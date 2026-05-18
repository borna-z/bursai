// Cloudflare CDN hostname rewrite for Supabase Storage signed URLs.
//
// Supabase HMAC-signs the URL against the Storage host
// (`khvkwojtlkcvxjxztduj.supabase.co`). After signing we swap only the
// hostname to `cdn.burs.app`, which is a Cloudflare proxy in front of the
// Storage origin. Cloudflare forwards transparently, so Storage still sees
// the request as if it came from its real hostname and the signature
// validates. The query string (including the `token` HMAC) is preserved.
//
// Rollback: set `EXPO_PUBLIC_CDN_ENABLED=false` and the rewrite no-ops so
// URLs fall back to the direct Supabase hostname.

const SUPABASE_STORAGE_HOST = 'khvkwojtlkcvxjxztduj.supabase.co';
const CDN_HOST = 'cdn.burs.app';
const CDN_ENABLED = process.env.EXPO_PUBLIC_CDN_ENABLED !== 'false';

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
