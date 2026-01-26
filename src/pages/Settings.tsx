import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Palette,
  Bell,
  Shield,
  LogOut,
  Download,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { PremiumSection } from '@/components/PremiumSection';

const colors = [
  'svart', 'vit', 'grå', 'marinblå', 'blå', 'röd', 'grön', 'beige', 'brun', 'rosa', 'gul', 'orange', 'lila'
];

const styleVibes = ['minimal', 'street', 'smart-casual', 'klassisk'];
const fitPreferences = ['loose', 'regular', 'slim'];

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
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { subscription, isPremium, remainingGarments, remainingOutfits, limits } = useSubscription();
  
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Get preferences from profile
  const preferences = (profile?.preferences as Preferences) || {};

  const updatePreference = async (key: keyof Preferences, value: any) => {
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

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Fetch all user data
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
      // Call edge function that handles complete account deletion
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Inställningar</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Premium Section */}
        <PremiumSection 
          isPremium={isPremium}
          subscription={subscription}
          limits={limits}
        />

        {/* Profile */}
        <Card>
          <CardHeader>
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
          </CardContent>
        </Card>

        {/* Style Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              <CardTitle className="text-base">Stilpreferenser</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Favoritfärger</Label>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <Badge
                    key={color}
                    variant={preferences.favoriteColors?.includes(color) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => toggleColorPreference('favoriteColors', color)}
                  >
                    {color}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ogillade färger</Label>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <Badge
                    key={color}
                    variant={preferences.dislikedColors?.includes(color) ? 'destructive' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => toggleColorPreference('dislikedColors', color)}
                  >
                    {color}
                  </Badge>
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
          <CardHeader>
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
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <CardTitle className="text-base">Integritet</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <ul className="list-disc list-inside text-sm">
                      <li>Alla dina plagg och bilder</li>
                      <li>Alla outfits och outfit-historik</li>
                      <li>All användarhistorik</li>
                      <li>Din profil och inställningar</li>
                      <li>Ditt konto</li>
                    </ul>
                    <p className="font-medium text-destructive">Detta går inte att ångra!</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Avbryt</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
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
    </div>
  );
}
