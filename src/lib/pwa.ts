const DISPLAY_MODE_MEDIA_QUERY = '(display-mode: standalone)';

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia(DISPLAY_MODE_MEDIA_QUERY).matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

export function getDisplayMode(): 'standalone' | 'browser' {
  return isStandalonePwa() ? 'standalone' : 'browser';
}

export { DISPLAY_MODE_MEDIA_QUERY };
