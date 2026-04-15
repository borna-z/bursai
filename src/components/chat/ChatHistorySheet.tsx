import { Clock3, MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export interface ChatThreadSummary {
  mode: string;
  title: string;
  preview: string;
  updatedAt: string;
  messageCount: number;
  hasOutfit: boolean;
}

interface ChatHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threads: ChatThreadSummary[];
  activeMode: string;
  isLoading: boolean;
  onSelectThread: (mode: string) => void;
  onNewThread: () => void;
}

function formatThreadDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
}

export function ChatHistorySheet({
  open,
  onOpenChange,
  threads,
  activeMode,
  isLoading,
  onSelectThread,
  onNewThread,
}: ChatHistorySheetProps) {
  const { t, locale } = useLanguage();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex h-full w-[86vw] max-w-sm flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border/35 px-5 pb-4 pt-[calc(var(--safe-area-top)+1rem)] text-left">
          <SheetTitle className="font-display italic text-[1.35rem] font-medium">
            {t('chat.history_title')}
          </SheetTitle>
          <SheetDescription>
            {t('chat.history_description')}
          </SheetDescription>
          <Button onClick={onNewThread} className="mt-2 h-11 w-full rounded-[0.9rem] gap-2">
            <Plus className="h-4 w-4" />
            {t('chat.new_chat')}
          </Button>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {isLoading ? (
            <div className="space-y-2 px-2 py-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-[72px] animate-pulse rounded-[1rem] bg-muted/50" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center px-5 text-center">
              <MessageSquare className="mb-3 h-5 w-5 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t('chat.no_past_chats')}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {threads.map((thread) => {
                const selected = thread.mode === activeMode;
                return (
                  <button
                    key={thread.mode}
                    type="button"
                    onClick={() => onSelectThread(thread.mode)}
                    className={cn(
                      'w-full rounded-[1rem] px-3 py-3 text-left transition-colors',
                      selected ? 'bg-secondary text-foreground' : 'hover:bg-secondary/55',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.85rem] border',
                          selected ? 'border-accent/35 bg-accent/10 text-accent' : 'border-border/35 bg-card text-muted-foreground',
                        )}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{thread.title || t('chat.untitled_thread')}</p>
                          {thread.hasOutfit && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label={t('chat.thread_has_outfit')} />
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground/78">
                          {thread.preview || t('chat.thread_preview_empty')}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/55">
                          <Clock3 className="h-3 w-3" />
                          <span>{formatThreadDate(thread.updatedAt, locale)}</span>
                          <span>{thread.messageCount}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
