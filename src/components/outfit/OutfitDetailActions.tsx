import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Star, Bookmark, BookmarkCheck, Loader2,
  Share2, RefreshCw, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { EASE_CURVE, DURATION_MEDIUM } from '@/lib/motion';

interface OutfitDetailActionsProps {
  outfit: {
    id: string;
    saved?: boolean;
    worn_at?: string | null;
    occasion?: string;
    style_vibe?: string | null;
  };
  onMarkWorn: () => void;
  isMarkingWorn: boolean;
  onToggleSave: () => void;
  onShare: () => void;
  onCreateSimilar: () => void;
  rating: number | null;
  onRating: (value: number) => void;
}

export function OutfitDetailActions({
  outfit,
  onMarkWorn,
  isMarkingWorn,
  onToggleSave,
  onShare,
  onCreateSimilar,
  rating,
  onRating,
}: OutfitDetailActionsProps) {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const navigate = useNavigate();

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE }}
      className="flex flex-col gap-3"
    >
      <Button
        onClick={() => { hapticLight(); onMarkWorn(); }}
        disabled={isMarkingWorn || !!outfit.worn_at}
        variant="editorial"
        className={cn(
          "w-full h-13 rounded-full font-body text-[15px] font-medium flex items-center justify-center gap-2",
          outfit.worn_at && "opacity-50 cursor-default"
        )}
      >
        {isMarkingWorn && <Loader2 className="w-4 h-4 animate-spin" />}
        {outfit.worn_at ? t('outfit.worn') : t('outfit.mark_worn')}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={() => { hapticLight(); navigate('/plan', { state: { preselectedOutfitId: outfit.id } }); }}
          className="h-11 rounded-full border-border/35 font-body text-[13px] font-medium"
        >
          <Calendar className="w-4 h-4 mr-1.5" />
          {t('outfit.plan') || 'Plan'}
        </Button>
        <Button
          variant="outline"
          onClick={() => { hapticLight(); onToggleSave(); }}
          className="h-11 rounded-full border-border/35 font-body text-[13px] font-medium"
        >
          {outfit.saved
            ? <><BookmarkCheck className="w-4 h-4 mr-1.5" />{t('outfit.saved')}</>
            : <><Bookmark className="w-4 h-4 mr-1.5" />{t('outfit.save') || 'Save'}</>
          }
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="ghost"
          onClick={() => { hapticLight(); onShare(); }}
          className="h-10 rounded-full text-foreground/50 font-body text-[13px]"
        >
          <Share2 className="w-3.5 h-3.5 mr-1.5" />
          Share
        </Button>
        <Button
          variant="ghost"
          onClick={() => { hapticLight(); onCreateSimilar(); }}
          className="h-10 rounded-full text-foreground/50 font-body text-[13px]"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Remake
        </Button>
      </div>

      {/* ── Star rating ── */}
      <div className="pt-3">
        <p className="label-editorial text-muted-foreground/60 mb-2">RATE THIS LOOK</p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onClick={() => onRating(value)}
              className="p-1 transition-transform active:scale-90"
            >
              <Star
                className={cn(
                  "w-7 h-7 transition-colors",
                  rating !== null && value <= rating
                    ? "text-primary fill-primary"
                    : "text-foreground/15"
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
