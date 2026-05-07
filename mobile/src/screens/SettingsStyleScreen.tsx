// Settings · Style profile — summary of current Style DNA + edit/reset actions.
// Mirrors design_handoff_burs_rn/source/audit-screens.jsx SettingsStyleScreen.

import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { FAVORITE_COLOR_SAMPLES } from '../theme/styleColors';
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
import { useStyleDNA } from '../hooks/useStyleDNA';
import { t as tr } from '../lib/i18n';
import { clearOnboardingDraft } from './OnboardingScreen';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// FORMALITY_LEVELS still drives the static chip strip below — the active
// chip is now matched against `dna.formality` rather than a hardcoded
// string so the strip reflects the real Style DNA bucket.
const FORMALITY_LEVELS = ['Loungewear', 'Casual', 'Smart casual', 'Business', 'Formal'] as const;

// Sourced from `theme/styleColors.ts` (single source of truth shared with ProfileScreen).
const FAVORITE_COLORS = FAVORITE_COLOR_SAMPLES;

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
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 22,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.22,
                marginBottom: 14,
              }}>
              {dna.archetype}
            </Text>
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

          <Eyebrow style={{ marginBottom: 8 }}>Favorite colors</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {FAVORITE_COLORS.map((color) => (
              <View
                key={color}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: color,
                  borderWidth: 1,
                  borderColor: t.border,
                }}
              />
            ))}
          </View>

          <Eyebrow style={{ marginBottom: 8 }}>Formality</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {FORMALITY_LEVELS.map((level) => (
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
              Alert.alert('Coming soon', 'Style word editing coming soon.')
            }
          />
          <SettingsRow
            icon={<PaletteIcon size={18} color={t.accent} />}
            title="Edit color preferences"
            caption="6 favorites"
            onPress={() =>
              Alert.alert('Coming soon', 'Color preference editing coming soon.')
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
