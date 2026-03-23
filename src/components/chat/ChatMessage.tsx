import { useMemo } from 'react';
import { GarmentInlineCard } from '@/components/chat/GarmentInlineCard';
import { OutfitSuggestionCard } from '@/components/chat/OutfitSuggestionCard';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';
import { OUTFIT_TAG_RE, parseGarmentTextSegments, stripUnknownGarmentMarkup } from '@/lib/garmentTokens';

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

export function ChatMessage({ message, isStreaming, garmentMap, onTryOutfit, isCreatingOutfit }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const text = isUser ? getTextContent(message.content) : stripUnknownGarmentMarkup(getTextContent(message.content));
  const images = getImageUrls(message.content);

  const { textParts, garmentCards, outfitCards } = useMemo(() => {
    if (!text) return { textParts: null, garmentCards: [], outfitCards: [] };
    const parts: React.ReactNode[] = [];
    const cards: GarmentBasic[] = [];
    const outfits: { garments: GarmentBasic[]; explanation: string }[] = [];

    let cleanText = text;
    const outfitMatches: { fullMatch: string; ids: string[]; explanation: string }[] = [];
    let oMatch: RegExpExecArray | null;
    OUTFIT_TAG_RE.lastIndex = 0;
    while ((oMatch = OUTFIT_TAG_RE.exec(text)) !== null) {
      const ids = oMatch[1].split(',').map(id => id.trim());
      outfitMatches.push({ fullMatch: oMatch[0], ids, explanation: oMatch[2].trim() });
    }

    for (const om of outfitMatches) {
      const gs = om.ids.map(id => garmentMap.get(id)).filter(Boolean) as GarmentBasic[];
      if (gs.length > 0) outfits.push({ garments: gs, explanation: om.explanation });
      cleanText = cleanText.replace(om.fullMatch, '');
    }

    parseGarmentTextSegments(cleanText).forEach((segment, index) => {
      if (segment.type === 'text') {
        parts.push(<span key={`t-${index}`}>{segment.value} </span>);
        return;
      }

      const garment = garmentMap.get(segment.id);
      if (garment) {
        cards.push(garment);
      } else if (segment.label) {
        parts.push(<span key={`g-${index}`}>{segment.label} </span>);
      }
    });
    return { textParts: parts.length > 0 ? parts : null, garmentCards: cards, outfitCards: outfits };
  }, [text, garmentMap]);

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[85%] space-y-2">
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap justify-end">
              {images.map((url, i) => (
                <img key={i} src={url} alt="Upload" className="h-32 w-32 object-cover rounded-2xl shadow-sm" />
              ))}
            </div>
          )}
          {text && (
            <div className="bg-primary/10 text-foreground rounded-2xl rounded-br-md px-4 py-3 text-[15px] leading-[1.7] whitespace-pre-wrap">
              {text}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant message — clean left-aligned, no avatar
  return (
    <div className="animate-fade-in">
      <div className="space-y-2 max-w-[92%]">
        {isStreaming && !text && images.length === 0 ? (
          <span className="inline-block w-0.5 h-5 bg-accent/60 animate-pulse rounded-full" />
        ) : (
          <>
            {textParts && (
              <div className="text-[15px] leading-[1.7] whitespace-pre-wrap text-foreground">
                {textParts}
                {isStreaming && (
                  <span className="inline-block w-[1.5px] h-[18px] bg-accent/60 animate-pulse ml-0.5 align-text-bottom rounded-full" />
                )}
              </div>
            )}
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((url, i) => (
                  <img key={i} src={url} alt="Stylist reference" className="h-40 w-40 object-cover rounded-2xl shadow-sm" />
                ))}
              </div>
            )}
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
