/**
 * alert_check — evaluates 6 business-critical rules and fires Discord alerts.
 *
 * Invoked by pg_cron every 5 minutes (see
 * supabase/migrations/20260518120100_alert_state_and_errors.sql). Auth uses
 * the shared RENDER_WORKER_BEARER env (same pattern as process_render_jobs).
 *
 * The Discord webhook URL is read from `vault.decrypted_secrets.alert_webhook_url`
 * at runtime. If the secret is missing the function no-ops with a structured
 * warning — this lets the PR merge before the user provisions the webhook.
 *
 * Per-rule 30-min dedupe via the `alert_state` table: a rule that fires is
 * suppressed on subsequent ticks until `now() - last_fired_at > 30 minutes`.
 *
 * The 6 rules:
 *   1. negative_balance      — any render_credits row with a negative balance
 *   2. orphan_render_jobs    — > 5 pending jobs older than 10 min
 *   3. stripe_webhook_errors — >= 5% non-2xx on request_idempotency keys
 *                              prefixed `stripe_` in the last 5 min
 *   4. ai_error_rate         — >= 20% AI function errors vs ai_rate_limits
 *                              calls, min volume 10, last 5 min
 *   5. start_trial_failures  — >= 2% start_trial errors vs request_idempotency
 *                              start_trial_ keys, min 5, last 5 min
 *   6. signup_drop_to_zero   — 0 signups this hour AND >0 signups prev hour
 */
import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { logger } from "../_shared/logger.ts";

const log = logger("alert_check");

const DEDUPE_WINDOW_MINUTES = 30;

