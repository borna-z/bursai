import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { FormStep } from '../FormStep';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@/components/ui/page-intro', () => ({
  PageIntro: ({ title, description }: { title: string; description: string }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

const baseProps = {
  t: (key: string) => key,
  imagePreview: 'https://example.com/image.jpg',
  aiAnalysis: {},
  storagePath: 'user/garment/original.jpg',
  isAnalyzing: false,
  isLoading: false,
  title: 'White tee',
  category: 'top',
  subcategory: 't-shirt',
  colorPrimary: 'white',
  colorSecondary: '',
  pattern: '',
  material: '',
  fit: '',
  selectedSeasons: ['summer'],
  formality: [3],
  inLaundry: false,
  onReset: vi.fn(),
  onReanalyze: vi.fn(),
  onSave: vi.fn(),
  onCancel: vi.fn(),
  setTitle: vi.fn(),
  setCategory: vi.fn(),
  setSubcategory: vi.fn(),
  setColorPrimary: vi.fn(),
  setColorSecondary: vi.fn(),
  setPattern: vi.fn(),
  setMaterial: vi.fn(),
  setFit: vi.fn(),
  toggleSeason: vi.fn(),
  setFormality: vi.fn(),
  setInLaundry: vi.fn(),
};

describe('FormStep', () => {
  it('renders the review form after analysis completes', () => {
    render(<FormStep {...baseProps} />);

    expect(screen.getByText('addgarment.review')).toBeInTheDocument();
    expect(screen.getByText('addgarment.form.in_laundry')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'addgarment.save' })).toBeInTheDocument();
  });
});
