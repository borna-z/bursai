# BURS Mobile — Launch Fix Plan (May 31, 2026)

**Goal:** Ship the React Native app to App Store + Play Store on May 31 with zero P1 fakes, real billing, push, account deletion, error telemetry, and complete iOS metadata.

**Scope:** `mobile/` only. Backend is read-only — all required edge functions (`delete_user_account`, `reset_style_memory`, `travel_capsule`, `send_push_notification`) already exist; per `mobile/CLAUDE.md` no new edge functions are added.

**Branch:** all PRs target `main`. (The earlier `feat/mobile-rn-app` launch-branch policy was retired 2026-05-06 per user direction.)

**Convention:** hooks mirror `mobile/src/hooks/useAddGarment.ts` style — `useAuth()` for user/session, `supabase` from `../lib/supabase`, edge functions via `fetch(\`${supabaseUrl}/functions/v1/<name>\`, ...)` with `Authorization: Bearer ${session.access_token}`. Tokens via `useTokens()`. No new design primitives — reuse existing `Eyebrow`, `PageTitle`, `Caption`, `Button`, `IconBtn`, `Chip`, `Card`, `SettingsRow`, `ListRow`, `BottomNav`.

---

## Critical Reframings vs the Original Spec

Three findings from this session's audit reshape the spec the user supplied:

1. **Three "new" edge functions already exist server-side.**
   - `supabase/functions/delete_user_account/index.ts` — full GDPR cascade, idempotency, rate limit. Mobile only needs the hook + UI.
   - `supabase/functions/reset_style_memory/index.ts` — atomic RPC + audit logs. Hook only.
   - `supabase/functions/travel_capsule/index.ts` (1235 lines) — pack-worthiness scoring, Gemini tool-use, deterministic fallback. Hook + screen wiring only.
   The plan below scopes those P1 items as **mobile-only** PRs.

2. **`avatars` bucket was deliberately removed** in `supabase/migrations/20260421124000_drop_profiles_avatar_path.sql`. The spec's P2.8 (avatar upload) **does not ship** — the bucket is gone, the column is dropped, the feature was deprecated. Action: remove the avatar-upload row from `SettingsAccountScreen` rather than wire it.

3. **Two unspec'd items are P1, not P2.** Sentry is not initialized in mobile (`@sentry/react-native` not imported anywhere) and `app.json` is missing iOS metadata required for App Store submission (ATT, privacy manifest, push capability, in-app-purchase capability). These become **P1.0** and **P1.0′** — they block submission, not just polish.

Three more findings worth stating up front:

4. **Six "blind spot" screens are mostly fine.** UnusedOutfits, UsedGarments, WardrobeGaps are production-ready. TravelCapsule wizard does not persist trip state across the three screens (route params are not threaded). NotificationsScreen FIXTURES is `[]` (empty placeholder, intentional). MonthCalendarScreen has a stale comment but real wiring.

5. **No new tables for inbox path.** A `notifications` table can be created via migration without a new edge function — direct `supabase.from('notifications').select()` with RLS.

6. **i18n is partially wired.** `mobile/src/lib/i18n.ts` exists; OnboardingScreen uses `tr()`. Settings + Profile do not. Locale files location not yet established. **Decision: defer broad i18n to v1.0.1.** Sweden launch tolerates English-only UI for v1.0; Swedish translation is a polish PR after submission.

---

# P1 — LAUNCH BLOCKERS (in dependency order)

PR ordering is a critical path. Items marked **(serial)** must finish before the next; **(parallel-OK)** can run alongside the serial chain.

### P1.0 — Sentry Integration **(serial — first PR)**

**Why first:** every subsequent PR adds error surfaces. Without Sentry, those surfaces ship blind. Two hours of work that retroactively makes every later PR observable.

**Files:**
- Modify: `mobile/App.tsx` (add Sentry init at top of file, wrap app in `ErrorBoundary`)
- Create: `mobile/src/lib/sentry.ts` (init helper + `captureMutationError` utility)
- Modify: `mobile/.env.example` (add `EXPO_PUBLIC_SENTRY_DSN`)
- Modify: `mobile/package.json` (add `@sentry/react-native`)
- Modify: `mobile/app.json` (add `@sentry/react-native/expo` to plugins)
- Modify: every existing mutation hook (`useAddGarment`, `useStyleChat`, `useMoodOutfit`, etc.) — add `onError: captureMutationError`

**`mobile/src/lib/sentry.ts` (new):**
```ts
// Sentry init for React Native via Expo. Called once from App.tsx, before any
// React tree mounts. DSN comes from EXPO_PUBLIC_SENTRY_DSN; absent in dev,
// present in EAS production builds via eas.json secrets. Sample rate 0.2 to
// match web (src/main.tsx).
import * as Sentry from '@sentry/react-native';

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (__DEV__) console.log('[sentry] no DSN — skipping init');
    return;
  }
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    debug: __DEV__,
    enableNative: !__DEV__, // skip native bridge in Expo Go
  });
}

// Drop-in onError handler for useMutation. Captures with mutation context.
export function captureMutationError(scope: string) {
  return (error: unknown) => {
    Sentry.withScope((s) => {
      s.setTag('mutation', scope);
      Sentry.captureException(error);
    });
  };
}

export { Sentry };
```

**`mobile/App.tsx` (additions, top of file):**
```ts
import { initSentry, Sentry } from './src/lib/sentry';
initSentry();

// Wrap default export
export default Sentry.wrap(App);
```

**Mutation hooks — pattern:**
```ts
// useAddGarment.ts (and every other mutation)
import { captureMutationError } from '../lib/sentry';

return useMutation({
  mutationFn: async (params) => { /* unchanged */ },
  onSuccess: () => { /* unchanged */ },
  onError: captureMutationError('useAddGarment'),
});
```

**Acceptance:**
- `cd mobile && npx tsc --noEmit` → 0 errors
- Test in dev with a forced throw inside `useAddGarment` mutationFn — verify the error appears in Sentry's project dashboard within 30s
- `grep -r "useMutation" mobile/src/hooks` shows `onError` on every match

**PR boundary:** one PR. Title: `feat(mobile): Sentry — error telemetry + onError handlers`.

**Complexity:** S.

---

### P1.0′ — App.json Metadata Completion **(parallel-OK)**

**Why:** App Store rejects on missing privacy manifest (iOS 17+), missing ATT description (if analytics/Sentry track), missing push capability, missing IAP capability. None of these are conditional — every iOS submission lists them.

**Files:**
- Modify: `mobile/app.json`

**Diff:**
```json
{
  "expo": {
    "name": "BURS",
    "slug": "burs",
    "scheme": "burs",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": { /* unchanged */ },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "me.burs.app",
      "buildNumber": "1",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false,
        "NSCameraUsageDescription": "BURS uses the camera to scan and add garments to your wardrobe.",
        "NSPhotoLibraryUsageDescription": "BURS reads images from your photo library to add garments.",
        "NSPhotoLibraryAddUsageDescription": "BURS saves outfit images to your photo library when you tap Save.",
        "NSLocationWhenInUseUsageDescription": "BURS uses your location to fetch local weather for outfit suggestions.",
        "NSUserTrackingUsageDescription": "Allow BURS to use limited diagnostics so we can fix crashes affecting your account.",
        "UIBackgroundModes": ["remote-notification"],
        "CFBundleURLTypes": [
          { "CFBundleURLSchemes": ["burs"] }
        ]
      },
      "associatedDomains": ["applinks:burs.me"],
      "entitlements": {
        "aps-environment": "production"
      }
    },
    "android": {
      "package": "me.burs.app",
      "versionCode": 1,
      "permissions": ["CAMERA", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "POST_NOTIFICATIONS"],
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [{ "scheme": "https", "host": "burs.me", "pathPrefix": "/" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "plugins": [
      "expo-font",
      "expo-localization",
      "expo-notifications",
      "expo-image-picker",
      "expo-tracking-transparency",
      ["@sentry/react-native/expo", { "organization": "burs", "project": "burs-mobile" }],
      ["expo-build-properties", {
        "ios": { "deploymentTarget": "15.1" },
        "android": { "minSdkVersion": 24 }
      }]
    ]
  }
}
```

**Bundle ID change rationale:** `burs.expo.build` is the placeholder Expo created. App Store Connect needs a real reverse-DNS — register `me.burs.app` in App Store Connect + Apple Developer portal before the first EAS build. Same for Android `me.burs.app` in Play Console.

