import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const invokeEdgeFunctionMock = vi.fn();

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      'insights.style_report': 'Style report',
      'insights.generate_report': 'Generate report',
      'insights.your_archetype': 'Your archetype',
      'insights.color_confidence': 'Color confidence',
      'insights.adventurousness': 'Adventurousness',
      'insights.formality_range': 'Formality range',
      'insights.report_error': 'Report error',
      'insights.analyzing_wardrobe': 'Analyzing wardrobe...',
      'insights.computing_scores': 'Computing scores...',
      'insights.writing_report': 'Writing report...',
    }[key] ?? key),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: (...args: unknown[]) => invokeEdgeFunctionMock(...args),
}));

vi.mock('@/components/ui/AILoadingCard', () => ({
  AILoadingCard: () => <div>Loading report</div>,
}));

vi.mock('@/components/ui/StaleIndicator', () => ({
  StaleIndicator: () => <div>Fresh</div>,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { StyleReportCard } from '../StyleReportCard';

describe('StyleReportCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the compact locked state when premium is unavailable', () => {
    render(<StyleReportCard isPremium={false} />);

    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate report' })).not.toBeInTheDocument();
  });

  it('sanitizes non-finite scores so NaN never renders', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({
      data: {
        archetype: 'Minimalist',
        colorConfidence: Number.NaN,
        adventurousness: Number.NaN,
        formalityRange: 'Balanced',
        summary: 'A calm report.',
      },
      error: null,
    });

    render(<StyleReportCard isPremium />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));

    await waitFor(() => {
      expect(screen.getByText('Minimalist')).toBeInTheDocument();
    });

    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(2);
    expect(screen.getByText('Balanced')).toBeInTheDocument();
  });
});
