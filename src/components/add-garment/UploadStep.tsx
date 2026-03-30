import type { ChangeEvent, RefObject } from 'react';
import { Camera, Image as ImageIcon, Link2, ScanBarcode, Layers, Palette, Sun, Tag, X, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';

interface UploadStepProps {
  isPremium: boolean;
  slotsLeft: number;
  slotsLeftLabel: string;
  onBack: () => void;
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

const AI_DETECTIONS = [
  { icon: Tag, label: 'Category' },
  { icon: Palette, label: 'Color' },
  { icon: Layers, label: 'Material' },
  { icon: Sun, label: 'Season' },
] as const;

export function UploadStep({
  isPremium,
  slotsLeft,
  slotsLeftLabel,
  onBack,
  title,
  prompt,
  helperText: _helperText,
  photoLabel: _photoLabel,
  linkLabel,
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
  return (
    <div className="flex min-h-[100dvh] flex-col bg-foreground text-background">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onImageSelect} className="hidden" />
      <input ref={batchInputRef} type="file" accept="image/*" multiple onChange={onBatchSelect} className="hidden" />

      {/* Header */}
      <header className="flex items-center justify-between px-5 pb-2" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}>
        <button
          onClick={() => { hapticLight(); onBack(); }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-background/15 transition-colors active:bg-background/25 cursor-pointer"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h1 className="font-display italic text-[1.25rem] font-medium">{title || 'Add Piece'}</h1>
        {!isPremium ? (
          <span className="rounded-full bg-background/15 px-3 py-1 text-[11px] font-medium tracking-wide">
            {slotsLeft} {slotsLeftLabel || 'left'}
          </span>
        ) : (
          <div className="w-10" />
        )}
      </header>

      {/* Camera viewport */}
      <AnimatedPage className="flex flex-1 flex-col">
        <div className="relative mx-5 flex-1 overflow-hidden rounded-[1.25rem] bg-background/8">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background/12">
              <Camera className="h-8 w-8 text-background/70" />
            </div>
            <p className="text-[0.92rem] font-medium text-background/60">{prompt || 'Point at your piece'}</p>
          </div>
        </div>

        {/* Camera controls */}
        <div className="flex items-center justify-center gap-8 py-6">
          <button
            onClick={() => { hapticLight(); onPickFromGallery(); }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-background/15 transition-colors active:bg-background/25 cursor-pointer"
            aria-label={galleryLabel}
          >
            <ImageIcon className="h-5 w-5" />
          </button>

          <button
            onClick={() => { hapticLight(); onTakePhoto(); }}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-background/40 transition-transform active:scale-95 cursor-pointer"
            aria-label={cameraLabel}
          >
            <div className="h-[58px] w-[58px] rounded-full bg-background" />
          </button>

          <button
            onClick={() => { hapticLight(); batchInputRef.current?.click(); }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-background/15 transition-colors active:bg-background/25 cursor-pointer"
            aria-label={batchLabel}
          >
            <Zap className="h-5 w-5" />
          </button>
        </div>

        {/* AI detection strip */}
        <div className="px-5 pb-4">
          <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-background/40">
            AI will detect
          </p>
          <div className="flex justify-center gap-3">
            {AI_DETECTIONS.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[0.75rem] bg-background/10">
                  <item.icon className="h-4 w-4 text-background/60" />
                </div>
                <span className="text-[10px] font-medium text-background/50">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Alternative methods */}
        <div className="flex gap-3 px-5 pb-5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}>
          <button
            onClick={() => hapticLight()}
            className="flex flex-1 items-center gap-3 rounded-[1rem] bg-background/10 px-4 py-3.5 transition-colors active:bg-background/15 cursor-pointer"
          >
            <Link2 className="h-4 w-4 text-background/60" />
            <div className="text-left">
              <p className="text-[13px] font-medium text-background/80">{linkLabel || 'Import from Link'}</p>
              <p className="text-[11px] text-background/40">Paste a product URL</p>
            </div>
          </button>
          <button
            onClick={() => hapticLight()}
            className="flex flex-1 items-center gap-3 rounded-[1rem] bg-background/10 px-4 py-3.5 transition-colors active:bg-background/15 cursor-pointer"
          >
            <ScanBarcode className="h-4 w-4 text-background/60" />
            <div className="text-left">
              <p className="text-[13px] font-medium text-background/80">Scan Barcode</p>
              <p className="text-[11px] text-background/40">Quick tag lookup</p>
            </div>
          </button>
        </div>
      </AnimatedPage>
    </div>
  );
}