**Required external tasks (user, not Claude):**
- [ ] Register App Store Connect app record with bundle `me.burs.app`
- [ ] Generate APNs auth key in Apple Developer → upload to RevenueCat (later) and Expo push service
- [ ] Create `PrivacyInfo.xcprivacy` data-collection disclosure (Sentry: crash logs / device ID; Supabase: email + user content; RevenueCat: purchase history / device ID)
- [ ] Add Privacy Policy URL `https://burs.me/privacy` and Marketing URL `https://burs.me` in App Store Connect

**Acceptance:**
- `eas build --platform ios --profile production` succeeds and produces an `.ipa`
- TestFlight upload accepted by App Store Connect with no missing-entitlement warnings

**PR boundary:** one PR for the `app.json` diff. The external tasks are user-side checkboxes tracked in the PR body.

**Complexity:** S (file diff) + M (external setup, user-side).

---

### P1.1 — Real Account Deletion **(serial after P1.0)**

**Background:** `supabase/functions/delete_user_account/index.ts` already does the GDPR cascade across 20+ tables and Storage. Mobile work = hook + UI replacement of the fake `Alert.alert('Account deletion requested')`.

**Files:**
- Create: `mobile/src/hooks/useDeleteAccount.ts`
- Modify: `mobile/src/screens/SettingsAccountScreen.tsx` (L150 area)
- Modify: `mobile/src/screens/SettingsPrivacyScreen.tsx` (L111 area)
- Modify: `mobile/src/contexts/AuthContext.tsx` (verify `signOut` is called after success — already exists per audit)

**`mobile/src/hooks/useDeleteAccount.ts` (new):**
```ts
// Calls the existing delete_user_account edge function and signs the user
// out on success. The server-side function does the full GDPR cascade
// (garments, outfits, wear_logs, planned_outfits, render_jobs, subscriptions,
// push_subscriptions, profiles, storage objects, auth.users) — mobile just
// invokes it. Two-step UX confirmation lives in the calling screen, not here.

import { useMutation } from '@tanstack/react-query';

import { supabase, supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';

interface DeleteAccountResponse {
  success: boolean;
  message: string;
}

export function useDeleteAccount() {
  const { session, signOut } = useAuth();

  return useMutation<DeleteAccountResponse, Error, void>({
    mutationFn: async () => {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const response = await fetch(`${supabaseUrl}/functions/v1/delete_user_account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          // Idempotency: if user double-taps confirm, the server-side
          // x-idempotency-key cache returns the original response instead of
          // attempting a second cascade.
          'x-idempotency-key': `delete-${session?.user?.id ?? 'unknown'}-${Date.now()}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`delete_user_account ${response.status}: ${text}`);
      }
      return (await response.json()) as DeleteAccountResponse;
    },
    onSuccess: async () => {
      // Sign out clears local session + queryClient. AuthContext's
      // SIGNED_OUT listener flushes AsyncStorage cache via Supabase's adapter.
      await signOut();
    },
    onError: captureMutationError('useDeleteAccount'),
  });
}
```

**Screen wiring — `SettingsAccountScreen.tsx`:**

Replace the L150 Alert chain with:
```tsx
import { useDeleteAccount } from '../hooks/useDeleteAccount';

const { mutate: deleteAccount, isPending: isDeleting } = useDeleteAccount();

const handleDeleteAccount = () => {
  Alert.alert(
    'Delete account',
    'This permanently removes your wardrobe, outfits, plans, style memory, and subscription. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Are you sure?',
            'Type DELETE in your head and tap Confirm to continue.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Confirm',
                style: 'destructive',
                onPress: () =>
                  deleteAccount(undefined, {
                    onError: (err) =>
                      Alert.alert('Could not delete account', err.message),
                  }),
              },
            ],
          );
        },
      },
    ],
  );
};

// Pass disabled={isDeleting} to the destructive row.
```

Replicate identically in `SettingsPrivacyScreen.tsx`. One hook, two call sites.

**Acceptance:**
- `cd mobile && npx tsc --noEmit` → 0 errors
- Manual test: create a throwaway test user → tap Delete → confirm → verify user is signed out, returns to AuthScreen, and `select count(*) from garments where user_id = '<test-id>'` is 0
- Sentry receives the error event if the network request fails

**PR boundary:** one PR. Title: `feat(mobile): real account deletion — useDeleteAccount + two-step confirm`.

**Complexity:** S.

---

### P1.2 — Privacy Policy + Terms Links **(parallel-OK)**

**Files:**
- Modify: `mobile/src/screens/SettingsPrivacyScreen.tsx` (L67 area — replace Alert with Linking)

**Diff:**
```tsx
import { Linking } from 'react-native';

// Replace L67 Alert.alert(...) with:
<SettingsRow
  label="Privacy policy"
  onPress={() => Linking.openURL('https://burs.me/privacy')}
  accessibilityLabel="Open privacy policy in browser"
/>
<SettingsRow
  label="Terms of service"
  onPress={() => Linking.openURL('https://burs.me/terms')}
  accessibilityLabel="Open terms of service in browser"
/>
```

**Acceptance:**
- Both URLs return 200 in a browser before merge (`curl -I https://burs.me/privacy` and `https://burs.me/terms`). If `/terms` does not yet exist on the web side, this PR is **blocked** until web adds it. Coordinate with web wave 11 (App Store launch wave already plans this).

**PR boundary:** one PR. Title: `feat(mobile): privacy + terms links → burs.me`.

**Complexity:** S.

---

### P1.3 — Real Password Reset + Deep Link **(parallel-OK)**

**Files:**
- Modify: `mobile/src/screens/ResetPasswordScreen.tsx` (L60 area — replace setTimeout)
- Modify: `mobile/src/RootNavigator.tsx` (add deep-link handler for `burs://reset-password`)
- Modify: `mobile/app.json` (already has `scheme: "burs"`; verify routes)
- Modify: `supabase/config.toml` and Supabase Auth dashboard — add `burs://reset-password` to allowed redirect URLs (user-side, not Claude)

**Hook approach:** inline mutation (one-shot, no caching needed).

**`ResetPasswordScreen.tsx` diff (replace the `setTimeout` block):**
```tsx
import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';

const handleSubmit = async () => {
  if (!isValidEmail(email)) {
    setError('Enter a valid email');
    return;
  }
  setIsSending(true);
  setError(null);
  try {
    const { error: rpcError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'burs://reset-password',
    });
    if (rpcError) throw rpcError;
    if (!isMounted.current) return;
    setSent(true);
  } catch (err) {
    Sentry.captureException(err);
    if (!isMounted.current) return;
    setError('Could not send reset email. Try again in a moment.');
  } finally {
    if (isMounted.current) setIsSending(false);
  }
};
```

**`RootNavigator.tsx` deep-link handler (additions):**
```tsx
import { Linking } from 'react-native';

const linking = {
  prefixes: ['burs://', 'https://burs.me'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      ShareOutfit: 'o/:id',
      // OAuth callback is already handled by the existing custom listener
      // around lines 234-256 — preserve that path.
    },
  },
};

// Pass to NavigationContainer:
<NavigationContainer linking={linking} theme={...}>
```

