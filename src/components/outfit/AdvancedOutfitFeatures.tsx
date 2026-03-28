import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, RefreshCw, Gem, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useCloneOutfitDNA, useSuggestAccessories } from '@/hooks/useAdvancedFeatures';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGarmentsByIds } from '@/hooks/useGarmentsByIds';
import { toast } from 'sonner';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

/* ── Step 19: Outfit DNA Cloning ── */
export function OutfitDNASection({ outfitId }: { outfitId: string }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const cloneDNA = useCloneOutfitDNA();
  const [variations, setVariations] = useState<Array<{ name: string; garment_ids: string[]; explanation: string }> | null>(null);

  const handleClone = async () => {
    try {
      const result = await cloneDNA.mutateAsync(outfitId);
      setVariations(result.variations);
    } catch {
      toast.error(t('outfit.dna_error'));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-primary" />
          <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide font-medium">
            {t('outfit.dna_title')}
          </p>
        </div>
        {!variations && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-8 text-xs"
            onClick={handleClone}
            disabled={cloneDNA.isPending}
          >
            {cloneDNA.isPending ? (
              <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />{t('outfit.dna_analyzing')}</>
            ) : (
              <><Sparkles className="w-3 h-3 mr-1.5" />{t('outfit.dna_clone')}</>
            )}
          </Button>
        )}
      </div>

      {variations && variations.map((v, i) => (
        <div key={i} className="rounded-[1.25rem] bg-muted/20 border border-border/20 p-4 space-y-2">
          <p className="text-sm font-semibold">{v.name}</p>
          <p className="text-xs text-muted-foreground">{v.explanation}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {v.garment_ids.slice(0, 4).map((gid) => (
              <div
                key={gid}
                className="aspect-[7/8] w-full cursor-pointer overflow-hidden rounded-lg bg-muted/30"
                onClick={() => navigate(`/wardrobe/${gid}`)}
              >
                <LazyImageSimple imagePath={undefined} alt="" className="h-full w-full object-cover" fallbackIcon={<Shirt className="w-4 h-4 text-muted-foreground/30" />} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {!variations && !cloneDNA.isPending && (
        <div className="rounded-[1.25rem] border border-dashed border-border/40 bg-muted/10 p-6 flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-6 h-6 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground/40">{t('outfit.dna_hint')}</p>
        </div>
      )}
    </div>
  );
}

/* ── Step 20: Smart Accessory Pairing ── */
export function AccessoryPairingSection({ outfitId }: { outfitId: string }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const suggestAccessories = useSuggestAccessories();
  const [suggestions, setSuggestions] = useState<Array<{ garment_id: string; reason: string }> | null>(null);

  const garmentIds = suggestions?.map(s => s.garment_id) || [];
  const { data: garments } = useGarmentsByIds(garmentIds);

  const handleSuggest = async () => {
    try {
      const result = await suggestAccessories.mutateAsync(outfitId);
      setSuggestions(result.suggestions);
    } catch {
      toast.error(t('outfit.accessory_error'));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gem className="w-4 h-4 text-primary" />
          <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide font-medium">
            {t('outfit.accessory_title')}
          </p>
        </div>
        {!suggestions && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-8 text-xs"
            onClick={handleSuggest}
            disabled={suggestAccessories.isPending}
          >
            {suggestAccessories.isPending ? (
              <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />{t('outfit.accessory_loading')}</>
            ) : (
              <><Sparkles className="w-3 h-3 mr-1.5" />{t('outfit.accessory_suggest')}</>
            )}
          </Button>
        )}
      </div>

      {suggestions && suggestions.map((s, i) => {
        const garment = garments?.find(g => g.id === s.garment_id);
        return (
          <div
            key={i}
            className="flex items-center gap-3 py-3 cursor-pointer hover:bg-muted/20 rounded-xl px-2 -mx-2 transition-colors"
            onClick={() => navigate(`/wardrobe/${s.garment_id}`)}
          >
            <LazyImageSimple
              imagePath={garment ? getPreferredGarmentImagePath(garment) : undefined}
              alt={garment?.title || ''}
              className="w-14 h-16 rounded-xl flex-shrink-0"
              fallbackIcon={<Gem className="w-4 h-4 text-muted-foreground/30" />}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{garment?.title || s.garment_id.slice(0, 8)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
            </div>
          </div>
        );
      })}

      {!suggestions && !suggestAccessories.isPending && (
        <div className="rounded-[1.25rem] border border-dashed border-border/40 bg-muted/10 p-6 flex flex-col items-center justify-center gap-2">
          <Gem className="w-6 h-6 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground/40">{t('outfit.accessory_hint')}</p>
        </div>
      )}
    </div>
  );
}
