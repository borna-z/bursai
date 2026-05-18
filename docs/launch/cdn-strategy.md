# CDN strategy — Cloudflare in front of Supabase Storage

## Why
Image cold-load on non-EU users currently 200–400ms; CDN drops to <100ms for cached objects and offloads bandwidth from Supabase egress.

## Architecture
- Cloudflare proxies cdn.burs.me → khvkwojtlkcvxjxztduj.supabase.co
- supabase-js HMAC-signs the URL against the real Storage hostname
- Mobile client rewrites the URL hostname to cdn.burs.me after signing
- **Cloudflare Origin Rule rewrites `Host` header (and SNI) back to `khvkwojtlkcvxjxztduj.supabase.co` before forwarding to origin.** Supabase routes requests by project host; a vanilla proxied CNAME that forwards `Host: cdn.burs.me` will not reach the project and every signed URL would 404/misroute. The Origin Rule is the load-bearing piece of this design — without it the rewrite breaks all garment images.
- Storage validates the HMAC against the (path, token, expires) tuple — hostname is not part of the signature payload, so the rewrite is signature-safe once the Host header is correct.

## Cloudflare configuration
1. CNAME `cdn.burs.me` → `khvkwojtlkcvxjxztduj.supabase.co` (proxied / orange-cloud).
2. **Origin Rule** (Rules → Origin Rules → Create):
   - When: Hostname equals `cdn.burs.me`
   - Then: Override `Host header` AND `SNI` to `khvkwojtlkcvxjxztduj.supabase.co`
3. Page Rule (or Cache Rule) for `cdn.burs.me/*`:
   - Cache Level: Cache Everything
   - **Edge Cache TTL: 1 hour (3600s) — must NOT exceed the signed URL lifetime (`EXPIRES_IN_SECONDS = 3600`).** Signed URLs are bearer tokens. Caching them past expiry at the edge would let anyone replay a leaked URL for the cache lifetime even after Supabase's HMAC clock-check would otherwise reject it. Keep edge TTL ≤ signed URL TTL.
   - Browser Cache TTL: respect existing (Storage sets `cache-control: max-age=3600` by default).

## Activation gate
The mobile rewrite is **off by default** (`EXPO_PUBLIC_CDN_ENABLED` unset or anything ≠ `'true'`). To enable:
1. Verify the Origin Rule is live by curl-testing `cdn.burs.me` with a freshly signed URL — should return 200 with the image bytes.
2. Set `EXPO_PUBLIC_CDN_ENABLED=true` in EAS env for the next build.
3. Smoke-test on a staging EAS build before promoting to production.

## Cache invalidation
Garment images are immutable — filenames are UUID-based and never overwritten. Deletions remove the source; signed URLs expire within 1 hour and the edge cache flushes on the same horizon. For emergency purge:
- Single URL: Cloudflare dashboard → Caching → Configuration → Purge by URL
- Mass: Purge Everything (last resort)

## Rollback
Set `EXPO_PUBLIC_CDN_ENABLED=false` (or unset) and ship the next EAS build / OTA — mobile rewrite no-ops; URLs fall back to direct Supabase hostname. `process.env.EXPO_PUBLIC_*` is inlined at build time, so a real rollback requires a new build, not just a JS OTA against an existing binary.

## Monitoring
- Cloudflare Analytics → Caching → cache hit ratio. Target >90% after 7 days of warmup.
- If hit rate drops below 70%, investigate: long-tail unique URLs (re-signed too frequently invalidating cache) or page-rule misconfig.
