/**
 * Opens external URLs safely from within Lovable's preview (which runs inside an iframe).
 *
 * IMPORTANT: Call `prepareExternalNavigation()` synchronously inside a user gesture (e.g. onClick)
 * BEFORE awaiting anything, otherwise popups may be blocked.
 */

export function prepareExternalNavigation() {
  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  // Stripe Checkout can get stuck inside the preview iframe. Pre-open a new tab in that case.
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
    // Fallback (may still be inside iframe)
    window.location.href = url;
  };

  return { popup, go, closePopup };
}
