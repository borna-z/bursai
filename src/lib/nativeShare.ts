/**
 * Native sharing utility — uses Median bridge, Web Share API, or clipboard fallback.
 */
import { isMedianApp } from './median';

export interface ShareOptions {
  title?: string;
  text?: string;
  url: string;
}

export async function nativeShare(opts: ShareOptions): Promise<boolean> {
  // 1. Median native share sheet
  if (isMedianApp() && window.median?.share?.open) {
    window.median.share.open({ url: opts.url });
    return true;
  }

  // 2. Web Share API (most mobile browsers)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: opts.title,
        text: opts.text,
        url: opts.url,
      });
      return true;
    } catch (err) {
      // User cancelled or API error — fall through to clipboard
      if ((err as Error)?.name === 'AbortError') return false;
    }
  }

  // 3. Clipboard fallback
  try {
    await navigator.clipboard.writeText(opts.url);
    return true;
  } catch {
    return false;
  }
}
