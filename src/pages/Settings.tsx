import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Palette, Bell, Shield, LogOut, Download, Trash2, Loader2,
  Moon, Sun, Monitor, Ruler, Weight, Lock, CheckCircle2, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { PremiumSection } from '@/components/PremiumSection';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Chip } from '@/components/ui/chip';
import { CalendarSection } from '@/components/settings/CalendarSection';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUPPORTED_LOCALES, Locale } from '@/i18n/translations';

const colors = [
  'svart', 'vit', 'grå', 'marinblå', 'blå', 'röd', 'grön', 'beige', 'brun', 'rosa', 'gul', 'orange', 'lila'
];

interface Preferences {
  favoriteColors?: string[];
  dislikedColors?: string[];
  fitPreference?: string;
  styleVibe?: string;
  genderNeutral?: boolean;
  morningReminder?: boolean;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { subscription, isPremium, limits } = useSubscription();
  const { locale, setLocale, t } = useLanguage();
  
  const [displayName, setDisplayName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [heightCm, setHeightCm] = useState<string>('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [heightError, setHeightError] = useState('');
  const [bodySaved, setBodySaved] = useState(false);

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
    const p = profile as (typeof profile & { height_cm?: number | null; weight_kg?: number | null });
    if (p?.height_cm) setHeightCm(String(p.height_cm));
    if (p?.weight_kg) setWeightKg(String(p.weight_kg));
  }, [profile]);

  const preferences = (profile?.preferences as Preferences) || {};

  const updatePreference = async (key: keyof Preferences, value: unknown) => {
    const newPrefs = { ...preferences, [key]: value };
    try {
      await updateProfile.mutateAsync({ preferences: newPrefs });
    } catch {
      toast.error(t('settings.pref_error'));
    }
  };

  const toggleColorPreference = async (type: 'favoriteColors' | 'dislikedColors', color: string) => {
    const currentColors = preferences[type] || [];
    const newColors = currentColors.includes(color)
      ? currentColors.filter((c: string) => c !== color)
      : [...currentColors, color];
    await updatePreference(type, newColors);
  };

  const handleSaveDisplayName = async () => {
    try {
      await updateProfile.mutateAsync({ display_name: displayName });
      toast.success(t('settings.name_saved'));
    } catch {
      toast.error(t('settings.name_error'));
    }
  };

  const validateHeight = (val: string) => {
    const n = parseInt(val, 10);
    if (val && (isNaN(n) || n < 100 || n > 250)) {
      setHeightError(t('settings.height_error'));
      return false;
    }
    setHeightError('');
    return true;
  };

