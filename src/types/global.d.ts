/**
 * Global type augmentations for BURS app.
 * Covers Vite-injected globals and window extensions.
 */

declare const __APP_VERSION__: string | undefined;

interface Window {
  /** Median.co native wrapper callback for pull-to-refresh */
  __burs_ptr_callback?: () => Promise<void>;
}
