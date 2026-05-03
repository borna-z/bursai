// Thin reader hook over AuthContext. Mirrors the web's useProfile shape just
// enough for screens to read profile + trigger a manual reload after a
// server-side mutation (e.g. saving onboarding completion).

import { useAuth } from '../contexts/AuthContext';

export function useProfile() {
  const { profile, refreshProfile } = useAuth();
  return { profile, refreshProfile };
}
