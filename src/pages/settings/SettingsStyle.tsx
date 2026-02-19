import { useState, useEffect } from 'react';
import { Ruler, Weight, Lock, Palette, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Chip } from '@/components/ui/chip';
import { toast } from 'sonner';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
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

export default function SettingsStyle() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { t } = useLanguage();

  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightError, setHeightError] = useState('');
  const [bodySaved, setBodySaved] = useState(false);

  useEffect(() => {
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

  return (
    <AppLayout>
      <PageHeader title="Stil" showBack />

      <div className="px-4 pb-6 pt-4 space-y-6 max-w-lg mx-auto">
        <SettingsGroup title={t('settings.body_data')}>
          <div className="px-4 py-3 border-b border-border/50 space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <Ruler className="w-3.5 h-3.5 text-accent" />{t('settings.height')}
            </Label>
            <div className="relative">
              <Input type="number" inputMode="numeric" value={heightCm}
                onChange={(e) => { setHeightCm(e.target.value); if (heightError) validateHeight(e.target.value); }}
                onBlur={() => validateHeight(heightCm)}
                placeholder="175"
                className={`pr-12 h-10 text-sm${heightError ? ' border-destructive focus-visible:ring-destructive' : ''}`}
                min={100} max={250} />
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
          <div className="px-4 py-3">
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
      </div>
    </AppLayout>
  );
}
