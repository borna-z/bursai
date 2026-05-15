// StyleChatScreen — assistant/user message bubble (N13 split, web-parity
// pass).
//
// Bubble has 18px radius with one corner squared to point toward the
// speaker (4px radius on speaker-side). Streaming assistant bubbles with
// no content yet show an animated three-dot indicator.
//
// M14: assistant bubbles render a mode-pill above the text when the
// envelope carries a recognised mode, and long-press triggers the anchor
// confirm dialog when an active-look is present.
//
// Chat-parity (this pass): the bubble now mirrors web's full layered
// rendering:
//   • outfit suggestion card (hero, when `render_outfit_card === true`)
//   • italic "rejection" sentence under the card (parity with web's
//     `extractRejectionSentence`)
//   • cleaned prose (with `[[garment:…]]` / `[[outfit:…]]` markup
//     stripped — see `lib/garmentTokens`)
//   • inline garment-card pills for every garment id mentioned in prose
//     OR surfaced via `stylistMeta.garment_mentions[]`. Each pill is
//     tappable and routes to `GarmentDetail` — that's the user's
//     "context window you can open and edit" entry.
//
// Memoized on the same key signals as before plus the prose text so a
// streaming delta doesn't churn cards but the final settled prose does
// re-evaluate inline mentions.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { ShoppingResultCard } from '../components/ShoppingResultCard';
import { OutfitSuggestionCard } from '../components/chat/OutfitSuggestionCard';
import { GarmentInlineCard } from '../components/chat/GarmentInlineCard';
import { useGarmentsByIds, type GarmentBasic } from '../hooks/useGarmentsByIds';
import {
  extractRejectionSentence,
  parseBoldSegments,
  parseGarmentTextSegments,
  stripUnknownGarmentMarkup,
} from '../lib/garmentTokens';
import { t as tr } from '../lib/i18n';
import type { ChatMessage } from '../hooks/useStyleChat';
import { modeLabel } from './StyleChatScreen.helpers';

export type MessageItemProps = {
  msg: ChatMessage;
  onLongPress: (msg: ChatMessage) => void;
  // M23 — invoked when the user taps the Open button on any
  // ShoppingResultCard rendered beneath this assistant bubble.
  onOpenProductLink: (url: string) => void;
  // G1 — invoked when the user taps "Try this outfit" on the inline
  // OutfitSuggestionCard. Receives the (possibly post-swap) garment id
  // list — today the screen anchors the first id so the next user turn
  // refines around the chosen look.
  onTryOutfit: (garmentIds: string[]) => void;
  // Parity-D — Save handler on the inline OutfitSuggestionCard.
  onSaveOutfit: (
    messageId: string,
    garmentIds: string[],
    context: { explanation: string },
  ) => Promise<void>;
  /** True when the persist mutation for THIS message is in flight. */
  isSavingOutfit?: boolean;
  /** True when this message's outfit has already been persisted. */
  isOutfitSaved?: boolean;
  // Q-D2 — refine-mode props.
  isRefining?: boolean;
  lockedIds?: Set<string>;
  onToggleLock?: (garmentId: string) => void;
  onEnterRefine?: (messageId: string, garmentIds: string[], explanation: string) => void;
  onCancelRefine?: () => void;
  // Web-parity additions:
  /** Tapping an inline garment pill — receives the garment id so the
   *  screen can navigate to GarmentDetail. */
  onOpenGarment: (garmentId: string) => void;
  /** Tapping the new explicit "Anchor" affordance on an outfit card —
   *  pins the first garment of the suggested look so the next prompt
   *  refines around it. Mirrors web's tap-to-anchor entry. */
  onAnchorOutfit: (garmentIds: string[]) => void;
};

