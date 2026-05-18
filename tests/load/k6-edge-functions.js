// k6 load test — top 5 edge functions
//
// Run modes (set via env var SCENARIO):
//   SCENARIO=smoke  → 5 VUs / 1 min (default; safe to run anywhere k6 has network)
//   SCENARIO=load   → 100 VUs ramp / 10 min + 500 VUs spike / 5 min
//
// Required env:
//   STAGING_URL or SUPABASE_URL          — https://<project-ref>.supabase.co
//   STAGING_ANON_KEY or ANON_KEY         — Supabase anon key (apikey header)
//   SERVICE_ROLE_KEY                     — service role key (setup/teardown only)
//
// Optional env:
//   POOL_SIZE                            — number of synthetic users in setup pool
//                                          (default: 5 for smoke, 50 for load)
//
// Endpoints exercised (round-robin per VU iteration):
//   1. analyze_garment       — Gemini vision call, fast mode
//   2. enqueue_render_job    — queues a render job for a garment
//   3. style_chat            — Gemini chat with wardrobe context
//   4. generate_outfit       — unified stylist engine
//   5. start_trial           — web-only Stripe trial mint (short-circuits to
//                              already_started=true for seeded users)
//
// Setup: provisions a POOL of synthetic auth users, each seeded with:
//   - subscriptions row (plan=premium, status=active, fake stripe_subscription_id)
//   - render_credits row (monthly_allowance=100)
//   - 4 garments with the NOT-NULL columns (title, category) populated
//
// VUs are distributed across the pool round-robin (`__VU % pool.length`) so
// per-user rate limits (style_chat 15/min, enqueue 10/min, generate_outfit
// 5/min) don't dominate the error rate. Codex P1 on PR #896 flagged that a
// single shared user would saturate the per-user throttle long before the
// service hit any real capacity ceiling.
//
// Teardown: deletes every pool user (cascades garments / subscriptions /
// render_credits via FKs).
//
// See tests/load/README.md for install + run instructions.

import http from "k6/http";
import { check, sleep } from "k6";

const SUPABASE_URL = __ENV.STAGING_URL || __ENV.SUPABASE_URL;
const ANON_KEY = __ENV.STAGING_ANON_KEY || __ENV.ANON_KEY;
const SERVICE_ROLE_KEY = __ENV.SERVICE_ROLE_KEY;
const SCENARIO = __ENV.SCENARIO || "smoke";
const POOL_SIZE_OVERRIDE = __ENV.POOL_SIZE
  ? parseInt(__ENV.POOL_SIZE, 10)
  : null;
const DEFAULT_POOL_SIZE = SCENARIO === "load" ? 50 : 5;
const POOL_SIZE = POOL_SIZE_OVERRIDE && POOL_SIZE_OVERRIDE > 0
  ? POOL_SIZE_OVERRIDE
  : DEFAULT_POOL_SIZE;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing env. Required: (STAGING_URL|SUPABASE_URL), (STAGING_ANON_KEY|ANON_KEY), SERVICE_ROLE_KEY",
  );
}

export const options =
  SCENARIO === "load"
    ? {
        // 50-user pool seed = ~250 sequential HTTP calls in setup (admin
        // create + sign-in + subscriptions upsert + render_credits upsert
        // + garments bulk-insert per user). k6's default setupTimeout is
        // 60s, which is tight at p95 latencies — bump to 5 min so a flaky
        // preview branch doesn't kill the run during provisioning.
        setupTimeout: "5m",
        teardownTimeout: "5m",
        scenarios: {
          ramp_100: {
            executor: "ramping-vus",
            startVUs: 0,
            stages: [
              { duration: "2m", target: 100 },
              { duration: "8m", target: 100 },
            ],
          },
          spike_500: {
            executor: "ramping-vus",
            startTime: "10m",
            startVUs: 100,
            stages: [
              { duration: "1m", target: 500 },
              { duration: "4m", target: 500 },
            ],
          },
        },
        thresholds: {
          http_req_failed: ["rate<0.05"],
          "http_req_duration{endpoint:analyze_garment}": ["p(95)<8000"],
          "http_req_duration{endpoint:enqueue_render_job}": ["p(95)<2000"],
          "http_req_duration{endpoint:style_chat}": ["p(95)<5000"],
          "http_req_duration{endpoint:generate_outfit}": ["p(95)<6000"],
          "http_req_duration{endpoint:start_trial}": ["p(95)<3000"],
        },
      }
    : {
        vus: 5,
        duration: "1m",
        thresholds: {
          // Looser ceiling for smoke — start_trial short-circuit path is
          // intentionally 200, but rate limits or transient hiccups still
          // occasionally surface 4xx. 10% keeps the smoke run useful as a
          // wire-up sanity check without false-failing on env flakiness.
          http_req_failed: ["rate<0.10"],
        },
      };

