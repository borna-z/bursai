import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { hapticLight } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useAddGarment } from '@/hooks/useAddGarment';
import { getGarmentProcessingMessage } from '@/lib/garmentImage';
import { BatchUploadProgress } from '@/components/wardrobe/BatchUploadProgress';
import { DuplicateWarningSheet } from '@/components/wardrobe/DuplicateWarningSheet';
import { PaywallModal } from '@/components/PaywallModal';
import { UploadStep } from '@/components/add-garment/UploadStep';
import { AnalyzingStep } from '@/components/add-garment/AnalyzingStep';
import { FormStep } from '@/components/add-garment/FormStep';

export default function AddGarmentPage() {
  const { t } = useLanguage();
  const { isPremium } = useSubscription();
  const processingMessage = getGarmentProcessingMessage('processing');

  const garment = useAddGarment({ t });

  if (garment.step === 'batch') {
    return (
      <BatchUploadProgress
        files={garment.batchFiles}
        onComplete={() => {
          garment.refreshSubscription();
          garment.navigate('/wardrobe');
        }}
        onCancel={() => {
          hapticLight();
          garment.setBatchFiles([]);
          garment.setStep('upload');
        }}
      />
    );
  }

  if (garment.step === 'upload') {
    return (
      <UploadStep
        isPremium={isPremium}
        slotsLeft={garment.remainingGarments()}
        slotsLeftLabel={t('scan.slots_left')}
        onBack={() => garment.navigate(-1)}
        title={t('addgarment.title')}
        prompt={t('addgarment.photo_prompt')}
        helperText={t('addgarment.helper_text')}
        photoLabel={t('addgarment.photo')}
        linkLabel={t('addgarment.link')}
        cameraLabel={t('addgarment.camera')}
        galleryLabel={t('addgarment.gallery')}
        batchLabel={t('batch.upload_multiple')}
        onOpenLiveScan={() => garment.navigate('/wardrobe/scan')}
        fileInputRef={garment.fileInputRef}
        batchInputRef={garment.batchInputRef}
        onImageSelect={garment.handleImageSelect}
        onBatchSelect={garment.handleBatchSelect}
        onTakePhoto={garment.takePhoto}
        onPickFromGallery={garment.pickFromGallery}
      />
    );
  }

  if (garment.step === 'analyzing') {
    return (
      <AnalyzingStep
        analysisError={garment.analysisError}
        analysisSummary={garment.analysisSummary}
        imagePreview={garment.imagePreview}
        reviewText={t('addgarment.ai_review')}
        processingLabel={processingMessage?.label ?? 'Creating clean wardrobe image'}
        retryLabel={t('addgarment.retry')}
        cancelLabel={t('common.cancel')}
        onRetry={garment.handleRetryAnalysis}
        onCancel={garment.resetForm}
      />
    );
  }

  return (
    <>
      <FormStep
        t={t}
        imagePreview={garment.imagePreview}
        aiAnalysis={garment.aiAnalysis}
        storagePath={garment.storagePath}
        isAnalyzing={garment.isAnalyzing}
        isLoading={garment.isLoading}
        title={garment.title}
        category={garment.category}
        subcategory={garment.subcategory}
        colorPrimary={garment.colorPrimary}
        colorSecondary={garment.colorSecondary}
        pattern={garment.pattern}
        material={garment.material}
        fit={garment.fit}
        selectedSeasons={garment.selectedSeasons}
        formality={garment.formality}
        inLaundry={garment.inLaundry}
        studioQualityEnabled={garment.studioQualityEnabled}
        onReset={garment.resetForm}
        onReanalyze={garment.handleReanalyze}
        onSave={garment.handleSave}
        onCancel={() => garment.navigate('/wardrobe')}
        setTitle={garment.setTitle}
        setCategory={garment.setCategory}
        setSubcategory={garment.setSubcategory}
        setColorPrimary={garment.setColorPrimary}
        setColorSecondary={garment.setColorSecondary}
        setPattern={garment.setPattern}
        setMaterial={garment.setMaterial}
        setFit={garment.setFit}
        toggleSeason={garment.toggleSeason}
        setFormality={garment.setFormality}
        setInLaundry={garment.setInLaundry}
        setStudioQualityEnabled={garment.setStudioQualityEnabled}
      />

      <PaywallModal isOpen={garment.showPaywall} onClose={() => garment.setShowPaywall(false)} reason="garments" />

      <DuplicateWarningSheet
        open={garment.showDuplicateSheet}
        onOpenChange={garment.setShowDuplicateSheet}
        duplicates={garment.duplicates}
        onKeepBoth={() => {
          garment.setShowDuplicateSheet(false);
          garment.clearDuplicates();
        }}
        onReplace={async (existingGarmentId) => {
          garment.setShowDuplicateSheet(false);
          garment.clearDuplicates();
          try {
            await supabase.from('garments').delete().eq('id', existingGarmentId);
            toast.success(t('duplicate.replaced') || 'Old garment replaced');
          } catch {
            toast.error(t('common.something_wrong'));
          }
        }}
        onCancel={() => {
          garment.setShowDuplicateSheet(false);
          garment.clearDuplicates();
          garment.resetForm();
        }}
      />
    </>
  );
}
