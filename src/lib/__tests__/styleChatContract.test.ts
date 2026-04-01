import { describe, expect, it } from 'vitest';

import {
  detectStylistChatModeFromSignals,
  resolveActiveLookStatus,
  shouldRenderStyleCard,
} from '../../../supabase/functions/_shared/style-chat-contract';

describe('styleChatContract', () => {
  it('routes more elevated to active-look refinement when a look is already live', () => {
    expect(detectStylistChatModeFromSignals({
      latestUser: 'make it more elevated',
      hasActiveLook: true,
      hasAnchor: false,
      refinementMode: 'more_elevated',
    })).toBe('ACTIVE_LOOK_REFINEMENT');
  });

  it('keeps explanation turns in look-explanation mode when a live look exists', () => {
    expect(detectStylistChatModeFromSignals({
      latestUser: 'why does this work?',
      hasActiveLook: true,
      hasAnchor: false,
      refinementMode: 'explain_why',
    })).toBe('LOOK_EXPLANATION');
  });

  it('prefers garment-first styling for anchor-led requests without an active look', () => {
    expect(detectStylistChatModeFromSignals({
      latestUser: 'style this blazer for dinner',
      hasActiveLook: false,
      hasAnchor: true,
      refinementMode: 'new_look',
    })).toBe('GARMENT_FIRST_STYLING');
  });

  it('marks unchanged looks as preserved and changed looks as updated', () => {
    expect(resolveActiveLookStatus(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe('preserved');
    expect(resolveActiveLookStatus(['a', 'b', 'c'], ['a', 'b', 'd'])).toBe('updated');
    expect(resolveActiveLookStatus([], ['a', 'b', 'c'])).toBe('new');
  });

  it('preserves outfit-card rendering for explanation turns with an active look', () => {
    expect(shouldRenderStyleCard('LOOK_EXPLANATION', ['a', 'b', 'c'], true)).toBe(true);
    expect(shouldRenderStyleCard('LOOK_EXPLANATION', ['a', 'b', 'c'], false)).toBe(false);
  });
});
