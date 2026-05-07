// M30 — Push notifications + Expo send branch.
//
// Branches on `push_subscriptions.provider`:
//   • 'web'  → existing VAPID web push flow (unchanged for web users).
//   • 'expo' → POSTs to https://exp.host/--/api/v2/push/send. Expo's REST
//             endpoint accepts unsigned pushes for the free tier — no auth
//             header required. Production volume should consider Expo's
//             access-token flow, but launch-day mobile traffic stays under
//             the free-tier limits.
//
// Per-row error handling: a 4xx / rate-limit on one row never aborts the
// whole call. Failed rows are logged via `console.error` (Sentry-eligible)
// and the response surfaces the per-provider sent count.
//
// Per-user preference filtering: optional `pref_key` on the request body
// (`'daily' | 'new_outfit' | 'reminders'`). When set, the function reads
// `profiles.notification_prefs` for the target user and short-circuits with
// `{ sent: 0, skipped: 'pref_off' }` when the relevant key is `false`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { CORS_HEADERS } from "../_shared/cors.ts";
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitResponse,
  checkOverload,
  overloadResponse,
} from "../_shared/scale-guard.ts";
import { logger } from "../_shared/logger.ts";

const log = logger("send_push_notification");

// Build a JSON Response with CORS headers — used for every successful exit
// path so the caller always gets the right Content-Type + CORS surface.
// Status defaults to 200; error paths pass their own status.
function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  provider: string | null;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  expo_token: string | null;
};

type PrefKey = "daily" | "new_outfit" | "reminders";

const ALLOWED_PREF_KEYS: ReadonlySet<string> = new Set([
  "daily",
  "new_outfit",
  "reminders",
]);

