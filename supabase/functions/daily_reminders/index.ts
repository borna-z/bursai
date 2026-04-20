import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Auth: service-role for cron, or valid user JWT (P1) ──
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";
    const isServiceRoleCaller =
      !!token && !!SUPABASE_SERVICE_ROLE_KEY && timingSafeEqual(token, SUPABASE_SERVICE_ROLE_KEY);

    if (!isServiceRoleCaller) {
      if (!authHeader?.startsWith("Bearer ") || !token) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
      const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await authClient.auth.getUser(token);
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // Get all push subscriptions with user preferences
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*");

    if (error || !subs?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscriptions" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Group by user
    const userSubs = new Map<string, typeof subs>();
    for (const sub of subs) {
      const existing = userSubs.get(sub.user_id) || [];
      existing.push(sub);
      userSubs.set(sub.user_id, existing);
    }

    const { default: webpush } = await import(
      "https://esm.sh/web-push@3.6.7"
    );
    webpush.setVapidDetails(
      "mailto:hello@bursai.com",
      vapidPublicKey,
      vapidPrivateKey
    );

    let totalSent = 0;
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000)
      .toISOString()
      .split("T")[0];

    for (const [userId, subscriptions] of userSubs) {
      // Check user preferences
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("preferences")
        .eq("id", userId)
        .single();

      const prefs = (profile?.preferences as Record<string, any>) || {};
      if (!prefs.morningReminder) continue;

      // Check if user has outfit planned for today
      const { data: planned } = await supabaseAdmin
        .from("planned_outfits")
        .select("id")
        .eq("user_id", userId)
        .eq("date", today)
        .limit(1);

      let title: string;
      let body: string;

      if (!planned?.length) {
        // Check tomorrow too
        const { data: tomorrowPlanned } = await supabaseAdmin
          .from("planned_outfits")
          .select("id")
          .eq("user_id", userId)
          .eq("date", tomorrow)
          .limit(1);

        if (!tomorrowPlanned?.length) {
          title = "Plan your outfit 👔";
          body = "No outfit planned for today or tomorrow. Let BURS help you!";
        } else {
          title = "Good morning! 🌅";
          body = "No outfit set for today — want a suggestion?";
        }
      } else {
        title = "Your outfit is ready ✨";
        body = "Check today's planned outfit in BURS.";
      }

      const payload = JSON.stringify({ title, body, url: "/" });

      for (const sub of subscriptions) {
        try {
          const result = await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          if (result.statusCode >= 200 && result.statusCode < 300) {
            totalSent++;
          }
        } catch (e: any) {
          if (e?.statusCode === 410 || e?.statusCode === 404) {
            await supabaseAdmin
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ sent: totalSent }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily_reminders error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});
