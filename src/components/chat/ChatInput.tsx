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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  const placeholder = pendingImage ? t('chat.image_placeholder') : t('chat.placeholder');

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  }, [input]);

  // Publish own height as CSS var so messages area can add bottom padding
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // Use getBoundingClientRect for border-box height (includes padding
      // from safe-area-inset-bottom and --keyboard-offset)
      setContainerHeight(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--chat-input-height', `${containerHeight}px`);
    return () => { document.documentElement.style.removeProperty('--chat-input-height'); };
  }, [containerHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 bottom-0 z-30 px-4 pt-2 bg-background/80 backdrop-blur-xl"
      style={{
        paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + var(--keyboard-offset, 0px)), 0.75rem)',
      }}
    >
      <div className="max-w-lg mx-auto">
        <div className="relative rounded-[1.25rem] border border-accent/10 bg-card/90 backdrop-blur-xl shadow-[0_-4px_24px_hsl(var(--background)/0.6)]">
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
