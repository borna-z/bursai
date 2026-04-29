// Mood Outfit — emotional starting point for an outfit.
// Pixel-faithful port of design_handoff_burs_rn/source/extra-screens.jsx MoodOutfitScreen.
//
// Layout: top header (back · "How do you feel?" + "Mood Outfit") → 3-col MoodCard grid (8
// moods per task spec, drawn from the prototype's 12-mood vocabulary) → "Time of day"
// context chip row (Morning · Day · Evening · Night) → "Find my outfit" CTA which routes
// to the standalone MoodFlow screen.
//
// `MoodCard` lives in /components/ — shared with MoodFlow.

import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { MoodCard, type MoodId } from '../components/MoodCard';
import { BackIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Mood = { id: MoodId; sub: string };

const MOODS: Mood[] = [
  { id: 'Confident',    sub: 'Sturdy, decisive' },
  { id: 'Relaxed',      sub: 'Easy, off-duty' },
  { id: 'Creative',     sub: 'Refined, playful' },
  { id: 'Professional', sub: 'Sharp, clean' },
  { id: 'Romantic',     sub: 'Soft, light' },
  { id: 'Energetic',    sub: 'Open, daylit' },
  { id: 'Cosy',         sub: 'Warm, lived-in' },
  { id: 'Bold',         sub: 'Statement, color' },
];

const TIMES = ['Morning', 'Day', 'Evening', 'Night'];

export function MoodOutfitScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [moodId, setMoodId] = useState<MoodId | null>(null);
  const [time, setTime] = useState<string>('Day');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={() => nav.goBack()} ariaLabel="Back">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>How do you feel?</Eyebrow>
          <PageTitle size={26}>Mood Outfit</PageTitle>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 18 }}
        showsVerticalScrollIndicator={false}>

        {/* ============ MOOD GRID 3-col ============ */}
        <View>
          <Eyebrow style={{ marginBottom: 10 }}>Pick a feeling</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MOODS.map((m) => (
              <View key={m.id} style={{ width: '31.5%', flexGrow: 1, flexBasis: '31.5%' }}>
                <MoodCard
                  name={m.id}
                  sub={m.sub}
                  active={moodId === m.id}
                  onPress={() => setMoodId(m.id)}
                />
              </View>
            ))}
          </View>
        </View>

        {/* ============ TIME OF DAY CONTEXT ============ */}
        <View>
          <Eyebrow style={{ marginBottom: 8 }}>Time of day</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {TIMES.map((name) => (
              <Chip
                key={name}
                label={name}
                active={name === time}
                onPress={() => setTime(name)}
              />
            ))}
          </View>
        </View>

        {/* ============ FIND MY OUTFIT ============ */}
        {/* Thread mood + time selections into MoodFlow so the loading copy + result chips
            match what the user picked here. Codex P2 on PR #706 — earlier impl dropped
            both selections so MoodFlow always rendered the hardcoded "Confident · Day". */}
        <Button
          label="Find my outfit"
          disabled={!moodId}
          onPress={() => moodId && nav.navigate('MoodFlow', { moodId, time })}
          block
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
});
