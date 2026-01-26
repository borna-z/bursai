import { useNavigate } from 'react-router-dom';
import { XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function BillingCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Avbrutet</CardTitle>
          <CardDescription>
            Betalningen avbröts. Du har inte debiterats.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Om du har frågor eller stötte på problem, tveka inte att kontakta oss.
          </p>

          <Button 
            className="w-full" 
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tillbaka till appen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
