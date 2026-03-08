import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Loader2, Shirt, Users, Crown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { AnimatedPage } from '@/components/ui/animated-page';
import { OutfitReactions } from '@/components/social/OutfitReactions';

interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
}

interface PublicOutfit {
  id: string;
  occasion: string;
  style_vibe: string | null;
  explanation: string | null;
  generated_at: string | null;
  outfit_items: { id: string; slot: string; garment: { id: string; title: string; image_path: string } | null }[];
}

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [outfits, setOutfits] = useState<PublicOutfit[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!username) { setNotFound(true); setLoading(false); return; }

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_path')
        .eq('username', username)
        .single();

      if (error || !profileData) { setNotFound(true); setLoading(false); return; }
      setProfile(profileData);

      // Avatar
      if (profileData.avatar_path) {
        const { data: url } = await supabase.storage.from('avatars').createSignedUrl(profileData.avatar_path, 3600);
        if (url) setAvatarUrl(url.signedUrl);
      }

      // Shared outfits
      const { data: outfitData } = await supabase
        .from('outfits')
        .select('id, occasion, style_vibe, explanation, generated_at, outfit_items(id, slot, garment:garments(id, title, image_path))')
        .eq('user_id', profileData.id)
        .eq('share_enabled', true)
        .order('generated_at', { ascending: false })
        .limit(12);

      const transformed = (outfitData || []).map((o: any) => ({
        ...o,
        outfit_items: (o.outfit_items || []).map((i: any) => ({ id: i.id, slot: i.slot, garment: i.garment })),
      }));
      setOutfits(transformed);

      // Load first garment image per outfit
      for (const outfit of transformed) {
        const firstItem = outfit.outfit_items.find((i: any) => i.garment?.image_path);
        if (firstItem?.garment?.image_path) {
          const { data: urlData } = await supabase.storage.from('garments').createSignedUrl(firstItem.garment.image_path, 3600);
          if (urlData) setImageUrls(prev => ({ ...prev, [outfit.id]: urlData.signedUrl }));
        }
      }

      setLoading(false);
    };
    load();
  }, [username]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (notFound || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h1 className="text-xl font-bold mb-2">{t('profile.not_found')}</h1>
        <p className="text-muted-foreground text-center mb-6">{t('profile.not_found_desc')}</p>
        <Link to="/auth"><Button>{t('share.create_own')}<ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      <Helmet>
        <title>{`${displayName} — BURS Style Profile`}</title>
        <meta name="description" content={`Check out ${displayName}'s style on BURS`} />
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
          <div className="max-w-lg mx-auto p-4 flex items-center gap-3">
            <span className="font-semibold">BURS</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-sm text-muted-foreground">@{profile.username}</span>
          </div>
        </div>

        <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-8">
          {/* Profile header */}
          <div className="flex flex-col items-center gap-3 pb-8">
            <Avatar className="w-20 h-20">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback className="bg-primary/8 text-primary font-semibold text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h1 className="text-xl font-bold">{displayName}</h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            </div>
            <div className="flex gap-6 mt-2">
              <div className="text-center">
                <span className="text-lg font-bold tabular-nums">{outfits.length}</span>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{t('profile.shared_outfits')}</p>
              </div>
            </div>
          </div>

          {/* Outfits grid */}
          {outfits.length === 0 ? (
            <div className="text-center py-12">
              <Shirt className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t('profile.no_outfits')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {outfits.map(outfit => (
                <div
                  key={outfit.id}
                  className="rounded-xl overflow-hidden border bg-card cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => navigate(`/share/${outfit.id}`)}
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    {imageUrls[outfit.id] ? (
                      <img src={imageUrls[outfit.id]} alt={outfit.occasion} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Shirt className="w-8 h-8 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 space-y-1.5">
                    <Badge variant="secondary" className="text-[10px] capitalize">{outfit.occasion}</Badge>
                    {outfit.style_vibe && (
                      <p className="text-[11px] text-muted-foreground truncate">{outfit.style_vibe}</p>
                    )}
                    <OutfitReactions outfitId={outfit.id} compact />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mt-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">{t('profile.cta_desc')}</p>
            <Link to="/auth">
              <Button size="lg" className="rounded-xl">
                <Crown className="w-4 h-4 mr-2" />{t('profile.cta_button')}
              </Button>
            </Link>
          </div>
        </AnimatedPage>
      </div>
    </>
  );
}