// uuid v4 generator (k6 has no Node crypto.randomUUID).
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const SERVICE_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

// Seed one synthetic user with everything the load endpoints expect:
//   1. auth user (admin API)
//   2. password sign-in → JWT
//   3. subscriptions row (premium/active + fake stripe_subscription_id so
//      start_trial short-circuits at the pre-check)
//   4. render_credits row (monthly_allowance=100 so enqueue_render_job's
//      reserveCredit doesn't 402 trial_studio_locked)
//   5. 4 garments with NOT-NULL columns populated (≥2 required for
//      generate_outfit's wardrobe engine; we seed a small but mixed-slot
//      wardrobe so the engine can compose actual outfits)
function provisionUser() {
  const tag = uuidv4();
  const email = `loadtest+${tag}@burs.app`;
  const password = `loadtest-pw-${tag}`;

  const adminUserResp = http.post(
    `${SUPABASE_URL}/auth/v1/admin/users`,
    JSON.stringify({ email, password, email_confirm: true }),
    { headers: SERVICE_HEADERS },
  );
  if (adminUserResp.status !== 200 && adminUserResp.status !== 201) {
    throw new Error(
      `setup: failed to create user (${adminUserResp.status}): ${adminUserResp.body}`,
    );
  }
  const user = JSON.parse(adminUserResp.body);

  const signInResp = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    {
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
    },
  );
  if (signInResp.status !== 200) {
    throw new Error(
      `setup: sign-in failed (${signInResp.status}): ${signInResp.body}`,
    );
  }
  const token = JSON.parse(signInResp.body).access_token;

  // Upsert subscriptions row: handle_new_user trigger inserts a free-tier
  // row at signup, so we PATCH (upsert with onConflict=user_id) it up to
  // premium/active. Fake stripe_subscription_id triggers start_trial's
  // pre-check short-circuit (already_started:true → 200) so the trial
  // endpoint doesn't try real Stripe API calls under load.
  const subResp = http.post(
    `${SUPABASE_URL}/rest/v1/subscriptions?on_conflict=user_id`,
    JSON.stringify({
      user_id: user.id,
      plan: "premium",
      status: "active",
      stripe_subscription_id: `sub_loadtest_${tag}`,
      stripe_customer_id: `cus_loadtest_${tag}`,
    }),
    {
      headers: { ...SERVICE_HEADERS, Prefer: "resolution=merge-duplicates" },
    },
  );
  if (subResp.status >= 300) {
    throw new Error(
      `setup: subscriptions upsert failed (${subResp.status}): ${subResp.body}`,
    );
  }

  // render_credits: monthly_allowance=100 leaves headroom for the full load
  // run's enqueue_render_job iterations per user (≤20 per VU iteration at
  // 500 VUs × 5min / 50 users / 5 endpoints / 0.5s sleep ≈ a few dozen).
  const creditsResp = http.post(
    `${SUPABASE_URL}/rest/v1/render_credits?on_conflict=user_id`,
    JSON.stringify({
      user_id: user.id,
      monthly_allowance: 100,
    }),
    {
      headers: { ...SERVICE_HEADERS, Prefer: "resolution=merge-duplicates" },
    },
  );
  if (creditsResp.status >= 300) {
    throw new Error(
      `setup: render_credits upsert failed (${creditsResp.status}): ${creditsResp.body}`,
    );
  }

  // 4 garments across mixed slots so generate_outfit has enough variety.
  // title + category are NOT NULL; the engine's slot classifier reads
  // category to compose top/bottom/shoes/outerwear combinations.
  const garmentRows = [
    { title: "Loadtest tee", category: "top" },
    { title: "Loadtest jeans", category: "bottom" },
    { title: "Loadtest sneakers", category: "shoes" },
    { title: "Loadtest jacket", category: "outerwear" },
  ].map((g, idx) => ({
    user_id: user.id,
    title: g.title,
    category: g.category,
    image_path: `${user.id}/loadtest-${tag}-${idx}.jpg`,
  }));

  const garmentResp = http.post(
    `${SUPABASE_URL}/rest/v1/garments`,
    JSON.stringify(garmentRows),
    {
      headers: { ...SERVICE_HEADERS, Prefer: "return=representation" },
    },
  );
  if (garmentResp.status !== 200 && garmentResp.status !== 201) {
    throw new Error(
      `setup: garments insert failed (${garmentResp.status}): ${garmentResp.body}`,
    );
  }
  const garments = JSON.parse(garmentResp.body);
  const garmentIds = Array.isArray(garments)
    ? garments.map((g) => g.id).filter(Boolean)
    : [];

  return { token, userId: user.id, email, garmentIds };
}

