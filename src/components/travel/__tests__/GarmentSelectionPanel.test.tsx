import type { PropsWithChildren } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GarmentSelectionPanel } from '../GarmentSelectionPanel';

vi.mock('framer-motion', () => {
  const motionElement = ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  );
  return {
    AnimatePresence: ({ children }: PropsWithChildren) => <>{children}</>,
    motion: new Proxy({}, { get: () => motionElement }),
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k }),
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));

const garments = [
  { id: 't1', title: 'Tee', category: 'top', image_path: '' },
  { id: 't2', title: 'Tee 2', category: 'top', image_path: '' },
  { id: 't3', title: 'Tee 3', category: 'top', image_path: '' },
  { id: 'b1', title: 'Jeans', category: 'bottom', image_path: '' },
  { id: 'b2', title: 'Jeans 2', category: 'bottom', image_path: '' },
  { id: 's1', title: 'Sneakers', category: 'shoes', image_path: '' },
];

describe('GarmentSelectionPanel', () => {
  it('starts collapsed and shows the summary', () => {
    render(
      <GarmentSelectionPanel
        allGarments={garments}
        value={null}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/using 6 of 6 garments/i)).toBeInTheDocument();
    // The sliders should NOT be visible before expanding.
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('expands when the header is clicked and shows one slider per non-empty category', () => {
    render(
      <GarmentSelectionPanel
        allGarments={garments}
        value={null}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /customize selection/i }));
    const sliders = screen.getAllByRole('slider');
    // top, bottom, shoes → 3 sliders
    expect(sliders).toHaveLength(3);
  });

  it('omits categories with zero items', () => {
    const small = [{ id: 't1', title: 'Tee', category: 'top', image_path: '' }];
    render(
      <GarmentSelectionPanel
        allGarments={small}
        value={null}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /customize selection/i }));
    expect(screen.getAllByRole('slider')).toHaveLength(1);
  });

  it('uses the travel capsule slot classifier for category + subcategory mapping', () => {
    const unusual = [
      { id: 'u1', title: 'Mystery', category: 'unknown-token', subcategory: null, image_path: '' },
      { id: 'u2', title: 'Running shoe', category: 'misc', subcategory: 'sneakers', image_path: '' },
    ];
    const onChange = vi.fn();
    render(
      <GarmentSelectionPanel
        allGarments={unusual}
        value={null}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /customize selection/i }));
    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(2);

    fireEvent.change(sliders[0], { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith({ top: 0, shoes: 1 });
  });

  it('calls onChange with the full distribution when a slider is moved', () => {
    const onChange = vi.fn();
    render(
      <GarmentSelectionPanel
        allGarments={garments}
        value={null}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /customize selection/i }));
    const [topSlider] = screen.getAllByRole('slider');
    fireEvent.change(topSlider, { target: { value: '1' } });
    expect(onChange).toHaveBeenLastCalledWith({ top: 1, bottom: 2, shoes: 1 });
  });

  it('shows the clamped warning when the running total exceeds 150', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      id: `t${i}`,
      title: `Tee ${i}`,
      category: 'top',
      image_path: '',
    }));
    render(
      <GarmentSelectionPanel
        allGarments={many}
        value={null}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/using 150 of 200 garments/i)).toBeInTheDocument();
  });

  it('resets to defaults when Reset is clicked', () => {
    const onChange = vi.fn();
    render(
      <GarmentSelectionPanel
        allGarments={garments}
        value={{ top: 1, bottom: 1, shoes: 1 }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /customize selection/i }));
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
