import { Sparkles, Image as ImageIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface GarmentSaveChoiceSheetProps {
  open: boolean;
  isSaving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectStudio: () => void;
  onSelectOriginal: () => void;
}

export function GarmentSaveChoiceSheet({
  open,
  isSaving = false,
  onOpenChange,
  onSelectStudio,
  onSelectOriginal,
}: GarmentSaveChoiceSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[2rem] border-border/60 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-6"
      >
        <SheetHeader className="space-y-2 text-left">
          <SheetTitle className="text-[1.35rem] font-semibold tracking-[-0.04em]">
            Save this garment
          </SheetTitle>
          <SheetDescription className="max-w-[34ch] text-[0.92rem] leading-6">
            Choose the version you want to save. Both options save right away.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={onSelectStudio}
            disabled={isSaving}
            className="app-sheet-card flex items-center gap-4 text-left transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-secondary/65 text-foreground">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.98rem] font-medium tracking-[-0.02em] text-foreground">
                Studio quality
              </p>
              <p className="mt-1 text-[0.84rem] leading-5 text-muted-foreground">
                Save now and let the studio version finish in the background.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onSelectOriginal}
            disabled={isSaving}
            className="app-sheet-card flex items-center gap-4 text-left transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-secondary/65 text-foreground">
              <ImageIcon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.98rem] font-medium tracking-[-0.02em] text-foreground">
                Original photo
              </p>
              <p className="mt-1 text-[0.84rem] leading-5 text-muted-foreground">
                Save the photo as it is with no studio processing.
              </p>
            </div>
          </button>
        </div>

        <Button
          variant="quiet"
          className="mt-4 h-11 w-full rounded-full text-[0.85rem] uppercase tracking-[0.12em]"
          disabled={isSaving}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
      </SheetContent>
    </Sheet>
  );
}
