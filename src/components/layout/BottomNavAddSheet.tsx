import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface BottomNavAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddGarmentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="16" height="13" rx="2" />
    <path d="M7 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <path d="M10 9v4M8 11h4" />
  </svg>
);

const LiveScanIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 7V4a1 1 0 0 1 1-1h3" />
    <path d="M14 3h3a1 1 0 0 1 1 1v3" />
    <path d="M18 13v3a1 1 0 0 1-1 1h-3" />
    <path d="M6 17H3a1 1 0 0 1-1-1v-3" />
    <circle cx="10" cy="10" r="3" />
  </svg>
);

const BulkAddIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="7" height="7" rx="1.5" />
    <rect x="11" y="2" width="7" height="7" rx="1.5" />
    <rect x="2" y="11" width="7" height="7" rx="1.5" />
    <rect x="11" y="11" width="7" height="7" rx="1.5" />
  </svg>
);

export function BottomNavAddSheet({ open, onOpenChange }: BottomNavAddSheetProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const actions = [
    {
      icon: <AddGarmentIcon />,
      label: t('nav.addGarment'),
      subtitle: t('nav.addGarmentDesc'),
      action: () => navigate('/wardrobe/add'),
    },
    {
      icon: <LiveScanIcon />,
      label: t('nav.liveScan'),
      subtitle: t('nav.liveScanDesc'),
      action: () => navigate('/wardrobe/scan'),
    },
    {
      icon: <BulkAddIcon />,
      label: t('nav.bulkAdd'),
      subtitle: t('nav.bulkAddDesc'),
      action: () => navigate('/wardrobe/add?mode=bulk'),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[20px] pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="px-[var(--page-px)] pb-4">
          <SheetTitle className="text-[17px] font-['DM_Sans'] font-semibold text-foreground">
            {t('nav.addTitle')}
          </SheetTitle>
        </SheetHeader>
        <div className="mx-[var(--page-px)] rounded-[14px] bg-card/30 border-[0.5px] border-border/40 overflow-hidden mb-4">
          {actions.map((item, i) => (
            <Fragment key={i}>
              {i > 0 && <div className="h-[0.5px] bg-border/30 ml-[52px]" />}
              <motion.button
                className="flex items-center gap-3 w-full px-4 py-[14px] text-left"
                whileTap={{ scale: 0.98 }}
                onClick={() => { hapticLight(); item.action(); onOpenChange(false); }}
              >
                <div className="text-foreground opacity-50">{item.icon}</div>
                <div className="flex-1">
                  <div className="text-[14px] font-['DM_Sans'] font-medium text-foreground">{item.label}</div>
                  <div className="text-[12px] text-muted-foreground mt-0.5">{item.subtitle}</div>
                </div>
                <ChevronRight className="h-[14px] w-[14px] text-foreground opacity-20" />
              </motion.button>
            </Fragment>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
