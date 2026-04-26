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

  it('restores Q1 answers from localStorage on remount', () => {
    const draft = {
      ...createEmptyStyleProfileV4(),
      gender: 'masculine' as const,
      height_cm: 182,
      build: 'athletic' as const,
      ageRange: '35-44' as const,
    };
    window.localStorage.setItem(
      `burs.quizV4.draft.user-1`,
      JSON.stringify(draft),
    );
    render(<StyleQuizV4 onComplete={vi.fn()} onSkip={vi.fn()} isSaving={false} userId="user-1" />);
    const heightInput = screen.getByPlaceholderText('175') as HTMLInputElement;
    expect(heightInput.value).toBe('182');
    // Persisted draft hydrates touched-state implicitly via the gate, so
    // Next should be enabled without further interaction.
    expect(getNext()).not.toBeDisabled();
  });

  it('persists answer changes to localStorage', () => {
    render(<StyleQuizV4 onComplete={vi.fn()} onSkip={vi.fn()} isSaving={false} userId="user-2" />);
    fireEvent.click(screen.getByText('styleQuizV4.gender.feminine'));
    const stored = window.localStorage.getItem('burs.quizV4.draft.user-2');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.gender).toBe('feminine');
    expect(parsed.version).toBe(STYLE_PROFILE_VERSION);
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
