import { useNavigate } from 'react-router-dom';
import { Repeat, List, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface SwapSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outfitId: string;
  onCreateSimilar: () => void;
  onSelectOther: () => void;
  onGenerateNew: () => void;
}

export function SwapSheet({
  open,
  onOpenChange,
  outfitId,
  onCreateSimilar,
  onSelectOther,
  onGenerateNew,
}: SwapSheetProps) {
  const navigate = useNavigate();

  const handleViewDetails = () => {
    onOpenChange(false);
    navigate(`/outfits/${outfitId}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto rounded-t-2xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>Byt outfit</SheetTitle>
          <SheetDescription>
            Välj hur du vill ändra den planerade outfiten
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 pb-6">
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start h-auto py-4 px-4"
            onClick={() => {
              onCreateSimilar();
              onOpenChange(false);
            }}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Repeat className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium">Skapa liknande</p>
                <p className="text-sm text-muted-foreground">
                  Generera en variation av denna outfit
                </p>
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start h-auto py-4 px-4"
            onClick={() => {
              onSelectOther();
              onOpenChange(false);
            }}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <List className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium">Välj annan sparad</p>
                <p className="text-sm text-muted-foreground">
                  Byt till en outfit du redan har
                </p>
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start h-auto py-4 px-4"
            onClick={() => {
              onGenerateNew();
              onOpenChange(false);
            }}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium">Generera ny</p>
                <p className="text-sm text-muted-foreground">
                  Skapa en helt ny outfit för dagen
                </p>
              </div>
            </div>
          </Button>

          <div className="pt-2">
            <Button
              variant="ghost"
              className="w-full"
              onClick={handleViewDetails}
            >
              Visa detaljer och byt enskilda plagg
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
