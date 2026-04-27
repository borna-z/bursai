import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { StyleQuizV4 } from '@/components/onboarding/StyleQuizV4';
import {
  STYLE_PROFILE_VERSION,
  createEmptyStyleProfileV4,
} from '@/types/styleProfile';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, locale: 'en' }),
}));

/** Drive Q1 to a fully-touched valid state so the canAdvance gate opens. */
function fillQ1() {
  fireEvent.click(screen.getByText('styleQuizV4.gender.feminine'));
  const heightInput = screen.getByPlaceholderText('175') as HTMLInputElement;
  fireEvent.change(heightInput, { target: { value: '170' } });
  fireEvent.click(screen.getByText('styleQuizV4.build.athletic'));
  fireEvent.click(screen.getByText('25-34'));
}

const getNext = () => screen.getByRole('button', { name: /next/i });
const getSkip = () => screen.getByRole('button', { name: /skip/i });

describe('StyleQuizV4', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders Q1 (identity) on mount', () => {
    render(<StyleQuizV4 onComplete={vi.fn()} onSkip={vi.fn()} isSaving={false} />);
    expect(screen.getByText('styleQuizV4.q1.title')).toBeTruthy();
    expect(screen.getByText('styleQuizV4.gender.feminine')).toBeTruthy();
  });

  it('disables Next on Q1 until all four identity fields are filled', () => {
    render(<StyleQuizV4 onComplete={vi.fn()} onSkip={vi.fn()} isSaving={false} />);
    expect(getNext()).toBeDisabled();
    fireEvent.click(screen.getByText('styleQuizV4.gender.feminine'));
    expect(getNext()).toBeDisabled();
    const heightInput = screen.getByPlaceholderText('175') as HTMLInputElement;
    fireEvent.change(heightInput, { target: { value: '170' } });
    expect(getNext()).toBeDisabled();
    fireEvent.click(screen.getByText('styleQuizV4.build.athletic'));
    expect(getNext()).toBeDisabled();
    fireEvent.click(screen.getByText('25-34'));
    expect(getNext()).not.toBeDisabled();
  });

  it('advances from Q1 to Q2 when all fields are filled and Next is pressed', async () => {
    render(<StyleQuizV4 onComplete={vi.fn()} onSkip={vi.fn()} isSaving={false} />);
    fillQ1();
    fireEvent.click(getNext());
    expect(await screen.findByText('styleQuizV4.q2.title')).toBeTruthy();
    expect(screen.getByText('styleQuizV4.q2.work')).toBeTruthy();
  });

  it('invokes onSkip when the Skip button is pressed on Q1', () => {
    const onSkip = vi.fn();
    render(<StyleQuizV4 onComplete={vi.fn()} onSkip={onSkip} isSaving={false} />);
    fireEvent.click(getSkip());
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('restores Q1 answers + touched flags from localStorage on remount', () => {
    const draft = {
      answers: {
        ...createEmptyStyleProfileV4(),
        gender: 'masculine' as const,
        height_cm: 182,
        build: 'athletic' as const,
        ageRange: '35-44' as const,
      },
      q1Touched: { gender: true, build: true, ageRange: true },
    };
    window.localStorage.setItem(
      `burs.quizV4.draft.user-1`,
      JSON.stringify(draft),
    );
    render(<StyleQuizV4 onComplete={vi.fn()} onSkip={vi.fn()} isSaving={false} userId="user-1" />);
    const heightInput = screen.getByPlaceholderText('175') as HTMLInputElement;
    expect(heightInput.value).toBe('182');
    // Touched flags persisted as all-true → gate opens.
    expect(getNext()).not.toBeDisabled();
  });

  it('keeps Next disabled when height is outside the realistic 100-220cm range (Codex round 10 P2)', () => {
    render(<StyleQuizV4 onComplete={vi.fn()} onSkip={vi.fn()} isSaving={false} />);
    fireEvent.click(screen.getByText('styleQuizV4.gender.feminine'));
    fireEvent.click(screen.getByText('styleQuizV4.build.athletic'));
    fireEvent.click(screen.getByText('25-34'));
    const heightInput = screen.getByPlaceholderText('175') as HTMLInputElement;
    // Below floor → still disabled
    fireEvent.change(heightInput, { target: { value: '50' } });
    expect(getNext()).toBeDisabled();
    // Above ceiling → still disabled
    fireEvent.change(heightInput, { target: { value: '999' } });
    expect(getNext()).toBeDisabled();
    // In range → enabled
    fireEvent.change(heightInput, { target: { value: '170' } });
    expect(getNext()).not.toBeDisabled();
  });

  it('does NOT enable Next when partial draft has untouched enum fields (Codex round 2 P2)', () => {
    // User typed only height before reload. q1Touched persisted as all-false
    // for the enum fields. Even though enum DEFAULTS are valid choices, the
    // gate must keep Next disabled until the user explicitly confirms them.
    const draft = {
      answers: { ...createEmptyStyleProfileV4(), height_cm: 170 },
      q1Touched: { gender: false, build: false, ageRange: false },
    };
    window.localStorage.setItem(
      'burs.quizV4.draft.user-partial',
      JSON.stringify(draft),
    );
    render(<StyleQuizV4 onComplete={vi.fn()} onSkip={vi.fn()} isSaving={false} userId="user-partial" />);
    const heightInput = screen.getByPlaceholderText('175') as HTMLInputElement;
    expect(heightInput.value).toBe('170');
    expect(getNext()).toBeDisabled();
  });

  it('persists answer changes + touched flags to localStorage', () => {
    render(<StyleQuizV4 onComplete={vi.fn()} onSkip={vi.fn()} isSaving={false} userId="user-2" />);
    fireEvent.click(screen.getByText('styleQuizV4.gender.feminine'));
    const stored = window.localStorage.getItem('burs.quizV4.draft.user-2');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.answers.gender).toBe('feminine');
    expect(parsed.answers.version).toBe(STYLE_PROFILE_VERSION);
    expect(parsed.q1Touched.gender).toBe(true);
    expect(parsed.q1Touched.build).toBe(false);
  });

  it('clears the draft on skip', () => {
    window.localStorage.setItem(
      'burs.quizV4.draft.user-3',
      JSON.stringify(createEmptyStyleProfileV4()),
    );
    render(<StyleQuizV4 onComplete={vi.fn()} onSkip={vi.fn()} isSaving={false} userId="user-3" />);
    fireEvent.click(getSkip());
    expect(window.localStorage.getItem('burs.quizV4.draft.user-3')).toBeNull();
  });
});
