// Pure helpers extracted from StyleChatScreen.tsx (N13).
// No React hooks; safe to unit-test directly.

import { t as tr } from '../lib/i18n';
import type { ChatMessage } from '../hooks/useStyleChat';
import type { StylistChatMode } from '../lib/styleChatContract';

export const STATIC_SUGGESTIONS = [
  'What to wear today?',
  'Style me for dinner',
  'Too formal',
  'More casual',
];

// Hoisted for stable identity across renders — used by the message FlatList.
export const messageKey = (m: ChatMessage) => m.id;

// Friendly labels for the 9 stylist modes. Keys mirror the
// `chat.mode.<MODE>` namespace appended to en.ts so a future translator
// pass can swap them without touching this file.
export function modeLabel(mode: StylistChatMode | undefined | null): string | null {
  if (!mode) return null;
  return tr(`chat.mode.${mode}`);
}
