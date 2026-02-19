import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Palette,
  Bell,
  Shield,
  LogOut,
  Download,
  Trash2,
  Loader2,
  Moon,
  Sun,
  Monitor,
  Ruler,
  Weight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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
  
  const [displayName, setDisplayName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [heightCm, setHeightCm] = useState<string>('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [showBodySection, setShowBodySection] = useState(false);

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
    // Load body measurements from profile
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
      toast.error('Kunde inte spara inställningen');
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
      toast.success('Namn sparat');
    } catch {
      toast.error('Kunde inte spara namnet');
    }
  };

  const handleSaveBodyData = async () => {
    try {
      const updates: Record<string, unknown> = {};
      if (heightCm) updates.height_cm = parseInt(heightCm, 10);
      if (weightKg) updates.weight_kg = parseInt(weightKg, 10);
      await updateProfile.mutateAsync(updates as Parameters<typeof updateProfile.mutateAsync>[0]);
      toast.success('Kroppsdata sparat');
    } catch {
      toast.error('Kunde inte spara kroppsdata');
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

      toast.success('Data exporterad');
    } catch {
      toast.error('Kunde inte exportera data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete_user_account');
      
      if (error) {
        console.error('Delete account error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Unknown error');
      }

      toast.success('Ditt konto och all data har raderats permanent.');
      navigate('/auth');
    } catch (error) {
      console.error('Delete account failed:', error);
      toast.error('Kunde inte radera kontot. Försök igen senare.');
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
      <PageHeader title="Inställningar" />
      
      <div className="p-4 space-y-6">
        {/* Premium Section */}
        <PremiumSection 
          isPremium={isPremium}
          subscription={subscription}
          limits={limits}
        />

        {/* Theme Toggle */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Moon className="w-5 h-5" />
              <CardTitle className="text-base">Utseende</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
                className="flex-1"
              >
                <Sun className="w-4 h-4 mr-2" />
                Ljust
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
                className="flex-1"
              >
                <Moon className="w-4 h-4 mr-2" />
                Mörkt
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
                className="flex-1"
              >
                <Monitor className="w-4 h-4 mr-2" />
                Auto
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Sync */}
        <CalendarSection />

        {/* Profile */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5" />
              <CardTitle className="text-base">Profil</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Visningsnamn</Label>
              <div className="flex gap-2">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ditt namn"
                />
                <Button onClick={handleSaveDisplayName} disabled={updateProfile.isPending}>
                  Spara
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              E-post: {user?.email}
            </div>

            {/* Body measurements collapsible */}
            <div className="pt-2 border-t">
              <button
                onClick={() => setShowBodySection(!showBodySection)}
                className="flex items-center justify-between w-full py-1 text-sm font-medium"
              >
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-muted-foreground" />
                  <span>Kroppsdata för AI-styling</span>
                </div>
                {showBodySection ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {showBodySection && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Hjälp din AI-stylist förstå din kropp för bättre passform-förslag. Datan delas aldrig med tredje part.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Längd</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={heightCm}
                          onChange={(e) => setHeightCm(e.target.value)}
                          placeholder="175"
                          className="pr-10 text-sm"
                          min={100}
                          max={250}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">cm</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Vikt (valfritt)</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value)}
                          placeholder="70"
                          className="pr-10 text-sm"
                          min={30}
                          max={300}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSaveBodyData}
                    disabled={updateProfile.isPending}
                    className="w-full"
                  >
                    Spara kroppsdata
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Style Preferences */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              <CardTitle className="text-base">Stilpreferenser</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Favoritfärger</Label>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <Chip
                    key={color}
                    selected={preferences.favoriteColors?.includes(color)}
                    onClick={() => toggleColorPreference('favoriteColors', color)}
                    className="capitalize"
                  >
                    {color}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Ogillade färger</Label>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <Chip
                    key={color}
                    selected={preferences.dislikedColors?.includes(color)}
                    onClick={() => toggleColorPreference('dislikedColors', color)}
                    className="capitalize"
                  >
                    {color}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Passform</Label>
              <Select
                value={preferences.fitPreference || 'regular'}
                onValueChange={(v) => updatePreference('fitPreference', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loose">Loose</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="slim">Slim</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Standard stil</Label>
              <Select
                value={preferences.styleVibe || 'smart-casual'}
                onValueChange={(v) => updatePreference('styleVibe', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="street">Street</SelectItem>
                  <SelectItem value="smart-casual">Smart casual</SelectItem>
                  <SelectItem value="klassisk">Klassisk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Könsneutral styling</Label>
              <Switch
                checked={preferences.genderNeutral || false}
                onCheckedChange={(v) => updatePreference('genderNeutral', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <CardTitle className="text-base">Notiser</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label>Morgonpåminnelse</Label>
              <Switch
                checked={preferences.morningReminder || false}
                onCheckedChange={(v) => updatePreference('morningReminder', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <CardTitle className="text-base">Integritet</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleExportData}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Exportera data
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Radera konto
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Radera konto permanent?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>Detta kommer att ta bort:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Alla dina plagg och bilder</li>
                      <li>Alla outfits och outfit-historik</li>
                      <li>All användarhistorik</li>
                      <li>Din profil och inställningar</li>
                      <li>Ditt konto</li>
                    </ul>
                    <p className="font-medium text-destructive pt-2">Detta går inte att ångra!</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Avbryt</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground"
                    disabled={isDeleting}
                  >
                    {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Radera permanent
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Button variant="outline" className="w-full" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Logga ut
        </Button>
      </div>
    </AppLayout>
  );
}
