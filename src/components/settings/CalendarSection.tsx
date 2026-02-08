import { useState } from 'react';
import { Calendar, RefreshCw, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

export function CalendarSection() {
  const { icsUrl, lastSynced, isSyncing, syncCalendar, saveIcsUrl, removeIcsUrl, isRemoving } = useCalendarSync();
  const [inputUrl, setInputUrl] = useState(icsUrl || '');
  const [showHelp, setShowHelp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAndSync = async () => {
    if (!inputUrl.trim()) return;
    
    // Basic URL validation
    if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
      return;
    }

    setIsSaving(true);
    try {
      await saveIcsUrl(inputUrl.trim());
      await syncCalendar();
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    await removeIcsUrl();
    setInputUrl('');
  };

  const isLoading = isSyncing || isSaving || isRemoving;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          <CardTitle className="text-base">Kalendersynk</CardTitle>
        </div>
        <CardDescription>
          Synka dina kalenderhändelser för smartare outfit-förslag
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ics-url">ICS-länk</Label>
          <div className="flex gap-2">
            <Input
              id="ics-url"
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/..."
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSaveAndSync}
            disabled={isLoading || !inputUrl.trim()}
            className="flex-1"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {icsUrl ? 'Synka igen' : 'Synka kalender'}
          </Button>
          
          {icsUrl && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleRemove}
              disabled={isLoading}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {lastSynced && (
          <p className="text-xs text-muted-foreground">
            Senast synkad: {formatDistanceToNow(new Date(lastSynced), { addSuffix: true, locale: sv })}
          </p>
        )}

        <Collapsible open={showHelp} onOpenChange={setShowHelp}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
              <ExternalLink className="w-3.5 h-3.5 mr-2" />
              Hur hittar jag min ICS-länk?
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-3">
              <div>
                <p className="font-medium">Google Calendar</p>
                <p className="text-muted-foreground text-xs">
                  Inställningar → Kalender → Hemlig adress i iCal-format
                </p>
              </div>
              <div>
                <p className="font-medium">Outlook/Office 365</p>
                <p className="text-muted-foreground text-xs">
                  Inställningar → Delad kalender → Publicera kalender → ICS
                </p>
              </div>
              <div>
                <p className="font-medium">Apple Calendar</p>
                <p className="text-muted-foreground text-xs">
                  Högerklicka på kalender → Dela → Offentlig kalender
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
