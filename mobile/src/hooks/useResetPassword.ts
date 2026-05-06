// Password reset — request + confirm.
//
// requestReset: triggers Supabase to email a recovery link with redirect to
//   `burs://reset-password`. The deep-link handler in App.tsx parses the
//   recovery hash fragment (#access_token=...&refresh_token=...&type=recovery)
//   and calls supabase.auth.setSession before React Navigation routes the
//   user to ResetPasswordScreen, so by the time confirmReset runs the user
//   has an active session and updateUser succeeds.
//
// confirmReset: writes the new password against the active session. Same
//   call path serves both the deep-link recovery flow AND a signed-in user
//   navigating from SettingsAccountScreen → ResetPassword to change their
//   password — both have a session at the point of call.
//
// Plain async functions rather than useMutation: the two methods are used
// in different screens (request from AuthScreen, confirm from
// ResetPasswordScreen) and neither needs cache invalidation, so there's no
// React Query value here. Errors are still piped to Sentry so backend
// failures (rate limit, weak-password policy, expired recovery token) show
// up in the same dashboard as captureMutationError sites.

import { supabase } from '../lib/supabase';
import { captureMutationError } from '../lib/sentry';

export const RESET_PASSWORD_REDIRECT = 'burs://reset-password';

export type ResetResult = { error: Error | null };

const reportRequest = captureMutationError('useResetPassword.requestReset');
const reportConfirm = captureMutationError('useResetPassword.confirmReset');

export function useResetPassword() {
  const requestReset = async (email: string): Promise<ResetResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_PASSWORD_REDIRECT,
    });
    if (error) reportRequest(error);
    return { error: (error as Error | null) ?? null };
  };

  const confirmReset = async (newPassword: string): Promise<ResetResult> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) reportConfirm(error);
    return { error: (error as Error | null) ?? null };
  };

  return { requestReset, confirmReset };
}
