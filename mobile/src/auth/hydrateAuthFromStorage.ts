import type { User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type { Profile } from './types';

const PROFILE_COLUMNS =
  'id, display_name, preferences, mannequin_presentation, created_at, onboarding_step, onboarding_completed_at, onboarding_started_at';

export async function selectProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[AuthContext] profile select failed:', error.message);
    return null;
  }
  return (data as Profile | null) ?? null;
}

export async function loadOrCreateProfile(user: User): Promise<Profile | null> {
  const existing = await selectProfile(user.id);
  if (existing) return existing;

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split('@')[0] ??
    'User';

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      display_name: displayName,
      preferences: { onboarding: { completed: false } },
      mannequin_presentation: 'mixed',
    })
    .select(PROFILE_COLUMNS)
    .single();

  if (insertError) {
    const code = (insertError as { code?: string }).code;
    if (code === '23503') {
      console.warn('[AuthContext] ghost session detected — signing out');
      await supabase.auth.signOut();
      return null;
    }
    if (code === '23505') {
      console.warn('[AuthContext] profile insert raced — re-selecting winning row');
      return await selectProfile(user.id);
    }
    console.warn('[AuthContext] profile auto-create failed:', insertError.message);
    return null;
  }

  return created as Profile;
}

const FRESH_SIGNUP_WINDOW_MS = 60_000;

export function isFreshSignup(
  user: User | null | undefined,
  eventAtMs = Date.now(),
): boolean {
  if (!user?.created_at) return false;
  const createdAtMs = new Date(user.created_at).getTime();
  if (Number.isNaN(createdAtMs)) return false;
  return eventAtMs - createdAtMs < FRESH_SIGNUP_WINDOW_MS;
}
