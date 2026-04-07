/**
 * Opens external URLs safely — supports Median.co native browser bridge,
 * Lovable preview iframe handling, and regular browser tabs.
 */
import { isMedianApp } from './median';

export function prepareExternalNavigation() {
  // In Median, external links use the native bridge — no popup needed
  if (isMedianApp()) {
    return {
      popup: null,
      go: (url: string) => {
        if (window.median?.open?.externalBrowser) {
          window.median.open.externalBrowser(url);
        } else {
          window.location.href = url;
        }
      },
      closePopup: () => {},
    };
  }

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const popup = inIframe ? window.open('', '_blank', 'noopener,noreferrer') : null;
  try {
    if (popup) popup.opener = null;
  } catch {
    // ignore
  }

  const closePopup = () => {
    try {
      popup?.close();
    } catch {
      // ignore
    }
  };

  const go = (url: string) => {
    if (popup && !popup.closed) {
      popup.location.href = url;
      popup.focus?.();
      return;
    }
    window.location.href = url;
  };

  return { popup, go, closePopup };
}
