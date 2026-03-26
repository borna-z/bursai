import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { CORS_HEADERS } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
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
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } =
      await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }

    const userId = claimsData.claims.sub as string;

    const { title, body, url } = await req.json();

    // Get user's push subscriptions
    const { data: subs, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (subErr || !subs?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscriptions found" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // For each subscription, send via Web Push
    // Using the web-push library approach with fetch-based VAPID
    const payload = JSON.stringify({ title, body, url: url || "/" });

    let sent = 0;
    for (const sub of subs) {
      try {
        // Use the Web Push protocol via fetch
        const pushRes = await sendWebPush(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          vapidPublicKey,
          vapidPrivateKey
        );
        if (pushRes.ok) sent++;
        else if (pushRes.status === 410 || pushRes.status === 404) {
          // Subscription expired, clean up
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
      } catch (e) {
        console.error("Push failed for sub:", sub.id, e);
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send_push_notification error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});

// Minimal Web Push implementation using VAPID
async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<Response> {
  // Import web push utilities
  const { default: webpush } = await import(
    "https://esm.sh/web-push@3.6.7"
  );

  webpush.setVapidDetails(
    "mailto:hello@bursai.com",
    vapidPublicKey,
    vapidPrivateKey
  );

  const result = await webpush.sendNotification(subscription, payload);
  return new Response(null, { status: result.statusCode });
}
