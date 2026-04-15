import { ArrowRight, Plane } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface TravelEmptyStateProps {
  onStartForm: () => void;
}

export function TravelEmptyState({ onStartForm }: TravelEmptyStateProps) {
  return (
    <Card surface="editorial" density="airy" className="overflow-hidden px-5 py-7 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-border/40 bg-background/60">
        <Plane className="h-5 w-5 text-foreground/70" />
      </div>
      <div className="mt-5 space-y-3">
        <span className="eyebrow-chip">Travel Capsule</span>
        <h2 className="page-intro-title !text-[2rem]">Pack less. Dress better.</h2>
        <p className="page-intro-copy mx-auto max-w-[30ch]">
          Tell BURS where you are going and for how long, and it will build a tighter wardrobe edit from what you already own.
        </p>
      </div>
      <Button onClick={onStartForm} size="lg" className="mt-6 w-full sm:w-auto sm:self-center">
        Build a capsule
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Card>
  );
}
