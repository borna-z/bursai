import { useRef, useEffect } from 'react';
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
  mode: 'stylist' | 'shopping';
}

export function ChatInput({
  input, onInputChange, onSend, onImageSelect,
  pendingImage, onClearImage, isStreaming, isUploading, mode,
}: ChatInputProps) {
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const placeholder = mode === 'shopping'
    ? (pendingImage ? t('chat.image_placeholder') : t('chat.shopping_placeholder'))
    : (pendingImage ? t('chat.image_placeholder') : t('chat.placeholder'));

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div className="px-4 pb-1 pt-2 shrink-0 animate-fade-in">
      <div className="max-w-lg mx-auto">
        <div className="relative rounded-3xl border border-border/30 bg-background/60 backdrop-blur-xl shadow-sm">
          {pendingImage && (
            <div className="px-3 pt-3">
              <div className="relative inline-block">
                <img src={pendingImage.url} alt="Pending upload preview" className="h-20 w-20 object-cover rounded-xl border border-border/30" />
                <button
                  onClick={onClearImage}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold"
                >
                  ×
                </button>
              </div>
            </div>
          )}
          <div className="flex items-end gap-1.5 px-3 py-3">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onImageSelect} />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
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
              className="flex-1 resize-none bg-transparent text-[15px] leading-relaxed py-2.5 px-1 outline-none placeholder:text-muted-foreground/50 max-h-32 min-h-[40px]"
            />
            <Button
              onClick={onSend}
              disabled={(!input.trim() && !pendingImage) || isStreaming}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
