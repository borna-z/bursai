import { useState } from 'react';
import { Calendar, RefreshCw, Loader2, Trash2, ExternalLink, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
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
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type SyncStatus = 'synced' | 'stale' | 'never';

function getSyncStatus(lastSynced: string | null): SyncStatus {
  if (!lastSynced) return 'never';
  const hoursSinceSync = differenceInHours(new Date(), new Date(lastSynced));
  // Consider stale if more than 12 hours (2 sync cycles)
  return hoursSinceSync > 12 ? 'stale' : 'synced';
}

function SyncStatusBadge({ status, lastSynced }: { status: SyncStatus; lastSynced: string | null }) {
  const config = {
    synced: {
      icon: CheckCircle2,
      label: 'Synkad',
      className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    },
    stale: {
      icon: AlertCircle,
      label: 'Behöver synkas',
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
    never: {
      icon: Clock,
      label: 'Ej synkad',
      className: 'bg-muted text-muted-foreground border-border',
    },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
      className
    )}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  );
}

export function CalendarSection() {
  const { icsUrl, lastSynced, isSyncing, syncCalendar, saveIcsUrl, removeIcsUrl, isRemoving } = useCalendarSync();
  const [inputUrl, setInputUrl] = useState(icsUrl || '');
  const [showHelp, setShowHelp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const syncStatus = getSyncStatus(lastSynced);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            <CardTitle className="text-base">Kalendersynk</CardTitle>
          </div>
          {icsUrl && <SyncStatusBadge status={syncStatus} lastSynced={lastSynced} />}
        </div>
        <CardDescription>
          Synka dina kalenderhändelser för smartare outfit-förslag
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync info box when connected */}
        {icsUrl && lastSynced && (
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Senast synkad</span>
              <span className="font-medium">
                {formatDistanceToNow(new Date(lastSynced), { addSuffix: true, locale: sv })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Automatisk synk</span>
              <span className="font-medium text-green-600 dark:text-green-400">Var 6:e timme</span>
            </div>
          </div>
        )}

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
            {icsUrl ? 'Synka nu' : 'Synka kalender'}
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

        <Collapsible open={showHelp} onOpenChange={setShowHelp}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
              <ExternalLink className="w-3.5 h-3.5 mr-2" />
              Hur hittar jag min ICS-länk?
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-4">
              <div className="space-y-1.5">
                <p className="font-semibold text-sm">Google Calendar</p>
                <ol className="text-muted-foreground text-xs space-y-1 list-none">
                  <li>1. Öppna Google Calendar i webbläsaren</li>
                  <li>2. Hovra över en kalender under "Mina kalendrar" till vänster</li>
                  <li>3. Klicka på ⋮ och välj "Inställningar och delning"</li>
                  <li>4. Scrolla ner till avsnittet "Integrera kalender"</li>
                  <li>5. Kopiera URL:en under "Hemlig adress i iCal-format"</li>
                </ol>
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold text-sm">Outlook / Microsoft 365</p>
                <ol className="text-muted-foreground text-xs space-y-1 list-none">
                  <li>1. Logga in på Outlook på webben, klicka på kugghjulet ⚙️ uppe till höger</li>
                  <li>2. Välj "Visa alla Outlook-inställningar" → Kalender → Delade kalendrar</li>
                  <li>3. Under "Publicera en kalender", välj kalender och behörighet</li>
                  <li>4. Klicka "Publicera"</li>
                  <li>5. Kopiera ICS-länken som visas</li>
                </ol>
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold text-sm">Apple Calendar (Mac)</p>
                <ol className="text-muted-foreground text-xs space-y-1 list-none">
                  <li>1. Öppna Kalender-appen och hovra över kalendernamnet i listan</li>
                  <li>2. Klicka på delningsikonen (personikonen)</li>
                  <li>3. Markera "Offentlig kalender"</li>
                  <li>4. Kopiera URL:en som börjar med webcal://</li>
                </ol>
              </div>
              <div className="pt-1 border-t border-border/50 text-xs text-muted-foreground space-y-1">
                <p>⚠️ Offentliga ICS-adresser kräver att kalendern är publik.</p>
                <p>⚠️ Hittar du inte "Publicera" i Outlook kan din IT-administratör ha blockerat funktionen.</p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
