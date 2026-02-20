import { useState } from 'react';
import { Calendar, RefreshCw, Loader2, Trash2, ExternalLink, CheckCircle2, Clock, AlertCircle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/components/ui/section-header';
import { useLanguage } from '@/contexts/LanguageContext';

type SyncStatus = 'synced' | 'stale' | 'never';

function getSyncStatus(lastSynced: string | null): SyncStatus {
  if (!lastSynced) return 'never';
  const hoursSinceSync = differenceInHours(new Date(), new Date(lastSynced));
  return hoursSinceSync > 12 ? 'stale' : 'synced';
}

function SyncStatusBadge({ status, t }: { status: SyncStatus; lastSynced: string | null; t: (key: string) => string }) {
  const config = {
    synced: {
      icon: CheckCircle2,
      label: t('calendar.synced'),
      className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    },
    stale: {
      icon: AlertCircle,
      label: t('calendar.needs_sync'),
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
    never: {
      icon: Clock,
      label: t('calendar.never_synced'),
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
  isConnected, isSyncing, isDisconnecting, lastSynced, onConnect, onSync, onDisconnect, t,
}: {
  isConnected: boolean; isSyncing: boolean; isDisconnecting: boolean; lastSynced: string | null;
  onConnect: () => void; onSync: () => Promise<void>; onDisconnect: () => Promise<void>;
  t: (key: string) => string;
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
          {isConnected && <SyncStatusBadge status={syncStatus} lastSynced={lastSynced} t={t} />}
        </div>

        {isConnected ? (
          <>
            {lastSynced && (
              <p className="text-xs text-muted-foreground">
                {t('calendar.last_synced')} {formatDistanceToNow(new Date(lastSynced), { addSuffix: true })} · {t('calendar.auto_every_6h')}
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onSync()} disabled={isLoading} className="flex-1">
                {isSyncing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                {t('calendar.sync_now')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDisconnect()} disabled={isLoading}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={onConnect} variant="outline" size="sm" className="w-full justify-start gap-2">
            {t('calendar.connect_google')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── ICS Link Section ─── */
function IcsCalendarCard({
  isConnected, currentUrl, isSyncing, isRemoving, lastSynced, onSave: onSaveAndSync, onRemove, onSync, t,
}: {
  isConnected: boolean; currentUrl: string | null; isSyncing: boolean; isRemoving: boolean; lastSynced: string | null;
  onSave: (url: string) => Promise<void>; onRemove: () => Promise<void>; onSync: () => Promise<void>;
  t: (key: string) => string;
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
    try { await onSaveAndSync(inputUrl.trim()); } finally { setIsSaving(false); }
  };

  const handleRemove = async () => { await onRemove(); setInputUrl(''); };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link2 className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium">{t('calendar.ics_label')}</span>
          </div>
          {isConnected && <SyncStatusBadge status={syncStatus} lastSynced={lastSynced} t={t} />}
        </div>

        <p className="text-xs text-muted-foreground">
          {isConnected
            ? `${t('calendar.last_synced')} ${lastSynced ? formatDistanceToNow(new Date(lastSynced), { addSuffix: true }) : '–'} · ${t('calendar.auto_every_6h')}`
            : t('calendar.connect_apple_desc')
          }
        </p>

        {isConnected ? (
          <>
            <div className="space-y-2">
              <Input type="url" value={inputUrl} onChange={(e) => setInputUrl(e.target.value)} placeholder="https://..." disabled={isLoading} className="text-xs" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isLoading || !inputUrl.trim()} className="flex-1">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                {t('calendar.sync_now')}
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
              {t('calendar.connect_ics')}
            </Button>
          ) : (
            <div className="space-y-2">
              <Input type="url" value={inputUrl} onChange={(e) => setInputUrl(e.target.value)} placeholder={t('calendar.paste_ics')} disabled={isLoading} className="text-xs" />
              <Button size="sm" onClick={handleSave} disabled={isLoading || !inputUrl.trim()} className="w-full">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                {t('calendar.sync_calendar')}
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
                {t('calendar.how_to')}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1">
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-3">
                <div className="space-y-1">
                  <p className="font-semibold">{t('calendar.google_help_title')}</p>
                  <ol className="text-muted-foreground space-y-0.5 list-none">
                    <li>{t('calendar.google_help_1')}</li>
                    <li>{t('calendar.google_help_2')}</li>
                    <li>{t('calendar.google_help_3')}</li>
                  </ol>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">{t('calendar.outlook_help_title')}</p>
                  <ol className="text-muted-foreground space-y-0.5 list-none">
                    <li>{t('calendar.outlook_help_1')}</li>
                    <li>{t('calendar.outlook_help_2')}</li>
                  </ol>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">{t('calendar.apple_help_title')}</p>
                  <ol className="text-muted-foreground space-y-0.5 list-none">
                    <li>{t('calendar.apple_help_1')}</li>
                    <li>{t('calendar.apple_help_2')}</li>
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
  const { t } = useLanguage();
  const {
    icsUrl, lastSynced, isSyncing, syncCalendar, saveIcsUrl,
    removeIcsUrl, isRemoving, connectedProvider,
    connectGoogle, disconnectGoogle, isDisconnectingGoogle, googleConnection,
  } = useCalendarSync();

  const isGoogleConnected = !!googleConnection;
  const isIcsConnected = !!icsUrl;

  return (
    <div className="space-y-3">
      <SectionHeader title={t('calendar.title')} />

      <GoogleCalendarCard
        isConnected={isGoogleConnected}
        isSyncing={isSyncing}
        isDisconnecting={isDisconnectingGoogle}
        lastSynced={isGoogleConnected ? lastSynced : null}
        onConnect={connectGoogle}
        onSync={syncCalendar}
        onDisconnect={disconnectGoogle}
        t={t}
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
        t={t}
      />
    </div>
  );
}