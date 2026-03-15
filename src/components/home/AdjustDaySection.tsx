import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { TAP_TRANSITION, EASE_CURVE } from '@/lib/motion';

const OCCASIONS = [
  { id: 'casual', labelKey: 'home.occasion.casual' },
  { id: 'work', labelKey: 'home.occasion.work' },
  { id: 'party', labelKey: 'home.occasion.party' },
  { id: 'date', labelKey: 'home.occasion.date' },
];

const STYLES = [
  { id: 'minimal', labelKey: 'home.style.minimal' },
  { id: 'street', labelKey: 'home.style.street' },
  { id: 'smart-casual', labelKey: 'home.style.smart_casual' },
  { id: 'classic', labelKey: 'home.style.klassisk' },
];

interface AdjustDaySectionProps {
  occasion: string;
  style: string | null;
  onOccasionChange: (id: string) => void;
  onStyleChange: (id: string | null) => void;
  onUpdate: () => void;
  isLoading?: boolean;
}

export function AdjustDaySection({
  occasion,
  style,
  onOccasionChange,
  onStyleChange,
  onUpdate,
  isLoading,
}: AdjustDaySectionProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl surface-secondary overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3.5">
          <span className="text-sm font-medium">{t('home.adjust_day')}</span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.25, ease: EASE_CURVE }}
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </motion.span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {/* Occasion pills */}
            <div className="flex gap-2 flex-wrap">
              {OCCASIONS.map((occ) => (
                <motion.button
                  key={occ.id}
                  whileTap={{ scale: 0.94 }}
                  transition={TAP_TRANSITION}
                  onClick={() => onOccasionChange(occ.id)}
                    className={cn(
                      'px-4 py-2 rounded-full text-xs font-medium transition-colors will-change-transform border',
                      occasion === occ.id
                        ? 'bg-accent/[0.08] text-accent ring-1 ring-accent/30 border-accent/20'
                        : 'surface-inset text-foreground'
                    )}
                >
                  {t(occ.labelKey)}
                </motion.button>
              ))}
            </div>

            {/* Style pills */}
            <div className="flex gap-2 flex-wrap">
              {STYLES.map((s) => (
                <motion.button
                  key={s.id}
                  whileTap={{ scale: 0.93 }}
                  transition={TAP_TRANSITION}
                  onClick={() => onStyleChange(style === s.id ? null : s.id)}
                  className={cn(
                    'px-4 py-2 rounded-full text-xs font-medium transition-colors will-change-transform',
                    style === s.id
                      ? 'bg-accent/10 text-accent'
                      : 'bg-foreground/[0.04] text-foreground'
                  )}
                >
                  {t(s.labelKey)}
                </motion.button>
              ))}
            </div>

            {/* Update button */}
            <Button
              onClick={onUpdate}
              disabled={isLoading}
              className="w-full h-11 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl"
            >
              {t('home.update_outfit')}
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
