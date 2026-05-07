// Settings · Style profile — summary of current Style DNA + edit/reset actions.
// Mirrors design_handoff_burs_rn/source/audit-screens.jsx SettingsStyleScreen.

import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { styleColorToHex } from '../theme/styleColors';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { SettingsRow } from '../components/SettingsRow';
import { Skeleton } from '../components/Skeleton';
import { TypedConfirmModal } from '../components/TypedConfirmModal';
import { BackIcon, SparklesIcon, PaletteIcon, TshirtIcon, RotateIcon } from '../components/icons';
import { useResetStyleMemory } from '../hooks/useResetStyleMemory';
import { FORMALITY_BUCKETS_DISPLAY, useStyleDNA } from '../hooks/useStyleDNA';
import { t as tr } from '../lib/i18n';
import { clearOnboardingDraft } from './OnboardingScreen';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** "Updated Nh ago" — minimal bucket logic, no date-fns dependency.
 * Returns null when the timestamp is missing or unparseable so the
 * caller can hide the freshness caption rather than show "just now"
 * for a row that's actually decades stale. */
function formatUpdatedAgo(updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return null;
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return 'Updated just now';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

export function SettingsStyleScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const resetMemory = useResetStyleMemory();
  const [resetOpen, setResetOpen] = useState(false);
  // M29 — DNA preview row at the top of the page. Reads from the same
  // hook ProfileScreen uses; cache hits across screens (5-min staleTime).
  // The full editor lands in M38; for now we show a read-only preview.
  const dnaQuery = useStyleDNA();
  const dna = dnaQuery.data;

  const handleConfirmReset = () => {
    resetMemory.mutate(undefined, {
      onSuccess: () => {
        setResetOpen(false);
        Alert.alert(
          tr('settings.reset_memory.success.title'),
          tr('settings.reset_memory.success.body'),
        );
      },
      onError: (err) => {
        setResetOpen(false);
        Alert.alert(
          tr('settings.reset_memory.title'),
          err instanceof Error ? err.message : tr('settings.reset_memory.error'),
        );
      },
    });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ HEADER ============ */}
        <View style={s.headerRow}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>Settings</Eyebrow>
            <PageTitle>Style profile</PageTitle>
          </View>
        </View>

        {/* ============ STYLE SUMMARY CARD ============ */}
        {/* M29: archetype + vibes + formality wired to useStyleDNA().
            Loading shows skeleton placeholders for the title + chip rows
            so the card frame still paints; the DNA hook is fast (single
            indexed select) but cold-start can take a frame. The full
            editor lands in M38 — for now SettingsRows below stay in their
            "coming soon" state. */}
        <Card hero padding={18}>
          <Eyebrow style={{ marginBottom: 8 }}>{tr('settingsStyle.dnaPreview.title')}</Eyebrow>
          {dna ? (
            <>
              <Text
                style={{
                  fontFamily: fonts.displayMedium,
                  fontStyle: 'italic',
                  fontSize: 22,
                  fontWeight: '500',
                  color: t.fg,
                  letterSpacing: -0.22,
                  marginBottom: 4,
                }}>
                {dna.archetype}
              </Text>
              {(() => {
                const updatedAgo = formatUpdatedAgo(dna.updatedAt);
                return updatedAgo ? (
                  <Caption style={{ marginBottom: 14 }}>{updatedAgo}</Caption>
                ) : (
                  <View style={{ marginBottom: 14 }} />
                );
              })()}
            </>
          ) : (
            <Skeleton radius={4} height={26} style={{ width: 180, marginBottom: 14 }} />
          )}

          <Eyebrow style={{ marginBottom: 8 }}>Archetypes</Eyebrow>
          {dna && dna.vibes.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {dna.vibes.map((vibe) => (
                <Chip key={vibe} label={vibe} active />
              ))}
            </View>
          ) : dna ? (
            <Caption style={{ marginBottom: 16 }}>
              {tr('settingsStyle.dnaPreview.empty')}
            </Caption>
          ) : (
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              <Skeleton radius={14} height={28} style={{ width: 80 }} />
              <Skeleton radius={14} height={28} style={{ width: 80 }} />
              <Skeleton radius={14} height={28} style={{ width: 80 }} />
            </View>
          )}

          {dna && dna.signatureColors.length > 0 ? (
            <>
              <Eyebrow style={{ marginBottom: 8 }}>Favorite colors</Eyebrow>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {dna.signatureColors.map((colorName) => (
                  <View
                    key={colorName}
                    accessibilityLabel={colorName}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: styleColorToHex(colorName),
                      borderWidth: 1,
                      borderColor: t.border,
                    }}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Eyebrow style={{ marginBottom: 8 }}>Formality</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {FORMALITY_BUCKETS_DISPLAY.map((level) => (
              <Chip key={level} label={level} active={dna ? level === dna.formality : false} />
            ))}
          </View>
        </Card>

        {/* ============ ACTIONS ============ */}
        <Card padding={4}>
          <SettingsRow
            icon={<SparklesIcon size={16} color={t.accent} />}
            title="Retake style quiz"
            caption="Refresh your DNA from scratch"
            onPress={async () => {
              // Purge the persisted onboarding draft before navigating —
              // otherwise OnboardingScreen.loadDraft() would resume the user
              // on whatever step they were last on instead of starting at
              // step 0 with empty answers.
              await clearOnboardingDraft();
              nav.navigate('Onboarding');
            }}
          />
          <SettingsRow
            icon={<TshirtIcon size={18} color={t.accent} />}
            title="Edit style words"
            caption={dna && dna.vibes.length > 0 ? dna.vibes.join(' · ') : undefined}
            onPress={() =>
              Alert.alert(
                tr('settingsStyle.editStyleWords.title'),
                tr('settingsStyle.editStyleWords.body'),
              )
            }
          />
          <SettingsRow
            icon={<PaletteIcon size={18} color={t.accent} />}
            title="Edit color preferences"
            caption={
              dna && dna.signatureColors.length > 0
                ? tr('settingsStyle.favoritesCountTemplate', {
                    count: dna.signatureColors.length,
                  })
                : undefined
            }
            onPress={() =>
              Alert.alert(
                tr('settingsStyle.editColorPreferences.title'),
                tr('settingsStyle.editColorPreferences.body'),
              )
            }
          />
          <SettingsRow
            icon={<RotateIcon size={16} color={t.destructive} />}
            title="Reset style memory"
            caption="Forget what BURS has learned"
            destructive
            last
            onPress={() => setResetOpen(true)}
          />
        </Card>
      </ScrollView>

      <TypedConfirmModal
        open={resetOpen}
        title={tr('settings.reset_memory.title')}
        body={tr('settings.reset_memory.body')}
        requiredText={tr('settings.reset_memory.required')}
        confirmLabel={tr('settings.reset_memory.confirm')}
        destructive
        isPending={resetMemory.isPending}
        onConfirm={handleConfirmReset}
        onCancel={() => setResetOpen(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
});
