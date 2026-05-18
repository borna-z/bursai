// Cloudflare CDN hostname rewrite for Supabase Storage signed URLs.
//
// Supabase HMAC-signs the URL against the Storage host
// (`khvkwojtlkcvxjxztduj.supabase.co`). After signing we swap only the
// hostname to `cdn.burs.me`, which is a Cloudflare proxy in front of the
// Storage origin. Cloudflare MUST rewrite the `Host` header (and SNI) back
// to the Supabase project hostname via an Origin Rule — Supabase routes by
// host, so a vanilla proxied CNAME with `Host: cdn.burs.me` will not reach
// the project. See `docs/launch/cdn-strategy.md` for the required Cloudflare
// rule set. The query string (including the `token` HMAC) is preserved.
//
// Activation: explicit opt-in via `EXPO_PUBLIC_CDN_ENABLED=true`. Default is
// off so builds that ship before the CDN infra is verified continue to hit
// Supabase Storage directly. Once the Cloudflare Origin Rule is live and
// verified end-to-end on a staging build, flip the env var in EAS and
// rebuild.

const SUPABASE_STORAGE_HOST = 'khvkwojtlkcvxjxztduj.supabase.co';
const CDN_HOST = 'cdn.burs.me';
const CDN_ENABLED = process.env.EXPO_PUBLIC_CDN_ENABLED === 'true';

export function rewriteSignedUrlForCDN(signedUrl: string): string {
  if (!CDN_ENABLED) return signedUrl;
  if (!signedUrl.includes(SUPABASE_STORAGE_HOST)) return signedUrl;
  try {
    const u = new URL(signedUrl);
    u.hostname = CDN_HOST;
    return u.toString();
  } catch {
    return signedUrl;
  }
}
