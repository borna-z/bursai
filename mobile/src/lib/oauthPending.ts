// One-shot pending-OAuth marker for the Google sign-in deep link.
//
// Why this exists (Codex P2 round 1 on PR #844): supabase-js v2 defaults to
// the implicit OAuth flow when `flowType` is unset, so the Google callback
// arrives as `burs://auth/callback#access_token=…&refresh_token=…`. The
// `burs://` custom scheme is NOT exclusive on either iOS or Android — any
// other app that registered the same scheme can synthesise that fragment
// and force a session swap to an attacker-controlled Supabase account by
// calling `setSession` with bearer tokens of its choosing.
//
// PKCE is intrinsically safe (the code is useless without the local
// `code_verifier` supabase-js stashed in AsyncStorage), so the gate only
// guards the implicit-token path. AuthScreen calls `markOAuthPending()`
// right before opening the provider URL; RootNavigator calls
// `consumeOAuthPending()` before honouring any tokens in the fragment.
// Missing/expired marker → callback is dropped silently.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@burs/oauth-pending-google';
// 10 min — same window the calendar PKCE verifier uses; comfortably longer
// than a real consent flow, short enough to neutralise stale markers.
const TTL_MS = 10 * 60 * 1000;

type StoredMarker = { createdAt: number };

/** Stash a one-shot marker right before opening the provider URL. */
export async function markOAuthPending(): Promise<void> {
  const payload: StoredMarker = { createdAt: Date.now() };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/** Pull and immediately delete the marker. Returns true only when a fresh
 *  (non-expired) marker existed — the caller should treat false as "drop
 *  the callback, this wasn't us". */
export async function consumeOAuthPending(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  await AsyncStorage.removeItem(STORAGE_KEY);
  try {
    const parsed = JSON.parse(raw) as StoredMarker;
    if (typeof parsed?.createdAt !== 'number') return false;
    if (Date.now() - parsed.createdAt > TTL_MS) return false;
    return true;
  } catch {
    return false;
  }
}