interface RuleResult {
  rule: string;
  fired: boolean;
  suppressed: boolean;
  metric?: string;
  description?: string;
  error?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Look up the Discord webhook URL from vault. Returns null if absent. */
async function loadWebhookUrl(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .schema("vault")
    .from("decrypted_secrets")
    .select("decrypted_secret")
    .eq("name", "alert_webhook_url")
    .maybeSingle();
  if (error) {
    log.warn("vault lookup failed for alert_webhook_url (treating as absent)", {
      error: error.message,
    });
    return null;
  }
  const url = (data as { decrypted_secret?: string } | null)?.decrypted_secret ?? null;
  return url && url.length > 0 ? url : null;
}

/** Post a Discord embed. Awaited so failure can be surfaced in the response. */
async function postDiscord(
  webhookUrl: string,
  ruleName: string,
  description: string,
  metric: string,
): Promise<void> {
  const payload = {
    username: "BURS Alerts",
    embeds: [
      {
        title: `🚨 ${ruleName}`,
        description,
        color: 15158332,
        fields: [{ name: "Metric", value: metric, inline: true }],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`discord webhook ${res.status}: ${body.slice(0, 200)}`);
  }
}

/** Check dedupe + fire + record state. Mutates `result` in place. */
async function fireOrSuppress(
  supabase: SupabaseClient,
  webhookUrl: string | null,
  result: RuleResult,
): Promise<void> {
  // Check dedupe window.
  const { data: stateRow, error: stateErr } = await supabase
    .from("alert_state")
    .select("last_fired_at")
    .eq("rule_name", result.rule)
    .maybeSingle();
  if (stateErr) {
    log.warn("alert_state lookup failed (firing anyway)", {
      rule: result.rule,
      error: stateErr.message,
    });
  }

  if (stateRow) {
    const last = new Date((stateRow as { last_fired_at: string }).last_fired_at).getTime();
    const ageMin = (Date.now() - last) / 60000;
    if (ageMin < DEDUPE_WINDOW_MINUTES) {
      result.suppressed = true;
      result.fired = false;
      return;
    }
  }

  // Fire to Discord (if configured).
  if (webhookUrl) {
    try {
      await postDiscord(
        webhookUrl,
        result.rule,
        result.description ?? "(no description)",
        result.metric ?? "(no metric)",
      );
    } catch (postErr) {
      result.fired = false;
      result.error = postErr instanceof Error ? postErr.message : String(postErr);
      return;
    }
  }

  // Upsert alert_state regardless of webhook configuration so the dedupe
  // window starts ticking even before the user provisions the webhook —
  // otherwise the first webhook setup would flood with backed-up alerts.
  const { error: upsertErr } = await supabase
    .from("alert_state")
    .upsert({ rule_name: result.rule, last_fired_at: new Date().toISOString() });
  if (upsertErr) {
    log.warn("alert_state upsert failed", {
      rule: result.rule,
      error: upsertErr.message,
    });
  }

  result.fired = true;
}

// ─── Rule evaluators ────────────────────────────────────────────────────────

async function rule1NegativeBalance(
  supabase: SupabaseClient,
): Promise<RuleResult & { _shouldFire?: boolean }> {
  const r: RuleResult & { _shouldFire?: boolean } = {
    rule: "negative_balance",
    fired: false,
    suppressed: false,
  };
  // Pull the relevant columns and filter client-side. render_credits is
  // ~1 row per user; at launch scale this is well under a few thousand rows
  // and fits comfortably in a single Postgrest page (default 1000) — we
  // page if larger via .range().
  type Row = {
    topup_balance: number | null;
    trial_gift_remaining: number | null;
    monthly_allowance: number | null;
    used_this_period: number | null;
  };
  let offenders = 0;
  const PAGE = 1000;
  let from = 0;
  // Cap at 100k rows total per tick to bound cost.
  for (let i = 0; i < 100; i++) {
    const { data: rows, error } = await supabase
      .from("render_credits")
      .select("topup_balance, trial_gift_remaining, monthly_allowance, used_this_period")
      .range(from, from + PAGE - 1);
    if (error) {
      r.error = error.message;
      return r;
    }
    const batch = (rows ?? []) as Row[];
    for (const row of batch) {
      const topup = row.topup_balance ?? 0;
      const trial = row.trial_gift_remaining ?? 0;
      const allowance = row.monthly_allowance ?? 0;
      const used = row.used_this_period ?? 0;
      if (topup < 0 || trial < 0 || (allowance - used) < 0) offenders++;
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }

  if (offenders > 0) {
    r._shouldFire = true;
    r.metric = `${offenders} row(s)`;
    r.description = `render_credits has ${offenders} row(s) with a negative balance (topup_balance, trial_gift_remaining, or monthly_allowance - used_this_period < 0).`;
  }
  return r;
}

async function rule2OrphanRenderJobs(supabase: SupabaseClient): Promise<RuleResult & { _shouldFire?: boolean }> {
  const r: RuleResult & { _shouldFire?: boolean } = {
    rule: "orphan_render_jobs",
    fired: false,
    suppressed: false,
  };
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("render_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("created_at", cutoff);
  if (error) {
    r.error = error.message;
    return r;
  }
  const n = count ?? 0;
  if (n > 5) {
    r._shouldFire = true;
    r.metric = `${n} pending jobs > 10 min old`;
    r.description = `render_jobs has ${n} pending rows older than 10 minutes (threshold > 5). Worker may be stalled.`;
  }
  return r;
}

async function rule3StripeWebhookFailures(
  supabase: SupabaseClient,
): Promise<RuleResult & { _shouldFire?: boolean }> {
  const r: RuleResult & { _shouldFire?: boolean } = {
    rule: "stripe_webhook_errors",
    fired: false,
    suppressed: false,
  };
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { count: total, error: totalErr } = await supabase
    .from("request_idempotency")
    .select("key", { count: "exact", head: true })
    .gt("created_at", cutoff)
    .like("key", "stripe_%");
  if (totalErr) {
    r.error = totalErr.message;
    return r;
  }
  if (!total || total === 0) return r;

  const { count: errs, error: errsErr } = await supabase
    .from("request_idempotency")
    .select("key", { count: "exact", head: true })
    .gt("created_at", cutoff)
    .like("key", "stripe_%")
    .gte("status", 400);
  if (errsErr) {
    r.error = errsErr.message;
    return r;
  }
  const errCount = errs ?? 0;
  const rate = errCount / total;
  if (rate >= 0.05) {
    r._shouldFire = true;
    r.metric = `${errCount}/${total} (${(rate * 100).toFixed(1)}%)`;
    r.description = `Stripe webhook error rate is ${(rate * 100).toFixed(1)}% over the last 5 min (threshold 5%).`;
  }
  return r;
}

async function rule4AiErrorRate(
  supabase: SupabaseClient,
): Promise<RuleResult & { _shouldFire?: boolean }> {
  const r: RuleResult & { _shouldFire?: boolean } = {
    rule: "ai_error_rate",
    fired: false,
    suppressed: false,
  };
  const cutoffISO = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const aiFns = [
    "analyze_garment",
    "mood_outfit",
    "style_chat",
    "generate_outfit",
    "shopping_chat",
    "wardrobe_gap_analysis",
    "travel_capsule",
  ];

  const { count: total, error: totalErr } = await supabase
    .from("ai_rate_limits")
    .select("id", { count: "exact", head: true })
    .gt("called_at", cutoffISO);
  if (totalErr) {
    r.error = totalErr.message;
    return r;
  }
  const totalN = total ?? 0;
  if (totalN < 10) return r; // min volume gate

  const { count: errs, error: errsErr } = await supabase
    .from("edge_function_errors")
    .select("id", { count: "exact", head: true })
    .in("function_name", aiFns)
    .gt("created_at", cutoffISO);
  if (errsErr) {
    r.error = errsErr.message;
    return r;
  }
  const errN = errs ?? 0;
  const rate = errN / totalN;
  if (rate >= 0.2) {
    r._shouldFire = true;
    r.metric = `${errN}/${totalN} (${(rate * 100).toFixed(1)}%)`;
    r.description = `AI function error rate is ${(rate * 100).toFixed(1)}% over the last 5 min (threshold 20%, min 10 calls).`;
  }
  return r;
}

async function rule5StartTrialFailures(
  supabase: SupabaseClient,
): Promise<RuleResult & { _shouldFire?: boolean }> {
  const r: RuleResult & { _shouldFire?: boolean } = {
    rule: "start_trial_failures",
    fired: false,
    suppressed: false,
  };
  const cutoffISO = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { count: total, error: totalErr } = await supabase
    .from("request_idempotency")
    .select("key", { count: "exact", head: true })
    .gt("created_at", cutoffISO)
    .like("key", "start_trial_%");
  if (totalErr) {
    r.error = totalErr.message;
    return r;
  }
  const totalN = total ?? 0;
  if (totalN < 5) return r;

  const { count: errs, error: errsErr } = await supabase
    .from("edge_function_errors")
    .select("id", { count: "exact", head: true })
    .eq("function_name", "start_trial")
    .gt("created_at", cutoffISO);
  if (errsErr) {
    r.error = errsErr.message;
    return r;
  }
  const errN = errs ?? 0;
  const rate = errN / totalN;
  if (rate >= 0.02) {
    r._shouldFire = true;
    r.metric = `${errN}/${totalN} (${(rate * 100).toFixed(1)}%)`;
    r.description = `start_trial error rate is ${(rate * 100).toFixed(1)}% over the last 5 min (threshold 2%, min 5 attempts).`;
  }
  return r;
}

async function rule6SignupDropToZero(
  supabase: SupabaseClient,
): Promise<RuleResult & { _shouldFire?: boolean }> {
  const r: RuleResult & { _shouldFire?: boolean } = {
    rule: "signup_drop_to_zero",
    fired: false,
    suppressed: false,
  };

  const now = Date.now();
  const thisHourStart = new Date(now - 60 * 60 * 1000).toISOString();
  const prevHourStart = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const prevHourEnd = thisHourStart;

  // auth.users is not exposed through PostgREST by default. The service-role
  // client can still RPC into the schema if a function exists, but we don't
  // have one. Use `admin.listUsers` via the auth admin API for an exact
  // count of users created in the relevant windows.
  // Practical fallback: query the `profiles` table (1:1 with auth.users via
  // handle_new_user trigger) for created_at counts — `profiles.created_at`
  // defaults to now() and is populated by the trigger.
  const { count: thisHour, error: thisErr } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gt("created_at", thisHourStart);
  if (thisErr) {
    r.error = thisErr.message;
    return r;
  }
  const { count: prevHour, error: prevErr } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gt("created_at", prevHourStart)
    .lte("created_at", prevHourEnd);
  if (prevErr) {
    r.error = prevErr.message;
    return r;
  }

  const tN = thisHour ?? 0;
  const pN = prevHour ?? 0;
  if (tN === 0 && pN > 0) {
    r._shouldFire = true;
    r.metric = `this hour: 0, prev hour: ${pN}`;
    r.description = `Signups dropped to 0 this hour after ${pN} the prior hour. Possible signup outage.`;
  }
  return r;
}

// ─── Entry point ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // ─── Auth: shared worker bearer ───────────────────────────
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RENDER_WORKER_BEARER = Deno.env.get("RENDER_WORKER_BEARER") ?? "";

  if (!RENDER_WORKER_BEARER || RENDER_WORKER_BEARER.length < 32) {
    return jsonResponse({ error: "worker bearer not configured" }, 503);
  }
  if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.length < 32) {
    return jsonResponse({ error: "service role key not configured" }, 503);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const expected = `Bearer ${RENDER_WORKER_BEARER}`;
  if (!timingSafeEqual(authHeader, expected)) {
    return jsonResponse({ error: "service role required" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ─── Load webhook URL (tolerate absence) ──────────────────
  const webhookUrl = await loadWebhookUrl(supabase);
  if (!webhookUrl) {
    log.warn("alert_webhook_url not set in vault; running in no-op mode", {});
  }

  // ─── Evaluate rules in parallel ───────────────────────────
  type RR = RuleResult & { _shouldFire?: boolean };
  const settled = await Promise.allSettled<RR>([
    rule1NegativeBalance(supabase) as Promise<RR>,
    rule2OrphanRenderJobs(supabase),
    rule3StripeWebhookFailures(supabase),
    rule4AiErrorRate(supabase),
    rule5StartTrialFailures(supabase),
    rule6SignupDropToZero(supabase),
  ]);

  const results: RR[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    const name = [
      "negative_balance",
      "orphan_render_jobs",
      "stripe_webhook_errors",
      "ai_error_rate",
      "start_trial_failures",
      "signup_drop_to_zero",
    ][i];
    return {
      rule: name,
      fired: false,
      suppressed: false,
      error: s.reason instanceof Error ? s.reason.message : String(s.reason),
    };
  });

  // Fire-or-suppress for any rule that breached. Sequential so we don't
  // race two concurrent state upserts on the same row (rare but ugly).
  for (const r of results) {
    if (r._shouldFire) {
      await fireOrSuppress(supabase, webhookUrl, r);
    }
  }

  const alertsFired = results.filter((r) => r.fired).length;
  const alertsSuppressed = results.filter((r) => r.suppressed).length;
  const errors = results.filter((r) => r.error).map((r) => ({
    rule: r.rule,
    error: r.error,
  }));

  log.info("alert_check tick complete", {
    fired: alertsFired,
    suppressed: alertsSuppressed,
    errors: errors.length,
    webhook_configured: webhookUrl !== null,
  });

  // When webhook is unset, we still return 200 and report what would have
  // fired. The PR can merge before the user provisions the webhook; cron
  // ticks until then are no-ops beyond the warning log above.
  return jsonResponse({
    rules_checked: 6,
    alerts_fired: alertsFired,
    alerts_suppressed: alertsSuppressed,
    webhook_configured: webhookUrl !== null,
    skipped: webhookUrl === null,
    reason: webhookUrl === null ? "no_webhook" : undefined,
    errors,
    results: results.map((r) => ({
      rule: r.rule,
      fired: r.fired,
      suppressed: r.suppressed,
      metric: r.metric,
    })),
  });
});
