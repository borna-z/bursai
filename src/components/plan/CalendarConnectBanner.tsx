import { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { cn } from '@/lib/utils';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335"/>
    </svg>
  );
}

export function CalendarConnectBanner() {
  const { connectedProvider, connectGoogle, isSyncing } = useCalendarSync();
  const [expanded, setExpanded] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showIcs, setShowIcs] = useState(false);
  const { saveIcsUrl, syncCalendar } = useCalendarSync();

  // Don't show if already connected
  if (connectedProvider) return null;

  const handleIcsConnect = async () => {
    if (!inputUrl.trim() || (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://'))) return;
    setIsSaving(true);
    try {
      await saveIcsUrl(inputUrl.trim());
      await syncCalendar();
      setExpanded(false);
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = isSyncing || isSaving;

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          'w-full flex items-center gap-3 rounded-xl border border-dashed p-3',
          'bg-muted/30 hover:bg-muted/50 transition-colors text-left'
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
          <Calendar className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Koppla din kalender</p>
          <p className="text-xs text-muted-foreground">Smartare outfit-förslag baserat på dina händelser</p>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Koppla kalender</span>
          </div>
          <button onClick={() => setExpanded(false)} className="text-muted-foreground">
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>

        {/* Google Calendar option */}
        <Button
          onClick={connectGoogle}
          disabled={isLoading}
          variant="outline"
          className="w-full justify-start gap-3 h-11"
        >
          <GoogleIcon className="w-4 h-4" />
          <div className="text-left">
            <div className="font-medium text-sm">Google Calendar</div>
          </div>
        </Button>

        {/* ICS fallback */}
        {!showIcs ? (
          <button
            onClick={() => setShowIcs(true)}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Eller koppla med ICS-länk (Apple, Outlook)
          </button>
        ) : (
          <div className="space-y-2">
            <Input
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Klistra in din ICS-länk"
              disabled={isLoading}
              className="text-sm"
            />
            <Button
              onClick={handleIcsConnect}
              disabled={isLoading || !inputUrl.trim()}
              size="sm"
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Synka kalender
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