export const MessageItem = React.memo(
  function MessageItem({
    msg,
    onLongPress,
    onOpenProductLink,
    onTryOutfit,
    onSaveOutfit,
    isSavingOutfit,
    isOutfitSaved,
    isRefining,
    lockedIds,
    onToggleLock,
    onEnterRefine,
    onCancelRefine,
    onOpenGarment,
    onAnchorOutfit,
  }: MessageItemProps) {
    const t = useTokens();
    const isUser = msg.role === 'user';
    const showTypingDots = msg.isStreaming && !msg.content;
    const mode = !isUser ? modeLabel(msg.stylistMeta?.mode) : null;
    const meta = msg.stylistMeta ?? null;
    const outfitGarmentIds = useMemo<string[]>(() => {
      if (isUser || meta?.render_outfit_card !== true) return [];
      if (meta.active_look?.garment_ids?.length) return meta.active_look.garment_ids;
      return meta.outfit_ids ?? [];
    }, [isUser, meta?.render_outfit_card, meta?.active_look?.garment_ids, meta?.outfit_ids]);
    const outfitId: string | null = null;
    const outfitExplanation = meta?.outfit_explanation || '';
    const showOutfitCard = !isUser && outfitGarmentIds.length > 0;

    // Synthesized SHOPPING envelopes carry a non-null `active_look` with
    // an empty `garment_ids: []`, so a Boolean() check alone returns
    // true and the screen-reader announces the long-press anchor hint
    // even though the underlying handler early-returns. Gate on a
    // non-empty garment_ids list.
    const canAnchor =
      !isUser &&
      Boolean(meta?.active_look) &&
      (meta?.active_look?.garment_ids?.length ?? 0) > 0;

    const shoppingCards =
      !isUser && meta?.shopping_results ? meta.shopping_results : null;

    // Web parity — clean the prose text before any per-segment parsing,
    // mirroring `ChatMessage.tsx:99`. Stripping unknown markup keeps a
    // streaming bubble visually stable: half-arrived tags are removed
    // until the closing `]]` lands.
    const rawText = isUser ? msg.content : stripUnknownGarmentMarkup(msg.content ?? '');

    // Web parity — extract the rejection sentence ("kept the loafers
    // over the trainers …") when an outfit card is present. The
    // remainder feeds the inline-prose path so the card-supporting
    // editorial line doesn't repeat.
    const { rejectionLine, displayText } = useMemo(() => {
      if (isUser) return { rejectionLine: null, displayText: rawText };
      if (!showOutfitCard) return { rejectionLine: null, displayText: rawText };
      const extracted = extractRejectionSentence(rawText);
      if (!extracted) return { rejectionLine: null, displayText: rawText };
      return { rejectionLine: extracted.rejection, displayText: extracted.remainder };
    }, [isUser, showOutfitCard, rawText]);

    // Web parity — collect all garment ids worth surfacing as inline
    // pills: those mentioned via `[[garment:…]]` tokens in prose, plus
    // any envelope-level `garment_mentions[]` that aren't already part
    // of the outfit card. Order is preserved so the bubble reads
    // top-to-bottom in a natural sequence (prose ids first, envelope
    // extras after).
    const { textSegments, inlineGarmentIds } = useMemo(() => {
      if (isUser || !displayText) {
        return { textSegments: null, inlineGarmentIds: [] as string[] };
      }
      const segs = parseGarmentTextSegments(displayText);
      const ids: string[] = [];
      segs.forEach((s) => {
        if (s.type === 'garment' && s.id && !ids.includes(s.id)) ids.push(s.id);
      });
      const extras = (meta?.garment_mentions ?? []).filter(
        (id) => !!id && !ids.includes(id) && !outfitGarmentIds.includes(id),
      );
      extras.forEach((id) => {
        if (!ids.includes(id)) ids.push(id);
      });
      return { textSegments: segs, inlineGarmentIds: ids };
    }, [isUser, displayText, meta?.garment_mentions, outfitGarmentIds]);

    // Hydrate the inline garment ids. Empty list short-circuits the
    // hook to `enabled: false`, so the SELECT only runs when there's
    // something to render.
    const { data: inlineGarments } = useGarmentsByIds(inlineGarmentIds);
    const inlineGarmentMap = useMemo(() => {
      const map = new Map<string, GarmentBasic>();
      (inlineGarments ?? []).forEach((g) => {
        if (g.id) map.set(g.id, g);
      });
      return map;
    }, [inlineGarments]);
    // Hydrated id set for ProseRenderer's "drop inline label when chip
    // will render" branch. Memoized off the same hook result so we
    // don't allocate a fresh Set per render.
    const hydratedInlineIds = useMemo(
      () => new Set(inlineGarmentMap.keys()),
      [inlineGarmentMap],
    );

    const handleLongPress = () => {
      if (canAnchor) onLongPress(msg);
    };

    // Inline label override map — if a [[garment:uuid|label]] segment
    // supplied a custom label, prefer it over the garment row's title.
    const labelById = useMemo(() => {
      const map = new Map<string, string>();
      (textSegments ?? []).forEach((s) => {
        if (s.type === 'garment' && s.label && s.id && !map.has(s.id)) {
          map.set(s.id, s.label);
        }
      });
      return map;
    }, [textSegments]);

    return (
      <View
        style={{
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          maxWidth: '92%',
          gap: 8,
        }}>
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={400}
          disabled={!canAnchor}
          accessibilityHint={canAnchor ? tr('chat.anchor.gesture.hint') : undefined}>
          {mode ? (
            <Eyebrow style={{ marginBottom: 4, marginLeft: 4 }}>{mode}</Eyebrow>
          ) : null}
          <View
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: isUser ? t.fg : t.card,
              borderRadius: 18,
              borderBottomRightRadius: isUser ? 4 : 18,
              borderBottomLeftRadius: isUser ? 18 : 4,
              borderWidth: isUser ? 0 : 1,
              borderColor: t.border,
            }}>
            {showTypingDots ? (
              <TypingDots color={t.fg2} />
            ) : (
              <Text
                style={{
                  fontFamily: fonts.ui,
                  fontSize: 13.5,
                  lineHeight: 19,
                  color: isUser ? t.bg : t.fg,
                  letterSpacing: -0.13,
                }}>
                {isUser ? (
                  msg.content
                ) : (
                  <ProseRenderer
                    segments={textSegments}
                    fallbackText={displayText}
                    hydratedIds={hydratedInlineIds}
                  />
                )}
                {msg.isStreaming && msg.content ? (
                  <Text style={{ color: t.fg3 }}> ▋</Text>
                ) : null}
              </Text>
            )}
          </View>
        </Pressable>

        {/* Web parity — italic rejection line under the outfit card,
            left-bordered with the accent colour. Renders only when an
            outfit card is present (otherwise the rejection sentence
            stays in the prose). */}
        {!isUser && rejectionLine ? (
          <View
            style={{
              borderLeftWidth: 1.5,
              borderLeftColor: t.accent + '40',
              paddingLeft: 10,
              marginLeft: 4,
            }}>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 12,
                lineHeight: 18,
                color: t.fg2,
              }}>
              {rejectionLine}
            </Text>
          </View>
        ) : null}

        {/* G1 — outfit suggestion card. */}
        {showOutfitCard ? (
          <OutfitSuggestionCard
            outfitId={outfitId}
            garmentIds={outfitGarmentIds}
            explanation={outfitExplanation}
            onTry={onTryOutfit}
            onAnchor={onAnchorOutfit}
            onSave={(ids, ctx) => onSaveOutfit(msg.id, ids, ctx)}
            saved={isOutfitSaved}
            saving={isSavingOutfit}
            isRefining={isRefining}
            lockedIds={lockedIds}
            onToggleLock={onToggleLock}
            onEnterRefine={
              onEnterRefine
                ? (ids, exp) => onEnterRefine(msg.id, ids, exp)
                : undefined
            }
            onCancelRefine={onCancelRefine}
          />
        ) : null}

        {/* M23 — product cards beneath the regular text bubble. */}
        {shoppingCards && shoppingCards.length > 0 ? (
          <View style={{ gap: 8 }}>
            {shoppingCards.map((card) => (
              <ShoppingResultCard
                key={card.id}
                card={card}
                onOpen={onOpenProductLink}
              />
            ))}
          </View>
        ) : null}

        {/* Web parity — inline garment-card pills. Rendered last so
            they hang under both the outfit card AND the prose, matching
            web's `ChatMessage.tsx:305-316` ordering. */}
        {!isUser && inlineGarmentIds.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              paddingTop: 2,
            }}>
            {inlineGarmentIds.map((id) => {
              const garment = inlineGarmentMap.get(id);
              if (!garment) return null;
              return (
                <GarmentInlineCard
                  key={id}
                  garment={garment}
                  onPress={onOpenGarment}
                  label={labelById.get(id)}
                />
              );
            })}
          </View>
        ) : null}
      </View>
    );
  },
  (a, b) =>
    a.msg.id === b.msg.id
    && a.msg.content === b.msg.content
    && a.msg.isStreaming === b.msg.isStreaming
    && a.msg.stylistMeta?.mode === b.msg.stylistMeta?.mode
    && a.msg.stylistMeta?.shopping_results === b.msg.stylistMeta?.shopping_results
    && a.msg.stylistMeta?.render_outfit_card === b.msg.stylistMeta?.render_outfit_card
    && a.msg.stylistMeta?.outfit_ids === b.msg.stylistMeta?.outfit_ids
    && a.msg.stylistMeta?.active_look?.garment_ids === b.msg.stylistMeta?.active_look?.garment_ids
    && a.msg.stylistMeta?.garment_mentions === b.msg.stylistMeta?.garment_mentions
    && a.onLongPress === b.onLongPress
    && a.onOpenProductLink === b.onOpenProductLink
    && a.onTryOutfit === b.onTryOutfit
    && a.onSaveOutfit === b.onSaveOutfit
    && a.onOpenGarment === b.onOpenGarment
    && a.onAnchorOutfit === b.onAnchorOutfit
    && a.isSavingOutfit === b.isSavingOutfit
    && a.isOutfitSaved === b.isOutfitSaved
    && a.isRefining === b.isRefining
    && a.lockedIds === b.lockedIds
    && a.onToggleLock === b.onToggleLock
    && a.onEnterRefine === b.onEnterRefine
    && a.onCancelRefine === b.onCancelRefine,
);

