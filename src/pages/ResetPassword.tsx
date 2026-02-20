import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Check hash for type=recovery
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    // Check search params for type=recovery
    const params = new URLSearchParams(window.location.search);
    if (params.get('type') === 'recovery') {
      setIsRecovery(true);
    }

    // If a session already exists, the recovery token was already consumed by AuthContext
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error(t('auth.password_too_short'));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t('auth.passwords_no_match'));
      return;
    }

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

  if (!isRecovery && !done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-secondary/30">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground text-sm">{t('auth.invalid_reset_link')}</p>
            <Button variant="outline" onClick={() => navigate('/auth')} className="w-full">
              {t('auth.back_to_login')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-secondary/30">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="font-medium">{t('auth.password_updated')}</p>
            <p className="text-sm text-muted-foreground">{t('auth.redirecting')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-secondary/30">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <h1
            className="text-3xl font-bold tracking-[0.12em]"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            DRAPE
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('auth.set_new_password')}</CardTitle>
            <CardDescription>{t('auth.set_new_password_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('auth.new_password')}</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder={t('auth.min_password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('auth.confirm_password')}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder={t('auth.confirm_password')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('auth.updating')}
                  </>
                ) : (
                  t('auth.update_password')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
