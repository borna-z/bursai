import { Images } from 'lucide-react';

interface BatchUploadTabProps {
  label: string;
  onClick: () => void;
}

export function BatchUploadTab({ label, onClick }: BatchUploadTabProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
    >
      <Images className="w-4 h-4" />
      {label}
    </button>
  );
}
