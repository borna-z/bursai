import { useEffect, useRef } from 'react';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChatInputProps {
  input: string;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pendingImage: { url: string; path: string } | null;
  onClearImage: () => void;
  isStreaming: boolean;
  isUploading: boolean;
  onFocus?: () => void;
  onComposerHeightChange?: (height: number) => void;
  keyboardOpen?: boolean;
}

const TEXTAREA_MAX_HEIGHT_PX = 176;

export function ChatInput({
  input,
  onInputChange,
  onSend,
  onImageSelect,
  pendingImage,
  onClearImage,
  isStreaming,
  isUploading,
  onFocus,
  onComposerHeightChange,
  keyboardOpen = false,
}: ChatInputProps) {
  const { t } = useLanguage();
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const placeholder = pendingImage ? t('chat.image_placeholder') : t('chat.placeholder');

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX);
    el.style.height = `${next}px`;
    // Only allow native scroll once content actually exceeds the cap —
    // otherwise users see a spurious scrollbar on short messages.
    el.style.overflowY = el.scrollHeight > TEXTAREA_MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, [input]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !onComposerHeightChange) return;

    const notify = () => onComposerHeightChange(root.getBoundingClientRect().height);
    notify();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(notify);
    observer.observe(root);
    return () => observer.disconnect();
  }, [onComposerHeightChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div
      ref={rootRef}
      className={`shrink-0 bg-gradient-to-t from-background via-background/95 to-background/0 px-3 pt-2 ${
        keyboardOpen
          ? 'pb-[0.4rem]'
          : 'pb-[calc(var(--app-safe-area-bottom,0px)+0.55rem)]'
      }`}
    >
      <div className="mx-auto max-w-xl">
        <div className="relative rounded-[1rem] border border-border/35 bg-card/95 shadow-[0_-10px_26px_hsl(var(--background)/0.82)] backdrop-blur-xl">
          {pendingImage && (
            <div className="px-3 pt-3">
              <div className="relative inline-block">
                <img
                  src={pendingImage.url}
                  alt={t('chat.pending_image_alt')}
                  className="h-20 w-20 rounded-[0.9rem] border border-border/20 object-cover"
                />
                <button
                  onClick={onClearImage}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
                  aria-label={t('chat.clear_image')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-1.5 px-2.5 py-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImageSelect} />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full text-muted-foreground/55 hover:bg-muted/40 hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || isUploading}
              aria-label={t('chat.upload_image')}
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            </Button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={onFocus}
              placeholder={placeholder}
              disabled={isStreaming}
              rows={1}
              className="max-h-[11rem] min-h-[42px] flex-1 resize-none bg-transparent px-1 py-2 text-[16px] font-body leading-relaxed outline-none placeholder:text-muted-foreground/42 placeholder:italic disabled:cursor-not-allowed"
              aria-label={t('chat.message_input')}
            />

            <Button
              onClick={onSend}
              disabled={(!input.trim() && !pendingImage) || isStreaming}
              size="icon"
              className={`h-10 w-10 shrink-0 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-30 ${
                input.trim() || pendingImage
                  ? 'bg-foreground text-background hover:bg-foreground/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
              aria-label={t('chat.send')}
            >
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
