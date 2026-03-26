import { CORS_HEADERS } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");

  if (!publicKey) {
    return new Response(
      JSON.stringify({ error: "VAPID keys not configured" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ publicKey }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
