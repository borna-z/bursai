import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { hapticLight } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useAddGarment } from '@/hooks/useAddGarment';
import { BatchUploadProgress } from '@/components/wardrobe/BatchUploadProgress';
import { DuplicateWarningSheet } from '@/components/wardrobe/DuplicateWarningSheet';
import { PaywallModal } from '@/components/PaywallModal';
import { UploadStep } from '@/components/add-garment/UploadStep';
import { AnalyzingStep } from '@/components/add-garment/AnalyzingStep';
import { FormStep } from '@/components/add-garment/FormStep';
import { GarmentSaveChoiceSheet } from '@/components/garment/GarmentSaveChoiceSheet';
import { GarmentSavedCard } from '@/components/garment/GarmentSavedCard';
import { categoryLabel, colorLabel } from '@/lib/humanize';

export default function AddGarmentPage() {
  const { t } = useLanguage();
  const { isPremium } = useSubscription();
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
        title={t('addgarment.title')}
        photoLabel={t('addgarment.photo')}
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
        processingLabel="Reviewing garment details"
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
        showCompact={Boolean(garment.aiAnalysis)}
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
        onReset={garment.resetForm}
        onReanalyze={garment.handleReanalyze}
        onSave={garment.openSaveChoice}
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
      />

      <GarmentSaveChoiceSheet
        open={garment.showConfirmSheet}
        isSaving={garment.isLoading}
        onOpenChange={garment.setShowConfirmSheet}
        onSelectStudio={() => { void garment.handleSave(true); }}
        onSelectOriginal={() => { void garment.handleSave(false); }}
      />

      {garment.savedCard && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-sm">
            <GarmentSavedCard
              garmentId={garment.savedCard.garmentId}
              imagePath={garment.savedCard.imagePath}
              title={garment.savedCard.title}
              category={categoryLabel(t, garment.savedCard.category)}
              colorPrimary={colorLabel(t, garment.savedCard.colorPrimary)}
              studioQualityEnabled={garment.savedCard.studioQualityEnabled}
              onDismiss={garment.dismissSavedCard}
              autoDismissMs={2800}
            />
          </div>
        </div>
      )}

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
