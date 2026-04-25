/**
 * i18nFallback — Hard-fallback helpers for translation keys when LanguageContext
 * may return its humanized-last-segment safety net.
 *
 * Background: src/contexts/LanguageContext.tsx returns a humanized version of
 * a translation key's last segment (e.g. 'notfound.title' → 'Title') in two
 * scenarios — (1) the consumer is rendered outside `<LanguageProvider>` (unit
 * tests, top-level error boundary fallback) so the dict cache is empty; (2)
 * the dictionary chunk has not yet finished loading on cold start. Pages that
 * MUST always render readable copy (404 page, share-link meta tags) use these
 * helpers to substitute an explicit English fallback when t() falls back.
 *
 * Codex P1+P2 fixes on PR #678.
 */

/**
 * Compute the same humanized-last-segment value that LanguageContext returns
 * when a key is missing. Used to detect that t() has fallen back to the
 * safety net.
 */
function expectedHumanizedFallback(key: string): string {
  const segment = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  const humanized = segment.replace(/[_-]/g, ' ');
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

/**
 * Safely render a translation key with an explicit English fallback. If t()
 * has fallen back to its humanized-last-segment safety net, we return the
 * caller's fallback instead of the meaningless humanized output.
 */
export function safeT(
  t: (key: string) => string,
  key: string,
  fallback: string,
): string {
  const value = t(key);
  return value === expectedHumanizedFallback(key) ? fallback : value;
}

/**
 * Interpolate `{name}`-style placeholders in a translation template, with two
 * safety properties on top of plain String.prototype.replace:
 *
 * 1. Function replacer (vs. string replacement) — prevents user-controlled
 *    values containing `$&`, `$'`, `` $` ``, or `$<name>` from being
 *    interpreted as JS regex special replacement tokens that mangle output.
 * 2. Humanize-fallback detection — when t(key) returns the humanized last
 *    segment (cold start before the dict loads), the template lacks the
 *    placeholder tokens entirely. We detect that and return the caller's
 *    fallback string instead of producing incomplete meta-tag content.
 */
export function interpolateMeta(
  t: (key: string) => string,
  key: string,
  vars: Record<string, string>,
  fallback: string,
): string {
  const template = t(key);
  if (template === expectedHumanizedFallback(key)) {
    return fallback;
  }
  return Object.entries(vars).reduce((acc, [name, value]) => {
    // Function replacer is the canonical way to insert literal text without
    // triggering JS's $&/$'/$` substitution rules.
    return acc.replace(`{${name}}`, () => value);
  }, template);
}
