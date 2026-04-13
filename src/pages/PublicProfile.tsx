import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Loader2, Shirt, Users, Crown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { AnimatedPage } from '@/components/ui/animated-page';
import { PageHeader } from '@/components/layout/PageHeader';
import { OutfitReactions } from '@/components/social/OutfitReactions';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { validateCompleteOutfit } from '@/lib/outfitValidation';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';

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
  outfit_items: { id: string; slot: string; garment: {
    id: string;
    title: string;
    category: string;
    subcategory: string | null;
    image_path: string | null;
    original_image_path?: string | null;
    processed_image_path?: string | null;
    image_processing_status?: string | null;
    rendered_image_path?: string | null;
    render_status?: string | null;
  } | null }[];
}

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const prefersReduced = useReducedMotion();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [outfits, setOutfits] = useState<PublicOutfit[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const stagger = (i: number) =>
    prefersReduced ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.08 * i, duration: 0.35, ease: EASE_CURVE } };

  useEffect(() => {
    const load = async () => {
      if (!username) { setNotFound(true); setLoading(false); return; }

      const { data: rawProfile, error } = await supabase
        .from('public_profiles')
        .select('id, username, display_name, avatar_path')
        .eq('username', username)
        .single();

      const profileData = rawProfile as unknown as PublicProfile | null;
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
        .select('id, occasion, style_vibe, explanation, generated_at, outfit_items(id, slot, garment:garments(id, title, category, subcategory, image_path, original_image_path, processed_image_path, image_processing_status, rendered_image_path, render_status))')
        .eq('user_id', profileData.id)
        .eq('share_enabled', true)
        .order('generated_at', { ascending: false })
        .limit(12);

      type RawOutfitItem = PublicOutfit['outfit_items'][number];
      type RawOutfit = {
        id: string; occasion: string; style_vibe: string | null;
        explanation: string | null; generated_at: string | null;
        outfit_items: RawOutfitItem[];
      };
      const transformed: PublicOutfit[] = ((outfitData || []) as RawOutfit[]).map((o) => ({
        ...o,
        outfit_items: (o.outfit_items || []).map((i) => ({ id: i.id, slot: i.slot, garment: i.garment })),
      })).filter((outfit) => validateCompleteOutfit(
        outfit.outfit_items.map((item) => ({ slot: item.slot, garment: item.garment })),
      ).isValid);
      setOutfits(transformed);

      // Load first garment image per outfit
      for (const outfit of transformed) {
        const firstItem = outfit.outfit_items.find((i) => i.garment && getPreferredGarmentImagePath(i.garment));
        const imagePath = firstItem?.garment ? getPreferredGarmentImagePath(firstItem.garment) : undefined;
        if (imagePath) {
          const { data: urlData } = await supabase.storage.from('garments').createSignedUrl(imagePath, 3600);
          if (urlData) setImageUrls(prev => ({ ...prev, [outfit.id]: urlData.signedUrl }));
        }
      }

      setLoading(false);
    };
    load();
  }, [username]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (notFound || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Users className="w-12 h-12 text-muted-foreground/20 mb-4" />
        <h1 className="font-display italic text-xl font-bold mb-2">{t('profile.not_found')}</h1>
        <p className="text-muted-foreground text-center mb-6 font-body">{t('profile.not_found_desc')}</p>
        <Link to="/auth"><Button className="rounded-full" onClick={() => hapticLight()}>{t('share.create_own')}<ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
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
        <PageHeader
          title={displayName}
          subtitle={`@${profile.username}`}
          showBack
        />

        <AnimatedPage className="max-w-lg mx-auto px-4 pb-24 pt-8">
          {/* Profile header */}
          <motion.div className="flex flex-col items-center gap-4 pb-8" {...stagger(0)}>
            <Avatar className="w-24 h-24 ring-2 ring-border/30 ring-offset-2 ring-offset-background">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback className="bg-primary/8 text-primary font-semibold text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-center space-y-1">
              <h1 className="font-display italic text-[1.4rem]">{displayName}</h1>
              <p className="text-[11px] font-body uppercase tracking-[0.14em] text-muted-foreground/60">@{profile.username}</p>
            </div>
            <div className="flex gap-8 mt-1">
              <div className="text-center">
                <span className="text-xl font-semibold tabular-nums">{outfits.length}</span>
                <p className="text-[10px] font-body text-muted-foreground/60 uppercase tracking-[0.14em] mt-0.5">{t('profile.shared_outfits')}</p>
              </div>
            </div>
          </motion.div>

          {/* Section eyebrow */}
          <motion.div className="mb-4" {...stagger(1)}>
            <p className="label-editorial text-muted-foreground/60 text-[10px]">{t('profile.shared_archive')}</p>
          </motion.div>

          {/* Outfits grid */}
          {outfits.length === 0 ? (
            <motion.div className="text-center py-16" {...stagger(2)}>
              <Shirt className="w-10 h-10 text-muted-foreground/15 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-body">{t('profile.no_outfits')}</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {outfits.map((outfit, i) => (
                <motion.div
                  key={outfit.id}
                  className="rounded-[1.25rem] overflow-hidden cursor-pointer active:scale-[0.98] transition-transform border border-border/40"
                  onClick={() => { hapticLight(); navigate(`/share/${outfit.id}`); }}
                  {...stagger(2 + i)}
                >
                  <div className="aspect-square bg-muted/30 overflow-hidden">
                    {imageUrls[outfit.id] ? (
                      <img src={imageUrls[outfit.id]} alt={outfit.occasion} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Shirt className="w-8 h-8 text-muted-foreground/15" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1.5">
                    <p className="text-[10px] font-body uppercase tracking-[0.12em] text-muted-foreground/60">{outfit.occasion}</p>
                    {outfit.style_vibe && (
                      <p className="text-[12px] font-body text-foreground/80 truncate">{outfit.style_vibe}</p>
                    )}
                    <OutfitReactions outfitId={outfit.id} compact />
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* CTA */}
          <motion.div className="mt-12 rounded-[1.25rem] p-6 text-center space-y-3" {...stagger(3)}>
            <Crown className="w-8 h-8 mx-auto text-accent" />
            <h3 className="font-display italic text-lg">{t('profile.cta_desc')}</h3>
            <Link to="/auth">
              <Button size="lg" className="rounded-full" onClick={() => hapticLight()}>
                <Crown className="w-4 h-4 mr-2" />{t('profile.cta_button')}
              </Button>
            </Link>
          </motion.div>
        </AnimatedPage>
      </div>
    </>
  );
}
