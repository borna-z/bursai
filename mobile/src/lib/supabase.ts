// Supabase client for React Native — mirrors the web app's project (ref khvkwojtlkcvxjxztduj).
// Reads EXPO_PUBLIC_* env vars (Expo's equivalent of VITE_* — inlined at build time).
// Throws fast on missing config so a misconfigured build is caught at import time, not on first network call.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Expo's Metro bundler inlines `process.env.EXPO_PUBLIC_*` via static text replacement —
// it does NOT resolve dynamic property access (`process.env[name]`), which would otherwise
// always be undefined in production bundles. Reads MUST be at the call site with dot
// notation so the transform can see them. Codex P1 #3 on PR #699.
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required Supabase env var: ${name}. ` +
      'Set it in mobile/.env (Expo inlines EXPO_PUBLIC_* at build time).'
    );
  }
  return value;
}

export const supabaseUrl = requireEnv('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
export const supabasePublishableKey = requireEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