**ResetPasswordScreen** must accept the access_token from the deep-link URL fragment (Supabase's reset flow puts it in the hash — `burs://reset-password#access_token=...&refresh_token=...&type=recovery`). Add a `useEffect` that parses `route.params` (or `Linking.getInitialURL()` on cold start) and calls `supabase.auth.setSession({ access_token, refresh_token })` before showing the new-password form.

**Acceptance:**
- Manual test: tap "Forgot password" → enter test email → receive email → tap link in email on device → app opens to `ResetPasswordScreen` with the new-password form pre-authenticated → set new password → verify sign-in works with new password
- Sentry captures any thrown error

**PR boundary:** one PR. Title: `feat(mobile): real password reset + burs:// deep-link handler`.

**Complexity:** M.

---

### P1.4 — Travel Capsule End-to-End **(parallel-OK after P1.0)**

**Background:** `supabase/functions/travel_capsule/index.ts` exists. Web `src/hooks/useTravelCapsules.ts` exists with the right shape. Web table `travel_capsules` exists. Mobile work = hook port + thread route params + replace `GARMENT_FIXTURES` (TravelMustHavesScreen L38–54) and `SECTIONS` (TravelPackingListScreen L41–81) with real data.

**Files:**
- Create: `mobile/src/hooks/useTravelCapsules.ts`
- Create: `mobile/src/hooks/useGenerateTravelCapsule.ts`
- Modify: `mobile/src/screens/TravelCapsuleScreen.tsx` (thread state via navigation params)
- Modify: `mobile/src/screens/TravelMustHavesScreen.tsx` (replace fixtures with `useFlatGarments({ inLaundry: false })`, accept route params)
- Modify: `mobile/src/screens/TravelPackingListScreen.tsx` (read from generated capsule, accept route params)
- Modify: `mobile/src/RootNavigator.tsx` (extend route param types)

**`mobile/src/hooks/useTravelCapsules.ts` (new — port from web):**
```ts
// Port of src/hooks/useTravelCapsules.ts. CRUD over travel_capsules table.
// User-scoped via RLS (auth.uid() = user_id policies).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';

export interface TravelCapsule {
  id: string;
  user_id: string;
  destination: string;
  trip_type: string;
  start_date: string; // ISO
  end_date: string;
  duration_days: number;
  must_haves: { garmentIds: string[] } | null;
  packing_list: { sections: Array<{ category: string; items: Array<{ id: string; name: string }> }> } | null;
  weather_summary: { high: number; low: number; conditions: string } | null;
  created_at: string;
}

const KEY = (userId: string | undefined) => ['travel-capsules', userId];

export function useTravelCapsules() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: KEY(user?.id),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('travel_capsules')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TravelCapsule[];
    },
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: async (capsule: Omit<TravelCapsule, 'id' | 'user_id' | 'created_at'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('travel_capsules')
        .insert({ ...capsule, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as TravelCapsule;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(user?.id) }),
    onError: captureMutationError('useTravelCapsules.save'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('travel_capsules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(user?.id) }),
    onError: captureMutationError('useTravelCapsules.remove'),
  });

  return { capsules: list.data ?? [], isLoading: list.isLoading, save, remove };
}
```

**`mobile/src/hooks/useGenerateTravelCapsule.ts` (new):**
```ts
// One-shot mutation that calls the travel_capsule edge function. Server-side
// returns capsule_items, outfits, packing_list, coverage_gaps. We persist the
// result via useTravelCapsules.save in the same flow.

import { useMutation } from '@tanstack/react-query';

import { supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';

export interface GenerateTravelCapsuleInput {
  destination: string;
  trip_type: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  weather: { high: number; low: number; conditions: string };
  occasions: string[];
  luggage_type: 'carry_on' | 'checked' | 'no_limit';
  companions: string;
  style_preference: string;
  garment_selection: string[]; // garment IDs the user pre-selected as must-haves
  must_have_items: string[];
}

export interface TravelCapsuleResult {
  capsule_items: Array<{ garment_id: string; reasoning: string; pack_score: number }>;
  outfits: Array<{ name: string; garment_ids: string[]; occasion: string; reasoning: string }>;
  packing_list: Array<{ category: string; items: Array<{ id: string; name: string; checked: boolean }> }>;
  coverage_gaps: Array<{ category: string; reason: string }>;
  total_combinations: number;
  reasoning: string;
}

export function useGenerateTravelCapsule() {
  const { session } = useAuth();

  return useMutation<TravelCapsuleResult, Error, GenerateTravelCapsuleInput>({
    mutationFn: async (input) => {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const response = await fetch(`${supabaseUrl}/functions/v1/travel_capsule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(input),
      });

      if (response.status === 402) {
        // Subscription gate — caller surfaces paywall.
        throw new Error('subscription_required');
      }
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`travel_capsule ${response.status}: ${text}`);
      }
      return (await response.json()) as TravelCapsuleResult;
    },
    onError: captureMutationError('useGenerateTravelCapsule'),
  });
}
```

**Route param types — `RootNavigator.tsx`:**
```ts
export type RootStackParamList = {
  // ...
  TravelMustHaves: { destination: string; tripType: string; startDate: string; endDate: string; durationDays: number };
  TravelPackingList: {
    destination: string;
    tripType: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    mustHaveGarmentIds: string[];
  };
};
```

**Wiring diff — `TravelCapsuleScreen.tsx`** (replace L247-248 TODO):
```tsx
const handleNext = () => {
  hapticLight();
  navigation.navigate('TravelMustHaves', {
    destination,
    tripType,
    startDate: startDateIso,
    endDate: endDateIso,
    durationDays,
  });
};
```

**`TravelMustHavesScreen.tsx`** — delete `GARMENT_FIXTURES` (L38–54). Replace with:
```tsx
import { useFlatGarments } from '../hooks/useGarments';

const { garments: allGarments, isLoading } = useFlatGarments({ inLaundry: false });
const route = useRoute<RouteProp<RootStackParamList, 'TravelMustHaves'>>();
const { destination, tripType, startDate, endDate, durationDays } = route.params;

// Render `allGarments` instead of `GARMENT_FIXTURES`. Filter chips already
// work — they reference category, which is on Garment.

const handleNext = () => {
  navigation.navigate('TravelPackingList', {
    destination, tripType, startDate, endDate, durationDays,
    mustHaveGarmentIds: Array.from(selected),
  });
};
```

**`TravelPackingListScreen.tsx`** — delete `SECTIONS` (L41–81). On mount, fire `useGenerateTravelCapsule().mutate(...)` with route params + a fetched `weather` summary (use `useWeather` from web port — see P2.2). Render the result's `packing_list`. The `Share` button (L94) stays as Alert until v1.0.1 polish.

**Acceptance:**
- `cd mobile && npx tsc --noEmit` → 0 errors
- Manual test: open Travel from Plan → enter Lisbon, 5 days, beach → tap Next → verify TravelMustHaves shows real wardrobe garments → select 3 → tap Next → verify TravelPackingList shows AI-generated capsule (≥1 outfit, ≥3 packing categories)
- Subscription-gated case: free user without trial → expect paywall Alert on Generate

**PR boundary:** one PR (the wizard + hooks must ship together). Title: `feat(mobile): travel capsule end-to-end — useTravelCapsules + useGenerateTravelCapsule + thread wizard state`.

**Complexity:** L.

---

### P1.5 — RevenueCat + Mobile Subscription Gate **(parallel-OK after P1.0)**

**Critical path note:** RevenueCat product/dashboard setup is days of external work. Start the dashboard config in parallel with P1.0/P1.1/P1.2/P1.3/P1.4 — code work below is the easy part.

#### External setup (user, not Claude — track as PR checklist)

- [ ] App Store Connect → create products `burs_premium_monthly_119sek` (auto-renewable, 119 SEK/month) and `burs_premium_annual_899sek` (auto-renewable, 899 SEK/year) — must be in "Ready to Submit" status before TestFlight build can include them
- [ ] Google Play Console → create matching subscription products with the same identifiers
- [ ] RevenueCat dashboard → create app, link both store products to entitlement `premium`
- [ ] RevenueCat → set up webhook to `https://khvkwojtlkcvxjxztduj.supabase.co/functions/v1/revenuecat_webhook` (this function is the **one exception** to the no-new-edge-functions rule — reconciliation is required and has no parallel on web; gate with explicit user approval before writing it)
- [ ] Sandbox tester accounts (3 minimum) for App Store Connect and Play Console
- [ ] Add `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` and `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` to `mobile/.env.example` and EAS secrets

#### Code work

**Files:**
- Modify: `mobile/package.json` (add `react-native-purchases`)
- Create: `mobile/src/lib/revenuecat.ts` (init helper)
- Modify: `mobile/App.tsx` (init RevenueCat with user ID after AuthContext resolves)
- Modify: `mobile/src/contexts/AuthContext.tsx` (call `Purchases.logIn(userId)` on sign-in, `Purchases.logOut()` on sign-out)
- Create: `mobile/src/hooks/useSubscription.ts`
- Create: `mobile/src/hooks/usePurchaseSubscription.ts`
- Create: `mobile/src/hooks/useRestorePurchases.ts`
- Modify: `mobile/src/screens/PaywallScreen.tsx` (wire purchase + restore)
- Modify: `mobile/src/screens/StyleChatScreen.tsx`, `StyleMeScreen.tsx`, `MoodFlowScreen.tsx`, `OutfitGenerateScreen.tsx`, `WardrobeGapsScreen.tsx` — replace `error === 'subscription_required'` Alert.alert with `navigation.navigate('Paywall')` proactive routing
- (Conditional, with user OK) Create: `supabase/functions/revenuecat_webhook/index.ts`

