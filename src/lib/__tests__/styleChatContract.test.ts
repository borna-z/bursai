import { describe, expect, it } from 'vitest';

import {
  detectStylistChatModeFromSignals,
  resolveStyleChatIntentFromSignals,
  resolveActiveLookStatus,
  resolveStyleCardPolicy,
  resolveStyleCardState,
  resolveStyleResponseKind,
  shouldRenderStyleCard,
  shouldRenderStyleCardFromPolicy,
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

  it('routes make it more formal into active-look refinement when a look is already live', () => {
    expect(detectStylistChatModeFromSignals({
      latestUser: 'make it more formal',
      hasActiveLook: true,
      hasAnchor: false,
      refinementMode: 'more_formal',
    })).toBe('ACTIVE_LOOK_REFINEMENT');
  });

  it('keeps sharper, polished, and premium prompts in refinement mode when a live look exists', () => {
    for (const latestUser of ['make it sharper', 'make it more polished', 'make it more premium']) {
      expect(detectStylistChatModeFromSignals({
        latestUser,
        hasActiveLook: true,
        hasAnchor: true,
        refinementMode: 'targeted_refinement',
      })).toBe('ACTIVE_LOOK_REFINEMENT');
    }
  });

  it('keeps explanation turns in look-explanation mode when a live look exists', () => {
    expect(detectStylistChatModeFromSignals({
      latestUser: 'why does this work?',
      hasActiveLook: true,
      hasAnchor: false,
      refinementMode: 'explain_why',
    })).toBe('LOOK_EXPLANATION');
  });

  it('routes what should i change into refinement when a live look exists', () => {
    expect(detectStylistChatModeFromSignals({
      latestUser: 'what should i change',
      hasActiveLook: true,
      hasAnchor: false,
      refinementMode: 'targeted_refinement',
    })).toBe('ACTIVE_LOOK_REFINEMENT');
  });

  it('prefers garment-first styling for anchor-led requests without an active look', () => {
    expect(detectStylistChatModeFromSignals({
      latestUser: 'style this blazer for dinner',
      hasActiveLook: false,
      hasAnchor: true,
      refinementMode: 'new_look',
    })).toBe('GARMENT_FIRST_STYLING');
  });

  it('treats style this garment as a create action when an anchor is present', () => {
    expect(resolveStyleChatIntentFromSignals({
      latestUser: 'style this garment for dinner',
      hasActiveLook: false,
      hasAnchor: true,
      refinementMode: 'targeted_refinement',
    })).toBe('create');
  });

  it('asks for a short clarifier when the prompt depends on missing context', () => {
    expect(resolveStyleChatIntentFromSignals({
      latestUser: 'style this garment',
      hasActiveLook: false,
      hasAnchor: false,
      refinementMode: 'targeted_refinement',
    })).toBe('clarify');

    expect(resolveStyleChatIntentFromSignals({
      latestUser: 'explain why this works',
      hasActiveLook: false,
      hasAnchor: false,
      refinementMode: 'explain_why',
    })).toBe('clarify');
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

  it('makes card policy required for styling turns and preserve-if-exists for analysis in a live thread', () => {
    expect(resolveStyleCardPolicy({
      mode: 'GARMENT_FIRST_STYLING',
      hasActiveLook: false,
      hasAnchor: true,
    })).toBe('required');

    expect(resolveStyleCardPolicy({
      mode: 'STYLE_IDENTITY_ANALYSIS',
      hasActiveLook: true,
      hasAnchor: false,
    })).toBe('preserve_if_exists');
  });

  it('distinguishes updated cards from replaced active looks', () => {
    expect(resolveStyleCardState(['a', 'b', 'c'], ['a', 'b', 'd'])).toBe('updated');
    expect(resolveActiveLookStatus(['a', 'b', 'c'], ['d', 'e', 'f'])).toBe('replaced');
    expect(resolveActiveLookStatus(['a', 'b', 'c'], [])).toBe('unavailable');
  });

  it('makes card policy required for outfit generation and active-look refinement', () => {
    expect(resolveStyleCardPolicy({
      mode: 'OUTFIT_GENERATION',
      hasActiveLook: false,
      hasAnchor: false,
    })).toBe('required');

    expect(resolveStyleCardPolicy({
      mode: 'ACTIVE_LOOK_REFINEMENT',
      hasActiveLook: true,
      hasAnchor: true,
    })).toBe('required');
  });

  it('makes card policy optional for conversational mode', () => {
    expect(resolveStyleCardPolicy({
      mode: 'CONVERSATIONAL',
      hasActiveLook: false,
      hasAnchor: false,
    })).toBe('optional');
  });

  it('renders card from policy when card state is valid and outfit ids present', () => {
    expect(shouldRenderStyleCardFromPolicy({
      cardPolicy: 'required',
      cardState: 'new',
      outfitIds: ['a', 'b', 'c'],
    })).toBe(true);
  });

  it('blocks card rendering when no outfit ids are present', () => {
    expect(shouldRenderStyleCardFromPolicy({
      cardPolicy: 'required',
      cardState: 'new',
      outfitIds: [],
    })).toBe(false);
  });

  it('blocks card rendering when card state is unavailable', () => {
    expect(shouldRenderStyleCardFromPolicy({
      cardPolicy: 'required',
      cardState: 'unavailable',
      outfitIds: ['a', 'b', 'c'],
    })).toBe(false);
  });

  it('marks styling failures without a card as style repair rather than analysis', () => {
    expect(resolveStyleResponseKind({
      mode: 'ACTIVE_LOOK_REFINEMENT',
      cardState: 'unavailable',
      fallbackUsed: false,
      degradedReason: 'request_timeout',
    })).toBe('style_repair');

    expect(resolveStyleResponseKind({
      mode: 'STYLE_IDENTITY_ANALYSIS',
      cardState: 'unavailable',
      fallbackUsed: false,
      degradedReason: null,
    })).toBe('analysis');
  });
});
