import { useState } from 'react';
import { Crown, Infinity, Sparkles, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Subscription } from '@/hooks/useSubscription';

interface PremiumSectionProps {
  isPremium: boolean;
  subscription: Subscription | null | undefined;
  limits: {
    maxGarments: number;
    maxOutfitsPerMonth: number;
  };
}

export function PremiumSection({ isPremium, subscription, limits }: PremiumSectionProps) {
  const [isLoadingCheckout, setIsLoadingCheckout] = useState<'monthly' | 'yearly' | null>(null);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const handleUpgrade = async (plan: 'monthly' | 'yearly') => {
    setIsLoadingCheckout(plan);
    try {
      const { data, error } = await supabase.functions.invoke('create_checkout_session', {
        body: { plan },
      });

      if (error) {
        console.error('Checkout error:', error);
        toast.error('Kunde inte starta betalning');
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Fick ingen betalningslänk');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Något gick fel');
    } finally {
      setIsLoadingCheckout(null);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('create_portal_session');

      if (error) {
        console.error('Portal error:', error);
        toast.error('Kunde inte öppna prenumerationshantering');
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Fick ingen länk');
      }
    } catch (err) {
      console.error('Portal error:', err);
      toast.error('Något gick fel');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  return (
    <Card className={cn(
      isPremium 
        ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30'
        : ''
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className={cn("w-5 h-5", isPremium && "text-amber-500")} />
            <CardTitle className="text-base">
              {isPremium ? 'Premium' : 'Free'}
            </CardTitle>
          </div>
          {isPremium && (
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500">
              Aktiv
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPremium ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Infinity className="w-4 h-4 text-amber-500" />
                <span>Obegränsad garderob</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Obegränsade outfits</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleManageSubscription}
              disabled={isLoadingPortal}
            >
              {isLoadingPortal ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Settings className="w-4 h-4 mr-2" />
              )}
              Hantera prenumeration
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Garments usage */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Plagg</span>
                <span className="text-muted-foreground">
                  {subscription?.garments_count || 0} / {limits.maxGarments}
                </span>
              </div>
              <Progress 
                value={((subscription?.garments_count || 0) / limits.maxGarments) * 100} 
                className="h-2" 
              />
            </div>
            
            {/* Outfits usage */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Outfits denna månad</span>
                <span className="text-muted-foreground">
                  {subscription?.outfits_used_month || 0} / {limits.maxOutfitsPerMonth}
                </span>
              </div>
              <Progress 
                value={((subscription?.outfits_used_month || 0) / limits.maxOutfitsPerMonth) * 100} 
                className="h-2" 
              />
            </div>

            <div className="space-y-2">
              <Button 
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                onClick={() => handleUpgrade('monthly')}
                disabled={isLoadingCheckout !== null}
              >
                {isLoadingCheckout === 'monthly' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Crown className="w-4 h-4 mr-2" />
                )}
                79 kr/månad
              </Button>
              <Button 
                variant="outline"
                className="w-full border-amber-500/50 hover:bg-amber-500/10"
                onClick={() => handleUpgrade('yearly')}
                disabled={isLoadingCheckout !== null}
              >
                {isLoadingCheckout === 'yearly' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                )}
                699 kr/år (spara 26%)
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
