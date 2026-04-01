import { describe, expect, it } from 'vitest';
import { findLatestActiveLookMessageIndex } from '../chatActiveLook';

describe('chatActiveLook', () => {
  it('keeps searching past later assistant prose to find the latest outfit card', () => {
    const messages = [
      { role: 'assistant' as const, content: 'Welcome' },
      {
        role: 'assistant' as const,
        content: '[[outfit:11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222,33333333-3333-3333-3333-333333333333|Current look]]',
      },
      { role: 'user' as const, content: 'Make it sharper' },
      { role: 'assistant' as const, content: 'I would swap the shoes.' },
    ];

    expect(findLatestActiveLookMessageIndex(messages)).toBe(1);
  });

  it('returns -1 when no assistant outfit tag exists', () => {
    expect(findLatestActiveLookMessageIndex([
      { role: 'assistant' as const, content: 'Hello there' },
      { role: 'user' as const, content: 'Need help' },
    ])).toBe(-1);
  });

  it('ignores malformed or truncated outfit fragments', () => {
    expect(findLatestActiveLookMessageIndex([
      { role: 'assistant' as const, content: '[[outfit:11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222|Almost there' },
      { role: 'assistant' as const, content: 'Still thinking through it.' },
    ])).toBe(-1);
  });

  it('uses structured stylist metadata as the primary active-look source', () => {
    expect(findLatestActiveLookMessageIndex([
      {
        role: 'assistant' as const,
        content: 'Explaining the look.',
        stylistMeta: {
          kind: 'stylist_response' as const,
          mode: 'LOOK_EXPLANATION' as const,
          response_kind: 'style_explanation' as const,
          card_policy: 'preserve_if_exists' as const,
          card_state: 'preserved' as const,
          assistant_text: 'Explaining the look.',
          outfit_ids: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'],
          outfit_explanation: 'Current active look',
          garment_mentions: [],
          suggestion_chips: [],
          truncated: false,
          active_look_status: 'preserved' as const,
          active_look: {
            garment_ids: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'],
            explanation: 'Current active look',
            source: 'unified_stylist_engine',
            status: 'preserved' as const,
            card_state: 'preserved' as const,
            anchor_garment_id: null,
            anchor_locked: false,
          },
          fallback_used: false,
          degraded_reason: null,
          render_outfit_card: true,
        },
      },
    ])).toBe(0);
  });
});
