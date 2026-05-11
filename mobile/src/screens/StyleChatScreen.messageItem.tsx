// StyleChatScreen — assistant/user message bubble (N13 split).
//
// Bubble has 18px radius with one corner squared to point toward the
// speaker (4px radius on speaker-side). Streaming assistant bubbles with
// no content yet show an animated three-dot indicator.
//
// M14: assistant bubbles render a mode-pill above the text when the
// envelope carries a recognised mode, and long-press triggers the anchor
// confirm dialog when an active-look is present.
//
// Memoized on (id, content, isStreaming, stylistMeta.mode) so the
// FlatList doesn't re-render every visible message on every SSE delta.

import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { ShoppingResultCard } from '../components/ShoppingResultCard';
import { OutfitSuggestionCard } from '../components/chat/OutfitSuggestionCard';
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
  // Parity-D — Save handler on the inline OutfitSuggestionCard. The
  // screen owns the in-flight state + the saved-id stamp so the same
  // garment list isn't double-persisted across re-renders.
  onSaveOutfit: (
    messageId: string,
    garmentIds: string[],
    context: { explanation: string },
  ) => Promise<void>;
  /** True when the persist mutation for THIS message is in flight. */
  isSavingOutfit?: boolean;
  /** True when this message's outfit has already been persisted. */
  isOutfitSaved?: boolean;
  // Q-D2 — refine-mode props. Only THIS message's card surfaces refine
  // chrome (the screen's `refineMode.messageId` matches `msg.id`). All
  // other cards pass `isRefining=false` so simultaneous taps don't
  // confuse the chat surface.
  isRefining?: boolean;
  lockedIds?: Set<string>;
  onToggleLock?: (garmentId: string) => void;
  onEnterRefine?: (messageId: string, garmentIds: string[], explanation: string) => void;
  onCancelRefine?: () => void;
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
  }: MessageItemProps) {
    const t = useTokens();
    const isUser = msg.role === 'user';
    const showTypingDots = msg.isStreaming && !msg.content;
    const mode = !isUser ? modeLabel(msg.stylistMeta?.mode) : null;
    // G1 — outfit suggestion card surfaced when the assistant explicitly
    // asks for one (`render_outfit_card === true`) AND the envelope
    // carries at least one garment id. The active_look's garment_ids
    // override outfit_ids when present (matches web's preference order)
    // so a "preserve_if_exists" turn renders the same outfit the user
    // is already iterating on.
    const meta = msg.stylistMeta ?? null;
    const outfitGarmentIds: string[] = !isUser && meta?.render_outfit_card === true
      ? (meta.active_look?.garment_ids?.length
          ? meta.active_look.garment_ids
          : meta.outfit_ids ?? [])
      : [];
    // Codex P3 round 3 on PR #789: the style_chat envelope's
    // `outfit_ids` is the resolved GARMENT id list (per the edge
    // function contract), NOT a saved outfit row id. Until the contract
    // carries an explicit saved-outfit row id field, leave this null so
    // OutfitSuggestionCard always uses the suggestion title.
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
      Boolean(msg.stylistMeta?.active_look) &&
      (msg.stylistMeta?.active_look?.garment_ids?.length ?? 0) > 0;
    // M23 — shopping result cards rendered beneath the bubble.
    const shoppingCards =
      !isUser && msg.stylistMeta?.shopping_results
        ? msg.stylistMeta.shopping_results
        : null;

    const handleLongPress = () => {
      if (canAnchor) onLongPress(msg);
    };

    return (
      <View
        style={{
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          maxWidth: '82%',
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
                {msg.content}
                {msg.isStreaming && msg.content ? (
                  <Text style={{ color: t.fg3 }}> ▋</Text>
                ) : null}
              </Text>
            )}
          </View>
        </Pressable>
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
        {/* G1 — outfit suggestion card. */}
        {showOutfitCard ? (
          <OutfitSuggestionCard
            outfitId={outfitId}
            garmentIds={outfitGarmentIds}
            explanation={outfitExplanation}
            onTry={onTryOutfit}
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
    && a.onLongPress === b.onLongPress
    && a.onOpenProductLink === b.onOpenProductLink
    && a.onTryOutfit === b.onTryOutfit
    && a.onSaveOutfit === b.onSaveOutfit
    && a.isSavingOutfit === b.isSavingOutfit
    && a.isOutfitSaved === b.isOutfitSaved
    // Q-D2 — refine props. `isRefining` is `false` for every non-active
    // card so toggling refine on one card doesn't re-render the entire
    // FlatList; only the active card and its previous-active sibling
    // see a referential change. `lockedIds` identity changes whenever
    // a tile is tapped (new Set each toggle) so the active card always
    // re-renders to surface the latest badge state.
    && a.isRefining === b.isRefining
    && a.lockedIds === b.lockedIds
    && a.onToggleLock === b.onToggleLock
    && a.onEnterRefine === b.onEnterRefine
    && a.onCancelRefine === b.onCancelRefine,
);

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
