import type { ChangeEvent, RefObject } from 'react';
import { Camera, Image as ImageIcon, ScanBarcode, Sparkles, Upload, Wand2, X, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';

interface UploadStepProps {
  isPremium: boolean;
  slotsLeft: number;
  slotsLeftLabel: string;
  onBack: () => void;
  onOpenLiveScan: () => void;
  title: string;
  prompt: string;
  helperText: string;
  photoLabel: string;
  linkLabel: string;
  cameraLabel: string;
  galleryLabel: string;
  batchLabel: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  batchInputRef: RefObject<HTMLInputElement | null>;
  onImageSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onBatchSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onTakePhoto: () => void;
  onPickFromGallery: () => void;
}

export function UploadStep({
  isPremium,
  slotsLeft,
  slotsLeftLabel,
  onBack,
  onOpenLiveScan,
  title,
  prompt,
  helperText,
  photoLabel,
  linkLabel: _linkLabel,
  cameraLabel,
  galleryLabel,
  batchLabel,
  fileInputRef,
  batchInputRef,
  onImageSelect,
  onBatchSelect,
  onTakePhoto,
  onPickFromGallery,
}: UploadStepProps) {
  const { t } = useLanguage();
  const trustPoints = [
    { icon: Sparkles, label: t('addgarment.trust_detect') },
    { icon: Wand2, label: t('addgarment.trust_cleanup') },
    { icon: ScanBarcode, label: t('addgarment.trust_review') },
  ] as const;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onImageSelect} className="hidden" />
      <input ref={batchInputRef} type="file" accept="image/*" multiple onChange={onBatchSelect} className="hidden" />

      <header className="flex items-center justify-between px-5 pb-2" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}>
        <button
          onClick={() => { hapticLight(); onBack(); }}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card/90 transition-colors active:bg-card cursor-pointer"
          aria-label={t('common.close')}
        >
          <X className="h-5 w-5" />
        </button>
        <h1 className="font-display italic text-[1.25rem] font-medium">{title || t('addgarment.title')}</h1>
        {!isPremium ? (
          <span className="rounded-full border border-border/70 bg-card/90 px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground">
            {slotsLeft} {slotsLeftLabel}
          </span>
        ) : (
          <div className="w-10" />
        )}
      </header>

      <AnimatedPage className="page-shell !max-w-xl flex flex-1 flex-col gap-5 !pt-4">
        <section className="surface-editorial rounded-[1.5rem] p-5">
          <div className="space-y-3">
            <p className="label-editorial text-muted-foreground/60">
              {prompt}
            </p>
            <h2 className="text-[1.6rem] font-semibold tracking-[-0.05em] text-foreground">
              {t('addgarment.hero_title')}
            </h2>
            <p className="max-w-[34ch] text-[0.95rem] leading-7 text-muted-foreground">
              {helperText}
            </p>
          </div>
        </section>

        <section className="grid gap-3">
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            type="button"
            onClick={() => { hapticLight(); onOpenLiveScan(); }}
            className="surface-hero premium-highlight flex w-full items-center justify-between gap-4 rounded-[1.45rem] p-5 text-left cursor-pointer"
          >
            <div className="space-y-2">
              <p className="label-editorial text-muted-foreground/60">
                {t('addgarment.live_scan_label')}
              </p>
              <h3 className="text-[1.15rem] font-semibold tracking-[-0.04em] text-foreground">
                {t('addgarment.live_scan_title')}
              </h3>
              <p className="max-w-[28ch] text-[0.9rem] leading-6 text-muted-foreground">
                {t('addgarment.live_scan_desc')}
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.1rem] bg-accent/18 text-accent">
              <Camera className="h-6 w-6" />
            </div>
          </motion.button>

          <div className="grid gap-3 sm:grid-cols-2">
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              type="button"
              onClick={() => { hapticLight(); onPickFromGallery(); }}
              className="surface-secondary flex items-start gap-4 rounded-[1.35rem] p-4 text-left cursor-pointer"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-secondary text-foreground">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-[0.98rem] font-medium tracking-[-0.02em] text-foreground">
                  {photoLabel}
                </p>
                <p className="text-[0.84rem] leading-6 text-muted-foreground">
                  {t('addgarment.upload_desc')}
                </p>
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              type="button"
              onClick={() => { hapticLight(); batchInputRef.current?.click(); }}
              className="surface-secondary flex items-start gap-4 rounded-[1.35rem] p-4 text-left cursor-pointer"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-secondary text-foreground">
                <Upload className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-[0.98rem] font-medium tracking-[-0.02em] text-foreground">
                  {batchLabel}
                </p>
                <p className="text-[0.84rem] leading-6 text-muted-foreground">
                  {t('addgarment.batch_desc')}
                </p>
              </div>
            </motion.button>
          </div>
        </section>

        <section className="surface-secondary rounded-[1.35rem] p-4">
          <div className="space-y-3">
            <p className="label-editorial text-muted-foreground/60">
              {t('addgarment.trusted_workflow')}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {trustPoints.map((item) => (
                <div key={item.label} className="premium-inline-stat flex items-start gap-3">
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <p className="text-[0.84rem] leading-6 text-foreground/82">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="premium-action-row mt-auto pt-2">
          <Button
            onClick={() => { hapticLight(); onTakePhoto(); }}
            className="h-12 flex-1 rounded-full"
          >
            <Camera className="mr-2 h-4 w-4" />
            {cameraLabel}
          </Button>
          <Button
            onClick={() => { hapticLight(); onPickFromGallery(); }}
            variant="outline"
            className="h-12 rounded-full px-5"
          >
            <Zap className="mr-2 h-4 w-4" />
            {galleryLabel}
          </Button>
        </div>
      </AnimatedPage>
    </div>
  );
}
