/**
 * Gemini explicit context caching (Wave S-B.2).
 *
 * Wraps Google's `cachedContents` REST resource so the analyze_garment
 * enrich-mode system prompt (~600 tokens of style-archetype / neckline /
 * sleeve / silhouette vocabulary, identical for every user and every
 * garment) is created once and reused across enrich calls. Subsequent
 * calls reference the cache by name and pay the discounted cached-token
 * rate (90% off on Gemini 2.5+).
 *
 * Caveats and design choices:
 *
 *  1. The `cachedContents` resource is a **separate REST endpoint** on the
 *     native Gemini API surface (`/v1beta/cachedContents`). It is NOT part
 *     of the OpenAI compatibility layer (`/v1beta/openai/...`). The two
 *     endpoints share an API key. We POST to the native endpoint to create
 *     the cache and then pass the returned cache *name* (e.g.
 *     `cachedContents/abc123`) to the OpenAI-compat completions call via
 *     `extra_body.google.cached_content` (see _shared/burs-ai.ts).
 *
 *  2. Edge Function isolates are stateless (cold-start per request). An
 *     in-memory cache-ID variable resets on every cold start, defeating
 *     the purpose. We persist the cache ID + Gemini-side TTL in the
 *     existing `ai_response_cache` table using a reserved cache_key
 *     (`__gemini_cache:<purpose>`). No new migration required — the table
 *     already has the columns we need (`cache_key`, `response`,
 *     `expires_at`, `model_used`). The cache row's `expires_at` mirrors
 *     the Gemini-side TTL so we re-create rather than reference an
 *     expired cache.
 *
 *  3. Model support: explicit `cachedContents` is documented for
 *     `gemini-2.5-flash` (1024-token minimum). It is **not** documented
 *     for `gemini-2.5-flash-lite` — Google's caching reference table omits
 *     flash-lite entirely as of 2026-05-15. We therefore only attach a
 *     cache when the resolved model is `gemini-2.5-flash`. The fallback
 *     chain (flash-lite first for `standard` complexity) means the FIRST
 *     enrich call after a deploy will warm the cache and succeed un-
 *     cached on flash-lite; subsequent calls that fall through to flash
 *     get the discount. To pin enrich-mode to flash directly, callers
 *     pass `models: ["gemini-2.5-flash"]` rather than relying on the
 *     complexity chain — see analyze_garment/index.ts.
 *
 *  4. Lazy warm-up: the first enrich call after a fresh deploy creates
 *     the cache synchronously (adds ~300ms to that one call). Cache TTL
 *     defaults to 24h. A best-effort refresh path runs when the cached
 *     `expires_at` is within 1h of expiry — fire-and-forget so the user
 *     request that triggered the refresh doesn't block on the PATCH.
 *
 *  5. Concurrency: two simultaneous first-time enrich calls could each
 *     race to create the cache. The cost is bounded — we keep the most
 *     recently written cache (UPSERT on cache_key) and the orphaned
 *     cache eventually expires server-side. The first-call latency cost
 *     is paid at most a handful of times per cold-start window; not
 *     worth a distributed lock.
 */

const GEMINI_CACHE_URL =
  (typeof Deno !== "undefined" ? Deno.env.get("GEMINI_CACHE_URL_OVERRIDE") : undefined) ??
  "https://generativelanguage.googleapis.com/v1beta/cachedContents";

// Reserved row prefix in `ai_response_cache`. The leading `__` is invalid
// in our SHA-256 hex cache keys, so this can never collide with a real
// AI-response cache row.
const ROW_KEY_PREFIX = "__gemini_cache:";

// Default cache TTL (24h). Gemini accepts a duration string ending in `s`.
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

// Refresh threshold — if a cache row is within this many seconds of
// expiring, fire a background refresh on next read.
const REFRESH_WINDOW_SECONDS = 60 * 60;

export interface GeminiCacheConfig {
  /** Purpose key — must be stable across deploys. e.g. `analyze_garment_enrich`. */
  purpose: string;
  /** Native Gemini model the cache is bound to (e.g. `models/gemini-2.5-flash`). */
  model: string;
  /** System instruction (the heavy, repeated text to cache). */
  systemInstruction: string;
  /** TTL in seconds. Defaults to 24h. Gemini-side minimum is 60s. */
  ttlSeconds?: number;
}

interface CachedContentRow {
  /** Gemini-side resource name, e.g. `cachedContents/abc123`. */
  name: string;
  /** Gemini-side model the cache was bound to. */
  model: string;
  /** Local mirror of the Gemini-side expiry — UTC ISO timestamp. */
  expiresAt: string;
}

interface CreateCachedContentResponse {
  name?: string;
  model?: string;
  expireTime?: string;
}

function rowKey(purpose: string): string {
  return `${ROW_KEY_PREFIX}${purpose}`;
}

/**
 * Read the persisted cache row (if any) for a given purpose. Returns null
 * on any DB error — caller must be prepared to create a fresh cache.
 */
async function readPersistedCache(
  supabase: any,
  purpose: string,
): Promise<CachedContentRow | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("ai_response_cache")
      .select("response, model_used, expires_at")
      .eq("cache_key", rowKey(purpose))
      .maybeSingle();
    if (error || !data) return null;
    const resp = (data as { response?: { name?: string } }).response;
    const expiresAt = (data as { expires_at?: string }).expires_at;
    const model = (data as { model_used?: string }).model_used;
    if (!resp?.name || !expiresAt || !model) return null;
    return { name: resp.name, model, expiresAt };
  } catch {
    return null;
  }
}

