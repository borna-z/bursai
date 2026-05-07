// M30 — Push notifications.
//
// Three exports:
//   • useRegisterPushToken — mutation that requests OS permissions, fetches an
//     Expo Push token, and upserts a row in `push_subscriptions` keyed on
//     (user_id, expo_token) with `provider = 'expo'`.
//   • useNotificationPrefs — query that reads `profiles.notification_prefs`,
//     defensively parsed at the boundary.
//   • useUpdateNotificationPrefs — mutation that merges sibling pref keys
//     (canonical read-modify-write merge from M24/M25/M29) with optimistic
//     update + rollback on error.
//
// Web uses VAPID web push; mobile uses Expo Push (APNs/FCM under the hood).
// Schema columns added in `20260507120000_push_provider_columns.sql` —
// `provider` ('web' | 'expo') + `expo_token`. The send_push_notification
// edge function branches on `provider` to pick the right transport.
//
// Live APNs verification waits on M43 (Apple Developer setup); the code paths
// land now so the user can wire the dev build immediately when the cert is
// ready.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { captureMutationError } from '../lib/sentry';

// ─── Notification preferences ───────────────────────────────────────────

export type NotificationPrefKey = 'daily' | 'new_outfit' | 'reminders';

export interface NotificationPrefs {
  daily: boolean;
  new_outfit: boolean;
  reminders: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  daily: true,
  new_outfit: true,
  reminders: true,
};

/**
 * Defensive parser for `profiles.notification_prefs`. Anything malformed
 * (missing key, wrong type, NULL column on a legacy row) downgrades to the
 * default-on shape so the screen always renders sane state.
 */
export function parseNotificationPrefs(value: unknown): NotificationPrefs {
  if (!value || typeof value !== 'object') return { ...DEFAULT_NOTIFICATION_PREFS };
  const obj = value as Record<string, unknown>;
  return {
    daily: typeof obj.daily === 'boolean' ? obj.daily : DEFAULT_NOTIFICATION_PREFS.daily,
    new_outfit:
      typeof obj.new_outfit === 'boolean'
        ? obj.new_outfit
        : DEFAULT_NOTIFICATION_PREFS.new_outfit,
    reminders:
      typeof obj.reminders === 'boolean'
        ? obj.reminders
        : DEFAULT_NOTIFICATION_PREFS.reminders,
  };
}

// ─── Expo project id resolution ─────────────────────────────────────────

/**
 * Resolve the EAS project id required by `getExpoPushTokenAsync`. Reads from
 * Expo's runtime constants in priority order:
 *   1. `expoConfig.extra.eas.projectId` — bare workflow / EAS-managed
 *   2. `easConfig.projectId` — legacy fallback for older Expo SDKs
 *
 * Returns `null` when neither is populated (Expo Go without an EAS project,
 * or a misconfigured build); the caller short-circuits the registration in
 * that case.
 */
function resolveExpoProjectId(): string | null {
  const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof fromExpoConfig === 'string' && fromExpoConfig.length > 0) {
    return fromExpoConfig;
  }
  // `easConfig` is deprecated but still populated on some SDK channels —
  // keep it as a fallback so a partially-migrated app.json doesn't break
  // token registration.
  const easConfig = (Constants as { easConfig?: { projectId?: string } }).easConfig;
  if (typeof easConfig?.projectId === 'string' && easConfig.projectId.length > 0) {
    return easConfig.projectId;
  }
  return null;
}

// ─── useRegisterPushToken ───────────────────────────────────────────────

export interface RegisterPushTokenResult {
  /** True when an Expo token was obtained and persisted. */
  registered: boolean;
  /** The token string when `registered`, otherwise null. */
  token: string | null;
  /** Final permission status after the request flow. */
  status: Notifications.PermissionStatus;
  /** Reason for a non-registered outcome (denied / unsupported / no project id / no user). */
  reason?: 'denied' | 'unsupported' | 'no_project_id' | 'no_user';
}

/**
 * Mutation hook — call once per app session after auth resolves to register
 * the device for push. Idempotent: re-running upserts on (user_id, expo_token)
 * so a token rotation creates a new row but a re-run with the same token is a
 * no-op.
 *
 * Permissions:
 *   • `Notifications.getPermissionsAsync()` first — if already granted, skip
 *     the prompt (re-prompting on every launch trains users to deny).
 *   • Otherwise `requestPermissionsAsync()`.
 *
 * Simulator / web fallback: `Device.isDevice` is false in iOS simulator and
 * web; `getExpoPushTokenAsync` would throw. Short-circuit with `unsupported`.
 */
