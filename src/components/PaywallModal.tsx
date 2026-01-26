import { useState } from 'react';
import { Crown, Infinity, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'garments' | 'outfits';
}

export function PaywallModal({ isOpen, onClose, reason }: PaywallModalProps) {
  const [isLoading, setIsLoading] = useState<'monthly' | 'yearly' | null>(null);

  const handleStartPremium = async (plan: 'monthly' | 'yearly') => {
    setIsLoading(plan);
    try {
      const { data, error } = await supabase.functions.invoke('create_checkout_session', {
        body: { plan },
      });

      if (error) {
        console.error('Checkout error:', error);
        toast.error('Kunde inte starta betalning. Försök igen.');
        return;
      }

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        toast.error('Fick ingen betalningslänk');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Något gick fel. Försök igen.');
    } finally {
      setIsLoading(null);
    }
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
            onClick={() => handleStartPremium('monthly')}
            disabled={isLoading !== null}
          >
            {isLoading === 'monthly' ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Crown className="w-5 h-5 mr-2" />
            )}
            79 kr/månad
          </Button>
          <Button 
            variant="outline"
            className="w-full h-12 text-base border-amber-500/50 hover:bg-amber-500/10"
            onClick={() => handleStartPremium('yearly')}
            disabled={isLoading !== null}
          >
            {isLoading === 'yearly' ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5 mr-2 text-amber-500" />
            )}
            699 kr/år (spara 26%)
          </Button>
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={onClose}
            disabled={isLoading !== null}
          >
            Inte nu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
