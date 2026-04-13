import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RefineChips } from '../RefineChips';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';

// Mock useLanguage
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

// Mock haptics
vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

function makeGarment(overrides: Partial<GarmentBasic> & { id: string }): GarmentBasic {
  return {
    title: 'Test',
    category: 'top',
    color_primary: 'black',
    image_path: null,
    original_image_path: null,
    processed_image_path: null,
    image_processing_status: null,
    rendered_image_path: null,
    render_status: null,
    ...overrides,
  } as GarmentBasic;
}

describe('RefineChips', () => {
  it('shows "Something fresh" and "Different vibe" always', () => {
    const onChip = vi.fn();
    render(<RefineChips garments={[makeGarment({ id: '1' })]} onChipTap={onChip} canUndo={false} onUndo={() => {}} />);
    expect(screen.getByText('chat.something_fresh')).toBeTruthy();
    expect(screen.getByText('chat.different_vibe')).toBeTruthy();
  });

  it('shows undo chip when canUndo is true', () => {
    const onUndo = vi.fn();
    render(<RefineChips garments={[]} onChipTap={() => {}} canUndo={true} onUndo={onUndo} />);
    const undoBtn = screen.getByText('chat.undo');
    fireEvent.click(undoBtn);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('fires onChipTap with message text when tapped', () => {
    const onChip = vi.fn();
    render(<RefineChips garments={[makeGarment({ id: '1' })]} onChipTap={onChip} canUndo={false} onUndo={() => {}} />);
    fireEvent.click(screen.getByText('chat.something_fresh'));
    expect(onChip).toHaveBeenCalledWith(expect.any(String));
  });
});
