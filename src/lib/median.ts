/**
 * Median.co native wrapper detection & bridge utilities.
 * Median wraps web apps into native iOS/Android apps via a WebView
 * and exposes a `median.*` JavaScript bridge for native features.
 */

declare global {
  interface Window {
    median?: {
      haptics?: {
        impact: (style?: 'light' | 'medium' | 'heavy') => void;
      };
      statusbar?: {
        set: (opts: { style: 'light' | 'dark'; overlay?: boolean }) => void;
      };
      open?: {
        externalBrowser: (url: string) => void;
      };
      onesignal?: {
        register: () => void;
        getPlayerId: () => Promise<{ playerId: string }>;
      };
      push?: {
        register: () => void;
      };
      camera?: {
        takePhoto: (opts?: { quality?: number }) => Promise<{ image: string }>;
        openPhotoLibrary: () => Promise<{ image: string }>;
      };
      share?: {
        open: (opts: { url: string }) => void;
      };
    };
    gonative?: boolean;
  }
}

const UA = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';

/** True when app is running inside the Median.co native wrapper */
export function isMedianApp(): boolean {
  return UA.includes('median') || UA.includes('gonative') || !!window.gonative;
}

/** True when running in Median on iOS */
export function isMedianIOS(): boolean {
  return isMedianApp() && /iphone|ipad|ipod/.test(UA);
}

/** True when running in Median on Android */
export function isMedianAndroid(): boolean {
  return isMedianApp() && UA.includes('android');
}

/**
 * Safely call a Median bridge function.
 * Returns undefined if not in Median or if the bridge path doesn't exist.
 */
export function medianBridge<T = void>(
  path: string,
  ...args: any[]
): T | undefined {
  if (!isMedianApp() || typeof window.median === 'undefined') return undefined;
  try {
    const parts = path.split('.');
    let obj: any = window.median;
    for (const part of parts) {
      obj = obj?.[part];
    }
    if (typeof obj === 'function') {
      return obj(...args) as T;
    }
  } catch {
    // bridge call failed silently
  }
  return undefined;
}
