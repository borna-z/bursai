// StyleChatScreen — composer + suggestion chip strip (N13 split).
//
// Text input pill with send button (chevron / spinner while streaming),
// fronted by a horizontal scroll strip of suggestion chips. Static
// fallback chips come from STATIC_SUGGESTIONS; the server can override
// per-mode via the SSE envelope.

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Chip } from '../components/Chip';
import { ChevronIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';

export function SuggestionChipRow({
  suggestions,
  onPress,
}: {
  suggestions: readonly string[];
  onPress: (text: string) => void;
}) {
  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
        {suggestions.map((sug) => (
          <Chip
            key={sug}
            label={sug}
            onPress={() => onPress(sug)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function ChatComposer({
  draft,
  isStreaming,
  onDraftChange,
  onSend,
}: {
  draft: string;
  isStreaming: boolean;
  onDraftChange: (v: string) => void;
  onSend: () => void;
}) {
  const t = useTokens();
  const canSend = !!draft.trim() && !isStreaming;
  return (
    <View style={[s.composer, { borderTopColor: t.border, backgroundColor: t.bg }]}>
      <View
        style={[
          s.inputPill,
          { backgroundColor: t.card, borderColor: t.border },
        ]}>
        <TextInput
          value={draft}
          onChangeText={onDraftChange}
          placeholder={tr('chat.composer.placeholder')}
          placeholderTextColor={t.fg3}
          editable={!isStreaming}
          multiline
          style={{
            flex: 1,
            fontFamily: fonts.ui,
            fontSize: 14,
            color: t.fg,
            paddingVertical: 8,
            paddingHorizontal: 4,
            maxHeight: 100,
          }}
        />
      </View>
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel={isStreaming ? 'Sending' : 'Send'}
        accessibilityState={{ disabled: !canSend, busy: isStreaming }}
        style={({ pressed }) => [
          s.sendBtn,
          {
            backgroundColor: canSend ? t.accent : t.bg2,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        {isStreaming ? (
          <ActivityIndicator size="small" color={t.accentFg} />
        ) : (
          <ChevronIcon color={draft.trim() ? t.accentFg : t.fg3} />
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  inputPill: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
