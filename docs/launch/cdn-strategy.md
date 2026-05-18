# CDN strategy — Cloudflare in front of Supabase Storage

## Why
Image cold-load on non-EU users currently 200–400ms; CDN drops to <100ms for cached objects and offloads bandwidth from Supabase egress.

## Architecture
- Cloudflare proxies cdn.burs.app → khvkwojtlkcvxjxztduj.supabase.co
- supabase-js HMAC-signs the URL against the real Storage hostname
- Mobile client rewrites hostname to cdn.burs.app after signing
- Cloudflare forwards transparently; Storage validates the HMAC against the request URL/headers as if it came from its real hostname

## Page rule
- URL: cdn.burs.app/*
- Cache Level: Cache Everything
- Edge Cache TTL: a month
- Browser Cache TTL: respect existing (Storage sets `cache-control: max-age=3600` by default)

## Cache invalidation
Garment images are immutable — filenames are UUID-based and never overwritten. Deletions remove the source; cached objects expire in 30d. For emergency purge:
- Single URL: Cloudflare dashboard → Caching → Configuration → Purge by URL
- Mass: Purge Everything (last resort)

## Rollback
Set `EXPO_PUBLIC_CDN_ENABLED=false` in the next OTA / build. Mobile rewrite no-ops; URLs fall back to direct Supabase hostname. No code changes needed.

## Monitoring
- Cloudflare Analytics → Caching → cache hit ratio. Target >90% after 7 days of warmup.
- If hit rate drops below 70%, investigate: long-tail unique URLs (e.g., re-signed too frequently invalidating cache) or page-rule misconfig.
