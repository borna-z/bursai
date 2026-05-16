// Tab content for GarmentDetailScreen — extracted in Phase 3.
//
// Owns:
//   • Tab selector state (Info / Outfits / Similar)
//   • All three tab bodies' JSX
//   • The ConditionDetailSheet modal (open/close lives here as it's
//     local to the Info tab's "Tap to view full breakdown" affordance)
//
// The orchestrator passes the hydrated garment + resolved AI state
// (assessment, generateImage hook outputs) and the action handlers that
// span multiple surfaces (toggle wishlist/lingerie, kick condition
// re-assessment, kick image generation, edit-navigate). This keeps
// data fetching and the paywall latch in the orchestrator (Phase 3
// modularization risk #2, equivalent for non-Animated cross-cutting
// state) and the View tree here.

import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { Caption } from '../../components/Caption';
import { Button } from '../../components/Button';
import { IconBtn } from '../../components/IconBtn';
import { ListRow } from '../../components/ListRow';
import { SettingsRow } from '../../components/SettingsRow';
import { ConditionBadge, tierForScore } from '../../components/ConditionBadge';
import { CloseIcon } from '../../components/icons';
import { SUBSCRIPTION_SENTINEL } from '../../lib/edgeFunctionClient';
import { t as tr } from '../../lib/i18n';
import type { ConditionAssessment } from '../../hooks/useAssessCondition';

export type GarmentDetailTab = 'info' | 'outfits' | 'similar';

export interface InfoField {
  label: string;
  value: string;
}

export interface GarmentDetailTabsProps {
  // Header / shape inputs ---------------------------------------------
  fields: InfoField[];
  // Active tab + setter live in the orchestrator (per the Phase 3 audit
  // contract — sub-component renders the selected tab; selection state
  // is parent-owned so it stays alongside the rest of the screen's
  // top-level state).
  tab: GarmentDetailTab;
  onTabChange: (next: GarmentDetailTab) => void;
  // Image-generation rescue (manual-entry garments without a photo).
  showGenerateImageCta: boolean;
  generateImagePending: boolean;
  generateImageError: string | null;
  onGenerateImage: () => void;
  // Condition (M21) state.
  activeAssessment: ConditionAssessment | null;
  assessError: string | null;
  isAssessing: boolean;
  onCheckCondition: () => void;
  onReassess: () => void;
  // Personal flags (Q-C2) state.
  isWishlist: boolean;
  isLingerie: boolean;
  onToggleWishlist: (next: boolean) => void;
  onToggleLingerie: (next: boolean) => void;
  // Occasion tags (rendered as small pills below the SettingsRows).
  occasionTags: string[] | null | undefined;
}

