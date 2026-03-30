import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import bursLogoWhite from '@/assets/burs-logo-white.png';
import bursLogoDark from '@/assets/burs-logo-256-2.png';
import { useTheme } from '@/contexts/ThemeContext';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { theme } = useTheme();

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
    });

    const hash = window.location.hash;
    if (hash.includes('type=recovery')) setIsRecovery(true);

    const params = new URLSearchParams(window.location.search);
    if (params.get('type') === 'recovery') setIsRecovery(true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setIsRecovery(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    if (password.length < 8) { toast.error(t('auth.password_too_short')); return; }
    if (password !== confirmPassword) { toast.error(t('auth.passwords_no_match')); return; }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast.error(t('auth.something_wrong'));
    } else {
      setDone(true);
      toast.success(t('auth.password_updated'));
      setTimeout(() => navigate('/'), 2000);
    }
  };

  // Dark mode: noir glass inputs | Light mode: editorial warm inputs — underline style (border-b only)
  const inputClass = isDark
    ? "w-full h-12 border-b border-white/[0.08] bg-transparent px-4 text-[15px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors disabled:opacity-40"
    : "w-full h-12 px-4 text-[15px] text-foreground placeholder:text-muted-foreground bg-transparent border-b border-border focus:outline-none focus:border-foreground transition-colors disabled:opacity-40";

  const cardClass = isDark
    ? "rounded-[1.25rem] border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl"
    : "rounded-[1.25rem] border border-border bg-card";

  const renderContent = () => {
    if (done) {
      return (
        <motion.div
          className={`${cardClass} p-8 text-center space-y-4`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: EASE_CURVE }}
        >
          <CheckCircle className={`w-12 h-12 mx-auto ${isDark ? 'text-emerald-400' : 'text-foreground'}`} />
          <p className="font-medium">{t('auth.password_updated')}</p>
          <p className="text-sm text-muted-foreground">{t('auth.redirecting')}</p>
        </motion.div>
      );
    }

    if (!isRecovery) {
      return (
        <motion.div
          className={`${cardClass} p-8 text-center space-y-5`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_CURVE }}
        >
          <p className="text-sm text-muted-foreground">{t('auth.invalid_reset_link')}</p>
          <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>
            {t('auth.back_to_login')}
          </Button>
        </motion.div>
      );
    }

    return (
      <motion.div
        className={`${cardClass} overflow-hidden`}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: EASE_CURVE }}
      >
        <div className="p-6 pb-2">
          <h2 className="font-display italic text-lg">{t('auth.set_new_password')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('auth.set_new_password_desc')}</p>
        </div>
        <div className="p-6 pt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground pl-0.5">{t('auth.new_password')}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.min_password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => { hapticLight(); setShowPassword(!showPassword); }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground pl-0.5">{t('auth.confirm_password')}</label>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              className={inputClass}
            />
          </div>
          <Button className="w-full mt-2" disabled={isLoading} onClick={() => { hapticLight(); handleReset(); }}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.updating')}
              </>
            ) : (
              t('auth.update_password')
            )}
          </Button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className={isDark
      ? "dark-landing min-h-screen flex flex-col items-center justify-center p-5 relative overflow-hidden"
      : "min-h-screen flex flex-col items-center justify-center p-5 relative overflow-hidden bg-background text-foreground"
    }>
      {/* Aurora glow (dark only) */}
      {isDark && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-[radial-gradient(ellipse,rgba(99,102,241,0.10)_0%,transparent_70%)] blur-3xl" />
        </div>
      )}

      <div className="relative z-10 w-full max-w-sm space-y-10">
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: EASE_CURVE }}
        >
          <img
            src={isDark ? bursLogoWhite : bursLogoDark}
            alt="BURS"
            className="h-10 w-auto opacity-90"
          />
        </motion.div>
        {renderContent()}
      </div>
    </div>
  );
}
