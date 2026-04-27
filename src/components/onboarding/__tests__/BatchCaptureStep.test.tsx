import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { BatchCaptureStep } from '@/components/onboarding/BatchCaptureStep';

// Mirror LanguageContext's no-provider safety net (humanized last segment of
// the key) so safeT() falls back to the component's explicit English strings.
function humanizedLastSegment(key: string): string {
  const segment = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  const humanized = segment.replace(/[_-]/g, ' ');
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => humanizedLastSegment(key),
    locale: 'en',
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));

vi.mock('@/hooks/useStorage', () => ({
  useStorage: () => ({
    uploadGarmentImage: vi.fn(),
    getGarmentSignedUrl: vi.fn(),
    deleteGarmentImage: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAnalyzeGarment', () => ({
  useAnalyzeGarment: () => ({
    analyzeGarment: vi.fn(),
    isAnalyzing: false,
    analysisProgress: 0,
  }),
}));

// useProfile is the persisted-count source of truth — drive the test entirely
// through its mocked return value so the component reflects the count we set
// without needing a full Supabase fake.
const profileMock = vi.hoisted(() => ({ data: { onboarding_garment_count: 0 } as { onboarding_garment_count: number } | null }));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => profileMock,
}));

describe('BatchCaptureStep', () => {
  beforeEach(() => {
    profileMock.data = { onboarding_garment_count: 0 };
  });

  it('renders progress with Continue disabled at 0 captures', () => {
    profileMock.data = { onboarding_garment_count: 0 };
    render(<BatchCaptureStep onComplete={vi.fn()} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    expect(continueBtn).toBeDisabled();
    // "Done" button only appears once the recommended threshold is reached.
    expect(screen.queryByRole('button', { name: /done/i })).not.toBeInTheDocument();
  });

  it('enables Continue once the persisted count reaches 20', () => {
    profileMock.data = { onboarding_garment_count: 20 };
    const onComplete = vi.fn();
    render(<BatchCaptureStep onComplete={onComplete} />);

    expect(screen.getByText('20')).toBeInTheDocument();
    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    expect(continueBtn).not.toBeDisabled();

    fireEvent.click(continueBtn);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows the Done button at recommended threshold (30)', () => {
    profileMock.data = { onboarding_garment_count: 30 };
    const onComplete = vi.fn();
    render(<BatchCaptureStep onComplete={onComplete} />);

    expect(screen.getByText('30')).toBeInTheDocument();
    const doneBtn = screen.getByRole('button', { name: /done/i });
    expect(doneBtn).not.toBeDisabled();

    fireEvent.click(doneBtn);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
