import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Copy, Download, Check, Crown, Sparkles, ArrowRight, Share2, MessageCircle, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { OutfitReactions } from '@/components/social/OutfitReactions';
import { getOccasionLabel } from '@/lib/occasionLabel';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { hapticLight } from '@/lib/haptics';
import { logger } from '@/lib/logger';
import { EASE_CURVE } from '@/lib/motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { isUuid } from '@/lib/validators';

interface OutfitItem {
  id: string;
  slot: string;
  garment: {
    id: string;
    title: string;
    color_primary: string;
    image_path: string | null;
    original_image_path?: string | null;
    rendered_image_path?: string | null;
    render_status?: string | null;
  } | null;
}

interface SharedOutfit {
  id: string;
  occasion: string;
  style_vibe: string | null;
  explanation: string | null;
  share_enabled: boolean;
  outfit_items: OutfitItem[];
}

async function trackEvent(eventType: string, metadata: object = {}) {
  try {
    await supabase.from('analytics_events').insert([{ event_type: eventType, metadata: metadata as Record<string, string> }]);
  } catch (err) { logger.error('Analytics error:', err); }
}

export default function ShareOutfitPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const [outfit, setOutfit] = useState<SharedOutfit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const outfitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOutfit = async () => {
      // P10 — validate UUID shape before issuing a query. Non-UUID strings
      // otherwise surface as Postgres 22P02 ("invalid input syntax for uuid")
      // errors in RLS logs — noise at best, enumeration oracle at worst.
      if (!id || !isUuid(id)) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      trackEvent('share_opened', { outfit_id: id });

      const { data, error } = await supabase
        .from('outfits')
        .select(`id, occasion, style_vibe, explanation, share_enabled, outfit_items (id, slot, garment:garments (id, title, color_primary, image_path, original_image_path, rendered_image_path, render_status))`)
        .eq('id', id).eq('share_enabled', true).single();

      if (error || !data) { setNotFound(true); setIsLoading(false); return; }

      const transformedOutfit: SharedOutfit = {
        id: data.id, occasion: data.occasion, style_vibe: data.style_vibe,
        explanation: data.explanation, share_enabled: data.share_enabled ?? false,
        outfit_items: ((data.outfit_items || []) as { id: string; slot: string; garment: OutfitItem['garment'] }[]).map((item) => ({ id: item.id, slot: item.slot, garment: item.garment })),
      };
      setOutfit(transformedOutfit);
      setIsLoading(false);

      for (const item of transformedOutfit.outfit_items) {
        const imagePath = item.garment ? getPreferredGarmentImagePath(item.garment) : undefined;
        if (imagePath) {
          const { data: urlData } = await supabase.storage.from('garments').createSignedUrl(imagePath, 3600);
          if (urlData) { setImageUrls(prev => ({ ...prev, [item.id]: urlData.signedUrl })); }
        }
      }
    };
    fetchOutfit();
  }, [id]);

  const handleCopyLink = async () => {
    hapticLight();
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true); toast.success(t('share.link_copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error(t('share.copy_error')); }
  };

  const handleDownloadImage = async () => {
    if (!outfitRef.current || !outfit) return;
    hapticLight();
    setIsDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(outfitRef.current, { quality: 1.0, backgroundColor: '#ffffff', pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `outfit-${outfit.occasion}.png`;
      link.href = dataUrl; link.click();
      toast.success(t('share.downloaded'));
    } catch (error) { logger.error('Download error:', error); toast.error(t('share.download_error')); }
    finally { setIsDownloading(false); }
  };

  const handleUpgradeClick = () => { trackEvent('upgrade_clicked', { source: 'share_page', outfit_id: id }); };

  const motionProps = prefersReduced
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: EASE_CURVE } };

  const stagger = (i: number) =>
    prefersReduced ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.1 * i, duration: 0.35, ease: EASE_CURVE } };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (notFound || !outfit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <h1 className="font-display italic text-2xl font-bold mb-2">{t('share.not_found')}</h1>
        <p className="text-muted-foreground text-center mb-6 font-body">{t('share.not_found_desc')}</p>
        <Link to="/auth"><Button className="rounded-full" onClick={() => hapticLight()}>{t('share.create_own')}<ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t('share.meta_title_template').replace('{occasion}', outfit.occasion)}</title>
        <meta name="description" content={outfit.explanation || t('share.meta_description_full')} />
        <meta property="og:title" content={t('share.meta_title_template').replace('{occasion}', outfit.occasion)} />
        <meta property="og:description" content={outfit.explanation || t('share.meta_description_short')} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content="https://burs.me/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={t('share.meta_title_template').replace('{occasion}', outfit.occasion)} />
        <meta name="twitter:description" content={outfit.explanation || t('share.meta_description_short')} />
      </Helmet>
    <div className="min-h-screen bg-background">
      <PageHeader
        title={t('share.title')}
        actions={
          <span className="text-[10px] font-body uppercase tracking-[0.16em] text-muted-foreground/60">BURS</span>
        }
      />

      <motion.div
        className="max-w-lg mx-auto px-[var(--page-px)] pt-6 pb-24"
        {...motionProps}
      >
        {/* Branded share card -- this element is screenshotted */}
        <motion.div {...stagger(0)}>
          <div
            ref={outfitRef}
            id="share-card"
            className="rounded-[1.25rem] overflow-hidden shadow-[0_12px_30px_rgba(28,25,23,0.08)]"
            style={{ width: '100%', maxWidth: 390, marginInline: 'auto', backgroundColor: '#F5F0E8', position: 'relative', flexShrink: 0 }}
          >
            {/* Garment grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: 400 }}>
              {[0, 1, 2, 3].map((i) => {
                const item = outfit.outfit_items[i];
                return (
                  <div key={i} style={{ width: '100%', height: 200, backgroundColor: '#EDE8DF', overflow: 'hidden' }}>
                    {item && imageUrls[item.id] ? (
                      <img src={imageUrls[item.id]} alt={item.garment?.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Branded strip */}
            <div style={{ height: 160, backgroundColor: '#1C1917', padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                  {getOccasionLabel(outfit.occasion, t)}
                </p>
                <p style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 18, color: 'white', lineHeight: 1.3, margin: 0 }}>
                  {(outfit.explanation || "Today's look").slice(0, 50)}
                </p>
              </div>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', margin: 0 }}>
                BURS · burs.me
              </p>
            </div>
          </div>
        </motion.div>

        {/* Reactions -- outside the screenshot card */}
        <motion.div className="mt-5" {...stagger(1)}>
          <OutfitReactions outfitId={outfit.id} />
        </motion.div>

        {/* Share actions */}
        <motion.div className="mt-6 rounded-[1.25rem] divide-y divide-border/40" {...stagger(2)}>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer"
            onClick={handleCopyLink}
          >
            {copied ? <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" /> : <Copy className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
            <span className="flex-1 text-sm font-body font-medium">{copied ? t('share.copied') : t('share.copy_link')}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer"
            onClick={() => { hapticLight(); handleDownloadImage(); }}
            disabled={isDownloading}
          >
            {isDownloading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground flex-shrink-0" /> : <Download className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
            <span className="flex-1 text-sm font-body font-medium">{t('share.download')}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer"
            onClick={() => {
              hapticLight();
              if (navigator.share) {
                navigator.share({ title: `${outfit.occasion} Outfit | BURS`, url: window.location.href }).catch(() => {});
              } else {
                handleCopyLink();
              }
            }}
          >
            <Share2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <span className="flex-1 text-sm font-body font-medium">{t('share.more') || 'More options'}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
          </button>
        </motion.div>

        {/* CTA cards */}
        <div className="mt-8 space-y-4">
          <motion.div className="rounded-[1.25rem] p-5 text-center space-y-3" {...stagger(3)}>
            <Sparkles className="w-8 h-8 mx-auto text-primary" />
            <h3 className="font-display italic text-lg">{t('share.cta_free_title')}</h3>
            <p className="text-sm text-muted-foreground font-body">{t('share.cta_free_desc')}</p>
            <Link to="/auth">
              <Button className="w-full rounded-full" onClick={() => hapticLight()}>
                {t('share.cta_free_button')}<ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>

          <motion.div className="rounded-[1.25rem] p-5 text-center space-y-3 border border-accent/20" {...stagger(4)}>
            <Crown className="w-8 h-8 mx-auto text-accent" />
            <h3 className="font-display italic text-lg">{t('share.cta_premium_title')}</h3>
            <ul className="text-sm text-muted-foreground font-body space-y-1.5">
              <li className="flex items-center justify-center gap-2"><Check className="w-3.5 h-3.5 text-accent" /> {t('share.cta_premium_wardrobe')}</li>
              <li className="flex items-center justify-center gap-2"><Check className="w-3.5 h-3.5 text-accent" /> {t('share.cta_premium_outfits')}</li>
              <li className="flex items-center justify-center gap-2"><Check className="w-3.5 h-3.5 text-accent" /> {t('share.cta_premium_ai')}</li>
            </ul>
            <Link to="/settings" onClick={handleUpgradeClick}>
              <Button className="w-full rounded-full" onClick={() => hapticLight()}>
                <Crown className="w-4 h-4 mr-2" />{t('share.cta_premium_button')}
              </Button>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
    </>
  );
}
