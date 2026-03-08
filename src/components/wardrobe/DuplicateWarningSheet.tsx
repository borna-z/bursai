import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, ArrowRight, Merge, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LazyImage } from '@/components/ui/lazy-image';
import { useStorage } from '@/hooks/useStorage';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { DuplicateMatch } from '@/hooks/useDuplicateDetection';

interface DuplicateWarningSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateMatch[];
  onKeepBoth: () => void;
  onReplace: (garmentId: string) => void;
  onCancel: () => void;
  newImagePreview?: string | null;
}

function DuplicateCard({ match, onReplace }: { match: DuplicateMatch; onReplace: () => void }) {
  const { getGarmentSignedUrl } = useStorage();
  const { t } = useLanguage();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  // Get signed URL on mount
  useState(() => {
    getGarmentSignedUrl(match.image_path).then(setSignedUrl);
  });

  const confidencePercent = Math.round(match.confidence * 100);
  const confidenceColor = confidencePercent >= 80
    ? 'text-red-400'
    : confidencePercent >= 60
      ? 'text-amber-400'
      : 'text-yellow-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 p-3 rounded-xl bg-muted/50 border border-border/50"
    >
      <div className="w-16 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        {signedUrl && (
          <LazyImage src={signedUrl} alt={match.title} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{match.title}</p>
        <p className={cn('text-xs font-semibold mt-0.5', confidenceColor)}>
          {confidencePercent}% {t('duplicate.match') || 'match'}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {match.match_type === 'both'
            ? t('duplicate.visual_and_attribute') || 'Visual + attribute match'
            : match.match_type === 'visual'
              ? t('duplicate.visual_match') || 'Visual match'
              : t('duplicate.attribute_match') || 'Attribute match'}
        </p>
      </div>
      <button
        onClick={onReplace}
        className="self-center px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1"
      >
        <Merge className="w-3 h-3" />
        {t('duplicate.replace') || 'Replace'}
      </button>
    </motion.div>
  );
}

export function DuplicateWarningSheet({
  open,
  onOpenChange,
  duplicates,
  onKeepBoth,
  onReplace,
  onCancel,
}: DuplicateWarningSheetProps) {
  const { t } = useLanguage();

  if (duplicates.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <SheetTitle className="text-base">
              {t('duplicate.title') || 'Possible duplicate detected'}
            </SheetTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('duplicate.subtitle') || 'We found similar items in your wardrobe. What would you like to do?'}
          </p>
        </SheetHeader>

        <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto">
          <AnimatePresence>
            {duplicates.map((match) => (
              <DuplicateCard
                key={match.garment_id}
                match={match}
                onReplace={() => onReplace(match.garment_id)}
              />
            ))}
          </AnimatePresence>
        </div>

        <div className="space-y-2">
          <button
            onClick={onKeepBoth}
            className="w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            <Check className="w-4 h-4" />
            {t('duplicate.keep_both') || 'Keep both — not a duplicate'}
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onCancel}
            className="w-full h-9 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('duplicate.cancel') || 'Cancel upload'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
