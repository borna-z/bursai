import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Copy, Download, Check, Crown, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { OutfitReactions } from '@/components/social/OutfitReactions';
import { getOccasionLabel } from '@/lib/occasionLabel';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { hapticLight } from '@/lib/haptics';
import { logger } from '@/lib/logger';

interface OutfitItem {
  id: string;
  slot: string;
  garment: {
    id: string;
    title: string;
    color_primary: string;
    image_path: string | null;
    original_image_path?: string | null;
    processed_image_path?: string | null;
    image_processing_status?: string | null;
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
  const [outfit, setOutfit] = useState<SharedOutfit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const outfitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOutfit = async () => {
      if (!id) return;
      trackEvent('share_opened', { outfit_id: id });

      const { data, error } = await supabase
        .from('outfits')
        .select(`id, occasion, style_vibe, explanation, share_enabled, outfit_items (id, slot, garment:garments (id, title, color_primary, image_path, original_image_path, processed_image_path, image_processing_status, rendered_image_path, render_status))`)
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

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (notFound || !outfit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <h1 className="font-display italic text-2xl font-bold mb-2">{t('share.not_found')}</h1>
        <p className="text-muted-foreground text-center mb-6">{t('share.not_found_desc')}</p>
        <Link to="/auth"><Button>{t('share.create_own')}<ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${outfit.occasion} Outfit | Styled by BURS`}</title>
        <meta name="description" content={outfit.explanation || 'Check out this outfit styled by BURS — your personal AI stylist.'} />
        <meta property="og:title" content={`${outfit.occasion} Outfit | Styled by BURS`} />
        <meta property="og:description" content={outfit.explanation || 'Check out this outfit styled by BURS.'} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content="https://burs.me/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${outfit.occasion} Outfit | Styled by BURS`} />
        <meta name="twitter:description" content={outfit.explanation || 'Check out this outfit styled by BURS.'} />
      </Helmet>
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-lg mx-auto p-4 flex items-center justify-between">
          <h1 className="font-display italic">{t('share.title')}</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? t('share.copied') : t('share.copy_link')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadImage} disabled={isDownloading}>
              {isDownloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              {t('share.download')}
            </Button>
          </div>
        </div>
      </div>

      <motion.div
        className="max-w-lg mx-auto p-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Branded share card — this element is screenshotted */}
        <div
          ref={outfitRef}
          id="share-card"
          style={{
            width: 390, height: 560,
            backgroundColor: '#F5F0E8',
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {/* Top: 2×2 garment grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: 400 }}>
            {[0, 1, 2, 3].map((i) => {
              const item = outfit.outfit_items[i];
              return (
                <div
                  key={i}
                  style={{
                    width: '100%', height: 200,
                    backgroundColor: '#EDE8DF',
                    overflow: 'hidden',
                  }}
                >
                  {item && imageUrls[item.id] ? (
                    <img
                      src={imageUrls[item.id]}
                      alt={item.garment?.title || ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      crossOrigin="anonymous"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Bottom: branded strip */}
          <div style={{
            height: 160,
            backgroundColor: '#1C1917',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <p style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: 8,
              }}>
                {getOccasionLabel(outfit.occasion, t)}
              </p>
              <p style={{
                fontFamily: '"Playfair Display", serif',
                fontStyle: 'italic',
                fontSize: 18,
                color: 'white',
                lineHeight: 1.3,
                margin: 0,
              }}>
                {(outfit.explanation || "Today's look").slice(0, 50)}
              </p>
            </div>
            <p style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 10,
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.1em',
              margin: 0,
            }}>
              BURS · burs.me
            </p>
          </div>
        </div>

        {/* Reactions live outside the card so they don't appear in the screenshot */}
        <div className="mt-4">
          <OutfitReactions outfitId={outfit.id} />
        </div>

        <div className="mt-8 space-y-4">
          <Card surface="editorial" className="border-primary/20">
            <CardContent className="p-4 text-center space-y-3">
              <Sparkles className="w-8 h-8 mx-auto text-primary" />
              <h3 className="font-display italic text-lg">{t('share.cta_free_title')}</h3>
              <p className="text-sm text-muted-foreground">{t('share.cta_free_desc')}</p>
              <Link to="/auth"><Button className="w-full">{t('share.cta_free_button')}<ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
            </CardContent>
          </Card>
          <Card surface="editorial" className="border-accent/30">
            <CardContent className="p-4 text-center space-y-3">
              <Crown className="w-8 h-8 mx-auto text-accent" />
              <h3 className="font-display italic text-lg">{t('share.cta_premium_title')}</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ {t('share.cta_premium_wardrobe')}</li>
                <li>✓ {t('share.cta_premium_outfits')}</li>
                <li>✓ {t('share.cta_premium_ai')}</li>
              </ul>
              <Link to="/pricing" onClick={handleUpgradeClick}>
                <Button className="w-full">
                  <Crown className="w-4 h-4 mr-2" />{t('share.cta_premium_button')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
    </>
  );
}