**`mobile/src/lib/revenuecat.ts` (new):**
```ts
// Initializes RevenueCat once per app lifecycle. Called from App.tsx after
// auth resolves so the SDK can identify the user against their Supabase
// user.id (RevenueCat's app_user_id == user.id is the contract that the
// reconciliation webhook depends on).

import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

let initialized = false;

export function initRevenueCat() {
  if (initialized) return;
  const apiKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY,
  });
  if (!apiKey) {
    if (__DEV__) console.warn('[revenuecat] no API key — skipping init');
    return;
  }
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
  Purchases.configure({ apiKey });
  initialized = true;
}

export async function identifyUser(userId: string) {
  if (!initialized) return;
  await Purchases.logIn(userId);
}

export async function clearUser() {
  if (!initialized) return;
  await Purchases.logOut();
}

export { Purchases };
```

**`mobile/src/hooks/useSubscription.ts` (new — bridges RevenueCat SDK + Supabase row):**
```ts
// Subscription state for mobile. Truth source order:
//   1. Supabase subscriptions row (server reconciliation; what edge functions read)
//   2. RevenueCat customer info (immediate post-purchase signal before webhook lands)
// Both feed into the same `isPremium` boolean. Edge function gates only
// inspect (1); UI uses the OR of both so a freshly-purchased user sees
// premium-gated screens unblock the second the StoreKit transaction closes,
// not 30s later when the webhook reconciles.

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Purchases, { CustomerInfo } from 'react-native-purchases';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SubscriptionRow {
  id: string;
  user_id: string;
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'inactive';
  plan: 'monthly' | 'annual' | null;
  current_period_end: string | null;
  trial_end: string | null;
}

const KEY = (userId: string | undefined) => ['subscription', userId];

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rcInfo, setRcInfo] = useState<CustomerInfo | null>(null);

  // Source of truth for edge function gates — server-reconciled state.
  const supabaseQuery = useQuery({
    queryKey: KEY(user?.id),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as SubscriptionRow | null;
    },
    staleTime: 60_000,
  });

  // Live RevenueCat customer info — closes the post-purchase reconciliation gap.
  useEffect(() => {
    let cancelled = false;
    Purchases.getCustomerInfo()
      .then((info) => { if (!cancelled) setRcInfo(info); })
      .catch(() => { /* non-fatal — RC offline */ });

    const listener = (info: CustomerInfo) => {
      setRcInfo(info);
      // Bust the Supabase cache so it re-fetches the reconciled row.
      queryClient.invalidateQueries({ queryKey: KEY(user?.id) });
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [queryClient, user?.id]);

  const supabasePremium = supabaseQuery.data?.status === 'active' || supabaseQuery.data?.status === 'trialing';
  const rcPremium = !!rcInfo?.entitlements.active['premium'];

  return {
    subscription: supabaseQuery.data ?? null,
    plan: supabaseQuery.data?.plan ?? null,
    status: supabaseQuery.data?.status ?? 'inactive',
    isPremium: supabasePremium || rcPremium,
    rcCustomerInfo: rcInfo,
    refresh: () => queryClient.invalidateQueries({ queryKey: KEY(user?.id) }),
  };
}
```

**`mobile/src/hooks/usePurchaseSubscription.ts` (new):**
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Purchases, { PurchasesPackage } from 'react-native-purchases';

import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';

export function usePurchaseSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      const result = await Purchases.purchasePackage(pkg);
      return result; // { customerInfo, productIdentifier }
    },
    onSuccess: () => {
      // RevenueCat's customer-info listener will fire too, but we double-bust
      // here so any in-flight read sees fresh data.
      queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
    },
    onError: captureMutationError('usePurchaseSubscription'),
  });
}

export function useGetOfferings() {
  return useQuery({
    queryKey: ['rc-offerings'],
    queryFn: () => Purchases.getOfferings(),
    staleTime: 5 * 60_000,
  });
}
```

**`mobile/src/hooks/useRestorePurchases.ts` (new):**
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Purchases from 'react-native-purchases';

import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';

export function useRestorePurchases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => Purchases.restorePurchases(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] }),
    onError: captureMutationError('useRestorePurchases'),
  });
}
```

**Paywall screen wiring** (`PaywallScreen.tsx`): list the two RevenueCat packages from `useGetOfferings()`, show price + period from `pkg.product.priceString`, primary button calls `usePurchaseSubscription().mutate(pkg)`, secondary text-button calls `useRestorePurchases().mutate()`.

**Gate-point replacement pattern** (apply to StyleChatScreen, StyleMeScreen, MoodFlowScreen, OutfitGenerateScreen, WardrobeGapsScreen):
```tsx
// Before:
if (errorMessage === 'subscription_required') {
  Alert.alert('Premium required', 'Upgrade to continue.');
}

// After:
if (errorMessage === 'subscription_required') {
  navigation.navigate('Paywall', { source: 'StyleChat' }); // or appropriate screen name
}
```

**Pre-emptive paywall** — on screen mount, if `!useSubscription().isPremium`, navigate to Paywall before letting the user start an AI request. This matches the spec's "proactive paywall presentation" requirement and saves a wasted edge-function call.

**Acceptance:**
- `cd mobile && npx tsc --noEmit` → 0 errors
- Sandbox test on a real device (simulator does not support StoreKit purchases): create sandbox tester → tap Subscribe Monthly → complete sandbox purchase → verify `useSubscription().isPremium === true` within 2s → verify Style Chat unblocks → background app → verify subscription persists across cold start → tap Restore on a fresh install → verify subscription comes back
- Verify edge function gate: a free user without a Supabase `subscriptions` row hits `style_chat` and gets a 402 → mobile catches and routes to Paywall
- Verify reconciliation: complete a sandbox purchase → wait 30s → query Supabase `subscriptions` table → confirm a row exists with `status='active'` (this proves the RevenueCat → Supabase webhook landed; the webhook is the single new edge function)

**PR boundary:** **two PRs.**
- PR A — `feat(mobile): RevenueCat init + useSubscription + Paywall purchase flow` (no webhook; gate fallback uses RevenueCat customer info only)
- PR B — `feat(supabase): revenuecat_webhook for subscription reconciliation` (introduces the new edge function — explicit user approval required per CLAUDE.md hard rule)

**Complexity:** L (PR A) + M (PR B).

---

### P1.6 — Push Notifications **(parallel-OK after P1.0′)**

**Files:**
- Modify: `mobile/package.json` (add `expo-notifications`)
- Create: `mobile/src/hooks/usePushNotifications.ts`
- Modify: `mobile/App.tsx` (foreground + tap listeners + `Notifications.setNotificationHandler`)
- Modify: `mobile/src/screens/SettingsNotificationsScreen.tsx` (persist toggles + register/unregister token on master toggle)
- Create: `supabase/migrations/<timestamp>_push_subscriptions_expo_token.sql` — add `expo_push_token` column to `push_subscriptions` (nullable; existing rows are web push)
- Modify: `supabase/functions/send_push_notification/index.ts` — add Expo push branch alongside existing Web Push branch (this is a modification, not a new function — within the rules)

**Note on the spec's `profiles.push_token`:** the existing schema uses a separate `push_subscriptions` table (web push: endpoint, p256dh, auth columns). Mobile should add an Expo token column to that same table rather than introducing `profiles.push_token` — keeps the cleanup path on sign-out / account deletion uniform.

**Migration:**
```sql
-- 20260505120000_push_subscriptions_expo_token.sql
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS expo_push_token text,
  ADD COLUMN IF NOT EXISTS platform text CHECK (platform IN ('web', 'ios', 'android')) DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS device_id text;

CREATE INDEX IF NOT EXISTS push_subscriptions_expo_token_idx
  ON public.push_subscriptions (expo_push_token)
  WHERE expo_push_token IS NOT NULL;

-- Existing RLS policies cover the new columns (auth.uid() = user_id).
```