// Inline prose with bold-markdown support. Garment-tag segments yield
// to a chip below the bubble when the garment row is hydrated; when
// hydration is still pending OR has resolved empty (RLS, deleted row),
// the segment's `|label` fallback is rendered inline so the sentence
// still reads naturally. Mirrors web `ChatMessage.tsx:174-180`.
function ProseRenderer({
  segments,
  fallbackText,
  hydratedIds,
}: {
  segments: ReturnType<typeof parseGarmentTextSegments> | null;
  fallbackText: string;
  hydratedIds: Set<string>;
}) {
  if (!segments || segments.length === 0) {
    return <>{renderBoldRuns(fallbackText)}</>;
  }
  return (
    <>
      {segments.map((s, i) => {
        if (s.type === 'text') {
          return <Text key={`t-${i}`}>{renderBoldRuns(s.value + ' ')}</Text>;
        }
        // Hydrated → chip carries the title below; suppress inline so
        // the title isn't duplicated.
        if (hydratedIds.has(s.id)) return null;
        // Not yet hydrated (or filtered) → fall back to the label so
        // the sentence doesn't read as "Pair the with the loafers".
        if (s.label) {
          return <Text key={`g-${i}`}>{renderBoldRuns(s.label + ' ')}</Text>;
        }
        return null;
      })}
    </>
  );
}

function renderBoldRuns(text: string): React.ReactNode {
  if (!text) return null;
  const runs = parseBoldSegments(text);
  return runs.map((r, i) =>
    r.bold ? (
      <Text key={i} style={{ fontFamily: fonts.uiSemi }}>{r.value}</Text>
    ) : (
      <Text key={i}>{r.value}</Text>
    ),
  );
}

// Three-dot typing indicator. Uses simple opacity cycling rather than a
// full Animated.loop so the assistant bubble doesn't pay the cost of a
// running spring during a normal text response.
function TypingDots({ color }: { color: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((current) => (current + 1) % 3), 350);
    return () => clearInterval(id);
  }, []);
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Stylist is typing"
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', gap: 4, paddingVertical: 4 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
            opacity: tick === i ? 0.95 : 0.35,
          }}
        />
      ))}
    </View>
  );
}
