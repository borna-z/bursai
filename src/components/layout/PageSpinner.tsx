import { Loader2 } from 'lucide-react';

interface PageSpinnerProps {
  className?: string;
}

export function PageSpinner({ className }: PageSpinnerProps) {
  return (
    <div className={className ?? "flex items-center justify-center min-h-[60vh]"}>
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
    </div>
  );
}