export function GarmentDetailTabs({
  fields,
  tab,
  onTabChange,
  showGenerateImageCta,
  generateImagePending,
  generateImageError,
  onGenerateImage,
  activeAssessment,
  assessError,
  isAssessing,
  onCheckCondition,
  onReassess,
  isWishlist,
  isLingerie,
  onToggleWishlist,
  onToggleLingerie,
  occasionTags,
}: GarmentDetailTabsProps) {
  const t = useTokens();
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const handleOpenSheet = React.useCallback(() => {
    setSheetOpen(true);
  }, []);
  const handleCloseSheet = React.useCallback(() => {
    setSheetOpen(false);
  }, []);

  return (
    <>
      <View style={[s.tabStrip, { borderColor: t.border, backgroundColor: t.card }]}>
        {(['info', 'outfits', 'similar'] as GarmentDetailTab[]).map((tabId) => {
          const active = tab === tabId;
          const label = tabId === 'info' ? 'Info' : tabId === 'outfits' ? 'Outfits' : 'Similar';
          return (
            <Pressable
              key={tabId}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              onPress={() => onTabChange(tabId)}
              style={[
                s.tabBtn,
                { backgroundColor: active ? t.fg : 'transparent' },
              ]}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 12,
                  color: active ? t.bg : t.fg2,
                  letterSpacing: -0.1,
                }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'info' ? (
        <View style={{ gap: 12 }}>
          {/* N12 — manual-entry garments arrive with no image_path. Until
              a photo is attached, the hero falls back to the gradient
              placeholder. Offer a single-tap AI catalog-image generator
              here so the wardrobe doesn't fill up with colored squares.
              Hidden once an image (original or rendered) lands, and
              while a studio render is mid-flight (the existing pipeline
              will produce the rendered image any moment). */}
          {showGenerateImageCta ? (
            <View style={{ gap: 10 }}>
              <Eyebrow>Image</Eyebrow>
              <Caption>{tr('garment.generateImage.empty')}</Caption>
              <Button
                label={
                  generateImagePending
                    ? tr('garment.generateImage.busy')
                    : tr('garment.generateImage.action')
                }
                variant="outline"
                size="sm"
                disabled={generateImagePending}
                onPress={onGenerateImage}
                accessibilityState={{
                  disabled: generateImagePending,
                  busy: generateImagePending,
                }}
                leadingIcon={
                  generateImagePending ? (
                    <ActivityIndicator size="small" color={t.fg} />
                  ) : undefined
                }
              />
              {/* Codex P2 round 2 on PR #816 — surface non-paywall
                  failures (rate limit, network, function returning
                  success: false) so the user sees something more than
                  the button reverting to its idle label. The paywall
                  sentinel is filtered because it routes via the
                  paywall latch above, not as an error caption. Same
                  shape as the condition-assessment error caption. */}
              {generateImageError &&
              generateImageError !== SUBSCRIPTION_SENTINEL ? (
                <Caption style={{ color: t.destructive }}>
                  {tr('garment.generateImage.error')}
                </Caption>
              ) : null}
            </View>
          ) : null}
          {/* M21 — condition assessment block. Badge appears once the
              garment row has a persisted score OR the hook has just
              returned one. The "Check condition" CTA sits adjacent so a
              user without a prior assessment can trigger one inline; an
              accessibility hint surfaces the bottom-sheet target. */}
          <View style={{ gap: 10 }}>
            <Eyebrow>Condition</Eyebrow>
            {activeAssessment ? (
              <ConditionBadge assessment={activeAssessment} onTap={handleOpenSheet} />
            ) : (
              <Caption>{tr('condition.empty')}</Caption>
            )}
            {assessError && assessError !== SUBSCRIPTION_SENTINEL ? (
              <Caption style={{ color: t.destructive }}>
                {tr('condition.error.network')}
              </Caption>
            ) : null}
            <Button
              label={isAssessing ? tr('condition.assessing') : tr('condition.checkAction')}
              variant="outline"
              size="sm"
              disabled={isAssessing}
              onPress={onCheckCondition}
              accessibilityState={{ disabled: isAssessing, busy: isAssessing }}
              leadingIcon={
                isAssessing ? <ActivityIndicator size="small" color={t.fg} /> : undefined
              }
            />
          </View>
          <View style={[s.fieldGroup, { backgroundColor: t.card, borderColor: t.border }]}>
            {fields.map((f, i) => (
              <ListRow
                key={f.label}
                title={f.label}
                hideChevron
                last={i === fields.length - 1}
                right={
                  <Text
                    style={{
                      fontFamily: fonts.uiMed,
                      fontSize: 13,
                      color: t.fg,
                      letterSpacing: -0.1,
                    }}>
                    {f.value}
                  </Text>
                }
                style={{ paddingHorizontal: 14 }}
              />
            ))}
          </View>
          {/* Q-C2 — personal-flag toggles (Lingerie + Wishlist). Moved
              here from the Alert.alert menu so Android's 3-button cap
              doesn't drop Delete + Cancel. Each ride
              `useUpdateGarment` so the cache patches + Q-C1's
              `garments-smart-counts` invalidation come along for
              free. Codex P2 round 1 on Q-C2 PR #831. */}
          <View style={[s.fieldGroup, { backgroundColor: t.card, borderColor: t.border }]}>
            <SettingsRow
              title={tr('garmentDetail.flag.wishlist.label')}
              caption={tr('garmentDetail.flag.wishlist.hint')}
              toggle={{ value: isWishlist, onValueChange: onToggleWishlist }}
              style={{ paddingHorizontal: 14 }}
            />
            <SettingsRow
              title={tr('garmentDetail.flag.lingerie.label')}
              caption={tr('garmentDetail.flag.lingerie.hint')}
              toggle={{ value: isLingerie, onValueChange: onToggleLingerie }}
              last
              style={{ paddingHorizontal: 14 }}
            />
          </View>
          {occasionTags && occasionTags.length > 0 ? (
            <View>
              <Eyebrow style={{ marginBottom: 8 }}>Tags</Eyebrow>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {occasionTags.map((tag) => (
                  <View
                    key={tag}
                    style={[s.tagChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
                    <Text style={[s.tagChipText, { color: t.fg2 }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {tab === 'outfits' ? (
        <EmptyTab title="Not in any outfit yet" body="Build a look featuring this piece." />
      ) : null}

      {tab === 'similar' ? (
        <EmptyTab title="No similar pieces" body="Similar-piece suggestions land in a future release." />
      ) : null}

      {/* M21 — condition detail bottom sheet. Surfaces the full breakdown
          (score, wear signals, repair recommendations) plus a Re-assess
          action that re-runs the AI call. RN's stock Modal handles the
          slide-up transition; same pattern as GarmentSaveChoiceSheet so
          mobile doesn't pull in another sheet library. */}
      {activeAssessment ? (
        <ConditionDetailSheet
          visible={sheetOpen}
          assessment={activeAssessment}
          isAssessing={isAssessing}
          onClose={handleCloseSheet}
          onReassess={onReassess}
        />
      ) : null}
    </>
  );
}

function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, gap: 6 }}>
      <PageTitle size={22}>{title}</PageTitle>
      <Caption style={{ textAlign: 'center', maxWidth: 240 }}>{body}</Caption>
    </View>
  );
}

interface ConditionDetailSheetProps {
  visible: boolean;
  assessment: ConditionAssessment;
  isAssessing: boolean;
  onClose: () => void;
  onReassess: () => void;
}

function ConditionDetailSheet({
  visible,
  assessment,
  isAssessing,
  onClose,
  onReassess,
}: ConditionDetailSheetProps) {
  const t = useTokens();
  const score = Number.isFinite(assessment.condition_score)
    ? Math.max(0, Math.min(100, Math.round(assessment.condition_score)))
    : 0;
  // Single source of truth for tier classification — shared with the
  // ConditionBadge so the sheet's large numeral and the inline pill can
  // never drift out of sync. (Codex P3 on PR #747.)
  const tier = tierForScore(score);
  const tierColor = tier === 'good' ? t.accent : tier === 'poor' ? t.destructive : t.fg;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal>
      <Pressable
        accessible={false}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: t.scrimBg }]}
        onPress={onClose}
      />
      <View
        accessibilityRole="none"
        style={[
          sheetStyles.sheet,
          { backgroundColor: t.bg, borderTopColor: t.border },
        ]}>
        <View style={[sheetStyles.handle, { backgroundColor: t.border }]} />

        {/* P1.2 — explicit close affordance. The backdrop tap also dismisses,
            but VoiceOver / TalkBack users need a discoverable button inside
            the sheet card. Top-right placement matches platform convention
            for modal close. (Codex P1 on PR #747.) */}
        <View style={sheetStyles.closeBtnWrap}>
          <IconBtn
            ariaLabel={tr('condition.closeSheet')}
            variant="ghost"
            onPress={onClose}>
            <CloseIcon color={t.fg} />
          </IconBtn>
        </View>

        <Eyebrow style={{ marginBottom: 6 }}>Condition</Eyebrow>
        {/* P1.1 — score block dims while a re-assessment is in flight so
            the surface communicates that the displayed score is stale.
            Paired with the inline ActivityIndicator on the disabled
            Re-assess button below. (Codex P1 on PR #747.) */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 10,
            marginBottom: 14,
            opacity: isAssessing ? 0.4 : 1,
          }}>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 48,
              lineHeight: 52,
              color: tierColor,
              letterSpacing: -1.2,
            }}>
            {score}
          </Text>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 11,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: tierColor,
            }}>
            {tr(`condition.tier.${tier}`)}
          </Text>
        </View>

        {assessment.summary ? (
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 13.5,
              lineHeight: 19,
              color: t.fg,
              marginBottom: 18,
            }}>
            {assessment.summary}
          </Text>
        ) : null}

        {assessment.wear_signals.length > 0 ? (
          <View style={{ marginBottom: 14 }}>
            <Eyebrow style={{ marginBottom: 8 }}>{tr('condition.wearSignals')}</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {assessment.wear_signals.map((signal) => (
                <View
                  key={signal}
                  style={[s.tagChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
                  <Text style={[s.tagChipText, { color: t.fg2 }]}>{signal}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {assessment.repair_recommendations.length > 0 ? (
          <View style={{ marginBottom: 14 }}>
            <Eyebrow style={{ marginBottom: 8 }}>{tr('condition.repairTitle')}</Eyebrow>
            <View style={{ gap: 6 }}>
              {assessment.repair_recommendations.map((rec) => (
                <View key={rec} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ color: t.fg2, fontFamily: fonts.ui, fontSize: 13 }}>•</Text>
                  <Text
                    style={{
                      flex: 1,
                      color: t.fg,
                      fontFamily: fonts.ui,
                      fontSize: 13,
                      lineHeight: 18,
                    }}>
                    {rec}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Button
          label={isAssessing ? tr('condition.assessing') : tr('condition.reassessAction')}
          variant="outline"
          block
          disabled={isAssessing}
          onPress={onReassess}
          accessibilityState={{ disabled: isAssessing, busy: isAssessing }}
          leadingIcon={
            isAssessing ? <ActivityIndicator size="small" color={t.fg} /> : undefined
          }
        />
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  closeBtnWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
});

const s = StyleSheet.create({
  tabStrip: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tabBtn: {
    flex: 1,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tagChipText: {
    fontFamily: fonts.uiSemi,
    fontSize: 11,
    letterSpacing: -0.05,
  },
});
