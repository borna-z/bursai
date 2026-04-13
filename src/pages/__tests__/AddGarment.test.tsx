import type { PropsWithChildren } from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const useSubscriptionMock = vi.fn();
const useAddGarmentMock = vi.fn();

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      'addgarment.title': 'Add garment',
      'addgarment.photo_prompt': 'Fast add flow',
      'addgarment.helper_text': 'Your piece appears as soon as you save it. Cleanup finishes quietly in the background.',
      'addgarment.hero_title': 'Add pieces without slowing down.',
      'addgarment.live_scan_label': 'Live scan',
      'addgarment.live_scan_title': 'Open the fastest capture flow',
      'addgarment.live_scan_desc': 'Use the dedicated scanner when you want speed, progress feedback, and instant confidence.',
      'addgarment.upload_desc': 'Choose one garment photo and review the detected details before saving.',
      'addgarment.batch_desc': 'Bring in several pieces at once and let the queue handle the processing safely.',
      'addgarment.trusted_workflow': 'Trusted workflow',
      'addgarment.trust_detect': 'AI detects category, color, and material',
      'addgarment.trust_cleanup': 'Cleanup and enhancement continue in the background',
      'addgarment.trust_review': 'You review before anything is saved',
      'scan.slots_left': 'left',
      'addgarment.photo': 'Upload photo',
      'addgarment.link': 'Import link',
      'addgarment.camera': 'Take photo',
      'addgarment.gallery': 'Photo library',
      'batch.upload_multiple': 'Add multiple',
      'common.close': 'Close',
    }[key] ?? key),
  }),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => useSubscriptionMock(),
}));

vi.mock('@/hooks/useAddGarment', () => ({
  useAddGarment: () => useAddGarmentMock(),
}));

vi.mock('@/components/wardrobe/BatchUploadProgress', () => ({
  BatchUploadProgress: () => <div>batch progress</div>,
}));

vi.mock('@/components/add-garment/AnalyzingStep', () => ({
  AnalyzingStep: () => <div>analyzing</div>,
}));

vi.mock('@/components/add-garment/FormStep', () => ({
  FormStep: () => <div>form step</div>,
}));

vi.mock('@/components/PaywallModal', () => ({
  PaywallModal: () => null,
}));

vi.mock('@/components/wardrobe/DuplicateWarningSheet', () => ({
  DuplicateWarningSheet: () => null,
}));

vi.mock('@/components/garment/GarmentSaveChoiceSheet', () => ({
  GarmentSaveChoiceSheet: () => null,
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, className }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));

import AddGarmentPage from '../AddGarment';

describe('Add garment page', () => {
  beforeEach(() => {
    useSubscriptionMock.mockReturnValue({ isPremium: false });
    useAddGarmentMock.mockReturnValue({
      step: 'upload',
      remainingGarments: () => 4,
      fileInputRef: { current: null },
      batchInputRef: { current: null },
      handleImageSelect: vi.fn(),
      handleBatchSelect: vi.fn(),
      takePhoto: vi.fn(),
      pickFromGallery: vi.fn(),
      navigate: vi.fn(),
      refreshSubscription: vi.fn(),
      setBatchFiles: vi.fn(),
      setStep: vi.fn(),
      batchFiles: [],
      showPaywall: false,
      setShowPaywall: vi.fn(),
      showDuplicateSheet: false,
      setShowDuplicateSheet: vi.fn(),
      duplicates: [],
      clearDuplicates: vi.fn(),
      showConfirmSheet: false,
      setShowConfirmSheet: vi.fn(),
      openSaveChoice: vi.fn(),
      garmentId: null,
      storagePath: null,
      imagePreview: null,
      analysisError: null,
      analysisSummary: null,
      aiAnalysis: null,
      isAnalyzing: false,
      isLoading: false,
      title: '',
      category: '',
      subcategory: '',
      colorPrimary: '',
      colorSecondary: '',
      pattern: '',
      material: '',
      fit: '',
      selectedSeasons: [],
      formality: [3],
      inLaundry: false,
      resetForm: vi.fn(),
      handleRetryAnalysis: vi.fn(),
      handleReanalyze: vi.fn(),
      handleSave: vi.fn(),
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
    });
  });

  it('surfaces the three primary add entry points', () => {
    render(
      <MemoryRouter>
        <AddGarmentPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /open the fastest capture flow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /take photo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /photo library/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add multiple/i })).toBeInTheDocument();
  });
});
