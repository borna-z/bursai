import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Heart, ShoppingBag, Clock, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';

interface ToolDef {
  path: string;
  icon: typeof Search;
  titleKey: string;
  subtitleKey: string;
  size: 'wide' | 'half' | 'full';
}

const TOOLS: ToolDef[] = [
  {
    path: '/ai/mood-outfit',
    icon: Heart,
    titleKey: 'discover.tool_mood',
    subtitleKey: 'discover.tool_mood_sub',
    size: 'wide',
  },
  {
    path: '/ai/visual-search',
    icon: Search,
    titleKey: 'discover.tool_visual',
    subtitleKey: 'discover.tool_visual_sub',
    size: 'half',
  },
  {
    path: '/ai/smart-shopping',
    icon: ShoppingBag,
    titleKey: 'discover.tool_shopping',
    subtitleKey: 'discover.tool_shopping_sub',
    size: 'half',
  },
  {
    path: '/ai/wardrobe-aging',
    icon: Clock,
    titleKey: 'discover.tool_aging',
    subtitleKey: 'discover.tool_aging_sub',
    size: 'full',
  },
  {
    path: '/ai/style-twin',
    icon: Users,
    titleKey: 'discover.tool_twin',
    subtitleKey: 'discover.tool_twin_sub',
    size: 'full',
  },
];

export function DiscoverStyleTools() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <section className="space-y-4">
      <h3 className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
        {t('discover.style_tools')}
      </h3>

      <div className="grid grid-cols-2 gap-2.5">
        {TOOLS.map((tool, i) => {
          const isWide = tool.size === 'wide';
          const isFull = tool.size === 'full';

          return (
            <motion.button
              key={tool.path}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * STAGGER_DELAY, duration: 0.4, ease: EASE_CURVE }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { hapticLight(); navigate(tool.path); }}
              className={cn(
                'relative overflow-hidden rounded-xl border border-border/10 bg-card/60 text-left transition-colors',
                isWide && 'col-span-2 p-4',
                isFull && 'col-span-2 p-3.5 flex items-center gap-3',
                !isWide && !isFull && 'p-3.5',
              )}
            >
              <div className={cn(
                'flex items-center justify-center rounded-lg bg-foreground/[0.04] shrink-0',
                isWide ? 'w-10 h-10 mb-3' : isFull ? 'w-9 h-9' : 'w-8 h-8 mb-2.5'
              )}>
                <tool.icon className={cn(
                  'text-muted-foreground/60',
                  isWide ? 'w-5 h-5' : 'w-4 h-4'
                )} />
              </div>

              <div className={cn(isFull && 'flex-1 min-w-0')}>
                <h4 className={cn(
                  'font-medium text-foreground leading-tight',
                  isWide ? 'text-[14px]' : 'text-[12px]'
                )}>
                  {t(tool.titleKey)}
                </h4>
                <p className={cn(
                  'text-muted-foreground/60 leading-snug mt-0.5',
                  isWide ? 'text-[12px]' : 'text-[10px]'
                )}>
                  {t(tool.subtitleKey)}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