**`mobile/src/hooks/usePushNotifications.ts` (new):**
```ts
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Sentry } from '../lib/sentry';

interface PushState {
  permission: Notifications.PermissionStatus | null;
  isSubscribed: boolean;
  loading: boolean;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>({
    permission: null,
    isSubscribed: false,
    loading: true,
  });

  // Refresh permission + subscription state on mount and on user change.
  useEffect(() => {
    if (!user) {
      setState({ permission: null, isSubscribed: false, loading: false });
      return;
    }
    (async () => {
      const settings = await Notifications.getPermissionsAsync();
      const { data } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .not('expo_push_token', 'is', null)
        .maybeSingle();
      setState({
        permission: settings.status,
        isSubscribed: !!data,
        loading: false,
      });
    })().catch((err) => Sentry.captureException(err));
  }, [user]);

  const subscribe = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    if (!Device.isDevice) throw new Error('Push only works on physical devices');

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      setState((s) => ({ ...s, permission: status }));
      return false;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenResponse.data;
    const deviceId = Device.modelId ?? Device.osBuildId ?? 'unknown';

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          expo_push_token: expoPushToken,
          platform: Platform.OS as 'ios' | 'android',
          device_id: deviceId,
          // web-push columns null for native
          endpoint: null,
          p256dh: null,
          auth: null,
        },
        { onConflict: 'user_id,device_id' },
      );

    if (error) throw error;
    setState({ permission: 'granted', isSubscribed: true, loading: false });
    return true;
  }, [user]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    const deviceId = Device.modelId ?? Device.osBuildId ?? 'unknown';
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('device_id', deviceId);
    setState((s) => ({ ...s, isSubscribed: false }));
  }, [user]);

  return { ...state, subscribe, unsubscribe };
}
```

**`App.tsx` foreground handler additions:**
```ts
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// In App() useEffect:
useEffect(() => {
  const subForeground = Notifications.addNotificationReceivedListener(() => {});
  const subTap = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') Linking.openURL(url);
  });
  return () => {
    subForeground.remove();
    subTap.remove();
  };
}, []);
```

**Settings persistence — `SettingsNotificationsScreen.tsx`** (covers spec P2.1 in the same PR):
```ts
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';

const { profile, refreshProfile } = useProfile();
const prefs = (profile?.notification_prefs as Record<string, boolean>) ?? {};

const handleToggle = async (key: string, on: boolean) => {
  await supabase
    .from('profiles')
    .update({ notification_prefs: { ...prefs, [key]: on } })
    .eq('id', user.id);
  refreshProfile();
};
```

Add migration column:
```sql
-- 20260505121000_profiles_notification_prefs.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb DEFAULT '{}'::jsonb;
```

**`send_push_notification/index.ts` modifications:** add a branch reading rows where `expo_push_token IS NOT NULL` and POSTing to `https://exp.host/--/api/v2/push/send` with `[{ to: token, title, body, data: { url } }]`. Existing web-push branch remains untouched. Deploy after migration applies.

**Acceptance:**
- `cd mobile && npx tsc --noEmit` → 0 errors
- `npx supabase migration list --linked` shows both migrations as Local-only (will push on merge)
- Manual test on physical device: open Settings → Notifications → toggle Push on → grant permission → verify row in `push_subscriptions` has `expo_push_token` populated → fire `send_push_notification` from web admin → verify notification arrives in foreground (banner) and background (system tray)
- Tap notification while app backgrounded → app opens to URL in `data.url` (or home if missing)
- Sign out → verify push_subscriptions row is deleted (cascade from `delete_user_account` already covers this; the toggle does not delete on sign-out — only explicit unsubscribe does)

**PR boundary:** one PR. Title: `feat(mobile): push notifications — Expo token registration + foreground/background handlers + send_push_notification Expo branch`.

**Deploy command** (post-merge): `npx supabase db push --linked --yes && npx supabase functions deploy send_push_notification --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`.

**Complexity:** L.

---

### P1.7 — Reset Style Memory Hook **(parallel-OK)**

**Background:** `supabase/functions/reset_style_memory/index.ts` exists. Three identical fake Alerts in mobile.

**Files:**
- Create: `mobile/src/hooks/useResetStyleMemory.ts`
- Modify: `mobile/src/screens/SettingsScreen.tsx` (L156)
- Modify: `mobile/src/screens/SettingsPrivacyScreen.tsx` (L91)
- Modify: `mobile/src/screens/SettingsStyleScreen.tsx` (L130 area)

**`mobile/src/hooks/useResetStyleMemory.ts` (new):**
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';

