import { useMemo } from 'react';
import { Sparkles, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GarmentInlineCard } from '@/components/chat/GarmentInlineCard';
import { OutfitSuggestionCard } from '@/components/chat/OutfitSuggestionCard';
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
  onTryOutfit?: (garmentIds: string[]) => void;
  isCreatingOutfit?: boolean;
}

export function ChatMessage({ message, isStreaming, garmentMap, isShopping, onTryOutfit, isCreatingOutfit }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const text = getTextContent(message.content);
  const images = getImageUrls(message.content);

  const { textParts, garmentCards, outfitCards } = useMemo(() => {
    if (!text) return { textParts: null, garmentCards: [], outfitCards: [] };
    const parts: React.ReactNode[] = [];
    const cards: GarmentBasic[] = [];
    const outfits: { garments: GarmentBasic[]; explanation: string }[] = [];

    // First, extract outfit tags
    const outfitRe = /\[\[outfit:([a-f0-9-,]+)\|([^\]]*)\]\]/gi;
    // Build a clean text without outfit tags, but track where they were
    let cleanText = text;
    const outfitMatches: { fullMatch: string; ids: string[]; explanation: string }[] = [];
    let oMatch: RegExpExecArray | null;
    while ((oMatch = outfitRe.exec(text)) !== null) {
      const ids = oMatch[1].split(',').map(id => id.trim());
      outfitMatches.push({ fullMatch: oMatch[0], ids, explanation: oMatch[2].trim() });
    }

    // Build outfit card data
    for (const om of outfitMatches) {
      const gs = om.ids.map(id => garmentMap.get(id)).filter(Boolean) as GarmentBasic[];
      if (gs.length > 0) outfits.push({ garments: gs, explanation: om.explanation });
      cleanText = cleanText.replace(om.fullMatch, '');
    }

    // Now parse garment tags from remaining text
    let lastIndex = 0;
    const re = /\[\[garment:([a-f0-9-]+)\]\]/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(cleanText)) !== null) {
      if (match.index > lastIndex) {
        const segment = cleanText.slice(lastIndex, match.index).trim();
        if (segment) parts.push(<span key={`t-${lastIndex}`}>{segment} </span>);
      }
      const garment = garmentMap.get(match[1]);
      if (garment) cards.push(garment);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < cleanText.length) {
      const segment = cleanText.slice(lastIndex).trim();
      if (segment) parts.push(<span key={`t-${lastIndex}`}>{segment}</span>);
    }
    return { textParts: parts.length > 0 ? parts : null, garmentCards: cards, outfitCards: outfits };
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
            {outfitCards.length > 0 && (
              <div className="space-y-2 pt-2">
                {outfitCards.map((oc, i) => (
                  <OutfitSuggestionCard
                    key={`outfit-${i}`}
                    garments={oc.garments}
                    explanation={oc.explanation}
                    onTryOutfit={onTryOutfit || (() => {})}
                    isCreating={isCreatingOutfit}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
