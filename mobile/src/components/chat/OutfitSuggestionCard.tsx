// OutfitSuggestionCard — chat-row chrome wrapping the upgraded G6
// OutfitCard. Rendered inside StyleChatScreen's MessageItem when an
// assistant turn carries `stylistMeta.render_outfit_card === true`.
//
// Why a wrapper rather than rendering OutfitCard directly:
//   • Chat bubbles get an explicit "Try this outfit" CTA that hands the
//     id list back to the screen for navigation/anchor seeding. The
//     base OutfitCard's `onUse`/`onSave` slots are owned by other
//     callers (StyleMe results, recent outfits) and shouldn't be
//     repurposed here.
//   • Garment hydration is local to the chat bubble — only the chat
//     surface knows the message id pair, so the SELECT lives next to
//     the bubble rather than inside OutfitCard.
//   • A future "Refine" affordance (web parity) drops in next to "Try"
//     without touching OutfitCard's API.
//
// Mirrors the shape of `src/components/chat/OutfitSuggestionCard.tsx` on
// web but pared down: no swap popover, no lock toggles, no save button.
// Those features ride a future PR; today the card just visualizes the
// suggestion + offers the Try CTA.

import React, { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { OutfitCard } from '../OutfitCard';
import { Button } from '../Button';
import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { useGarmentsByIds } from '../../hooks/useGarmentsByIds';
import { t as tr } from '../../lib/i18n';

export interface OutfitSuggestionCardProps {
  /** Optional outfit row id when the assistant references a saved
   *  outfit; today only the garment id list is consumed, but accepting
   *  the outfit id here matches the web contract and lets a future
   *  "Open outfit" affordance drop in without an API change. */
  outfitId?: string | null;
  /** Garment ids the assistant suggested. Surfaced as the OutfitCard's
   *  garments grid once hydrated; passing an empty list short-circuits
   *  rendering. */
  garmentIds: string[];
  /** Optional explanation text from the assistant — rendered as a
   *  subtitle so the user knows why this outfit was suggested. */
  explanation?: string;
  /** Tap handler for the Try CTA — receives the (possibly post-swap)
   *  garment id list. Today the screen wires this through to the
   *  anchor row so the next chat turn refines around the chosen look. */
  onTry: (garmentIds: string[]) => void;
  /** Parity-D — Save CTA. Caller wires this to `usePersistGeneratedOutfit`
   *  so the user can pin a chat-suggested outfit to their saved Outfits
   *  list without first tapping Try. Mirrors web's
   *  `src/components/chat/OutfitSuggestionCard.tsx` save affordance. */
  onSave?: (
    garmentIds: string[],
    context: { explanation: string },
  ) => Promise<void> | void;
  /** When true the Save button renders as "Saved" + accent variant and
   *  disables tap so a quick double-tap doesn't double-save. The parent
   *  flips this once `onSave` resolves. */
  saved?: boolean;
  /** While the persistence mutation is in flight, surface "Saving…" so
   *  the user sees the action registered. */
  saving?: boolean;
}

export function OutfitSuggestionCard({
  outfitId,
  garmentIds,
  explanation,
  onTry,
  onSave,
  saved,
  saving,
}: OutfitSuggestionCardProps) {
  const t = useTokens();
  const safeIds = useMemo(
    () => garmentIds.filter((id): id is string => typeof id === 'string' && !!id),
    [garmentIds],
  );
  const { data: garments, isLoading } = useGarmentsByIds(safeIds);

  // Empty / unhydratable suggestion — render nothing rather than a
  // skeletal shell. The plain assistant text bubble already conveys the
  // recommendation; an empty card just adds visual noise.
  if (safeIds.length === 0) return null;

  // While the SELECT is in flight render a compact placeholder so the
  // bubble still has a tappable surface and the layout doesn't shift
  // when the row resolves. The subsequent OutfitCard maps the resolved
  // garment list straight through; its internal Shimmer covers the
  // signed-URL fetch per slot.
  if (isLoading || !garments) {
    // Surface a disabled state so the card communicates that the Try
    // CTA isn't tappable yet. Without this, a tap during hydration
    // lands on plain View and is silently dead. The disabled
    // accessibilityState plus dimmed opacity tells assistive tech and
    // sighted users alike that the action will appear shortly.
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityState={{ disabled: true, busy: true }}
        accessibilityLabel={tr('chat.outfitCard.loading')}
        style={{
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.card,
          borderRadius: radii.xl,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          opacity: 0.7,
        }}>
        <ActivityIndicator size="small" color={t.accent} />
        <Text
          style={{
            fontFamily: fonts.ui,
            fontSize: 12.5,
            color: t.fg2,
          }}>
          {tr('chat.outfitCard.loading')}
        </Text>
      </View>
    );
  }

  // Hydration came back empty (every id was filtered by RLS or has been
  // deleted from the wardrobe). Skip rendering — the assistant text
  // alone is the floor.
  if (garments.length === 0) return null;

  // OutfitCard sub/name — mirror the design system's existing copy
  // pattern (uppercase eyebrow + italic display title). The eyebrow
  // labels the surface as a chat suggestion; the name uses the
  // assistant's outfit_id when available so saved-outfit references
  // read like a callback rather than a generic title.
  const sub = tr('chat.outfitCard.eyebrow');
  const name = outfitId
    ? tr('chat.outfitCard.name.saved')
    : tr('chat.outfitCard.name.suggestion');

  return (
    <View style={{ gap: 8 }}>
      <OutfitCard
        sub={sub}
        name={name}
        garments={garments.map((g) => ({
          id: g.id,
          rendered_image_path: g.rendered_image_path,
          original_image_path: g.original_image_path,
        }))}
      />
      {explanation ? (
        <Text
          numberOfLines={3}
          style={{
            fontFamily: fonts.ui,
            fontSize: 12.5,
            lineHeight: 18,
            color: t.fg2,
            paddingHorizontal: 4,
          }}>
          {explanation}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {/* Both children get flex:1 (no `block` — that hard-codes width:100%
            and would clip the Save sibling inside the 82%-wide chat bubble). */}
        <Button
          label={tr('chat.outfitCard.try')}
          size="sm"
          style={{ flex: 1 }}
          onPress={() => onTry(garments.map((g) => g.id))}
        />
        {onSave ? (
          <Button
            label={
              saved
                ? tr('chat.outfitCard.saved')
                : saving
                  ? tr('chat.outfitCard.saving')
                  : tr('chat.outfitCard.save')
            }
            size="sm"
            variant={saved ? 'accent' : 'outline'}
            style={{ flex: 1 }}
            onPress={() => {
              if (saved || saving) return;
              void onSave(garments.map((g) => g.id), { explanation: explanation ?? '' });
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
