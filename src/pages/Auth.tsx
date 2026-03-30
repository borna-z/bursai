import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Check } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { EASE_CURVE, STAGGER_DELAY, DURATION_MEDIUM, DURATION_SLOW } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
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
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2">
      {rules.map(r => (
        <div key={r.key} className="flex items-center gap-1.5 transition-colors duration-200">
          {r.met
            ? <Check className="w-3 h-3 text-accent shrink-0" />
            : <div className="w-3 h-3 rounded-full border border-border/50 shrink-0" />}
          <span className={`text-[11px] font-body transition-colors duration-200 ${r.met ? 'text-foreground' : 'text-muted-foreground/40'}`}>{t(r.key)}</span>
        </div>
      ))}
    </div>
  );
}

function getLoginErrorMessage(error: Error, t: (k: string) => string) {
  const msg = error.message.toLowerCase();
  if (msg.includes('invalid login credentials')) return t('auth.error_wrong_credentials');
  if (msg.includes('email not confirmed')) return t('auth.error_email_not_confirmed');
  if (msg.includes('provider') || msg.includes('oauth') || msg.includes('identity')) return t('auth.error_oauth_account');
  if (msg.includes('fetch') || msg.includes('network')) return t('auth.error_connection');
  return t('auth.something_wrong');
}

function EditorialGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {[14, 50, 86].map((pct) => (
        <div key={pct} className="absolute top-0 bottom-0 w-px"
          style={{ left: `${pct}%`, background: 'linear-gradient(to bottom, transparent, hsl(var(--border)/0.08) 18%, hsl(var(--border)/0.08) 82%, transparent)' }} />
      ))}
      {[25, 70].map((pct) => (
        <div key={pct} className="absolute left-0 right-0 h-px"
          style={{ top: `${pct}%`, background: 'linear-gradient(to right, transparent, hsl(var(--border)/0.06) 20%, hsl(var(--border)/0.06) 80%, transparent)' }} />
      ))}
    </div>
  );
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
  const prefersReduced = useReducedMotion();

  const animate = (delay: number) =>
    prefersReduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.1 } }
      : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: DURATION_MEDIUM, delay, ease: EASE_CURVE } };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <motion.img src={bursLogo} alt="BURS" className="h-8 w-auto"
          animate={prefersReduced ? { opacity: 1 } : { opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: EASE_CURVE }} />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const handleSignIn = async () => {
    if (!email || !password) { toast.error(t('auth.fill_all')); return; }
    setIsLoading(true); setEmailNotConfirmed(false);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) setEmailNotConfirmed(true);
      toast.error(getLoginErrorMessage(error, t));
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) { toast.error(t('auth.enter_email_first')); return; }
    setResendingEmail(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResendingEmail(false);
    if (error) toast.error(error.message || t('auth.something_wrong'));
    else toast.success(t('auth.confirmation_sent'));
  };

  const handleSignUp = async () => {
    if (!email || !password) { toast.error(t('auth.fill_all')); return; }
    const passOk = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
    if (!passOk) { toast.error(t('auth.password_too_short')); return; }
    setIsLoading(true);
    const { data, error } = await signUp(email, password);
    setIsLoading(false);
    if (error) {
      if (error.message.includes('already registered')) toast.error(t('auth.already_exists'));
      else if (error.message.includes('weak_password') || error.message.includes('pwned')) toast.error(t('auth.weak_password'));
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setIsLoading(false);
    if (error) toast.error(t('auth.something_wrong'));
    else toast.success(t('auth.reset_email_sent'));
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/`, queryParams: { access_type: 'offline', prompt: 'consent' } },
      });
      if (error) { toast.error(t('auth.something_wrong')); setIsLoading(false); }
    } catch { toast.error(t('auth.something_wrong')); setIsLoading(false); }
  };

  const handleSubmit = () => {
    hapticLight();
    if (tab === 'login') handleSignIn();
    else handleSignUp();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const isLogin = tab === 'login';
  const inputBase = "w-full h-12 border-b border-border/40 bg-transparent px-0 text-[15px] font-body text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-accent transition-colors duration-200 disabled:opacity-40 rounded-none";

  return (
    <div className="relative min-h-screen flex flex-col bg-background overflow-hidden font-body">
      <EditorialGrid />

      {/* Top eyebrow bar */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-[max(env(safe-area-inset-top,0px),24px)] pb-4">
        <p className="label-editorial text-muted-foreground/60 text-[9px] tracking-[0.26em]">
          {t('auth.header_tagline')}
        </p>
        <p className="label-editorial text-muted-foreground/30 text-[9px] tracking-[0.26em]">
          {t('auth.header_est')}
        </p>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-[340px]">

          {/* Hero: Logo + brand headline */}
          <motion.div
            className="mb-10 flex flex-col items-center gap-5"
            {...animate(0)}
          >
            <img src={bursLogo} alt="BURS" className="h-10 w-auto" />
            <h1 className="font-display italic text-[1.6rem] text-foreground tracking-tight">
              BURS
            </h1>
            <div className="flex items-center gap-4">
              <div className="h-px w-10 bg-accent/25" />
              <p className="label-editorial text-muted-foreground/50 text-[9px] tracking-[0.3em]">
                {t('auth.tagline') || 'The Digital Atelier'}
              </p>
              <div className="h-px w-10 bg-accent/25" />
            </div>
          </motion.div>

          {/* Tab switcher */}
          <motion.div {...animate(STAGGER_DELAY * 2)} className="mb-8">
            <div className="flex border-b border-border/30">
              {(['login', 'signup'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { hapticLight(); setTab(v); }}
                  className={`flex-1 pb-3 text-[11px] uppercase tracking-[0.2em] font-medium transition-all duration-200 border-b-[1.5px] -mb-px ${
                    tab === v
                      ? 'border-accent text-foreground'
                      : 'border-transparent text-muted-foreground/35 hover:text-muted-foreground/65'
                  }`}
                >
                  {v === 'login' ? t('auth.login') : t('auth.signup')}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Auth form card */}
          <motion.div {...animate(STAGGER_DELAY * 4)}>
            <div className="surface-secondary rounded-[1.25rem] p-5" onKeyDown={handleKeyDown}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  className="space-y-6"
                  initial={prefersReduced ? { opacity: 0 } : { opacity: 0, x: isLogin ? -10 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReduced ? { opacity: 0 } : { opacity: 0, x: isLogin ? 10 : -10 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {/* Email field */}
                  <div className="space-y-2">
                    <span className="block label-editorial text-muted-foreground/60 text-[9px] tracking-[0.24em]">
                      {t('auth.email')}
                    </span>
                    <input
                      type="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className={inputBase}
                      autoComplete="email"
                    />
                  </div>

                  {/* Password field */}
                  <div className="space-y-2">
                    <span className="block label-editorial text-muted-foreground/60 text-[9px] tracking-[0.24em]">
                      {t('auth.password')}
                    </span>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder={isLogin ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : t('auth.min_password')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className={`${inputBase} pr-8`}
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                      />
                      <button
                        type="button"
                        onClick={() => { hapticLight(); setShowPassword(!showPassword); }}
                        className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-foreground/60 transition-colors cursor-pointer"
                        aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {!isLogin && password.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.2 }}
                      >
                        <PasswordRequirements password={password} t={t} />
                      </motion.div>
                    )}
                  </div>

                  {/* Remember me + Forgot password */}
                  <div className="flex items-center justify-between">
                    <div
                      role="checkbox"
                      aria-checked={rememberMe}
                      tabIndex={0}
                      onClick={() => { hapticLight(); setRememberMe(!rememberMe); }}
                      onKeyDown={(e) => e.key === ' ' && setRememberMe(!rememberMe)}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all duration-150 ${
                        rememberMe
                          ? 'bg-accent border-accent'
                          : 'border-border/50 hover:border-foreground/30'
                      }`}>
                        {rememberMe && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className="text-[11px] text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors select-none">
                        {t('auth.remember_me')}
                      </span>
                    </div>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => { hapticLight(); handleForgotPassword(); }}
                        className="text-[11px] text-accent/70 hover:text-accent transition-colors hover:underline underline-offset-2"
                      >
                        {t('auth.forgot_password')}
                      </button>
                    )}
                  </div>

                  {/* Email not confirmed banner */}
                  {isLogin && emailNotConfirmed && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between bg-accent/8 border border-accent/20 rounded-xl px-4 py-3"
                    >
                      <span className="text-[11px] text-foreground/65">{t('auth.email_not_confirmed_notice')}</span>
                      <button
                        type="button"
                        onClick={() => { hapticLight(); handleResendConfirmation(); }}
                        disabled={resendingEmail}
                        className="text-[11px] text-accent font-medium underline underline-offset-2 hover:opacity-70 transition-opacity disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {resendingEmail && <Loader2 className="w-3 h-3 animate-spin" />}
                        {t('auth.resend')}
                      </button>
                    </motion.div>
                  )}

                  {/* Submit button */}
                  <motion.button
                    type="button"
                    disabled={isLoading}
                    onClick={handleSubmit}
                    whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                    className="w-full h-[50px] bg-foreground text-background rounded-full text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-foreground/88 transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>{isLogin ? t('auth.logging_in') : t('auth.creating')}</span>
                      </>
                    ) : (
                      isLogin ? t('auth.login') : t('auth.signup')
                    )}
                  </motion.button>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Divider */}
          <motion.div {...animate(STAGGER_DELAY * 6)} className="relative flex items-center gap-4 my-7">
            <div className="flex-1 h-px bg-border/25" />
            <span className="label-editorial text-muted-foreground/35 text-[9px] tracking-[0.22em]">{t('auth.or')}</span>
            <div className="flex-1 h-px bg-border/25" />
          </motion.div>

          {/* Google OAuth */}
          <motion.div {...animate(STAGGER_DELAY * 8)}>
            <motion.button
              type="button"
              disabled={isLoading}
              onClick={() => { hapticLight(); handleOAuth('google'); }}
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}
              className="w-full h-[50px] border border-border/40 bg-background hover:bg-card hover:border-border/60 rounded-full flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-40"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="text-[11px] uppercase tracking-[0.18em] text-foreground/70">{t('auth.continue_google')}</span>
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-center px-6 pb-[max(env(safe-area-inset-bottom,0px),20px)] pt-4">
        <p className="label-editorial text-muted-foreground/30 text-[9px] tracking-[0.22em]">
          {t('auth.footer')}
        </p>
      </div>
    </div>
  );
}
