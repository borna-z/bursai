import { useRef, useEffect, useState } from 'react';
import { Send, Loader2, ImagePlus } from 'lucide-react';
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
}

export function ChatInput({
  input, onInputChange, onSend, onImageSelect,
  pendingImage, onClearImage, isStreaming, isUploading,
}: ChatInputProps) {
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(0);

  const placeholder = pendingImage ? t('chat.image_placeholder') : t('chat.placeholder');

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  }, [input]);

  // Publish the VISIBLE card height (not the outer fixed container which
  // includes keyboard-offset padding that creates a huge empty gap).
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCardHeight(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // Card height + top padding (8px) + safe-area bottom (env) approximated at 34px on notch devices
    // The scroll area uses this to reserve space below messages
    document.documentElement.style.setProperty('--chat-input-height', `${cardHeight + 44}px`);
    return () => { document.documentElement.style.removeProperty('--chat-input-height'); };
  }, [cardHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div
      className="fixed inset-x-0 z-30 px-4 pt-2 bg-background/80 backdrop-blur-xl"
      style={{
        // Use bottom offset instead of padding — avoids double-counting
        // with viewport height changes. The input moves UP by keyboard height.
        bottom: 'var(--keyboard-offset, 0px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)',
      }}
    >
      <div className="max-w-lg mx-auto">
        <div ref={cardRef} className="relative rounded-[1.25rem] border border-accent/10 bg-card/90 backdrop-blur-xl shadow-[0_-4px_24px_hsl(var(--background)/0.6)]">
          {pendingImage && (
            <div className="px-3 pt-3">
              <div className="relative inline-block">
                <img src={pendingImage.url} alt="Pending upload preview" className="h-20 w-20 object-cover rounded-[1.1rem] border border-border/20" /> {/* i18n-ignore */}
                <button
                  onClick={onClearImage}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold shadow-sm"
                >
                  ×
                </button>
              </div>
            </div>
          )}
          <div className="flex items-end gap-1.5 px-3 py-2">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onImageSelect} />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-muted/40"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || isUploading}
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            </Button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isStreaming}
              rows={1}
              className="flex-1 resize-none bg-transparent text-[16px] font-body leading-relaxed py-2 px-1 outline-none placeholder:text-muted-foreground/40 placeholder:italic max-h-32 min-h-[44px]"
            />
            <Button
              onClick={onSend}
              disabled={(!input.trim() && !pendingImage) || isStreaming}
              size="icon"
              className={`h-10 w-10 shrink-0 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-30 ${input.trim() || pendingImage ? 'bg-foreground text-background hover:bg-foreground/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
