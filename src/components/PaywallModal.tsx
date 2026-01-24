import { Crown, Infinity, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'garments' | 'outfits';
}

export function PaywallModal({ isOpen, onClose, reason }: PaywallModalProps) {
  const handleStartPremium = () => {
    // Placeholder for premium upgrade flow
    console.log('Start premium flow');
    // In future: redirect to Stripe checkout
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl">Lås upp Premium</DialogTitle>
          <DialogDescription className="text-base">
            {reason === 'garments' 
              ? 'Du har nått gränsen på 10 plagg med gratisplanen.'
              : 'Du har använt alla 10 outfit-genereringar denna månad.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-6">
          <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Infinity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Obegränsad garderob</p>
              <p className="text-sm text-muted-foreground">Lägg till hur många plagg du vill</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Obegränsade outfits</p>
              <p className="text-sm text-muted-foreground">Generera outfits utan begränsning</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Smartare rekommendationer</p>
              <p className="text-sm text-muted-foreground">AI-drivna förslag för din stil</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Button 
            className="w-full h-12 text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            onClick={handleStartPremium}
          >
            <Crown className="w-5 h-5 mr-2" />
            Starta Premium
          </Button>
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={onClose}
          >
            Inte nu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
