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
// Endpoints exercised (round-robin per VU iteration):
//   1. analyze_garment       — Gemini vision call, fast mode
//   2. enqueue_render_job    — queues a render job for a garment
//   3. style_chat            — Gemini chat with wardrobe context
//   4. generate_outfit       — unified stylist engine
//   5. start_trial           — web-only Stripe trial mint
//
// Setup: creates one synthetic auth user + 1 garment row.
// Teardown: deletes the user (cascades to garments).
//
// See tests/load/README.md for install + run instructions.

import http from "k6/http";
import { check, sleep } from "k6";

const SUPABASE_URL = __ENV.STAGING_URL || __ENV.SUPABASE_URL;
const ANON_KEY = __ENV.STAGING_ANON_KEY || __ENV.ANON_KEY;
const SERVICE_ROLE_KEY = __ENV.SERVICE_ROLE_KEY;
const SCENARIO = __ENV.SCENARIO || "smoke";

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing env. Required: (STAGING_URL|SUPABASE_URL), (STAGING_ANON_KEY|ANON_KEY), SERVICE_ROLE_KEY",
  );
}

export const options =
  SCENARIO === "load"
    ? {
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
          // Looser ceiling for smoke — some endpoints (start_trial)
          // legitimately return 4xx on re-runs against a shared user.
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

export function setup() {
  const tag = uuidv4();
  const email = `loadtest+${tag}@burs.app`;
  const password = `loadtest-pw-${tag}`;

  // 1. Create synthetic auth user via admin API.
  const adminUserResp = http.post(
    `${SUPABASE_URL}/auth/v1/admin/users`,
    JSON.stringify({ email, password, email_confirm: true }),
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (adminUserResp.status !== 200 && adminUserResp.status !== 201) {
    throw new Error(
      `setup: failed to create user (${adminUserResp.status}): ${adminUserResp.body}`,
    );
  }
  const user = JSON.parse(adminUserResp.body);

  // 2. Sign in synthetic user to get a JWT.
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

  // 3. Insert one synthetic garment row via service role
  //    (used as enqueue_render_job target — schema must match prod garments).
  const garmentResp = http.post(
    `${SUPABASE_URL}/rest/v1/garments`,
    JSON.stringify({
      user_id: user.id,
      image_path: `loadtest/${tag}.jpg`,
    }),
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    },
  );

  let garmentId = null;
  if (garmentResp.status === 200 || garmentResp.status === 201) {
    const parsed = JSON.parse(garmentResp.body);
    garmentId = Array.isArray(parsed) ? parsed[0]?.id : parsed?.id;
  } else {
    // Don't hard-fail setup if garments table schema drifts — leave
    // garmentId null and let enqueue_render_job iterations return 4xx.
    // (We surface this to the operator via stdout.)
    // eslint-disable-next-line no-console
    console.warn(
      `setup: garment insert non-fatal failure (${garmentResp.status}): ${garmentResp.body}`,
    );
  }

  return { token, userId: user.id, email, garmentId };
}

export default function (data) {
  const baseHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.token}`,
    apikey: ANON_KEY,
  };

  // Round-robin: 5 endpoints, one per iteration.
  const choice = __ITER % 5;

  if (choice === 0) {
    const r = http.post(
      `${SUPABASE_URL}/functions/v1/analyze_garment`,
      JSON.stringify({
        // analyze_garment accepts { storagePath, base64Image, locale, mode }.
        // Using a public placeholder URL via storagePath-style proxy is
        // brittle, so we pass a tiny base64 stub and locale=en, mode=fast.
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
    const r = http.post(
      `${SUPABASE_URL}/functions/v1/enqueue_render_job`,
      JSON.stringify({
        garmentId: data.garmentId,
        source: "loadtest",
        clientNonce: `loadtest-${__VU}-${__ITER}`,
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
      }),
      { headers: baseHeaders, tags: { endpoint: "style_chat" } },
    );
    check(r, {
      "style_chat 2xx": (res) => res.status >= 200 && res.status < 300,
    });
  } else if (choice === 3) {
    const r = http.post(
      `${SUPABASE_URL}/functions/v1/generate_outfit`,
      JSON.stringify({ mode: "standard", mood: "casual" }),
      { headers: baseHeaders, tags: { endpoint: "generate_outfit" } },
    );
    check(r, {
      "generate_outfit 2xx": (res) => res.status >= 200 && res.status < 300,
    });
  } else {
    const r = http.post(
      `${SUPABASE_URL}/functions/v1/start_trial`,
      JSON.stringify({ plan: "monthly" }),
      { headers: baseHeaders, tags: { endpoint: "start_trial" } },
    );
    // 409 = already-trialed (re-run safe), 200 = first call.
    check(r, {
      "start_trial ok-or-conflict": (res) =>
        res.status === 200 || res.status === 409,
    });
  }

  sleep(0.5);
}

export function teardown(data) {
  if (!data || !data.userId) return;
  http.del(
    `${SUPABASE_URL}/auth/v1/admin/users/${data.userId}`,
    null,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
}