export function setup() {
  console.log(`[setup] provisioning ${POOL_SIZE} synthetic users...`);
  const users = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    users.push(provisionUser());
  }
  console.log(`[setup] pool ready (${users.length} users)`);
  return { users };
}

// Round-robin pool dispatch — every VU picks one user, every iteration picks
// the same user (so per-user rate limits accumulate predictably). Distributing
// across the pool means at 500 VUs / 50 users we get ~10 VUs per user, and at
// 5 VUs / 5 users we get 1 VU per user — both well under the per-user
// per-minute caps for every endpoint we exercise.
function pickUser(data) {
  return data.users[__VU % data.users.length];
}

// VALID_SOURCES from supabase/functions/enqueue_render_job/index.ts:68-74.
// Anything else returns 400. `manual_enhance` matches "user triggered a
// re-render" semantics, which is the closest fit for synthetic load.
const ENQUEUE_SOURCE = "manual_enhance";

export default function (data) {
  const user = pickUser(data);
  const baseHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${user.token}`,
    apikey: ANON_KEY,
  };

  // Round-robin: 5 endpoints, one per iteration.
  const choice = __ITER % 5;

  if (choice === 0) {
    const r = http.post(
      `${SUPABASE_URL}/functions/v1/analyze_garment`,
      JSON.stringify({
        // analyze_garment accepts { storagePath, base64Image, locale, mode }.
        // 1x1 PNG stub passes the magic-byte validator (S-A.3) without
        // requiring real upload + signed-URL plumbing.
        base64Image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        locale: "en",
        mode: "fast",
      }),
      { headers: baseHeaders, tags: { endpoint: "analyze_garment" } },
    );
    check(r, {
      "analyze_garment 2xx": (res) => res.status >= 200 && res.status < 300,
    });
  } else if (choice === 1) {
    const garmentId = user.garmentIds[0];
    const r = http.post(
      `${SUPABASE_URL}/functions/v1/enqueue_render_job`,
      JSON.stringify({
        garmentId,
        source: ENQUEUE_SOURCE,
        // clientNonce: unique per VU+iter so reserveCredit doesn't replay
        // every call into the same idempotent reservation. >=8 chars.
        clientNonce: `loadtest-${__VU}-${__ITER}-${Math.random()
          .toString(36)
          .slice(2)}`,
      }),
      { headers: baseHeaders, tags: { endpoint: "enqueue_render_job" } },
    );
    check(r, {
      "enqueue_render_job 2xx": (res) =>
        res.status === 200 || res.status === 202,
    });
  } else if (choice === 2) {
    const r = http.post(
      `${SUPABASE_URL}/functions/v1/style_chat`,
      JSON.stringify({
        messages: [{ role: "user", content: "hi" }],
        locale: "en",
      }),
      { headers: baseHeaders, tags: { endpoint: "style_chat" } },
    );
    check(r, {
      "style_chat 2xx": (res) => res.status >= 200 && res.status < 300,
    });
  } else if (choice === 3) {
    const r = http.post(
      `${SUPABASE_URL}/functions/v1/generate_outfit`,
      JSON.stringify({ mode: "standard", locale: "en" }),
      { headers: baseHeaders, tags: { endpoint: "generate_outfit" } },
    );
    check(r, {
      "generate_outfit 2xx": (res) => res.status >= 200 && res.status < 300,
    });
  } else {
    const r = http.post(
      `${SUPABASE_URL}/functions/v1/start_trial`,
      JSON.stringify({}),
      { headers: baseHeaders, tags: { endpoint: "start_trial" } },
    );
    // With a fake stripe_subscription_id seeded in setup(), the pre-check
    // short-circuits with { ok:true, already_started:true } → 200. We do
    // NOT exercise the real Stripe customers.create / subscriptions.create
    // path; doing so under load would burn real Stripe quota and leave
    // billable test customers behind.
    check(r, {
      "start_trial 200": (res) => res.status === 200,
    });
  }

  sleep(0.5);
}

export function teardown(data) {
  if (!data || !Array.isArray(data.users)) return;
  for (const u of data.users) {
    if (!u || !u.userId) continue;
    http.del(`${SUPABASE_URL}/auth/v1/admin/users/${u.userId}`, null, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });
  }
}