export function useResetStyleMemory() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');
      const response = await fetch(`${supabaseUrl}/functions/v1/reset_style_memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`reset_style_memory ${response.status}: ${text}`);
      }
      return response.json() as Promise<{ ok: true; tables_cleared: Record<string, number> }>;
    },
    onSuccess: () => {
      // Bust everything that derives from style memory.
      queryClient.invalidateQueries({ queryKey: ['style-dna', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
    },
    onError: captureMutationError('useResetStyleMemory'),
  });
}
```

**Wiring (identical at all three call sites):**
```tsx
const { mutate: resetMemory, isPending } = useResetStyleMemory();

const handleResetStyleMemory = () => {
  Alert.alert(
    'Reset style memory',
    'BURS will forget your past outfit reactions and pairing preferences. Your wardrobe and outfits stay.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () =>
          resetMemory(undefined, {
            onSuccess: () => Alert.alert('Done', 'Style memory cleared.'),
            onError: (e) => Alert.alert('Could not reset', e.message),
          }),
      },
    ],
  );
};
```

**Acceptance:**
- Tap Reset → confirm → see "Done" → query Supabase: `select count(*) from feedback_signals where user_id = '<id>'` returns 0
- Tap Reset twice in quick succession → second invocation goes through (idempotent on server side)

**PR boundary:** one PR. Title: `feat(mobile): useResetStyleMemory — wire 3 settings call sites`.

**Complexity:** S.

---

### P1.8 — ShareOutfit: Hide for v1.0 **(parallel-OK, decision)**

**Decision:** **hide the Share entry point** until v1.0.1.

**Rationale:** real share-URL requires (a) `outfits.share_slug` column + unique index, (b) public web route at `https://burs.me/o/:slug` (web work, outside mobile/), (c) OG image generation (server work, outside mobile/), (d) mock URL goes to a 404 today — embarrassing on launch day. Cutting the feature is the brutal-but-correct call.

**Files:**
- Modify: `mobile/src/screens/OutfitDetailScreen.tsx` — remove or feature-flag the Share button
- Modify: `mobile/src/RootNavigator.tsx` — keep route registered but unreachable (deep-link handler still routes there for future-compat)

**Diff** (one place where outfit detail surfaces a share affordance):
```tsx
// Wrap the share button in a feature flag constant. v1.0.1 flips it.
const SHARE_OUTFIT_ENABLED = false;

{SHARE_OUTFIT_ENABLED && <ShareButton onPress={...} />}
```

**Acceptance:**
- Grep `mobile/src/screens` for any remaining navigation to `ShareOutfit` from a user-facing button — should return only the OutfitDetail line above (now hidden)
- TestFlight build: the Share button does not render on any outfit screen

**PR boundary:** trivial — fold into the next available housekeeping PR or P1.7. Title: `feat(mobile): hide ShareOutfit until v1.0.1`.

**Complexity:** S.

---

### P1.9 — Notifications Inbox: Hide for v1.0 **(parallel-OK, decision)**

**Decision:** **hide the Notifications nav entry** until v1.0.1.

**Rationale:** the inbox needs (a) a `notifications` table, (b) insert triggers from at least 5 sources (laundry reminders, style memory milestones, weekly digest, render-job completion, subscription state changes), (c) read-state, (d) deep-link fan-out per notification type. Push notifications (P1.6) cover the *real-time* alert path; the in-app inbox is a secondary surface that does not block launch. The empty-state risk is real — users see "No notifications yet" forever — so hiding is cleaner than shipping a perma-empty surface.

**Files:**
- Modify: `mobile/src/screens/HomeScreen.tsx` (or wherever the bell icon entry point lives — locate via grep) — remove the bell from the header
- Keep `NotificationsScreen.tsx` in the codebase + RootNavigator route — fastest path to v1.0.1 ship

**Acceptance:**
- Grep `mobile/src/screens` for `nav.navigate('Notifications')` — should return zero matches in user-facing UI

**PR boundary:** fold into the same housekeeping PR as P1.8. Title can extend: `feat(mobile): hide ShareOutfit + Notifications inbox for v1.0`.

**Complexity:** S.

---

### P1.10 — Style DNA + Real Wardrobe Stats **(parallel-OK)**

**Background:** web `src/hooks/useStyleDNA.ts` exists and is portable. Six surfaces today render hardcoded "Quiet luxe" / 142-38-186 stats: ProfileScreen L30/33/126/162-164, SettingsScreen L146, SettingsStyleScreen L24-26/L64.

**Files:**
- Create: `mobile/src/hooks/useStyleDNA.ts` (port of web hook)
- Create: `mobile/src/hooks/useWardrobeStats.ts` (new — three counts)
- Modify: `mobile/src/screens/ProfileScreen.tsx`
- Modify: `mobile/src/screens/SettingsScreen.tsx` (L146 Premium caption — also pulls from useSubscription)
- Modify: `mobile/src/screens/SettingsStyleScreen.tsx`

**`mobile/src/hooks/useStyleDNA.ts` (new):**
```ts
// Direct port of src/hooks/useStyleDNA.ts. Aggregates wear_logs + garment
// metadata into archetype + dominant colors + formality breakdown. Read-only.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface StyleDNA {
  archetypes: string[]; // e.g. ['Minimal', 'Editorial']
  formality: string;    // e.g. 'Smart casual'
  dominantColors: string[]; // hex or named
  totalWears: number;
}

export function useStyleDNA() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['style-dna', user?.id],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<StyleDNA | null> => {
      if (!user) return null;

      // Match web's two-table aggregation. The full algorithm lives in
      // src/hooks/useStyleDNA.ts — replicate exactly so web/mobile show the
      // same Style DNA for the same user.
      const [wearLogsRes, garmentsRes] = await Promise.all([
        supabase.from('wear_logs').select('garment_id, worn_at').eq('user_id', user.id),
        supabase.from('garments').select('id, formality, color_primary, style_archetypes').eq('user_id', user.id),
      ]);
      if (wearLogsRes.error) throw wearLogsRes.error;
      if (garmentsRes.error) throw garmentsRes.error;

      const wears = wearLogsRes.data ?? [];
      const garments = garmentsRes.data ?? [];
      if (garments.length === 0) return null;

      // Frequency-weighted archetype voting — same logic as web.
      const archetypeVotes = new Map<string, number>();
      const formalityVotes = new Map<string, number>();
      const colorVotes = new Map<string, number>();
      const wearsByGarment = new Map<string, number>();
      for (const w of wears) wearsByGarment.set(w.garment_id, (wearsByGarment.get(w.garment_id) ?? 0) + 1);

      for (const g of garments) {
        const weight = (wearsByGarment.get(g.id) ?? 0) + 1;
        for (const a of (g.style_archetypes ?? []) as string[]) {
          archetypeVotes.set(a, (archetypeVotes.get(a) ?? 0) + weight);
        }
        if (g.formality) formalityVotes.set(g.formality, (formalityVotes.get(g.formality) ?? 0) + weight);
        if (g.color_primary) colorVotes.set(g.color_primary, (colorVotes.get(g.color_primary) ?? 0) + weight);
      }

      const top = (m: Map<string, number>, n: number) =>
        Array.from(m.entries()).sort(([, a], [, b]) => b - a).slice(0, n).map(([k]) => k);

      return {
        archetypes: top(archetypeVotes, 3),
        formality: top(formalityVotes, 1)[0] ?? 'Smart casual',
        dominantColors: top(colorVotes, 5),
        totalWears: wears.length,
      };
    },
  });
}
```

**`mobile/src/hooks/useWardrobeStats.ts` (new):**
```ts
import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface WardrobeStats {
  garmentCount: number;
  outfitCount: number;
  wearCount: number;
}

export function useWardrobeStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wardrobe-stats', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<WardrobeStats> => {
      // HEAD count is cheap — three parallel ones beat a single aggregated query.
      const [g, o, w] = await Promise.all([
        supabase.from('garments').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('outfits').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('wear_logs').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
      ]);
      if (g.error) throw g.error;
      if (o.error) throw o.error;
      if (w.error) throw w.error;
      return {
        garmentCount: g.count ?? 0,
        outfitCount: o.count ?? 0,
        wearCount: w.count ?? 0,
      };
    },
  });
}
```

**ProfileScreen wiring:**
```tsx
import { useStyleDNA } from '../hooks/useStyleDNA';
import { useWardrobeStats } from '../hooks/useWardrobeStats';

const { data: dna } = useStyleDNA();
const { data: stats } = useWardrobeStats();

// L30/33: replace ARCHETYPES/CURRENT_FORMALITY const with dna?.archetypes ?? [] and dna?.formality ?? '—'
// L162-164: replace 142/38/186 with stats?.garmentCount / outfitCount / wearCount, default to '—' when undefined
```

**SettingsScreen L146 (Premium caption):**
```tsx
import { useSubscription } from '../hooks/useSubscription';

const { isPremium, plan, status } = useSubscription();
const trialDaysLeft = subscription?.trial_end
  ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / 86400000))
  : 0;

// caption logic:
// - isPremium && status === 'trialing' → `Premium · ${trialDaysLeft}-day trial`
// - isPremium && plan === 'monthly' → 'Premium · monthly'
// - isPremium && plan === 'annual' → 'Premium · annual'
// - !isPremium → 'Free'
```

**SettingsStyleScreen L24-26/L64:** same pattern as ProfileScreen, using `useStyleDNA`.

**Acceptance:**
- Empty wardrobe: dashes everywhere instead of fake numbers
- Real wardrobe with 5 garments: ProfileScreen shows "5 Garments"
- Subscription state shifts (manual: insert a row in `subscriptions` for the test user) → caption updates within 60s (staleTime)

**PR boundary:** one PR. Title: `feat(mobile): style DNA + real wardrobe stats — replace 6 hardcoded surfaces`.

**Complexity:** M.

---

# P2 — IMPORTANT (single bundled PR each, terser)

### P2.1 — SettingsNotifications persistence
**Already covered by P1.6** (the migration adds `profiles.notification_prefs`, the screen wires to the same column). Mark resolved when P1.6 ships.

### P2.2 — StyleMe weather wiring
Port `src/hooks/useWeather.ts` to `mobile/src/hooks/useWeather.ts` (uses the existing `weather` edge function — no new function). Use `expo-location` for device coords with permission gate. Replace L179 hardcoded weather; keep L184 "Adjust" hidden until v1.0.1 (P2.7 sweep).
**Files:** `mobile/src/hooks/useWeather.ts` (new), `StyleMeScreen.tsx`, `mobile/app.json` (already adds NSLocationWhenInUseUsageDescription in P1.0′).
**Acceptance:** real device shows local temp/conditions matching `https://api.openweathermap.org/...` for the device's coords.
**PR boundary:** one PR with P2.7. **Complexity:** M.

### P2.3 — EditGarment photo replacement
`expo-image-picker` (already added by P1.0′ plugin list). New mutation `useReplaceGarmentImage(garmentId, newUri)` that uploads via `mobile/src/lib/imageUpload.ts` (already exists), updates `garments.original_image_path`, deletes prior storage object, invalidates `['garment', id]` and `['garments']`.
**Files:** `mobile/src/hooks/useReplaceGarmentImage.ts` (new), `EditGarmentScreen.tsx` L331.
**Acceptance:** prior image is gone from storage (no orphaned objects); new image renders.
**PR boundary:** one PR. **Complexity:** M.

### P2.4 — Locale-aware decimal parser (Sweden launch blocker disguised as P2)
`EditGarmentScreen.tsx` L166. Replace `parseFloat` with a tiny helper:
```ts
function parsePrice(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
```
**Files:** `EditGarmentScreen.tsx` L166-170, `mobile/src/lib/parsePrice.ts` (new), `mobile/src/lib/__tests__/parsePrice.test.ts` (new — vitest or jest-expo, pick whichever the repo settles on).
**Acceptance:** `12,50`, `12.50`, `12,5`, `0` all parse correctly; `12,50,5`, `abc`, `-3` return null.
**PR boundary:** fold with P2.3 if convenient. **Complexity:** S.

### P2.5 — ProfileScreen real refetch
Replace `useMockRefresh(600)` with parallel refetch of `useProfile`, `useStyleDNA`, `useWardrobeStats`.
**Files:** `ProfileScreen.tsx` L40 area.
**Acceptance:** pull-to-refresh actually invalidates. **Complexity:** S.

### P2.6 — Stale comment cleanup
Delete L1-6 of `MonthCalendarScreen.tsx`. Trivial.
**Complexity:** S.

### P2.7 — Coming-soon row sweep
Hide every `Alert.alert('Coming soon', ...)` row that the matching P1/P2 doesn't already implement. Survivors after the sweep:
- StyleChatScreen L205 (memory edit) — hide
- TravelPackingListScreen L94 (share) — hide button (Travel wizard already ships in P1.4 without it)
- SettingsAccountScreen L77 (avatar — bucket dropped) — **delete the row entirely**, not just hide
- SettingsAccountScreen L125 (Google sign-in) — hide
- SettingsStyleScreen L112 (style words) — hide
- SettingsStyleScreen L120 (color prefs) — hide
- StyleMeScreen L184 (weather adjust) — hide (P2.2 implements only the read path)
**Files:** every screen above.
**Acceptance:** zero `'Coming soon'` strings remain in `mobile/src/screens/`.
**PR boundary:** one PR. **Complexity:** S.

### P2.8 — DROPPED (avatars bucket removed; not implementing).

### P2.9 — Wardrobe screen avatar initial + Wishlist
- Initial: `useAuth().profile?.display_name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? '?'`
- Wishlist: hide the tile until v1.0.1 (P2.7 covers this if the row uses Alert.alert).
**Files:** `WardrobeScreen.tsx`. **Complexity:** S.

### P2.10 — `grant_trial_gift` parity check
Before launch: read web's `src/pages/Onboarding/AchievementStep.tsx` and verify whether it calls `grant_trial_gift`. If yes, the trial-on-completion flow needs porting to mobile's `OnboardingScreen.tsx`. If no (web is also moving to RevenueCat-driven trial), no port needed — RevenueCat's introductory offer covers the trial. **Action: confirm with one grep, then either port the call or close this item with a tracker note.**
**Complexity:** S investigation; possibly M port.

---

# P3 — NICE TO HAVE (one polish PR, post-launch ok)

| ID | Item | Hook to port | File |
|----|------|---|------|
| P3.1 | GarmentDetail Outfits tab | `useGarmentOutfitHistory` (web exists) | `GarmentDetailScreen.tsx` |
| P3.2 | GarmentDetail Similar tab | `useSimilarGarments` (web exists) | `GarmentDetailScreen.tsx` |
| P3.3 | StyleChat real memory facts | new `useStyleMemoryFacts` reading `user_style_summaries` | `StyleChatScreen.tsx` L58-62 |
| P3.4 | StyleChat memory inline edit | calls `memory_ingest` (port web hook) | `StyleChatScreen.tsx` L205 |
| P3.5 | ShareOutfit save image | `expo-media-library` + `react-native-view-shot` | `ShareOutfitScreen.tsx` |
| P3.6 | Day summary | `useDaySummary` web port (note: depends on calendar/forecast hooks too) | `HomeScreen.tsx` |
| P3.7 | Photo feedback / signals | `useFeedbackSignals` + `usePhotoFeedback` | OutfitDetailScreen reactions |
| P3.8 | Duplicate detection | `useDuplicateDetection` web port | AddPieceStep3 |
| P3.9 | Render job polling | confirm `useAddGarment` already chains; if not, port `useRenderJobStatus` | AddGarment flow |

**PR boundary:** one big "v1.0.1 polish" PR after launch. Or fold individual items into Wave 9.5+ launch plan prompts.

---

# Risks Surfaced Beyond the Top-3

### R4 — Sentry not initialized — **Critical**
**Where:** absent from `mobile/App.tsx`, `mobile/src/`. Verified by grep returning zero `@sentry/react-native` matches.
**Failure:** every crash, network failure, mutation onError ships blind. Post-launch diagnostics depend entirely on user bug reports.
**Fix:** P1.0.
**Lives in:** P1.

### R5 — App.json missing iOS metadata — **Critical**
**Where:** `mobile/app.json` L19-22 (only `ITSAppUsesNonExemptEncryption` set). Missing privacy manifest, push capability, IAP entitlement, ATT description, CFBundleURLTypes scheme registration, associated domains.
**Failure:** App Store first-submission rejection.
**Fix:** P1.0′.
**Lives in:** P1.

### R6 — Mutation `onError` handlers missing — **High**
**Where:** every existing hook in `mobile/src/hooks/`. None have `onError`.
**Failure:** errors stored in React Query state, never reported, never shown in UI consistently.
**Fix:** P1.0 adds `captureMutationError(scope)` to every existing mutation in the same PR.
**Lives in:** P1 (within P1.0).

### R7 — No screen-level lazy loading — **Medium**
**Where:** `mobile/src/RootNavigator.tsx` L14-52 — 30+ screens eagerly imported.
**Failure:** cold-start parses entire JS bundle. Acceptable on modern devices (~1s cold start), poor on low-end Android.
**Fix:** wrap each non-tab screen in `React.lazy(() => import('../screens/X'))` after Sentry+billing PRs are merged. Defer to v1.0.1 polish PR — risk of bundler regressions during pre-launch crunch outweighs benefit.
**Lives in:** post-launch hardening, **NOT P1**.

### R8 — iOS Universal Links / Android App Links not configured — **Medium**
**Where:** `mobile/app.json` — no `associatedDomains` (iOS) or verified `intentFilters` (Android) for `https://burs.me`.
**Failure:** users tapping `https://burs.me/o/<slug>` in Mail, Slack, etc. land on the website instead of the app. Spoofable `burs://` scheme on Android.
**Fix:** P1.0′ adds the config. Web side also needs `apple-app-site-association` and `assetlinks.json` files at `https://burs.me/.well-known/`. Latter is a separate web PR — track.
**Lives in:** P1 (P1.0′ for app.json; web side as a launch-readiness checklist item).

### R9 — Onboarding AsyncStorage state — no TTL — **Low**
**Where:** `mobile/src/screens/OnboardingScreen.tsx` L49-51.
**Failure:** stale onboarding state lingers forever on uninstall/reinstall. Small payload, not exploitable.
**Fix:** clear key on `SIGNED_IN` event in AuthContext (~5 lines). Defer to v1.0.1.
**Lives in:** post-launch polish.

### R10 — RevenueCat user identity reset on sign-out — **Medium**
**Where:** `mobile/src/contexts/AuthContext.tsx` `signOut` — does not call `Purchases.logOut()`.
**Failure:** if user A signs out and user B signs in on the same device, user B's purchase queries return user A's entitlements until next app reload.
**Fix:** in P1.5, AuthContext modification adds `await Purchases.logOut()` to `signOut` and `await Purchases.logIn(userId)` to `SIGNED_IN` listener.
**Lives in:** P1.5.

### R11 — Settings/Profile screens hardcoded English — **Medium**
**Where:** `SettingsScreen.tsx`, `SettingsAppearanceScreen.tsx`, etc. Each shows `<Eyebrow>Account</Eyebrow>` style hardcoded copy.
**Failure:** Sweden launch markets to Swedish-speaking users in English-only UI. Trust impact, not rejection.
**Fix:** wrap in `tr('settings.account')` etc. + add `mobile/src/i18n/locales/{en,sv}.ts`. **Defer to v1.0.1.**
**Lives in:** v1.0.1.

### R12 — Accessibility coverage incomplete — **Medium**
**Where:** `MonthCalendarScreen.tsx` (6% of date cells labeled), `AuthScreen` (50%), `InsightsScreen` (67%).
**Failure:** Apple's review may flag for 1.0 submission. Not an automatic reject but prompts a "next time" warning.
**Fix:** sweep PR adding `accessibilityRole`/`accessibilityLabel` to all `Pressable` components. **Schedule for the week of May 19** as a single targeted sweep.
**Lives in:** P3-adjacent — bundle into P2.7 sweep PR.

### R13 — service_role policies on `job_queue` / `user_style_*` — **Low (intentional)**
**Where:** `supabase/migrations/00000000000000_initial_schema.sql:1986-1990`, `20260501120000_user_style_summaries_and_memory_ingest.sql:66`.
**Failure:** none — JWT clients never execute as service_role. Confirmed intentional for cron-driven batch ops.
**Fix:** none. Document and close.

### R14 — `analyze_garment` no fallback provider — **Medium**
**Where:** `supabase/functions/analyze_garment/index.ts`.
**Failure:** Gemini outage = blank Step 2 in Add Garment flow. The user types a title manually and saves with empty AI metadata; later enrichment kicks in via cron.
**Fix:** **acceptable for launch**. Track as Wave 10 hardening. The current behavior degrades gracefully (no crash; user can still save).
**Lives in:** post-launch.

### R15 — RevenueCat → Supabase reconciliation requires NEW edge function — **Medium**
**Where:** would land in `supabase/functions/revenuecat_webhook/index.ts`.
**Failure:** without it, the `subscriptions` table never reflects mobile purchases → edge function gates lock premium users out.
**Fix:** **explicit user approval required** before writing this function (it's the one exception to the "no new edge functions" rule). Skeleton template included in P1.5 PR B.
**Lives in:** P1.5 PR B.

---

# Sprint Plan — May 4 → May 31

**Working assumptions:** solo dev (user) with Claude Code, agent-driven implementation, code-reviewer + Codex loop on every PR. ~3 weeks = 27 days.

### Critical Path

```
Day 1-2  ─► P1.0 Sentry            ─┐
Day 1-2  ─► P1.0' app.json         ─┤
                                     ├─► Day 3-7  ─► P1.5 RevenueCat (PR A: code; external setup runs in background)
Day 3-4  ─► P1.1 Delete account    ─┘                Day 7-9    ─► P1.5 PR B revenuecat_webhook
Day 3    ─► P1.2 Privacy/Terms                       Day 8-10   ─► P1.6 Push notifications
Day 4-5  ─► P1.3 Reset password                      Day 10-13  ─► P1.4 Travel capsule e2e
Day 5    ─► P1.7 Reset style memory                  Day 13-15  ─► P1.10 Style DNA + stats
Day 5    ─► P1.8 + P1.9 Hide ShareOutfit + Inbox

                                    Day 15-17  ─► P2.2 + P2.3 + P2.4 + P2.6 + P2.7 (one PR sweep)
                                    Day 17-19  ─► P2.5 + P2.9 + P2.10 + a11y sweep
                                    Day 19-21  ─► TestFlight build #1 — internal testing
                                    Day 22-24  ─► Bug fix burndown from TestFlight #1
                                    Day 25-26  ─► TestFlight build #2 — external testers
                                    Day 27-28  ─► Bug fix burndown from TestFlight #2
                                    Day 28     ─► App Store submission (May 31)
```

### Parallel Streams (can run alongside critical path)

| Stream | Owner | Days |
|---|---|---|
| App Store Connect product setup | User | Day 1-3 |
| RevenueCat dashboard setup | User | Day 1-3 |
| Privacy Policy + Terms pages on burs.me | User (or web wave 11 prompt) | Day 1-5 |
| Apple Developer + Play Console capabilities | User | Day 1-2 |
| `apple-app-site-association` + `assetlinks.json` on burs.me | User (web side) | Day 5-7 |
| RevenueCat sandbox tester provisioning | User | Day 5 |

### TestFlight Cut Decision

**TestFlight build #1 cuts on Day 19** — once P1.0 through P1.10 + P2.7 sweep are merged.

**Why Day 19, not earlier:** Apple sandbox StoreKit purchases require a TestFlight build to verify reliably. Subscription edge cases (renewal, cancellation, restore on second device, family sharing) are the highest-risk surface and need 5+ days of real testing across 3 sandbox accounts.

**Why Day 19, not later:** Apple review averages 24-48 hours but can stretch to 7 days. Submitting on Day 28 leaves 3 days of slack before May 31. Don't cut tighter — first-time submissions get rejected ~30% of the time.

### What Gets Cut from v1.0 (ships in v1.0.1)

| Cut | Why | Reschedule to |
|---|---|---|
| ShareOutfitScreen real flow (P1.8) | Web-side coordination + OG generation | v1.0.1 |
| Notifications inbox (P1.9) | Multi-source notification table + triggers | v1.0.1 |
| StyleChat memory edit (P3.4) | Polish, not blocker | v1.0.1 |
| GarmentDetail Outfits/Similar tabs (P3.1, P3.2) | Polish, not blocker | v1.0.1 |
| Day summary on Home (P3.6) | Multi-hook port (calendar, forecast) | v1.0.1 |
| i18n Swedish locale | v1.0 ships English-only | v1.0.1 |
| Screen-level lazy loading (R7) | Bundler regression risk during crunch | v1.0.1 |
| Photo feedback / signals (P3.7) | Learning loop polish | v1.0.1 |

### What Cannot Slip from v1.0 (App Store rejects without these)

1. **P1.0** Sentry (or App Store accepts a build with no crash reporting? Yes — but launching without it is operationally untenable; treat as non-negotiable internal blocker)
2. **P1.0′** app.json privacy manifest + capabilities — **hard reject** without privacy manifest on iOS 17+
3. **P1.1** Real account deletion — **hard reject** under 5.1.1(v)
4. **P1.2** Privacy + Terms links functional — **hard reject** without these
5. **P1.5** RevenueCat purchase + restore working — **hard reject** if app contains paywall but purchases fail in sandbox
6. **P1.6** Push notification capability declared and functional — **hard reject** if `aps-environment` is set without functional registration

Items 3-6 collectively map to ~7 dev days of work plus 5 days of external setup. Critical path defends them.

### Risk Reserve

Days 22-28 contain ~7 days of explicit reserve for TestFlight bug fixes, App Store rejection iterations, and unforeseen issues. If the critical path ships on schedule (Day 19 cut), this is comfortable. If P1.5 RevenueCat slips by 3 days (RealiCat dashboard delays, sandbox tester issues), reserve drops to 4 days — still acceptable. If P1.5 slips by 6+ days, push submission to **June 7** and accept a 1-week launch delay rather than ship a broken billing flow.

---

# Appendix — Findings to Add to `docs/launch/findings-log.md`

Add these rows under "Wave 9 Pre-Launch Audit — Mobile" heading at top of file:

| Date | Prompt | Location | Description | Action |
|------|--------|----------|-------------|--------|
| 2026-05-04 | Mobile P1 audit | mobile/App.tsx | Sentry not initialized — every error ships blind | Track for: P1.0 |
| 2026-05-04 | Mobile P1 audit | mobile/app.json | Missing privacy manifest, push, IAP entitlement, ATT, CFBundleURLTypes, associatedDomains | Track for: P1.0′ |
| 2026-05-04 | Mobile P1 audit | mobile/src/hooks/* | All mutations missing onError handlers | Track for: P1.0 |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/SettingsAccountScreen.tsx L150, SettingsPrivacyScreen.tsx L111 | Account deletion is fake Alert with no server call | Track for: P1.1 |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/SettingsPrivacyScreen.tsx L67 | Privacy/Terms link Alert instead of Linking.openURL | Track for: P1.2 |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/ResetPasswordScreen.tsx L60 | 700ms setTimeout instead of supabase.auth.resetPasswordForEmail | Track for: P1.3 |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/TravelMustHavesScreen.tsx L38-54 | GARMENT_FIXTURES instead of useFlatGarments | Track for: P1.4 |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/TravelPackingListScreen.tsx L41-81 | SECTIONS hardcoded packing list | Track for: P1.4 |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/TravelCapsuleScreen.tsx L247-248 | Trip state not threaded across wizard | Track for: P1.4 |
| 2026-05-04 | Mobile P1 audit | mobile/src/hooks/useSubscription.ts | Missing — no mobile billing path | Track for: P1.5 |
| 2026-05-04 | Mobile P1 audit | mobile/src/hooks/usePushNotifications.ts | Missing — no Expo push registration | Track for: P1.6 |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/Settings*.tsx (3 files) | Reset style memory fake Alert in 3 call sites | Track for: P1.7 |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/ShareOutfitScreen.tsx | Mock https://burs.me/o/mock URL | Track for: P1.8 (hide for v1.0) |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/NotificationsScreen.tsx L45 | FIXTURES = [] empty placeholder | Track for: P1.9 (hide for v1.0) |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/ProfileScreen.tsx + 5 others | Hardcoded 142/38/186 + Quiet luxe + Smart casual | Track for: P1.10 |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/SettingsAccountScreen.tsx L77 | Avatar upload row — bucket was dropped 2026-04-21 | Track for: P2.7 (delete row) |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/MonthCalendarScreen.tsx L1-6 | Stale "mock-data only" comment | Track for: P2.6 |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/EditGarmentScreen.tsx L166 | Locale-aware decimal parser missing (Sweden) | Track for: P2.4 |
| 2026-05-04 | Mobile P1 audit | mobile/src/screens/* | ~7 hardcoded English strings in Settings/Profile | Track for: v1.0.1 i18n sweep |

---

**End of plan. Total: 12 P1 PRs, 7 P2 items in 2 PRs, 1 v1.0.1 polish PR. ~19 days of focused work + 5 days of external setup + 7 days of TestFlight burndown = May 31 submission realistic with a 3-day reserve.**
