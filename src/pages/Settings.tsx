import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Palette, Bell, LogOut, Download, Trash2, Loader2,
  Moon, Sun, Monitor, Ruler, Weight, Lock, CheckCircle2, Globe, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
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
import { AccentColorPicker } from '@/components/settings/AccentColorPicker';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsGroup } from '@/components/settings/SettingsGroup';

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
    if (profile?.display_name) setDisplayName(profile.display_name);
    const p = profile as (typeof profile & { height_cm?: number | null; weight_kg?: number | null });
    if (p?.height_cm) setHeightCm(String(p.height_cm));
    if (p?.weight_kg) setWeightKg(String(p.weight_kg));
  }, [profile]);

  const preferences = (profile?.preferences as Preferences) || {};

  const updatePreference = async (key: keyof Preferences, value: unknown) => {
    const newPrefs = { ...preferences, [key]: value };
    try { await updateProfile.mutateAsync({ preferences: newPrefs }); }
    catch { toast.error(t('settings.pref_error')); }
  };

  const toggleColorPreference = async (type: 'favoriteColors' | 'dislikedColors', color: string) => {
    const currentColors = preferences[type] || [];
    const newColors = currentColors.includes(color)
      ? currentColors.filter((c: string) => c !== color)
      : [...currentColors, color];
    await updatePreference(type, newColors);
  };

  const handleSaveDisplayName = async () => {
    try { await updateProfile.mutateAsync({ display_name: displayName }); toast.success(t('settings.name_saved')); }
    catch { toast.error(t('settings.name_error')); }
  };

  const validateHeight = (val: string) => {
    const n = parseInt(val, 10);
    if (val && (isNaN(n) || n < 100 || n > 250)) { setHeightError(t('settings.height_error')); return false; }
    setHeightError(''); return true;
  };

  const handleSaveBodyData = async () => {
    if (heightCm && !validateHeight(heightCm)) return;
    try {
      const updates: Record<string, unknown> = {};
      updates.height_cm = heightCm ? parseInt(heightCm, 10) : null;
      updates.weight_kg = weightKg ? parseInt(weightKg, 10) : null;
      await updateProfile.mutateAsync(updates as Parameters<typeof updateProfile.mutateAsync>[0]);
      setBodySaved(true);
      setTimeout(() => setBodySaved(false), 2500);
    } catch { toast.error(t('settings.body_save_error')); }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const [garmentsRes, outfitsRes, profileRes] = await Promise.all([
        supabase.from('garments').select('*').eq('user_id', user?.id),
        supabase.from('outfits').select('*, outfit_items(*)').eq('user_id', user?.id),
        supabase.from('profiles').select('*').eq('id', user?.id).single(),
      ]);
      const data = { profile: profileRes.data, garments: garmentsRes.data, outfits: outfitsRes.data, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `garderobsassistent-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('settings.export_success'));
    } catch { toast.error(t('settings.export_error')); }
    finally { setIsExporting(false); }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete_user_account');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      toast.success(t('settings.delete_success'));
      navigate('/auth');
    } catch (error) { console.error('Delete account failed:', error); toast.error(t('settings.delete_error')); }
    finally { setIsDeleting(false); }
  };

  const handleSignOut = async () => { await signOut(); navigate('/auth'); };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title={t('settings.title')} />

      <Tabs defaultValue="general" className="flex flex-col flex-1">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 pb-2 pt-1">
          <TabsList className="w-full h-10 bg-muted/60 p-0.5 rounded-lg">
            <TabsTrigger value="general" className="flex-1 text-xs data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-md">
              {t('settings.appearance').split(' ')[0] || 'Allmänt'}
            </TabsTrigger>
            <TabsTrigger value="style" className="flex-1 text-xs data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-md">
              {t('settings.style')}
            </TabsTrigger>
            <TabsTrigger value="account" className="flex-1 text-xs data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-md">
              {t('settings.profile')}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── General Tab ── */}
        <TabsContent value="general" className="px-4 pt-2 pb-6">
          <SettingsGroup title={t('settings.appearance')}>
            <div className="px-4 py-3 border-b border-border/50">
              <div className="flex gap-1.5">
                <Button variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('light')} className={`flex-1 h-9 text-xs ${theme === 'light' ? 'bg-accent text-accent-foreground' : ''}`}>
                  <Sun className="w-3.5 h-3.5 mr-1.5" />{t('settings.theme.light')}
                </Button>
                <Button variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('dark')} className={`flex-1 h-9 text-xs ${theme === 'dark' ? 'bg-accent text-accent-foreground' : ''}`}>
                  <Moon className="w-3.5 h-3.5 mr-1.5" />{t('settings.theme.dark')}
                </Button>
                <Button variant={theme === 'system' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('system')} className={`flex-1 h-9 text-xs ${theme === 'system' ? 'bg-accent text-accent-foreground' : ''}`}>
                  <Monitor className="w-3.5 h-3.5 mr-1.5" />Auto
                </Button>
              </div>
            </div>
            <div className="px-4 py-3">
              <AccentColorPicker />
            </div>
          </SettingsGroup>

          <SettingsGroup title={t('settings.language')}>
            <SettingsRow icon={<Globe />} label={t('settings.language')} last>
              <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                <SelectTrigger className="w-[130px] h-8 text-xs border-0 bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LOCALES.map((loc) => (
                    <SelectItem key={loc.code} value={loc.code}>{loc.flag} {loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title={t('settings.notifications_title')}>
            <SettingsRow icon={<Bell />} label={t('settings.morning_reminder')} last>
              <Switch checked={preferences.morningReminder || false} onCheckedChange={(v) => updatePreference('morningReminder', v)} />
            </SettingsRow>
          </SettingsGroup>

          <CalendarSection />
        </TabsContent>

        {/* ── Style Tab ── */}
        <TabsContent value="style" className="px-4 pt-2 pb-6">
          <SettingsGroup title={t('settings.body_data')}>
            <div className="px-4 py-3 border-b border-border/50 space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <Ruler className="w-3.5 h-3.5 text-accent" />{t('settings.height')}
              </Label>
              <div className="relative">
                <Input
                  type="number" inputMode="numeric" value={heightCm}
                  onChange={(e) => { setHeightCm(e.target.value); if (heightError) validateHeight(e.target.value); }}
                  onBlur={() => validateHeight(heightCm)}
                  placeholder="175"
                  className={`pr-12 h-10 text-sm${heightError ? ' border-destructive focus-visible:ring-destructive' : ''}`}
                  min={100} max={250}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">cm</span>
              </div>
              {heightError && <p className="text-xs text-destructive">{heightError}</p>}
            </div>
            <div className="px-4 py-3 border-b border-border/50 space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <Weight className="w-3.5 h-3.5 text-accent" />{t('settings.weight')}
                <span className="text-muted-foreground font-normal">{t('settings.optional')}</span>
              </Label>
              <div className="relative">
                <Input type="number" inputMode="numeric" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" className="pr-12 h-10 text-sm" min={30} max={300} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
              </div>
            </div>
            <div className="px-4 py-2.5 border-b border-border/50">
              <div className="flex items-start gap-2 text-muted-foreground">
                <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">{t('settings.body_privacy')}</p>
              </div>
            </div>
            <div className="px-4 py-3">
              <Button onClick={handleSaveBodyData} disabled={updateProfile.isPending} size="sm" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-9 text-xs">
                {updateProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : bodySaved ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> : null}
                {bodySaved ? t('settings.saved') : t('settings.save_measurements')}
              </Button>
            </div>
          </SettingsGroup>

          <SettingsGroup title={t('settings.favorite_colors')}>
            <div className="px-4 py-3 border-b border-border/50">
              <div className="flex flex-wrap gap-1.5">
                {colors.map((color) => (
                  <Chip key={color} selected={preferences.favoriteColors?.includes(color)} onClick={() => toggleColorPreference('favoriteColors', color)} className="capitalize text-xs">{color}</Chip>
                ))}
              </div>
            </div>
          </SettingsGroup>

          <SettingsGroup title={t('settings.disliked_colors')}>
            <div className="px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
                {colors.map((color) => (
                  <Chip key={color} selected={preferences.dislikedColors?.includes(color)} onClick={() => toggleColorPreference('dislikedColors', color)} className="capitalize text-xs">{color}</Chip>
                ))}
              </div>
            </div>
          </SettingsGroup>

          <SettingsGroup title={t('settings.fit')}>
            <SettingsRow icon={<Palette />} label={t('settings.fit')}>
              <Select value={preferences.fitPreference || 'regular'} onValueChange={(v) => updatePreference('fitPreference', v)}>
                <SelectTrigger className="w-[110px] h-8 text-xs border-0 bg-muted/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="loose">Loose</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="slim">Slim</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
            <SettingsRow icon={<Palette />} label={t('settings.default_style')}>
              <Select value={preferences.styleVibe || 'smart-casual'} onValueChange={(v) => updatePreference('styleVibe', v)}>
                <SelectTrigger className="w-[130px] h-8 text-xs border-0 bg-muted/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="street">Street</SelectItem>
                  <SelectItem value="smart-casual">Smart casual</SelectItem>
                  <SelectItem value="klassisk">Klassisk</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
            <SettingsRow icon={<Palette />} label={t('settings.gender_neutral')} last>
              <Switch checked={preferences.genderNeutral || false} onCheckedChange={(v) => updatePreference('genderNeutral', v)} />
            </SettingsRow>
          </SettingsGroup>
        </TabsContent>

        {/* ── Account Tab ── */}
        <TabsContent value="account" className="px-4 pt-2 pb-6">
          <div className="mb-6">
            <PremiumSection isPremium={isPremium} subscription={subscription} limits={limits} />
          </div>

          <SettingsGroup title={t('settings.profile')}>
            <div className="px-4 py-3 border-b border-border/50 space-y-2">
              <Label className="text-xs font-medium">{t('settings.display_name')}</Label>
              <div className="flex gap-2">
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('settings.your_name')} className="h-9 text-sm" />
                <Button onClick={handleSaveDisplayName} disabled={updateProfile.isPending} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 h-9 text-xs px-4">
                  {t('settings.save')}
                </Button>
              </div>
            </div>
            <SettingsRow icon={<User />} label={t('settings.email')} last>
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">{user?.email}</span>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title={t('settings.privacy')}>
            <SettingsRow icon={<Download />} label={t('settings.export')} onClick={isExporting ? undefined : handleExportData}>
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </SettingsRow>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div>
                  <SettingsRow icon={<Trash2 />} label={t('settings.delete_account')} last className="text-destructive [&_span]:text-destructive">
                    <ChevronRight className="w-4 h-4 text-destructive/60" />
                  </SettingsRow>
                </div>
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
          </SettingsGroup>

          <SettingsGroup>
            <SettingsRow icon={<LogOut />} label={t('settings.sign_out')} onClick={handleSignOut} last>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </SettingsRow>
          </SettingsGroup>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
