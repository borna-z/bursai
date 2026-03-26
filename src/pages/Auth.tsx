import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import bursLogo from '@/assets/burs-logo-256-2.png';

function PasswordRequirements({ password, t }: { password: string; t: (k: string) => string }) {
  const rules = useMemo(() => [
    { key: 'auth.req_length', met: password.length >= 8 },
    { key: 'auth.req_uppercase', met: /[A-Z]/.test(password) },
    { key: 'auth.req_lowercase', met: /[a-z]/.test(password) },
    { key: 'auth.req_number', met: /[0-9]/.test(password) },
  ], [password]);

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
      {rules.map(r => (
        <div key={r.key} className="flex items-center gap-1.5 transition-colors duration-200">
          {r.met ? (
            <Check className="w-3 h-3 text-foreground shrink-0" />
          ) : (
            <div className="w-3 h-3 rounded-full border border-border shrink-0" />
          )}
          <span className={`text-[11px] font-['DM_Sans'] transition-colors duration-200 ${r.met ? 'text-foreground' : 'text-muted-foreground/50'}`}>
            {t(r.key)}
          </span>
        </div>
      ))}
    </div>
  );
}

function getLoginErrorMessage(error: Error, t: (k: string) => string) {
  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Wrong email or password. If this account was created with Google, use Continue with Google.';
  }

  if (message.includes('email not confirmed')) {
    return 'Please confirm your email before logging in.';
  }

  if (message.includes('provider') || message.includes('oauth') || message.includes('identity')) {
    return 'This account is set up with Google sign-in. Use Continue with Google or reset your password.';
  }

  if (message.includes('fetch') || message.includes('network')) {
    return 'Connection problem. Please refresh and try again.';
  }

  return t('auth.something_wrong');
}

export default function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/40" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error(t('auth.fill_all')); return; }
    setIsLoading(true);
    setEmailNotConfirmed(false);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setEmailNotConfirmed(true);
      }
      toast.error(getLoginErrorMessage(error, t));
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) { toast.error(t('auth.enter_email_first')); return; }
    setResendingEmail(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResendingEmail(false);
    if (error) {
      toast.error(error.message || t('auth.something_wrong'));
    } else {
      toast.success('Confirmation email sent!');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error(t('auth.fill_all')); return; }
    const passOk = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
    if (!passOk) { toast.error(t('auth.password_too_short')); return; }
    setIsLoading(true);
    const { data, error } = await signUp(email, password);
    setIsLoading(false);
    if (error) {
      if (error.message.includes('already registered')) toast.error(t('auth.already_exists'));
      else if (error.message.includes('weak_password') || error.message.includes('weak') || error.message.includes('pwned')) toast.error(t('auth.weak_password'));
      else toast.error(error.message || t('auth.something_wrong'));
    } else if (data?.user?.identities?.length === 0) {
      toast.error(t('auth.already_exists'));
    } else if (data?.user && !data.session) {
      toast.success(t('auth.check_email'));
    } else {
      toast.success(t('auth.account_created'));
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { toast.error(t('auth.enter_email_first')); return; }
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);
    if (error) toast.error(t('auth.something_wrong'));
    else toast.success(t('auth.reset_email_sent'));
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) {
        toast.error(t('auth.something_wrong'));
        setIsLoading(false);
      }
    } catch {
      toast.error(t('auth.something_wrong'));
      setIsLoading(false);
    }
  };

  const isLogin = tab === 'login';

  const inputClass = "w-full h-12 border border-border bg-white/60 dark:bg-white/5 px-4 text-[15px] font-['DM_Sans'] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/30 transition-colors disabled:opacity-40";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 bg-background font-['DM_Sans']">
      <div className="w-full max-w-sm space-y-10">
        {/* Logo */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_CURVE }}
        >
          <img src={bursLogo} alt="BURS" width={48} height={48} className="h-12 w-auto" />
          <p className="text-muted-foreground text-[11px] uppercase tracking-[0.2em]">
            {t('auth.tagline')}
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="border border-border bg-card overflow-hidden"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: EASE_CURVE }}
        >
          {/* OAuth */}
          <div className="p-6 pb-4 space-y-2.5">
            <button
              type="button"
              className="w-full h-12 border border-foreground text-foreground text-[11px] font-medium uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
              disabled={isLoading}
              onClick={() => handleOAuth('google')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {t('auth.continue_google')}
            </button>
          </div>

          {/* Divider */}
          <div className="px-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">{t('auth.or')}</span>
              </div>
            </div>
          </div>

          {/* Tabs — underline style */}
          <div className="px-6 pt-5">
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setTab('login')}
                className={`flex-1 text-[11px] uppercase tracking-[0.15em] font-medium pb-3 transition-all duration-200 border-b-2 -mb-px ${
                  isLogin
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground'
                }`}
              >
                {t('auth.login')}
              </button>
              <button
                type="button"
                onClick={() => setTab('signup')}
                className={`flex-1 text-[11px] uppercase tracking-[0.15em] font-medium pb-3 transition-all duration-200 border-b-2 -mb-px ${
                  !isLogin
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground'
                }`}
              >
                {t('auth.signup')}
              </button>
            </div>
          </div>

          {/* Form */}
          <motion.form
            key={tab}
            onSubmit={isLogin ? handleSignIn : handleSignUp}
            className="p-6 space-y-4"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.15em] font-medium text-muted-foreground pl-0.5">{t('auth.email')}</label>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className={inputClass}
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.15em] font-medium text-muted-foreground pl-0.5">{t('auth.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isLogin ? '••••••••' : t('auth.min_password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className={`${inputClass} pr-11`}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                  aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {!isLogin && password.length > 0 && (
                <PasswordRequirements password={password} t={t} />
              )}
            </div>

            {/* Remember me + Forgot */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`w-4 h-4 border flex items-center justify-center transition-all duration-200 ${
                    rememberMe
                      ? 'bg-foreground border-foreground'
                      : 'border-border bg-transparent hover:border-muted-foreground'
                  }`}
                >
                  {rememberMe && <Check className="w-3 h-3 text-background" />}
                </div>
                <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors select-none">
                  {t('auth.remember_me')}
                </span>
              </label>
              {isLogin && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors underline-offset-2 hover:underline"
                >
                  {t('auth.forgot_password')}
                </button>
              )}
            </div>

            {/* Resend confirmation */}
            {isLogin && emailNotConfirmed && (
              <div className="flex items-center justify-between bg-muted/40 border border-border px-3 py-2.5">
                <span className="text-[11px] text-foreground font-['DM_Sans']">
                  Email not confirmed.
                </span>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendingEmail}
                  className="text-[11px] text-foreground font-medium font-['DM_Sans'] underline underline-offset-2 hover:text-foreground/70 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                >
                  {resendingEmail && <Loader2 className="w-3 h-3 animate-spin" />}
                  Resend confirmation email
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-[52px] bg-foreground text-background text-[11px] uppercase tracking-[0.15em] font-semibold hover:bg-foreground/90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isLogin ? t('auth.logging_in') : t('auth.creating')}
                </>
              ) : (
                isLogin ? t('auth.login') : t('auth.signup')
              )}
            </button>
          </motion.form>
        </motion.div>
      </div>
    </div>
  );
}
