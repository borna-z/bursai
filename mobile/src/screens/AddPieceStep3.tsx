// Add piece — Step 3 of 3 (confirm batch).
// Pixel-faithful port of design_handoff_burs_rn/source/screens.jsx AddGarmentStep3.
//
// Layout: top header (back · "Step 3 of 3" + "Confirm batch" · Re-scan) → horizontal
// piece-selector strip (2px gold border on active) → hero block (100×130 thumb + detected
// chips + italic title) → 5 form-field rows (label/value) → 4 season chips → sticky save.
//
// State: `active` is the index of the currently-selected piece. The piece array carries
// hue + title + category + color + material + fit + seasons. Real edit handlers wire up
// in a later PR — this PR shows the shell + visual fidelity.

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { BackIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Piece = {
  hue: number;
  title: string;
  cat: string;
  color: string;
  material: string;
  fit: string;
  seasons: string[];
};

const PIECES: Piece[] = [
  { hue: 32,  title: 'Cream wool overshirt', cat: 'Outerwear · Overshirt', color: 'Cream',    material: 'Wool blend',     fit: 'Regular',  seasons: ['Spring', 'Autumn'] },
  { hue: 28,  title: 'Charcoal trouser',     cat: 'Bottoms · Trouser',     color: 'Charcoal', material: 'Wool',           fit: 'Tailored', seasons: ['Autumn', 'Winter'] },
  { hue: 200, title: 'White oxford shirt',   cat: 'Tops · Shirt',          color: 'White',    material: 'Cotton poplin',  fit: 'Regular',  seasons: ['Spring', 'Summer', 'Autumn'] },
  { hue: 18,  title: 'Rust crewneck',        cat: 'Tops · Knit',           color: 'Rust',     material: 'Merino wool',    fit: 'Relaxed',  seasons: ['Autumn', 'Winter'] },
  { hue: 45,  title: 'Camel loafers',        cat: 'Shoes · Loafer',        color: 'Camel',    material: 'Suede',          fit: '—',        seasons: ['Spring', 'Autumn'] },
];

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

function hueGrad(h: number): [string, string] {
  return [`hsl(${h}, 38%, 78%)`, `hsl(${(h + 30) % 360}, 30%, 62%)`];
}

export function AddPieceStep3() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [active, setActive] = useState(0);
  const p = PIECES[active];

  // Save → reset to MainTabs (Today). The flow is "you opened the FAB, finished adding pieces,
  // now you're back at the home tab" — match the prototype's `nav.replace('home')`.
  const onSaveAll = () => {
    nav.reset({ index: 0, routes: [{ name: 'MainTabs', params: { initialTab: 'today' } }] });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={() => nav.goBack()} ariaLabel="Back">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>Step 3 of 3</Eyebrow>
          <PageTitle size={26}>Confirm batch</PageTitle>
        </View>
        <Pressable
          onPress={() => nav.goBack()}
          style={{ paddingHorizontal: 6, paddingVertical: 8 }}>
          <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.accent, fontWeight: '500' }}>Re-scan</Text>
        </Pressable>
      </View>

      {/* ============ PIECE SELECTOR STRIP ============ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}
        style={{ borderBottomWidth: 1, borderBottomColor: t.border, flexGrow: 0 }}>
        {PIECES.map((pp, i) => {
          const isActive = i === active;
          return (
            <Pressable
              key={i}
              onPress={() => setActive(i)}
              accessibilityLabel={`Piece ${i + 1}`}
              style={{
                width: 44,
                height: 56,
                borderRadius: radii.md,
                borderWidth: isActive ? 2 : 1,
                borderColor: isActive ? t.accent : t.border,
                overflow: 'hidden',
                position: 'relative',
              }}>
              <LinearGradient
                colors={hueGrad(pp.hue)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View
                style={{
                  position: 'absolute',
                  top: 3,
                  left: 4,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: radii.pill,
                  backgroundColor: t.scrimBg,
                }}>
                <Text style={{ fontFamily: fonts.uiBold, fontSize: 9, color: t.scrimFg, letterSpacing: 0.2 }}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 14 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ HERO ============ */}
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View
            style={{
              width: 100,
              height: 130,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: t.border,
              overflow: 'hidden',
            }}>
            <LinearGradient
              colors={hueGrad(p.hue)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
          <View style={{ flex: 1, paddingTop: 4 }}>
            <Eyebrow style={{ marginBottom: 4 }}>Detected</Eyebrow>
            <Text style={{ fontFamily: fonts.displayMedium, fontStyle: 'italic', fontWeight: '500', fontSize: 22, lineHeight: 26, letterSpacing: -0.22, color: t.fg }}>
              {p.title}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
              <Chip label={p.cat.split(' · ')[0]} />
              <Chip label={p.color} />
              <Chip label={p.material.split(' ')[0]} />
            </View>
          </View>
        </View>

        {/* ============ FORM FIELDS ============ */}
        <View style={{ gap: 8 }}>
          {[
            ['Title', p.title],
            ['Category', p.cat],
            ['Primary color', p.color],
            ['Material', p.material],
            ['Fit', p.fit],
          ].map(([label, value]) => (
            <View
              key={label}
              style={[
                s.fieldRow,
                { borderColor: t.border, backgroundColor: t.card },
              ]}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 10,
                  letterSpacing: 1.4,
                  color: t.fg2,
                  textTransform: 'uppercase',
                }}>
                {label}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.uiMed,
                  fontSize: 13,
                  color: t.fg,
                  fontWeight: '500',
                  flexShrink: 1,
                  textAlign: 'right',
                }}
                numberOfLines={1}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        {/* ============ SEASONS ============ */}
        <View>
          <Eyebrow style={{ marginBottom: 8 }}>Seasons</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SEASONS.map((season) => (
              <Chip key={season} label={season} active={p.seasons.includes(season)} />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ============ STICKY SAVE BAR ============ */}
      <View style={[s.stickyBar, { borderTopColor: t.border, backgroundColor: t.bg }]}>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{PIECES.length} pieces</Eyebrow>
          <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: t.fg2, letterSpacing: -0.11 }}>
            Edit any before saving
          </Text>
        </View>
        <Button label="Save all" onPress={onSaveAll} />
      </View>
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
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 12,
  },
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
});
