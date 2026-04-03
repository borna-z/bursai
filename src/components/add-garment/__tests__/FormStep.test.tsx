import type React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FormStep } from '@/components/add-garment/FormStep';

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: () => <div>Page Header</div>,
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: () => <div>Slider</div>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: () => <button type="button">Switch</button>,
}));

describe('FormStep', () => {
  it('renders the add garment review form without crashing', () => {
    const noop = vi.fn();

    render(
      <FormStep
        t={(key) => key}
        imagePreview="https://example.com/garment.jpg"
        aiAnalysis={{}}
        storagePath="user-1/garment-1/original.jpg"
        isAnalyzing={false}
        isLoading={false}
        title="Navy blazer"
        category="top"
        subcategory="blazer"
        colorPrimary="navy"
        colorSecondary=""
        pattern="solid"
        material="wool"
        fit="regular"
        selectedSeasons={['autumn']}
        formality={[4]}
        inLaundry={false}
        onReset={noop}
        onReanalyze={noop}
        onSave={noop}
        onCancel={noop}
        setTitle={noop}
        setCategory={noop}
        setSubcategory={noop}
        setColorPrimary={noop}
        setColorSecondary={noop}
        setPattern={noop}
        setMaterial={noop}
        setFit={noop}
        toggleSeason={noop}
        setFormality={noop}
        setInLaundry={noop}
      />,
    );

    expect(screen.getByText('Navy blazer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'addgarment.save' })).toBeInTheDocument();
  });
});
