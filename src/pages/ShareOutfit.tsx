import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Copy, Download, Check, Crown, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { OutfitReactions } from '@/components/social/OutfitReactions';
import { getOccasionLabel } from '@/lib/occasionLabel';

interface OutfitItem {
  id: string;
  slot: string;
  garment: {
    id: string;
    title: string;
    color_primary: string;
    image_path: string;
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
  } catch (err) { console.error('Analytics error:', err); }
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

  const slotLabels: Record<string, string> = {
    top: t('share.slot.top'),
    bottom: t('share.slot.bottom'),
    shoes: t('share.slot.shoes'),
    outerwear: t('share.slot.outerwear'),
    accessory: t('share.slot.accessory'),
  };

  useEffect(() => {
    const fetchOutfit = async () => {
      if (!id) return;
      trackEvent('share_opened', { outfit_id: id });

      const { data, error } = await supabase
        .from('outfits')
        .select(`id, occasion, style_vibe, explanation, share_enabled, outfit_items (id, slot, garment:garments (id, title, color_primary, image_path))`)
        .eq('id', id).eq('share_enabled', true).single();

      if (error || !data) { setNotFound(true); setIsLoading(false); return; }

      const transformedOutfit: SharedOutfit = {
        id: data.id, occasion: data.occasion, style_vibe: data.style_vibe,
        explanation: data.explanation, share_enabled: data.share_enabled ?? false,
        outfit_items: (data.outfit_items || []).map((item: any) => ({ id: item.id, slot: item.slot, garment: item.garment })),
      };
      setOutfit(transformedOutfit);
      setIsLoading(false);

      for (const item of transformedOutfit.outfit_items) {
        if (item.garment?.image_path) {
          const { data: urlData } = await supabase.storage.from('garments').createSignedUrl(item.garment.image_path, 3600);
          if (urlData) { setImageUrls(prev => ({ ...prev, [item.id]: urlData.signedUrl })); }
        }
      }
    };
    fetchOutfit();
  }, [id]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true); toast.success(t('share.link_copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error(t('share.copy_error')); }
  };

  const handleDownloadImage = async () => {
    if (!outfitRef.current || !outfit) return;
    setIsDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(outfitRef.current, { quality: 1.0, backgroundColor: '#ffffff', pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `outfit-${outfit.occasion}.png`;
      link.href = dataUrl; link.click();
      toast.success(t('share.downloaded'));
    } catch (error) { console.error('Download error:', error); toast.error(t('share.download_error')); }
    finally { setIsDownloading(false); }
  };

  const handleUpgradeClick = () => { trackEvent('upgrade_clicked', { source: 'share_page', outfit_id: id }); };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (notFound || !outfit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <h1 className="text-2xl font-bold mb-2">{t('share.not_found')}</h1>
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
          <h1 className="font-semibold">{t('share.title')}</h1>
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

      <div className="max-w-lg mx-auto p-4">
        <div ref={outfitRef} className="bg-background p-4 rounded-lg">
          <div className="mb-6 text-center">
            <Badge variant="secondary" className="mb-2 capitalize">{getOccasionLabel(outfit.occasion, t)}</Badge>
            {outfit.style_vibe && <p className="text-sm text-muted-foreground capitalize">{t('share.style_label')} {outfit.style_vibe}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {outfit.outfit_items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-square bg-secondary overflow-hidden">
                    {imageUrls[item.id] ? (
                      <img src={imageUrls[item.id]} alt={item.garment?.title || item.slot} className="w-full h-full object-cover" crossOrigin="anonymous" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><div className="w-12 h-12 rounded-full bg-muted" /></div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-muted-foreground">{slotLabels[item.slot] || item.slot}</p>
                    <p className="text-sm font-medium truncate">{item.garment?.title || t('share.unknown_garment')}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {outfit.explanation && <Card className="bg-primary/5 border-primary/20"><CardContent className="p-3"><p className="text-sm">{outfit.explanation}</p></CardContent></Card>}
          <div className="mt-4">
            <OutfitReactions outfitId={outfit.id} />
          </div>
          <div className="mt-6 text-center text-xs text-muted-foreground">{t('share.watermark')}</div>
        </div>

        <div className="mt-8 space-y-4">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4 text-center space-y-3">
              <Sparkles className="w-8 h-8 mx-auto text-primary" />
              <h3 className="font-semibold text-lg">{t('share.cta_free_title')}</h3>
              <p className="text-sm text-muted-foreground">{t('share.cta_free_desc')}</p>
              <Link to="/auth"><Button className="w-full">{t('share.cta_free_button')}<ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
            <CardContent className="p-4 text-center space-y-3">
              <Crown className="w-8 h-8 mx-auto text-amber-500" />
              <h3 className="font-semibold text-lg">{t('share.cta_premium_title')}</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ {t('share.cta_premium_wardrobe')}</li>
                <li>✓ {t('share.cta_premium_outfits')}</li>
                <li>✓ {t('share.cta_premium_ai')}</li>
              </ul>
              <Link to="/pricing" onClick={handleUpgradeClick}>
                <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                  <Crown className="w-4 h-4 mr-2" />{t('share.cta_premium_button')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  );
}