import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import bursLogoWhite from '@/assets/burs-logo-white.png';

export default function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#030305]">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
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
    const { error } = await signIn(email, password);
    setIsLoading(false);
    if (error) {
      toast.error(error.message.includes('Invalid login credentials') ? t('auth.wrong_credentials') : t('auth.something_wrong'));
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error(t('auth.fill_all')); return; }
    if (password.length < 8) { toast.error(t('auth.password_too_short')); return; }
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
    const { error } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (error) { toast.error(t('auth.something_wrong')); setIsLoading(false); }
  };

  const isLogin = tab === 'login';

  return (
    <div className="dark-landing min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Aurora glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-[radial-gradient(ellipse,rgba(99,102,241,0.12)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] rounded-full bg-[radial-gradient(ellipse,rgba(139,92,246,0.08)_0%,transparent_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Logo + wordmark */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: EASE_CURVE }}
        >
          <img src={bursLogoWhite} alt="BURS" className="h-10 w-auto opacity-90" />
          <p className="text-white/40 text-sm tracking-wide">
            {t('auth.tagline')}
          </p>
        </motion.div>

        {/* Glass card */}
        <motion.div
          className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: EASE_CURVE }}
        >
          {/* OAuth */}
          <motion.div
            className="p-6 pb-4 space-y-2.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <button
              type="button"
              className="w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/80 text-sm font-medium flex items-center justify-center gap-3 hover:bg-white/[0.08] transition-colors disabled:opacity-40"
              disabled={isLoading}
              onClick={() => handleOAuth('google')}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {t('auth.continue_google')}
            </button>
            <button
              type="button"
              className="w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/80 text-sm font-medium flex items-center justify-center gap-3 hover:bg-white/[0.08] transition-colors disabled:opacity-40"
              disabled={isLoading}
              onClick={() => handleOAuth('apple')}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              {t('auth.continue_apple')}
            </button>
          </motion.div>

          {/* Divider */}
          <div className="px-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.06]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-transparent px-3 text-white/25">{t('auth.or')}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4">
            <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.06] p-0.5">
              <button
                type="button"
                onClick={() => setTab('login')}
                className={`flex-1 text-sm font-medium py-2 rounded-[10px] transition-all duration-200 ${
                  isLogin
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {t('auth.login')}
              </button>
              <button
                type="button"
                onClick={() => setTab('signup')}
                className={`flex-1 text-sm font-medium py-2 rounded-[10px] transition-all duration-200 ${
                  !isLogin
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-white/40 hover:text-white/60'
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50 pl-0.5">{t('auth.email')}</label>
              <input
                type="email"
                placeholder="din@email.se"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/15 transition-colors disabled:opacity-40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50 pl-0.5">{t('auth.password')}</label>
              <input
                type="password"
                placeholder={isLogin ? '••••••••' : t('auth.min_password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/15 transition-colors disabled:opacity-40"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-full bg-white text-[#030305] text-sm font-semibold hover:bg-white/90 active:scale-[0.97] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
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

            {isLogin && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="w-full text-xs text-white/30 hover:text-white/50 transition-colors text-center pt-1"
              >
                {t('auth.forgot_password')}
              </button>
            )}
          </motion.form>
        </motion.div>
      </div>
    </div>
  );
}
