import type { ChangeEvent, RefObject } from 'react';
import { Camera, Image as ImageIcon, Upload, X } from 'lucide-react';

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

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onImageSelect} className="hidden" />
      <input ref={batchInputRef} type="file" accept="image/*" multiple onChange={onBatchSelect} className="hidden" />

      <header className="flex items-center justify-between px-4 pb-1.5 sm:px-5" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 14px)' }}>
        <button
          onClick={() => { hapticLight(); onBack(); }}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card/90 transition-colors active:bg-card cursor-pointer"
          aria-label={t('common.close')}
        >
          <X className="h-5 w-5" />
        </button>
        <h1 className="font-display italic text-[1.18rem] font-medium sm:text-[1.25rem]">{title || t('addgarment.title')}</h1>
        {!isPremium ? (
          <span className="rounded-full border border-border/70 bg-card/90 px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground">
            {slotsLeft} {slotsLeftLabel}
          </span>
        ) : (
          <div className="w-10" />
        )}
      </header>

      <AnimatedPage className="page-shell !max-w-xl flex flex-1 flex-col gap-3.5 !pt-3">
        <section className="grid gap-3">
          <button
            type="button"
            onClick={() => { hapticLight(); onOpenLiveScan(); }}
            className="surface-hero premium-highlight flex w-full items-center justify-between gap-3.5 rounded-[1.25rem] p-3.5 text-left cursor-pointer"
          >
            <h3 className="text-[1rem] font-semibold tracking-[-0.04em] text-foreground">
              {t('addgarment.live_scan_title')}
            </h3>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.95rem] bg-accent/18 text-accent">
              <Camera className="h-5 w-5" />
            </div>
          </button>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-border/40 rounded-[1.15rem] p-3.5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-[0.9rem] bg-secondary text-foreground">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-2.5">
                  <p className="text-[0.98rem] font-medium tracking-[-0.02em] text-foreground">
                    {photoLabel}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8.5 rounded-full px-3.5"
                      onClick={() => { hapticLight(); onTakePhoto(); }}
                    >
                      <Camera className="mr-1.5 h-3.5 w-3.5" />
                      {cameraLabel}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8.5 rounded-full px-3.5"
                      onClick={() => { hapticLight(); onPickFromGallery(); }}
                    >
                      <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                      {galleryLabel}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { hapticLight(); batchInputRef.current?.click(); }}
              className="border border-border/40 flex items-start gap-3.5 rounded-[1.15rem] p-3.5 text-left cursor-pointer"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.95rem] bg-secondary text-foreground">
                <Upload className="h-5 w-5" />
              </div>
              <p className="text-[0.98rem] font-medium tracking-[-0.02em] text-foreground">
                {batchLabel}
              </p>
            </button>
          </div>
        </section>
      </AnimatedPage>
    </div>
  );
}