// Defensive parser — see mobile/src/hooks/usePushNotifications.ts. Mirrored
// here so a malformed jsonb column never silently disables every push.
function isPrefOn(prefs: unknown, key: PrefKey): boolean {
  if (!prefs || typeof prefs !== "object") return true; // default-on
  const obj = prefs as Record<string, unknown>;
  const v = obj[key];
  if (typeof v === "boolean") return v;
  // Missing / non-boolean → default to on so a partial column doesn't
  // accidentally suppress all sends.
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (checkOverload("send_push_notification")) {
    return overloadResponse(CORS_HEADERS);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }

    const userId = user.id;

    await enforceRateLimit(serviceClient, userId, "send_push_notification");

    // Idempotency intentionally DEFERRED (Reviewer D on PR #763): no
    // current caller passes `x-idempotency-key`, AND the shared
    // `_shared/idempotency.ts` helpers key on the raw header without
    // body-hashing. Adopting them here without a body-aware key would
    // ship a feature that's simultaneously inert (no current consumers)
    // AND landmined (a future date-keyed caller, e.g.
    // `daily-${userId}-${YYYY-MM-DD}`, would have request B replay
    // request A's cached counts). Re-add when (a) a real caller exists
    // and (b) the key includes a body hash — see memory_ingest's
    // sha256(body) fallback for the canonical defensive pattern.
    const startedAt = Date.now();

    const requestBody = await req.json().catch(() => ({}));
    const {
      title,
      body,
      url,
      data: extraData,
      pref_key: rawPrefKey,
    } = (requestBody ?? {}) as {
      title?: string;
      body?: string;
      url?: string;
      data?: Record<string, unknown>;
      pref_key?: string;
    };

    // Pref filter — when the caller specifies which pref this push relates
    // to, read `profiles.notification_prefs` and skip the send if disabled.
    let prefKey: PrefKey | null = null;
    if (typeof rawPrefKey === "string" && ALLOWED_PREF_KEYS.has(rawPrefKey)) {
      prefKey = rawPrefKey as PrefKey;
    }
    if (prefKey) {
      // Use the service client so we read the column even though RLS
      // already permits self-reads — keeps the read path uniform with the
      // sub-fetch below.
      const { data: profileRow, error: profileErr } = await serviceClient
        .from("profiles")
        .select("notification_prefs")
        .eq("id", userId)
        .maybeSingle();
      if (profileErr) {
        log.warn("profile read failed, defaulting prefs on", {
          userId,
          pref_key: prefKey,
          error: profileErr.message,
        });
      } else if (!isPrefOn(profileRow?.notification_prefs, prefKey)) {
        return jsonResponse({
          sent: 0,
          skipped: "pref_off",
          pref_key: prefKey,
        });
      }
    }

    // Pull every push subscription for the user — both web and expo. Use the
    // service client so a user with RLS-failed reads (shouldn't happen on
    // self) still gets pushed.
    const { data: subs, error: subErr } = await serviceClient
      .from("push_subscriptions")
      .select("id, user_id, provider, endpoint, p256dh, auth, expo_token")
      .eq("user_id", userId);

    if (subErr) {
      // log.exception (not log.error) so the structured exception path
      // surfaces to Sentry alongside the catch-all at the bottom of the
      // function — Reviewer C 2nd-pass observability nit.
      log.exception("push_subscriptions read failed", subErr, { userId });
      return jsonResponse({ error: "Failed to read push subscriptions" }, 500);
    }

    if (!subs || subs.length === 0) {
      return jsonResponse({ sent: 0, message: "No subscriptions found" });
    }

    const rows = subs as PushSubscriptionRow[];

    let sentExpo = 0;
    let sentWeb = 0;
    const failures: Array<{ id: string; provider: string; reason: string }> = [];

    // Iterate per-row so a 4xx on one transport doesn't drop the others.
    for (const sub of rows) {
      const provider = sub.provider ?? "web";
      try {
        if (provider === "expo") {
          const ok = await sendExpoPush(sub, { title, body, url, data: extraData });
          if (ok.delivered) {
            sentExpo++;
          } else {
            failures.push({ id: sub.id, provider, reason: ok.reason });
            // DeviceNotRegistered / InvalidCredentials → delete the row so
            // we don't hammer dead tokens. Other errors keep the row alive
            // for retry.
            if (ok.cleanup) {
              await serviceClient
                .from("push_subscriptions")
                .delete()
                .eq("id", sub.id);
            }
          }
        } else {
          // web — VAPID. Same flow as before; isolated into a helper for
          // readability.
          const ok = await sendVapidPush(sub, { title, body, url });
          if (ok.delivered) {
            sentWeb++;
          } else {
            failures.push({ id: sub.id, provider: "web", reason: ok.reason });
            if (ok.cleanup) {
              await serviceClient
                .from("push_subscriptions")
                .delete()
                .eq("id", sub.id);
            }
          }
        }
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        log.exception("send threw outside SendResult shape", e, {
          userId,
          subId: sub.id,
          provider,
        });
        failures.push({ id: sub.id, provider, reason });
      }
    }

    const sentTotal = sentExpo + sentWeb;
    const response = jsonResponse({
      sent: sentTotal,
      sent_expo: sentExpo,
      sent_web: sentWeb,
      failures: failures.length,
    });

    // Fire-and-forget analytics — captures per-send detail (counts,
    // failures, pref bucket) that scale-guard's `logTelemetry` shape
    // can't express (its event is AI-call-shaped). Direct insert mirrors
    // the same `analytics_events` table + `metadata` blob pattern used
    // internally by `logTelemetry`. Intentionally not awaited — a
    // telemetry write failure must never block the user-visible response.
    //
    // Status taxonomy (Reviewer D 2nd-pass on PR #763):
    //   "ok"      — every row delivered
    //   "partial" — some rows delivered, some failed (degraded)
    //   "fail"    — zero rows delivered (full outage for this user)
    // Distinguishing "fail" from "partial" lets dashboards surface
    // total-failure spikes that "partial" alone would smear over.
    let telemetryStatus: "ok" | "partial" | "fail";
    if (failures.length === 0) telemetryStatus = "ok";
    else if (sentTotal === 0) telemetryStatus = "fail";
    else telemetryStatus = "partial";

    serviceClient
      .from("analytics_events")
      .insert({
        event_type: "push_send",
        user_id: userId,
        metadata: {
          fn: "send_push_notification",
          latency_ms: Date.now() - startedAt,
          status: telemetryStatus,
          sent_expo: sentExpo,
          sent_web: sentWeb,
          failures: failures.length,
          sub_count: rows.length,
          pref_key: prefKey,
        },
      })
      .then(
        () => {},
        // Surface analytics-write failures to logs (and Sentry via
        // `log.warn`'s structured emit) instead of silently swallowing —
        // Reviewer D 2nd-pass nit. If `analytics_events` writes start
        // failing (column drift, RLS regression), we'd otherwise lose
        // the signal entirely.
        (err) =>
          log.warn("analytics_events insert failed", {
            userId,
            error: err instanceof Error ? err.message : String(err),
          }),
      );

    return response;
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitResponse(e, CORS_HEADERS);
    }
    log.exception("unhandled error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});

// ─── Expo Push (M30) ─────────────────────────────────────────────────────

type SendResult = {
  delivered: boolean;
  reason: string;
  /** True when the row should be deleted (token permanently invalid). */
  cleanup: boolean;
};

type ExpoSendBody = {
  title?: string;
  body?: string;
  url?: string;
  data?: Record<string, unknown>;
};

async function sendExpoPush(
  sub: PushSubscriptionRow,
  payload: ExpoSendBody,
): Promise<SendResult> {
  const token = sub.expo_token ?? sub.endpoint;
  if (!token) {
    return { delivered: false, reason: "missing_expo_token", cleanup: true };
  }
  if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
    // Defensive: a row marked provider='expo' that doesn't carry an Expo
    // token is malformed — drop it rather than POST to Expo with garbage.
    return { delivered: false, reason: "invalid_expo_token_shape", cleanup: true };
  }

  // Merge the deep-link `url` into the data payload as `route` so the
  // mobile listener (App.tsx > useNotificationDeepLink) can navigate on tap.
  // Callers that already pass `data.route` win.
  const mergedData: Record<string, unknown> = { ...(payload.data ?? {}) };
  if (typeof payload.url === "string" && payload.url.length > 0 && !mergedData.route) {
    mergedData.route = payload.url;
  }

  const message = {
    to: token,
    title: payload.title ?? "BURS",
    body: payload.body ?? "",
    sound: "default" as const,
    data: mergedData,
  };

  // M30 review fix — Expo's documented payload ceiling is 4 KB; we clamp at
  // 3.5 KB so headers + JSON-array wrapper stay under the limit. Going over
  // would yield a `MessageTooBig` ticket on the receiving end (transient
  // from Expo's perspective; we'd retry forever). Skip + warn instead.
  const serialized = JSON.stringify(message);
  if (serialized.length > 3500) {
    log.warn("expo payload too large", {
      subId: sub.id,
      bytes: serialized.length,
    });
    return { delivered: false, reason: "expo_payload_too_large", cleanup: false };
  }

  // M30 review fix — bound the Expo POST. Deno's default fetch has no
  // timeout and Expo's edge can occasionally stall; without a cap a single
  // hung request blocks the whole per-row loop.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: serialized,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { delivered: false, reason: "expo_timeout", cleanup: false };
    }
    return {
      delivered: false,
      reason: `expo_fetch_failed:${err instanceof Error ? err.message : String(err)}`,
      cleanup: false,
    };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // 429 / 5xx → transient, keep the row.
    return {
      delivered: false,
      reason: `expo_http_${res.status}:${text.slice(0, 200)}`,
      cleanup: res.status === 401 || res.status === 403,
    };
  }

  const json = await res.json().catch(() => null) as
    | { data?: Array<{ status?: string; details?: { error?: string } }> }
    | null;
  const ticket = json?.data?.[0];
  if (!ticket) {
    return { delivered: false, reason: "expo_missing_ticket", cleanup: false };
  }
  if (ticket.status === "ok") {
    return { delivered: true, reason: "ok", cleanup: false };
  }
  // status === 'error' — Expo's documented errors include
  // DeviceNotRegistered, MessageTooBig, MessageRateExceeded,
  // MismatchSenderId, InvalidCredentials. Permanent token failures are the
  // 'DeviceNotRegistered' / 'InvalidCredentials' set; the rest are transient.
  const errCode = ticket.details?.error ?? "unknown_error";
  const cleanup =
    errCode === "DeviceNotRegistered" || errCode === "InvalidCredentials";
  return { delivered: false, reason: `expo_error:${errCode}`, cleanup };
}

