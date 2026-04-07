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

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    locale: 'en',
    t: (key: string) => ({
      'outfits.empty_ready_title': 'Empty ready title',
      'outfits.empty_locked_title': 'Empty locked title',
      'outfits.empty_ready_desc': 'Empty ready desc',
      'outfits.empty_locked_desc': 'Empty locked desc',
      'outfits.empty_cta_ready': 'Create a look',
      'outfits.empty_cta_locked': 'Add your first pieces',
      'outfits.progress_label': 'Progress',
      'plan.empty_title': 'Empty title',
      'plan.empty_desc': 'Empty desc',
      'plan.empty_step_add_title': 'Add garments',
      'plan.empty_step_add_desc': 'Empty step add desc',
      'plan.empty_step_generate_title': 'Generate an outfit',
      'plan.empty_step_generate_desc': 'Empty step generate desc',
      'plan.empty_step_plan_title': 'Plan your week',
      'plan.empty_step_plan_desc': 'Empty step plan desc',
      'insights.empty_title': 'Empty title',
      'insights.empty_desc_ready': 'Empty desc ready',
      'insights.empty_desc_locked': 'Empty desc locked',
      'insights.empty_meta': 'Empty meta',
      'insights.empty_cta_ready': 'Generate and wear an outfit',
      'insights.empty_cta_locked': 'Add your first pieces',
      'wardrobe.empty_title': 'Wardrobe empty title',
      'wardrobe.empty_desc': 'Wardrobe empty desc',
      'wardrobe.onboarding_progress': 'Progress',
      'wardrobe.onboarding_scan_title': 'Live scan',
      'wardrobe.onboarding_scan_desc': 'Wardrobe scan desc',
      'wardrobe.onboarding_upload_title': 'Upload a photo',
      'wardrobe.onboarding_upload_desc': 'Wardrobe upload desc',
    }[key] ?? key),
  }),
}));

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

    fireEvent.click(screen.getByRole('button', { name: /create a look/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/ai/generate');
  });

  it('routes the plan onboarding generate step to Style Me', () => {
    renderWithRouter(<PlanOnboardingEmpty />);

    fireEvent.click(screen.getByRole('button', { name: /generate an outfit/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/ai/generate');
  });

  it('routes the plan onboarding planning step to the planner', () => {
    mockUseOutfits.mockReturnValue({ data: [{ id: 'outfit-1' }] });

    renderWithRouter(<PlanOnboardingEmpty />);

    fireEvent.click(screen.getByRole('button', { name: /plan your week/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/plan');
  });

  it('routes insights empty-state CTA to Style Me', () => {
    renderWithRouter(<InsightsOnboardingEmpty />);

    fireEvent.click(screen.getByRole('button', { name: /generate and wear an outfit/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/ai/generate');
  });
});
