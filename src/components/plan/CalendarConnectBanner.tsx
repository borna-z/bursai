import { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { cn } from '@/lib/utils';

export function CalendarConnectBanner() {
  const { icsUrl, isSyncing, syncCalendar, saveIcsUrl, lastSynced } = useCalendarSync();
  const [expanded, setExpanded] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Don't show if already connected
  if (icsUrl) return null;

  const handleConnect = async () => {
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
            onClick={handleConnect}
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

        <button
          onClick={() => setShowHelp(!showHelp)}
          className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Hur hittar jag min ICS-länk?
        </button>

        {showHelp && (
          <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-2">
            <div>
              <p className="font-medium">Outlook / Office 365</p>
              <p className="text-muted-foreground">
                Inställningar → Delad kalender → Publicera kalender → ICS
              </p>
            </div>
            <div>
              <p className="font-medium">Google Calendar</p>
              <p className="text-muted-foreground">
                Inställningar → Kalender → Hemlig adress i iCal-format
              </p>
            </div>
            <div>
              <p className="font-medium">Apple Calendar</p>
              <p className="text-muted-foreground">
                Högerklicka → Dela → Offentlig kalender
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
