// Supabase client for React Native — mirrors the web app's project (ref khvkwojtlkcvxjxztduj).
// Reads EXPO_PUBLIC_* env vars (Expo's equivalent of VITE_* — inlined at build time).
// Throws fast on missing config so a misconfigured build is caught at import time, not on first network call.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

function requireEnv(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required Supabase env var: ${name}. ` +
      'Set it in mobile/.env (Expo inlines EXPO_PUBLIC_* at build time).'
    );
  }
  return value;
}

export const supabaseUrl = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
export const supabasePublishableKey = requireEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function getSupabaseFunctionUrl(functionName: string): string {
  return `${supabaseUrl}/functions/v1/${functionName}`;
}
