import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GarmentInlineCard } from '@/components/chat/GarmentInlineCard';
import { OutfitSuggestionCard } from '@/components/chat/OutfitSuggestionCard';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';
import { parseGarmentTextSegments, parseOutfitTags, stripUnknownGarmentMarkup } from '@/lib/garmentTokens';

function renderBoldMarkdown(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

const REJECTION_RE = /\b(over the|instead of|rather than|kept the)\b|(\bchose\b.*\bnot\b)/i;

function extractRejectionSentence(text: string): { rejection: string; remainder: string } | null {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [];
  const idx = sentences.findIndex(s => REJECTION_RE.test(s));
  if (idx === -1) return null;
  const rejection = sentences[idx].trim();
  const remainder = [...sentences.slice(0, idx), ...sentences.slice(idx + 1)]
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { rejection, remainder };
}

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
  showStyleCards?: boolean;
  onGarmentClick?: (garmentId: string) => void;
}

export function ChatMessage({ message, isStreaming, garmentMap, onTryOutfit, isCreatingOutfit, showStyleCards = true, onGarmentClick }: ChatMessageProps) {
  const navigate = useNavigate();
  const isUser = message.role === 'user';
  const text = isUser ? getTextContent(message.content) : stripUnknownGarmentMarkup(getTextContent(message.content));
  const images = getImageUrls(message.content);

  const { textParts, garmentCards, outfitCards, rejectionLine } = useMemo(() => {
    if (!text) return { textParts: null, garmentCards: [], outfitCards: [], rejectionLine: null };
    const parts: React.ReactNode[] = [];
    const cards: GarmentBasic[] = [];
    const outfits: { garments: GarmentBasic[]; explanation: string }[] = [];

    let cleanText = text;
    const outfitMatches = parseOutfitTags(text);

    for (const om of outfitMatches) {
      const gs = om.ids.map(id => garmentMap.get(id)).filter(Boolean) as GarmentBasic[];
      if (gs.length > 0) outfits.push({ garments: gs, explanation: om.explanation });
      cleanText = cleanText.replace(om.fullMatch, '');
    }

    let rejectionLine: string | null = null;
    if (outfits.length > 0) {
      const extracted = extractRejectionSentence(cleanText);
      if (extracted) {
        rejectionLine = extracted.rejection;
        cleanText = extracted.remainder;
      }
    }

    parseGarmentTextSegments(cleanText).forEach((segment, index) => {
      if (segment.type === 'text') {
        parts.push(<span key={`t-${index}`}>{renderBoldMarkdown(segment.value)}{' '}</span>);
        return;
      }

      const garment = garmentMap.get(segment.id);
      if (garment) {
        cards.push(garment);
      } else if (segment.label) {
        parts.push(<span key={`g-${index}`}>{renderBoldMarkdown(segment.label)}{' '}</span>);
      }
    });
    return { textParts: parts.length > 0 ? parts : null, garmentCards: cards, outfitCards: outfits, rejectionLine };
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
  const hasOutfit = showStyleCards && outfitCards.length > 0;

  return (
    <div className="animate-fade-in">
      <div className="space-y-2 max-w-[92%]">
        {isStreaming && !text && images.length === 0 ? (
          <span className="inline-block w-0.5 h-5 bg-accent/60 animate-pulse rounded-full" />
        ) : (
          <>
            {/* Outfit card — hero position when present */}
            <div style={{ minHeight: isStreaming && hasOutfit ? 120 : undefined }}>
              {hasOutfit && (
                <div className="space-y-2">
                  {outfitCards.map((oc, i) => (
                    <OutfitSuggestionCard
                      key={`outfit-${i}`}
                      garments={oc.garments}
                      explanation={oc.explanation}
                      onTryOutfit={onTryOutfit || (() => {})}
                      isCreating={isCreatingOutfit}
                    />
                  ))}
                  {rejectionLine && (
                    <div className="border-l-2 border-foreground/20 pl-2.5 mt-1.5">
                      <span className="font-['DM_Sans'] text-xs text-foreground/60 italic leading-relaxed">
                        {renderBoldMarkdown(rejectionLine)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Prose text — secondary style when outfit is present */}
            {textParts && (
              <div
                style={{ minHeight: 48 }}
                className={
                  hasOutfit
                    ? 'text-[14px] leading-relaxed text-foreground/70 whitespace-pre-wrap'
                    : 'text-[15px] leading-[1.7] whitespace-pre-wrap text-foreground'
                }
              >
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
            {showStyleCards && garmentCards.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {garmentCards.map(g => (
                  <GarmentInlineCard
                    key={g.id}
                    garment={g}
                    onClick={() => onGarmentClick ? onGarmentClick(g.id) : navigate(`/wardrobe/${g.id}`)}
                  />
                ))}
              </div>
            )}
            {showStyleCards && outfitCards.length > 0 && !hasOutfit && (
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
