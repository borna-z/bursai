import type { ChangeEvent, RefObject } from 'react';
import { ArrowLeft, Camera, Link2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  onImageSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onBatchSelect: (e: ChangeEvent<HTMLInputElement>) => void;
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
    <div className="min-h-screen bg-background">
      <div className="p-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        {!isPremium && <span className="text-xs text-muted-foreground">{slotsLeft} {slotsLeftLabel || 'left'}</span>}
      </div>

      <div className="flex flex-col items-center px-6 pt-8 pb-12 space-y-8 max-w-md mx-auto">
        <div className="space-y-3 text-center">
          <div className="w-16 h-16 bg-accent/10 flex items-center justify-center mx-auto">
            <Upload className="w-7 h-7 text-accent" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground max-w-[260px] mx-auto leading-relaxed">{prompt}</p>
          <p className="text-xs text-muted-foreground/80 max-w-[260px] mx-auto">{helperText}</p>
        </div>

        <Tabs defaultValue="photo" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11">
            <TabsTrigger value="photo" className="flex items-center gap-2 text-sm">
              <Camera className="w-4 h-4" />
              {photoLabel}
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-2 text-sm">
              <Link2 className="w-4 h-4" />
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
      </div>
    </div>
  );
}
