import { Camera, Plus, Shirt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface BottomNavAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTIONS = [
  {
    id: 'add-garment',
    labelKey: 'wardrobe.add',
    description: 'Capture or upload a new piece into your wardrobe.',
    icon: Shirt,
    to: '/wardrobe/add',
  },
  {
    id: 'live-scan',
    labelKey: 'wardrobe.live_scan',
    description: 'Use the live scanner for the fastest add flow.',
    icon: Camera,
    to: '/wardrobe/scan',
  },
] as const;

export function BottomNavAddSheet({ open, onOpenChange }: BottomNavAddSheetProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleSelect = (to: string) => {
    hapticLight();
    onOpenChange(false);
    navigate(to);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[2rem] border-border/60 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-6"
      >
        <SheetHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
            <Plus className="size-4" />
            {t('nav.add')}
          </div>
          <SheetTitle className="text-[1.35rem] font-semibold tracking-[-0.04em]">
            Add to your wardrobe
          </SheetTitle>
          <SheetDescription className="max-w-[32ch] text-[0.92rem] leading-6">
            Keep the workspace clean: add one garment or open the live scanner.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 grid gap-3" aria-label="Quick add actions">
          {ACTIONS.map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleSelect(action.to)}
                className="app-sheet-card flex items-center gap-4 text-left transition-colors hover:bg-card"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-secondary/65 text-foreground">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.98rem] font-medium tracking-[-0.02em] text-foreground">
                    {t(action.labelKey)}
                  </p>
                  <p className="mt-1 text-[0.84rem] leading-5 text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <Button
          variant="quiet"
          className="mt-4 h-11 w-full rounded-full text-[0.85rem] uppercase tracking-[0.12em]"
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>
      </SheetContent>
    </Sheet>
  );
}
