import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  InsightsOnboardingEmpty,
  OutfitsOnboardingEmpty,
  PlanOnboardingEmpty,
} from '../OnboardingEmptyState';

const mockNavigate = vi.fn();
const mockUseGarmentCount = vi.fn();
const mockUseOutfits = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useGarments', () => ({
  useGarmentCount: () => mockUseGarmentCount(),
}));

vi.mock('@/hooks/useOutfits', () => ({
  useOutfits: (...args: unknown[]) => mockUseOutfits(...args),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, locale: 'en' }),
}));

function renderWithRouter(element: React.ReactElement) {
  return render(
    <MemoryRouter>
      {element}
    </MemoryRouter>,
  );
}

describe('OnboardingEmptyState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGarmentCount.mockReturnValue({ data: 3 });
    mockUseOutfits.mockReturnValue({ data: [] });
  });

  it('routes outfits empty-state CTA to the canonical Style Me screen', () => {
    renderWithRouter(<OutfitsOnboardingEmpty />);

    fireEvent.click(screen.getByRole('button', { name: /outfits\.empty_cta_ready/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/ai/generate');
  });

  it('routes the plan onboarding generate step to Style Me', () => {
    renderWithRouter(<PlanOnboardingEmpty />);

    fireEvent.click(screen.getByRole('button', { name: /plan\.empty_step_generate_title/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/ai/generate');
  });

  it('routes the plan onboarding planning step to the planner', () => {
    mockUseOutfits.mockReturnValue({ data: [{ id: 'outfit-1' }] });

    renderWithRouter(<PlanOnboardingEmpty />);

    fireEvent.click(screen.getByRole('button', { name: /plan\.empty_step_plan_title/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/plan');
  });

  it('routes insights empty-state CTA to Style Me', () => {
    renderWithRouter(<InsightsOnboardingEmpty />);

    fireEvent.click(screen.getByRole('button', { name: /insights\.empty_cta_ready/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/ai/generate');
  });
});