// ─── VAPID Web Push (legacy, M30 unchanged) ──────────────────────────────

type WebSendBody = {
  title?: string;
  body?: string;
  url?: string;
};

async function sendVapidPush(
  sub: PushSubscriptionRow,
  payload: WebSendBody,
): Promise<SendResult> {
  if (!sub.endpoint || !sub.p256dh || !sub.auth) {
    return { delivered: false, reason: "missing_vapid_keys", cleanup: true };
  }
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!vapidPublicKey || !vapidPrivateKey) {
    return { delivered: false, reason: "vapid_keys_unconfigured", cleanup: false };
  }

  const json = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
  });

  try {
    // web-push throws on permanent failures (404 / 410) carrying a
    // `statusCode`. Map back to the SendResult shape.
    const { default: webpush } = await import("https://esm.sh/web-push@3.6.7");
    webpush.setVapidDetails(
      "mailto:hello@burs.me",
      vapidPublicKey,
      vapidPrivateKey,
    );
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      json,
    );
    return { delivered: true, reason: "ok", cleanup: false };
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    const cleanup = status === 404 || status === 410;
    return {
      delivered: false,
      reason: `vapid_${status ?? "unknown"}:${err instanceof Error ? err.message : String(err)}`,
      cleanup,
    };
  }
}
