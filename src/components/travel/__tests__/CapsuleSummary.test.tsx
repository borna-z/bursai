import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CapsuleSummary } from '@/components/travel/CapsuleSummary';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, any>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt }: { alt: string }) => <div>{alt}</div>,
}));

describe('CapsuleSummary', () => {
  it('renders the lighter packing summary without changing packing content', () => {
    render(
      <CapsuleSummary
        result={{
          outfits: [{}, {}],
          coverage_gaps: [{ code: 'tops', message: 'Bring one more top.' }],
          packing_tips: ['Roll knitwear to save room.'],
        } as any}
        groupedItems={{
          Tops: [
            { id: 'garment-1', title: 'White tee', image_path: 'tee.jpg', category: 'tops' },
          ],
        }}
        checkedItems={new Set()}
        toggleChecked={vi.fn()}
        itemOutfitCount={new Map([['garment-1', 2]])}
        capsuleItemIds={['garment-1']}
        garmentMap={new Map([['garment-1', { id: 'garment-1', title: 'White tee', image_path: 'tee.jpg', category: 'tops' }]])}
        allGarmentsMap={new Map()}
        totalItems={4}
        packedCount={1}
      />,
    );

    expect(screen.getByText('Packing Progress')).toBeInTheDocument();
    expect(screen.getByText('Coverage Gaps')).toBeInTheDocument();
    expect(screen.getByText('Roll knitwear to save room.')).toBeInTheDocument();
  });
});
