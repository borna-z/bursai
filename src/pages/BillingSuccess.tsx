import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export default function BillingSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    // Refresh subscription data after successful payment
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['subscription', user.id] });
      queryClient.invalidateQueries({ queryKey: ['stripe-subscription', user.id] });
    }
  }, [user?.id, queryClient]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Crown className="w-6 h-6 text-amber-500" />
            Premium aktiverat!
          </CardTitle>
          <CardDescription>
            Tack för din prenumeration. Du har nu tillgång till alla premium-funktioner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Obegränsad garderob</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Obegränsade outfit-genereringar</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Smartare AI-rekommendationer</span>
            </div>
          </div>

          <Button 
            className="w-full" 
            onClick={() => navigate('/')}
          >
            Börja använda Premium
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate('/settings')}
          >
            Hantera prenumeration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
