import type { ChangeEvent, RefObject } from 'react';
import { Camera, Link2, Upload } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Card } from '@/components/ui/card';
import { PageIntro } from '@/components/ui/page-intro';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CameraCapture } from './CameraCapture';
import { LinkImportTab } from './LinkImportTab';

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

export function UploadStep({
  isPremium,
  slotsLeft,
  slotsLeftLabel,
  onBack,
  title,
  prompt,
  helperText,
  photoLabel,
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
    <AppLayout hideNav>
      <PageHeader
        title={title}
        subtitle={helperText}
        showBack
        actions={!isPremium ? <span className="eyebrow-chip">{slotsLeft} {slotsLeftLabel || 'left'}</span> : undefined}
      />

      <AnimatedPage className="page-shell !px-5 !pt-6 page-cluster">
        <Card surface="editorial" className="p-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.1rem] bg-background/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <Upload className="h-7 w-7 text-foreground/72" />
          </div>
          <div className="mt-5">
            <PageIntro
              center
              eyebrow="Add garment"
              title={prompt}
              description="Bring in a single piece, import from a product link, or start a batch and let BURS clean up the metadata afterward."
            />
          </div>
        </Card>

        <Card surface="utility" className="p-4">
          <Tabs defaultValue="photo" className="w-full">
            <TabsList className="grid h-11 w-full grid-cols-2 rounded-full bg-secondary/60 p-1">
              <TabsTrigger value="photo" className="flex items-center gap-2 rounded-full text-sm">
                <Camera className="h-4 w-4" />
                {photoLabel}
              </TabsTrigger>
              <TabsTrigger value="link" className="flex items-center gap-2 rounded-full text-sm">
                <Link2 className="h-4 w-4" />
                {linkLabel}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="photo" className="mt-6">
              <CameraCapture
                fileInputRef={fileInputRef}
                batchInputRef={batchInputRef}
                onImageSelect={onImageSelect}
                onBatchSelect={onBatchSelect}
                onTakePhoto={onTakePhoto}
                onPickFromGallery={onPickFromGallery}
                onBatchClick={() => batchInputRef.current?.click()}
                cameraLabel={cameraLabel}
                galleryLabel={galleryLabel}
                batchLabel={batchLabel}
              />
            </TabsContent>

            <LinkImportTab value="link" />
          </Tabs>
        </Card>
      </AnimatedPage>
    </AppLayout>
  );
}
