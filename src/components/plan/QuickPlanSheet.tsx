import { useState } from 'react';
import { Wand2, Loader2, Check, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { format, addDays } from 'date-fns';
import { sv } from 'date-fns/locale';

interface QuickPlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAutoGenerate: (days: number) => Promise<void>;
  isGenerating: boolean;
  generatingDay: number;
}

export function QuickPlanSheet({
  open,
  onOpenChange,
  onAutoGenerate,
  isGenerating,
  generatingDay,
}: QuickPlanSheetProps) {
  const [isComplete, setIsComplete] = useState(false);

  const handleAutoGenerate = async () => {
    setIsComplete(false);
    await onAutoGenerate(7);
    setIsComplete(true);
  };

  const progress = isGenerating ? Math.round((generatingDay / 7) * 100) : (isComplete ? 100 : 0);

  const getDayLabel = (dayIndex: number) => {
    const date = addDays(new Date(), dayIndex);
    return format(date, 'EEEE', { locale: sv });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => {
      if (!isGenerating) {
        setIsComplete(false);
        onOpenChange(o);
      }
    }}>
      <SheetContent side="bottom" className="h-auto rounded-t-2xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>Planera hela veckan</SheetTitle>
          <SheetDescription>
            Låt AI:n fylla i outfits för alla dagar
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {isGenerating ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm">
                  Skapar outfit för {getDayLabel(generatingDay)}...
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {generatingDay} av 7 dagar
              </p>
            </div>
          ) : isComplete ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Veckan är planerad!</h3>
              <p className="text-sm text-muted-foreground">
                7 outfits har skapats och planerats
              </p>
              <Button
                className="mt-4"
                onClick={() => {
                  setIsComplete(false);
                  onOpenChange(false);
                }}
              >
                Visa planeringen
              </Button>
            </div>
          ) : (
            <>
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wand2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Auto-planering</p>
                    <p className="text-sm text-muted-foreground">
                      Baserat på väder, tillfälle och din stil
                    </p>
                  </div>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 ml-13">
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-primary" />
                    Undviker nyligen använda plagg
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-primary" />
                    Prioriterar oanvända favoriter
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-primary" />
                    Anpassar till väderprognos
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleAutoGenerate}
                className="w-full active:animate-press"
                size="lg"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Planera 7 dagar
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
