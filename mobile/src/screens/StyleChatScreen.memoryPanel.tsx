// StyleChatScreen — collapsible style-memory panel + chip rail (N13 split).
//
// Renders the user's persisted style memory facts as a chip strip. Each
// chip surfaces a single fact (e.g. "never suggest the burgundy hoodie")
// and offers an inline "Forget" affordance for `never_suggest_garment`
// signals. Other signal kinds render with a disabled action and an
// explanatory alert.

import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Caption } from '../components/Caption';
import { t as tr } from '../lib/i18n';
import type { StyleMemoryFact } from '../hooks/useStyleMemoryFacts';

export type MemoryPanelProps = {
  open: boolean;
  facts: readonly StyleMemoryFact[];
  onToggleOpen: () => void;
  onForget: (fact: StyleMemoryFact) => void;
};

export function MemoryPanel({ open, facts, onToggleOpen, onForget }: MemoryPanelProps) {
  const t = useTokens();
  if (!open) {
    return (
      <Pressable
        onPress={onToggleOpen}
        accessibilityRole="button"
        accessibilityLabel="Show style memory"
        style={({ pressed }) => [
          s.memoryRailRow,
          { borderBottomColor: t.border, backgroundColor: t.bg, opacity: pressed ? 0.7 : 1 },
        ]}>
        <Eyebrow>{tr('chat.memory.section_title')}</Eyebrow>
        <Text style={{ fontFamily: fonts.uiMed, fontSize: 11.5, color: t.accent }}>
          {tr('chat.memory.toggle.show')}
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={[s.memoryPanel, { borderBottomColor: t.border, backgroundColor: t.card }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Eyebrow>{tr('chat.memory.section_title')}</Eyebrow>
        <Pressable
          onPress={onToggleOpen}
          style={{ paddingHorizontal: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Hide style memory">
          <Text style={{ fontFamily: fonts.uiMed, fontSize: 11.5, color: t.accent }}>
            {tr('chat.memory.toggle.hide')}
          </Text>
        </Pressable>
      </View>
      {facts.length === 0 ? (
        <Caption style={{ color: t.fg3 }}>{tr('chat.memory.empty')}</Caption>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {facts.map((fact) => (
            <MemoryChipRow
              key={fact.id}
              fact={fact}
              onForget={() => onForget(fact)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// Memory chip — single fact in the style-memory panel. Only
// `never_suggest_garment` chips can be forgotten today; other signal
// kinds render as read-only with an explanatory alert if the user taps
// the disabled action so they understand why.
function MemoryChipRow({
  fact,
  onForget,
}: {
  fact: StyleMemoryFact;
  onForget: () => void;
}) {
  const t = useTokens();
  const canForget = fact.signalKind === 'never_suggest_garment' && !!fact.garmentId;
  const handlePress = () => {
    if (!canForget) {
      Alert.alert(
        tr('chat.memory.disabled.title'),
        tr('chat.memory.disabled.body'),
        [{ text: 'OK', style: 'default' }],
      );
      return;
    }
    Alert.alert(
      tr('chat.memory.confirm.title'),
      tr('chat.memory.confirm.body.template', { label: fact.label }),
      [
        { text: tr('chat.anchor.set.cancel'), style: 'cancel' },
        { text: tr('chat.memory.forget_action'), onPress: onForget, style: 'destructive' },
      ],
    );
  };
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Style memory chip: ${fact.label}`}
      style={({ pressed }) => ({
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
        backgroundColor: t.accentSoft,
        opacity: pressed ? 0.78 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      })}>
      <Text
        style={{
          fontFamily: fonts.uiMed,
          fontSize: 11,
          color: t.accent,
          letterSpacing: -0.1,
        }}>
        {fact.label}
      </Text>
      {canForget ? (
        <Text style={{ fontFamily: fonts.uiMed, fontSize: 11, color: t.accent, opacity: 0.55 }}>
          ×
        </Text>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  memoryPanel: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  memoryRailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
});
