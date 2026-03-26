import type { ChangeEvent, RefObject } from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { BatchUploadTab } from './BatchUploadTab';

interface CameraCaptureProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  batchInputRef: RefObject<HTMLInputElement | null>;
  onImageSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onBatchSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onTakePhoto: () => void;
  onPickFromGallery: () => void;
  onBatchClick: () => void;
  cameraLabel: string;
  galleryLabel: string;
  batchLabel: string;
}

export function CameraCapture({
  fileInputRef,
  batchInputRef,
  onImageSelect,
  onBatchSelect,
  onTakePhoto,
  onPickFromGallery,
  onBatchClick,
  cameraLabel,
  galleryLabel,
  batchLabel,
}: CameraCaptureProps) {
  return (
    <div className="flex flex-col items-center space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onImageSelect}
        className="hidden"
      />
      <input
        ref={batchInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onBatchSelect}
        className="hidden"
      />

      <div className="grid grid-cols-2 gap-3 w-full">
        <button
          onClick={onTakePhoto}
          className="group flex flex-col items-center gap-3 p-6 border border-border/50 bg-card hover:border-accent/40 hover:bg-accent/5 transition-all"
        >
          <div className="w-12 h-12 bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
            <Camera className="w-6 h-6 text-accent" />
          </div>
          <span className="text-sm font-medium text-foreground">{cameraLabel}</span>
        </button>
        <button
          onClick={onPickFromGallery}
          className="group flex flex-col items-center gap-3 p-6 border border-border/50 bg-card hover:border-accent/40 hover:bg-accent/5 transition-all"
        >
          <div className="w-12 h-12 bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <ImageIcon className="w-6 h-6 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">{galleryLabel}</span>
        </button>
      </div>

      <BatchUploadTab label={batchLabel} onClick={onBatchClick} />
    </div>
  );
}
