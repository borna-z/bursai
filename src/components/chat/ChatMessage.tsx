import { useMemo } from 'react';
import { Sparkles, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GarmentInlineCard } from '@/components/chat/GarmentInlineCard';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';

type MultimodalPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

function getTextContent(content: string | MultimodalPart[]): string {
  if (typeof content === 'string') return content;
  return content.filter(p => p.type === 'text').map(p => (p as { type: 'text'; text: string }).text).join(' ');
}

function getImageUrls(content: string | MultimodalPart[]): string[] {
  if (typeof content === 'string') return [];
  return content.filter(p => p.type === 'image_url').map(p => (p as { type: 'image_url'; image_url: { url: string } }).image_url.url);
}

interface ChatMessageProps {
  message: { role: 'user' | 'assistant'; content: string | MultimodalPart[] };
  isStreaming: boolean;
  garmentMap: Map<string, GarmentBasic>;
  isShopping?: boolean;
}

export function ChatMessage({ message, isStreaming, garmentMap, isShopping }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const text = getTextContent(message.content);
  const images = getImageUrls(message.content);

  const { textParts, garmentCards } = useMemo(() => {
    if (!text) return { textParts: null, garmentCards: [] };
    const parts: React.ReactNode[] = [];
    const cards: GarmentBasic[] = [];
    let lastIndex = 0;
    const re = /\[\[garment:([a-f0-9-]+)\]\]/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      const garment = garmentMap.get(match[1]);
      if (garment) cards.push(garment);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }
    return { textParts: parts, garmentCards: cards };
  }, [text, garmentMap]);

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[85%] space-y-2">
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap justify-end">
              {images.map((url, i) => (
                <img key={i} src={url} alt="Upload" className="h-28 w-28 object-cover rounded-xl" />
              ))}
            </div>
          )}
          {text && (
            <div className="bg-muted/60 rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {text}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3 items-start animate-fade-in">
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-accent/10 shrink-0 mt-0.5 animate-scale-in">
        {isShopping
          ? <ShoppingBag className="w-3.5 h-3.5 text-accent" />
          : <Sparkles className="w-3.5 h-3.5 text-accent" />}
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {isStreaming && !text ? (
          <span className="inline-block w-0.5 h-5 bg-foreground/70 animate-pulse" />
        ) : (
          <>
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {textParts}
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-foreground/70 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
            {garmentCards.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {garmentCards.map(g => (
                  <GarmentInlineCard key={g.id} garment={g} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