  const handleSaveBodyData = async () => {
    if (heightCm && !validateHeight(heightCm)) return;
    try {
      const updates: Record<string, unknown> = {};
      if (heightCm) updates.height_cm = parseInt(heightCm, 10);
      else updates.height_cm = null;
      if (weightKg) updates.weight_kg = parseInt(weightKg, 10);
      else updates.weight_kg = null;
      await updateProfile.mutateAsync(updates as Parameters<typeof updateProfile.mutateAsync>[0]);
      setBodySaved(true);
      setTimeout(() => setBodySaved(false), 2500);
    } catch {
      toast.error(t('settings.body_save_error'));
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const [garmentsRes, outfitsRes, profileRes] = await Promise.all([
        supabase.from('garments').select('*').eq('user_id', user?.id),
        supabase.from('outfits').select('*, outfit_items(*)').eq('user_id', user?.id),
        supabase.from('profiles').select('*').eq('id', user?.id).single(),
      ]);

      const data = {
        profile: profileRes.data,
        garments: garmentsRes.data,
        outfits: outfitsRes.data,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `garderobsassistent-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(t('settings.export_success'));
    } catch {
      toast.error(t('settings.export_error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete_user_account');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      toast.success(t('settings.delete_success'));
      navigate('/auth');
    } catch (error) {
      console.error('Delete account failed:', error);
      toast.error(t('settings.delete_error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title={t('settings.title')} />
      
      <div className="p-4 space-y-6">
        <PremiumSection isPremium={isPremium} subscription={subscription} limits={limits} />

        {/* Theme Toggle */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Moon className="w-5 h-5" />
              <CardTitle className="text-base">{t('settings.appearance')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('light')} className="flex-1">
                <Sun className="w-4 h-4 mr-2" />{t('settings.theme.light')}
              </Button>
              <Button variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('dark')} className="flex-1">
                <Moon className="w-4 h-4 mr-2" />{t('settings.theme.dark')}
              </Button>
              <Button variant={theme === 'system' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('system')} className="flex-1">
                <Monitor className="w-4 h-4 mr-2" />Auto
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Language Selector */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              <CardTitle className="text-base">{t('settings.language')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPORTED_LOCALES.map((loc) => (
                  <SelectItem key={loc.code} value={loc.code}>{loc.flag} {loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <CalendarSection />

        {/* Profile */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5" />
              <CardTitle className="text-base">{t('settings.profile')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.display_name')}</Label>
              <div className="flex gap-2">
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('settings.your_name')} />
                <Button onClick={handleSaveDisplayName} disabled={updateProfile.isPending}>{t('settings.save')}</Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">{t('settings.email')} {user?.email}</div>
          </CardContent>
        </Card>

        {/* Body Data */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Ruler className="w-5 h-5" />
              <div>
                <CardTitle className="text-base">{t('settings.body_data')}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{t('settings.body_help')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Ruler className="w-3.5 h-3.5 text-primary" />{t('settings.height')}
              </Label>
              <div className="relative">
                <Input
                  type="number" inputMode="numeric" value={heightCm}
                  onChange={(e) => { setHeightCm(e.target.value); if (heightError) validateHeight(e.target.value); }}
                  onBlur={() => validateHeight(heightCm)}
                  placeholder="175"
                  className={`pr-12 h-12${heightError ? ' border-destructive focus-visible:ring-destructive' : ''}`}
                  min={100} max={250}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">cm</span>
              </div>
              {heightError && <p className="text-xs text-destructive">{heightError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Weight className="w-3.5 h-3.5 text-primary" />{t('settings.weight')}
                <span className="text-muted-foreground font-normal">{t('settings.optional')}</span>
              </Label>
              <div className="relative">
                <Input type="number" inputMode="numeric" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" className="pr-12 h-12" min={30} max={300} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">kg</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-muted/50 rounded-lg p-3">
              <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">{t('settings.body_privacy')}</p>
            </div>

            <Button onClick={handleSaveBodyData} disabled={updateProfile.isPending} className="w-full">
              {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : bodySaved ? <CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> : null}
              {bodySaved ? t('settings.saved') : t('settings.save_measurements')}
            </Button>
          </CardContent>
        </Card>

        {/* Style Preferences */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              <CardTitle className="text-base">{t('settings.style')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>{t('settings.favorite_colors')}</Label>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <Chip key={color} selected={preferences.favoriteColors?.includes(color)} onClick={() => toggleColorPreference('favoriteColors', color)} className="capitalize">{color}</Chip>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('settings.disliked_colors')}</Label>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <Chip key={color} selected={preferences.dislikedColors?.includes(color)} onClick={() => toggleColorPreference('dislikedColors', color)} className="capitalize">{color}</Chip>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('settings.fit')}</Label>
              <Select value={preferences.fitPreference || 'regular'} onValueChange={(v) => updatePreference('fitPreference', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="loose">Loose</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="slim">Slim</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('settings.default_style')}</Label>
              <Select value={preferences.styleVibe || 'smart-casual'} onValueChange={(v) => updatePreference('styleVibe', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="street">Street</SelectItem>
                  <SelectItem value="smart-casual">Smart casual</SelectItem>
                  <SelectItem value="klassisk">Klassisk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>{t('settings.gender_neutral')}</Label>
              <Switch checked={preferences.genderNeutral || false} onCheckedChange={(v) => updatePreference('genderNeutral', v)} />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <CardTitle className="text-base">{t('settings.notifications_title')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label>{t('settings.morning_reminder')}</Label>
              <Switch checked={preferences.morningReminder || false} onCheckedChange={(v) => updatePreference('morningReminder', v)} />
            </div>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <CardTitle className="text-base">{t('settings.privacy')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full" onClick={handleExportData} disabled={isExporting}>
              {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {t('settings.export')}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="w-4 h-4 mr-2" />{t('settings.delete_account')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.delete_permanent')}</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>{t('settings.delete_warning')}</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>{t('settings.delete_garments')}</li>
                      <li>{t('settings.delete_outfits')}</li>
                      <li>{t('settings.delete_history')}</li>
                      <li>{t('settings.delete_profile')}</li>
                      <li>{t('settings.delete_account_item')}</li>
                    </ul>
                    <p className="font-medium text-destructive pt-2">{t('settings.delete_irreversible')}</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground" disabled={isDeleting}>
                    {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('settings.delete_permanently')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-2" />{t('settings.sign_out')}
        </Button>
      </div>
    </AppLayout>
  );
}