export function useRegisterPushToken() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<RegisterPushTokenResult, Error, void>({
    mutationFn: async (): Promise<RegisterPushTokenResult> => {
      if (!user) {
        return {
          registered: false,
          token: null,
          status: Notifications.PermissionStatus.UNDETERMINED,
          reason: 'no_user',
        };
      }

      // Push only works on a physical device — simulator + web bail. We
      // still resolve the permission status (best-effort) so Settings UI
      // can read the same query.
      if (!Device.isDevice) {
        const existing = await Notifications.getPermissionsAsync();
        return {
          registered: false,
          token: null,
          status: existing.status,
          reason: 'unsupported',
        };
      }

      // Permission negotiation — read first, prompt only when undetermined.
      // iOS provisional grants surface in the top-level `status` field as
      // `GRANTED` already (with `ios.status === IosAuthorizationStatus.
      // PROVISIONAL` carrying the quiet-delivery bit on the side), so the
      // canonical `=== GRANTED` check below already accepts them — no
      // extra branching is needed. (Reviewer A on PR #763 caught the
      // earlier defensive isAllowed helper as dead code.)
      const existing = await Notifications.getPermissionsAsync();
      let finalStatus = existing.status;
      if (existing.status !== Notifications.PermissionStatus.GRANTED) {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
      }
      if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
        return { registered: false, token: null, status: finalStatus, reason: 'denied' };
      }

      const projectId = resolveExpoProjectId();
      if (!projectId) {
        return {
          registered: false,
          token: null,
          status: finalStatus,
          reason: 'no_project_id',
        };
      }

      const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenResult.data;

      // Upsert keyed on (user_id, expo_token) — a token rotation makes a new
      // row; a re-registration with the same token is a no-op. We never
      // populate the VAPID columns (`endpoint` / `p256dh` / `auth`) for an
      // Expo row — the schema migration left them nullable.
      //
      // `endpoint` exists on the table as NOT NULL legacy from the VAPID
      // shape — we mirror the token into it so the column stays populated
      // for Expo rows too. Treating `endpoint` as "the unique transport
      // identifier for this subscription, regardless of provider" keeps the
      // existing UNIQUE-on-endpoint expectations intact even though there's
      // no formal unique index.
      const { error: upsertError } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          provider: 'expo',
          expo_token: token,
          endpoint: token,
        },
        { onConflict: 'user_id,endpoint' },
      );
      if (upsertError) throw upsertError;

      return { registered: true, token, status: finalStatus };
    },
    onError: captureMutationError('useRegisterPushToken'),
    onSuccess: (result) => {
      // Bump the cached permission status so any Settings UI reading it
      // doesn't have to refetch.
      queryClient.setQueryData(['notificationPermission'], result.status);
    },
  });
}

// ─── useNotificationPrefs ───────────────────────────────────────────────

/**
 * Reader — returns the user's `profiles.notification_prefs` blob, defensively
 * parsed. Defaults to all-on when the column is NULL or malformed.
 */
export function useNotificationPrefs() {
  const { user } = useAuth();

  return useQuery<NotificationPrefs, Error>({
    queryKey: ['notificationPrefs', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<NotificationPrefs> => {
      if (!user) return { ...DEFAULT_NOTIFICATION_PREFS };
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_prefs')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      const raw = (data?.notification_prefs ?? null) as unknown;
      return parseNotificationPrefs(raw);
    },
  });
}

// ─── useUpdateNotificationPrefs ─────────────────────────────────────────

/**
 * Writer — toggles a single pref key. Optimistic update + rollback on error,
 * canonical merge pattern from M24/M25/M29: read the current row, merge in
 * the new key, write the whole jsonb back. Sibling keys are preserved
 * verbatim so a future pref addition that lands on the column ahead of the
 * client (server-side migration) survives a write.
 */
export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<
    NotificationPrefs,
    Error,
    { key: NotificationPrefKey; value: boolean },
    { previous: NotificationPrefs | undefined }
  >({
    mutationFn: async ({ key, value }) => {
      if (!user) throw new Error('Not authenticated');

      // Read-modify-write — re-fetch so a concurrent edit elsewhere on the
      // device doesn't get clobbered. The screen is single-active so the
      // concurrent-edit risk is low; the merge protects against future
      // server-side pref additions.
      const { data: existing, error: readError } = await supabase
        .from('profiles')
        .select('notification_prefs')
        .eq('id', user.id)
        .maybeSingle();
      if (readError) throw readError;

      const current = parseNotificationPrefs(
        (existing?.notification_prefs ?? null) as unknown,
      );
      const next: NotificationPrefs = { ...current, [key]: value };

      const { error: writeError } = await supabase
        .from('profiles')
        .update({ notification_prefs: next })
        .eq('id', user.id);
      if (writeError) throw writeError;

      return next;
    },
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey: ['notificationPrefs', user?.id] });
      const previous = queryClient.getQueryData<NotificationPrefs>([
        'notificationPrefs',
        user?.id,
      ]);
      const base = previous ?? { ...DEFAULT_NOTIFICATION_PREFS };
      const optimistic: NotificationPrefs = { ...base, [key]: value };
      queryClient.setQueryData(['notificationPrefs', user?.id], optimistic);
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(
          ['notificationPrefs', user?.id],
          context.previous,
        );
      }
      captureMutationError('useUpdateNotificationPrefs')(err);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['notificationPrefs', user?.id], data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPrefs', user?.id] });
    },
  });
}
