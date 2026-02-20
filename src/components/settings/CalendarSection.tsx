import { useState } from 'react';
import { Calendar, RefreshCw, Loader2, Trash2, ExternalLink, CheckCircle2, Clock, AlertCircle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/components/ui/section-header';

type SyncStatus = 'synced' | 'stale' | 'never';

function getSyncStatus(lastSynced: string | null): SyncStatus {
  if (!lastSynced) return 'never';
  const hoursSinceSync = differenceInHours(new Date(), new Date(lastSynced));
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
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border',
      className
    )}>
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </div>
  );
}

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

/* ─── Google Calendar Section ─── */
function GoogleCalendarCard({
  isConnected,
  isSyncing,
  isDisconnecting,
  lastSynced,
  onConnect,
  onSync,
  onDisconnect,
}: {
  isConnected: boolean;
  isSyncing: boolean;
  isDisconnecting: boolean;
  lastSynced: string | null;
  onConnect: () => void;
  onSync: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  const isLoading = isSyncing || isDisconnecting;
  const syncStatus = isConnected ? getSyncStatus(lastSynced) : 'never';

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <GoogleIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Google Calendar</span>
          </div>
          {isConnected && <SyncStatusBadge status={syncStatus} lastSynced={lastSynced} />}
        </div>

        {isConnected ? (
          <>
            {lastSynced && (
              <p className="text-xs text-muted-foreground">
                Senast synkad {formatDistanceToNow(new Date(lastSynced), { addSuffix: true, locale: sv })} · Automatisk var 6:e timme
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onSync()} disabled={isLoading} className="flex-1">
                {isSyncing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Synka nu
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDisconnect()} disabled={isLoading}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={onConnect} variant="outline" size="sm" className="w-full justify-start gap-2">
            Koppla Google Calendar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── ICS Link Section ─── */
function IcsCalendarCard({
  isConnected,
  currentUrl,
  isSyncing,
  isRemoving,
  lastSynced,
  onSave: onSaveAndSync,
  onRemove,
  onSync,
}: {
  isConnected: boolean;
  currentUrl: string | null;
  isSyncing: boolean;
  isRemoving: boolean;
  lastSynced: string | null;
  onSave: (url: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onSync: () => Promise<void>;
}) {
  const [inputUrl, setInputUrl] = useState(currentUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const isLoading = isSyncing || isSaving || isRemoving;
  const syncStatus = isConnected ? getSyncStatus(lastSynced) : 'never';

  const handleSave = async () => {
    if (!inputUrl.trim() || (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://'))) return;
    setIsSaving(true);
    try {
      await onSaveAndSync(inputUrl.trim());
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    await onRemove();
    setInputUrl('');
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link2 className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium">ICS-länk</span>
          </div>
          {isConnected && <SyncStatusBadge status={syncStatus} lastSynced={lastSynced} />}
        </div>

        <p className="text-xs text-muted-foreground">
          {isConnected
            ? `Senast synkad ${lastSynced ? formatDistanceToNow(new Date(lastSynced), { addSuffix: true, locale: sv }) : '–'} · Automatisk var 6:e timme`
            : 'Koppla Apple Calendar, Outlook eller annan ICS-källa'
          }
        </p>

        {isConnected ? (
          <>
            <div className="space-y-2">
              <Input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://..."
                disabled={isLoading}
                className="text-xs"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isLoading || !inputUrl.trim()} className="flex-1">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Synka nu
              </Button>
              <Button variant="outline" size="sm" onClick={handleRemove} disabled={isLoading}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </>
        ) : (
          !showInput ? (
            <Button variant="outline" size="sm" onClick={() => setShowInput(true)} className="w-full justify-start gap-2">
              <Link2 className="w-4 h-4" />
              Lägg till ICS-länk
            </Button>
          ) : (
            <div className="space-y-2">
              <Input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Klistra in din ICS-länk"
                disabled={isLoading}
                className="text-xs"
              />
              <Button size="sm" onClick={handleSave} disabled={isLoading || !inputUrl.trim()} className="w-full">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Synka kalender
              </Button>
            </div>
          )
        )}

        {/* ICS help */}
        {(isConnected || showInput) && (
          <Collapsible open={showHelp} onOpenChange={setShowHelp}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground text-xs h-8">
                <ExternalLink className="w-3 h-3 mr-1.5" />
                Hur hittar jag min ICS-länk?
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1">
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-3">
                <div className="space-y-1">
                  <p className="font-semibold">Google Calendar</p>
                  <ol className="text-muted-foreground space-y-0.5 list-none">
                    <li>1. Öppna Google Calendar i webbläsaren</li>
                    <li>2. Hovra över en kalender → ⋮ → Inställningar</li>
                    <li>3. Kopiera "Hemlig adress i iCal-format"</li>
                  </ol>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">Outlook / Microsoft 365</p>
                  <ol className="text-muted-foreground space-y-0.5 list-none">
                    <li>1. Inställningar → Kalender → Delade kalendrar</li>
                    <li>2. Publicera kalender → Kopiera ICS-länken</li>
                  </ol>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">Apple Calendar</p>
                  <ol className="text-muted-foreground space-y-0.5 list-none">
                    <li>1. Kalender → delningsikon → Offentlig kalender</li>
                    <li>2. Kopiera webcal://-länken</li>
                  </ol>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Main Export ─── */
export function CalendarSection() {
  const {
    icsUrl, lastSynced, isSyncing, syncCalendar, saveIcsUrl,
    removeIcsUrl, isRemoving, connectedProvider,
    connectGoogle, disconnectGoogle, isDisconnectingGoogle, googleConnection,
  } = useCalendarSync();

  const isGoogleConnected = !!googleConnection;
  const isIcsConnected = !!icsUrl;

  return (
    <div className="space-y-3">
      <SectionHeader title="Kalendersynk" />

      <GoogleCalendarCard
        isConnected={isGoogleConnected}
        isSyncing={isSyncing}
        isDisconnecting={isDisconnectingGoogle}
        lastSynced={isGoogleConnected ? lastSynced : null}
        onConnect={connectGoogle}
        onSync={syncCalendar}
        onDisconnect={disconnectGoogle}
      />

      <IcsCalendarCard
        isConnected={isIcsConnected}
        currentUrl={icsUrl}
        isSyncing={isSyncing}
        isRemoving={isRemoving}
        lastSynced={isIcsConnected ? lastSynced : null}
        onSave={async (url) => { await saveIcsUrl(url); await syncCalendar(); }}
        onRemove={removeIcsUrl}
        onSync={syncCalendar}
      />
    </div>
  );
}