async function writePersistedCache(
  supabase: any,
  purpose: string,
  row: CachedContentRow,
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("ai_response_cache").upsert(
      {
        cache_key: rowKey(purpose),
        response: { name: row.name },
        model_used: row.model,
        expires_at: row.expiresAt,
        hit_count: 0,
        compressed: false,
        user_id: null,
      },
      { onConflict: "cache_key" },
    );
  } catch (e) {
    console.warn("gemini-cache: persist failed:", e instanceof Error ? e.message : String(e));
  }
}

async function deletePersistedCache(supabase: any, purpose: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("ai_response_cache").delete().eq("cache_key", rowKey(purpose));
  } catch {
    // Best effort; an orphaned row will be overwritten on next create.
  }
}

/**
 * Create a fresh cachedContents resource on Gemini and persist the
 * returned name + expiry. Returns null on API error so callers can
 * gracefully fall back to an uncached request.
 */
async function createGeminiCache(
  apiKey: string,
  config: GeminiCacheConfig,
): Promise<CachedContentRow | null> {
  const ttl = Math.max(60, config.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  // Gemini's caches require the model name to be in the `models/<id>` form
  // even when the OpenAI-compat endpoint accepts the bare id. Normalise here
  // so callers can pass either.
  const fullModel = config.model.startsWith("models/")
    ? config.model
    : `models/${config.model}`;

  const body = {
    model: fullModel,
    // `system_instruction` is text-only per Gemini docs. Wrap as a Part.
    system_instruction: {
      parts: [{ text: config.systemInstruction }],
    },
    ttl: `${ttl}s`,
  };

  try {
    const resp = await fetch(`${GEMINI_CACHE_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      console.warn(
        "gemini-cache: create failed",
        resp.status,
        // Truncate to avoid leaking payload details into the log.
        txt.slice(0, 200),
      );
      return null;
    }
    const data = (await resp.json()) as CreateCachedContentResponse;
    if (!data?.name) {
      console.warn("gemini-cache: create returned no name");
      return null;
    }
    // Gemini returns `expireTime` as RFC3339. Mirror it locally; if the
    // server omits it, fall back to our requested TTL.
    const expiresAt = data.expireTime
      ? new Date(data.expireTime).toISOString()
      : new Date(Date.now() + ttl * 1000).toISOString();
    return {
      name: data.name,
      model: data.model ?? fullModel,
      expiresAt,
    };
  } catch (e) {
    console.warn(
      "gemini-cache: create threw:",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

/**
 * Refresh the TTL of an existing cache. Fire-and-forget — caller should
 * not await this. On failure we delete the stale row so the next request
 * creates a fresh cache.
 */
function refreshGeminiCacheTtl(
  apiKey: string,
  supabase: any,
  purpose: string,
  cacheName: string,
  ttlSeconds: number,
): void {
  // `cacheName` already includes the `cachedContents/...` prefix, so we
  // construct the PATCH URL directly off the base host.
  const base = GEMINI_CACHE_URL.replace(/\/cachedContents$/, "");
  const url = `${base}/${cacheName}?key=${encodeURIComponent(apiKey)}`;
  try {
    fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: `${ttlSeconds}s` }),
    })
      .then(async (resp) => {
        if (!resp.ok) {
          // 404 → the cache expired server-side. Drop the local row so
          // next read creates a new one.
          if (resp.status === 404) {
            await deletePersistedCache(supabase, purpose);
          }
          return;
        }
        // Bump local expires_at to match.
        const newExpiry = new Date(Date.now() + ttlSeconds * 1000).toISOString();
        try {
          await supabase
            .from("ai_response_cache")
            .update({ expires_at: newExpiry })
            .eq("cache_key", rowKey(purpose));
        } catch {
          // Non-fatal.
        }
      })
      .catch(() => {
        // Non-fatal.
      });
  } catch {
    // Best-effort.
  }
}

/**
 * Returns the Gemini-side cache resource name (e.g.
 * `cachedContents/abc123`) for the given purpose. Creates a fresh cache
 * on first call after deploy (or after server-side TTL expiry). Returns
 * null if caching is unavailable (no API key, REST error) so the caller
 * can issue an un-cached request as fallback.
 *
 * The returned name is passed verbatim to the OpenAI-compat completions
 * call via `extra_body.google.cached_content`.
 */
export async function ensureCachedContent(
  supabase: any,
  config: GeminiCacheConfig,
): Promise<string | null> {
  if (typeof Deno === "undefined") return null;
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;

  const ttl = Math.max(60, config.ttlSeconds ?? DEFAULT_TTL_SECONDS);

  // 1. Try the persisted row.
  const existing = await readPersistedCache(supabase, config.purpose);
  if (existing) {
    const remainingMs = new Date(existing.expiresAt).getTime() - Date.now();
    // Soft refresh: if we're inside the refresh window, kick off a
    // background PATCH but still return the existing cache name.
    if (remainingMs > 0 && remainingMs < REFRESH_WINDOW_SECONDS * 1000) {
      refreshGeminiCacheTtl(apiKey, supabase, config.purpose, existing.name, ttl);
    }
    // Hard miss: cache has already expired locally — drop and recreate.
    if (remainingMs <= 0) {
      await deletePersistedCache(supabase, config.purpose);
    } else {
      return existing.name;
    }
  }

  // 2. Create a fresh cache.
  const created = await createGeminiCache(apiKey, config);
  if (!created) return null;
  await writePersistedCache(supabase, config.purpose, created);
  return created.name;
}

/**
 * Test-only escape hatch — clear the persisted row so the next call
 * creates fresh. Never invoked by production code paths.
 */
export async function _clearCacheForTesting(
  supabase: any,
  purpose: string,
): Promise<void> {
  await deletePersistedCache(supabase, purpose);
}
