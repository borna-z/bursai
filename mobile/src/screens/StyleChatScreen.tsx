// Style Chat — AI stylist conversation surface.
// Pixel-faithful port of design_handoff_burs_rn/source/extra-screens.jsx StyleChatScreen
// + audit-screens.jsx StyleChatV2Screen (memory panel + history affordance).
//
// Layout: top header (back · "AI" + "Style Chat" · history button) → memory panel
// (collapsible chip row showing remembered facts + Edit) → message list (FlatList,
// inverted, keeps newest at the bottom and scrolls correctly with the keyboard) →
// suggestion chip row → composer (pill input + accent send button).
//
// Why inverted FlatList:
//   - RN's keyboard handling is much smoother when the list grows from the bottom up.
//     Inverting flips the data order so item 0 is the newest message at the bottom.
//   - We render the data array in reverse-chronological order so the newest sits at
//     index 0 of the inverted list.
// KeyboardAvoidingView wraps the screen so the composer + last messages stay visible
// when the keyboard rises. iOS uses `padding`, Android uses `height` per the standard
// RN guidance — Android's `padding` mode tends to cut off content above the keyboard.

import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { OutfitCard } from '../components/OutfitCard';
import { BackIcon, ChevronIcon, CloseIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Message =
  | { id: string; role: 'user' | 'ai'; kind: 'text';   text: string;  time?: string }
  | { id: string; role: 'ai';          kind: 'outfit'; name: string;  sub: string;   hues: number[] };

// Mock conversation — newest first because the FlatList is inverted. Real impl will hydrate
// from a Supabase chat-messages query and prepend new turns as they stream in.
const MESSAGES: Message[] = [
  { id: 'm6', role: 'ai',   kind: 'outfit', name: 'Coffee · with chore', sub: '5 PIECES · LAYERED', hues: [45, 32, 38, 28] },
  { id: 'm5', role: 'ai',   kind: 'text',   text: 'Sand canvas chore over the cardigan. Keeps you sharp without overheating.' },
  { id: 'm4', role: 'user', kind: 'text',   text: 'Add a jacket?' },
  { id: 'm3', role: 'ai',   kind: 'outfit', name: 'Coffee · soft tailored', sub: '4 PIECES · 14° CLOUDY', hues: [32, 38, 200, 28] },
  { id: 'm2', role: 'ai',   kind: 'text',   text: 'Cream wool tee, navy cardigan if it stays under 16°. Lean to your bone sneakers — bone tones the linen up.' },
  { id: 'm1', role: 'user', kind: 'text',   text: 'What goes with my linen trousers for a coffee meeting?', time: 'Today, 09:14' },
];

const SUGGESTIONS = [
  'What to wear today?',
  'Style me for dinner',
  'Too formal',
  'More casual',
];

const MEMORY_FACTS = [
  'Editorial · earth tones',
  'Top M · Bottom 32',
  'Avoids loud prints',
];

// Mock past chat sessions surfaced when the History button is tapped. Real impl will
// hydrate from the chat_messages table, grouped by session.
type ChatSession = { id: string; date: string; firstMessage: string };

const PAST_SESSIONS: ChatSession[] = [
  { id: 's1', date: 'Yesterday',     firstMessage: 'What goes with my linen trousers for a coffee meeting?' },
  { id: 's2', date: 'Wed · Apr 24',  firstMessage: 'Help me pick a blazer for the dinner on Friday' },
  { id: 's3', date: 'Mon · Apr 22',  firstMessage: 'Too warm for the wool overshirt — alternatives?' },
  { id: 's4', date: 'Sat · Apr 20',  firstMessage: 'Outfit for a creative-studio meeting' },
];

export function StyleChatScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [draft, setDraft] = useState('');
  const [memoryOpen, setMemoryOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const data = useMemo(() => MESSAGES, []);

  const send = () => {
    if (!draft.trim()) return;
    // Real impl: append a user message + kick off AI request. For the design pass we just
    // clear the input — the static MESSAGES list represents the visual end-state.
    setDraft('');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}>

        {/* ============ HEADER ============ */}
        <View style={[s.header, { borderBottomColor: t.border }]}>
          <IconBtn variant="ghost" onPress={() => nav.goBack()} ariaLabel="Back">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow style={{ marginBottom: 1 }}>AI</Eyebrow>
            <Text style={{ fontFamily: fonts.displayMedium, fontStyle: 'italic', fontWeight: '500', fontSize: 18, color: t.fg, letterSpacing: -0.18 }}>
              Style Chat
            </Text>
          </View>
          <IconBtn variant="ghost" onPress={() => setShowHistory((v) => !v)} ariaLabel="History">
            {/* Hamburger glyph mirrors styleChatV2 history button */}
            <View style={{ width: 18, height: 12, justifyContent: 'space-between' }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ height: 1.6, backgroundColor: t.fg, borderRadius: 1 }} />
              ))}
            </View>
          </IconBtn>
        </View>

        {/* ============ MEMORY PANEL ============ */}
        {/* Collapsible — when expanded, shows fact chips + Edit + Hide. When collapsed,
            renders a thin "Show" pill row so the user can reopen without leaving the screen.
            Codex P3 on PR #706 — earlier impl had no path back from collapsed. */}
        {memoryOpen ? (
          <View style={[s.memoryPanel, { borderBottomColor: t.border, backgroundColor: t.card }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Eyebrow>Style memory</Eyebrow>
              <Pressable onPress={() => setMemoryOpen(false)} style={{ paddingHorizontal: 4 }} accessibilityLabel="Hide style memory">
                <Text style={{ fontFamily: fonts.uiMed, fontSize: 11.5, color: t.accent }}>Hide</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {MEMORY_FACTS.map((fact) => (
                <View
                  key={fact}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radii.pill,
                    backgroundColor: t.accentSoft,
                  }}>
                  <Text style={{ fontFamily: fonts.uiMed, fontSize: 11, color: t.accent, letterSpacing: -0.1 }}>
                    {fact}
                  </Text>
                </View>
              ))}
              <Pressable
                onPress={() =>
                  Alert.alert('Coming soon', 'Style memory editing coming soon.')
                }
                accessibilityRole="button"
                accessibilityLabel="Edit style memory"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: t.border,
                }}>
                <Text style={{ fontFamily: fonts.uiMed, fontSize: 11, color: t.fg2, letterSpacing: -0.1 }}>
                  Edit
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setMemoryOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Show style memory"
            style={({ pressed }) => [
              s.memoryRailRow,
              { borderBottomColor: t.border, backgroundColor: t.bg, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Eyebrow>Style memory</Eyebrow>
            <Text style={{ fontFamily: fonts.uiMed, fontSize: 11.5, color: t.accent }}>Show</Text>
          </Pressable>
        )}

        {/* ============ MESSAGE LIST (FlatList inverted) ============ */}
        <FlatList
          data={data}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 }}
          renderItem={({ item }) => <MessageItem msg={item} />}
          ListFooterComponent={
            <Caption style={{ textAlign: 'center', paddingVertical: 6 }}>
              {/* Footer in inverted list = top of the screen — i.e. start-of-conversation timestamp.
                  Extract to a local const so TS can narrow the kind === 'text' branch and expose .time. */}
              {(() => {
                const first = data[data.length - 1];
                return first && first.kind === 'text' ? first.time : null;
              })()}
            </Caption>
          }
        />

        {/* ============ SUGGESTION CHIPS ============ */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
            {SUGGESTIONS.map((sug) => (
              <Chip key={sug} label={sug} onPress={() => setDraft(sug)} />
            ))}
          </ScrollView>
        </View>

        {/* ============ COMPOSER ============ */}
        <View style={[s.composer, { borderTopColor: t.border, backgroundColor: t.bg }]}>
          <View
            style={[
              s.inputPill,
              { backgroundColor: t.card, borderColor: t.border },
            ]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask your stylist…"
              placeholderTextColor={t.fg3}
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
            onPress={send}
            disabled={!draft.trim()}
            accessibilityLabel="Send"
            style={({ pressed }) => [
              s.sendBtn,
              {
                backgroundColor: draft.trim() ? t.accent : t.bg2,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <ChevronIcon color={draft.trim() ? t.accentFg : t.fg3} />
          </Pressable>
        </View>

        {/* ============ HISTORY OVERLAY (toggled by header History button) ============ */}
        {showHistory ? (
          <Pressable
            onPress={() => setShowHistory(false)}
            accessibilityLabel="Close history"
            style={[s.historyBackdrop, { backgroundColor: t.scrimBg }]}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              accessible={false}
              style={[
                s.historySheet,
                { backgroundColor: t.bg, borderColor: t.border, shadowColor: t.shadow.color },
              ]}>
              <View style={s.historyHeader}>
                <View style={{ flex: 1 }}>
                  <Eyebrow>Past chats</Eyebrow>
                  <Text
                    style={{
                      fontFamily: fonts.displayMedium,
                      fontStyle: 'italic',
                      fontSize: 20,
                      color: t.fg,
                      marginTop: 2,
                    }}>
                    History
                  </Text>
                </View>
                <IconBtn ariaLabel="Close" onPress={() => setShowHistory(false)}>
                  <CloseIcon color={t.fg} />
                </IconBtn>
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
                {PAST_SESSIONS.map((sess) => (
                  <Pressable
                    key={sess.id}
                    onPress={() => setShowHistory(false)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open chat from ${sess.date}`}
                    style={({ pressed }) => [
                      s.historyRow,
                      { borderBottomColor: t.border, opacity: pressed ? 0.7 : 1 },
                    ]}>
                    <Eyebrow>{sess.date}</Eyebrow>
                    <Text
                      numberOfLines={2}
                      style={{
                        marginTop: 4,
                        fontFamily: fonts.uiSemi,
                        fontSize: 13.5,
                        color: t.fg,
                        letterSpacing: -0.13,
                      }}>
                      {sess.firstMessage}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Message bubble — inline so styling stays close to the parent context. Bubble has 18px
// radius with one corner squared to point toward the speaker (4px radius on speaker-side).
function MessageItem({ msg }: { msg: Message }) {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  if (msg.kind === 'outfit') {
    // AI outfit attachment — left-aligned, ~78% width like the prototype. Wear/Save row
    // sits under the card so the user can act on the suggestion without leaving chat.
    return (
      <View style={{ alignSelf: 'flex-start', width: '78%', marginVertical: 4, gap: 6 }}>
        <OutfitCard name={msg.name} sub={msg.sub} hues={msg.hues} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Button
            label="Wear this"
            size="sm"
            onPress={() => nav.navigate('OutfitDetail')}
            style={{ flex: 1 }}
            block
          />
          <Button
            label="Save"
            size="sm"
            variant="outline"
            onPress={() => Alert.alert('Saved', 'Outfit saved to your collection.')}
            style={{ flex: 1 }}
            block
          />
        </View>
      </View>
    );
  }

  const isUser = msg.role === 'user';
  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '82%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: isUser ? t.fg : t.card,
        borderRadius: 18,
        borderBottomRightRadius: isUser ? 4 : 18,
        borderBottomLeftRadius: isUser ? 18 : 4,
        borderWidth: isUser ? 0 : 1,
        borderColor: t.border,
      }}>
      <Text
        style={{
          fontFamily: fonts.ui,
          fontSize: 13.5,
          lineHeight: 19,
          color: isUser ? t.bg : t.fg,
          letterSpacing: -0.13,
        }}>
        {msg.text}
      </Text>
    </View>
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
  historyBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  historySheet: {
    maxHeight: '70%',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
  },
  historyRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
});
