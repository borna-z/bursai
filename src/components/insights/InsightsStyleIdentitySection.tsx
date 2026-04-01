import type { InsightsDashboardViewModel } from '@/components/insights/useInsightsDashboardAdapter';
import { InsightsSection } from '@/components/insights/InsightsSection';
import { cn } from '@/lib/utils';

function PatternStrength({ strength }: { strength: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-secondary/75">
      <div className="h-full rounded-full bg-foreground/65" style={{ width: `${Math.min(strength, 100)}%` }} />
    </div>
  );
}

export function InsightsStyleIdentitySection({
  style,
}: {
  style: InsightsDashboardViewModel['style'];
}) {
  return (
    <InsightsSection
      id="style-identity"
      eyebrow="Style identity"
      title="The signals that define how you actually dress."
      description="Archetype, formality, palette loyalty, and formulas should read like a style editor’s note, not a quiz result."
    >
      <div className="surface-secondary rounded-[1.6rem] p-5 sm:p-6" data-testid="style-dna-section">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="label-editorial text-muted-foreground/62">Style DNA</p>
              <h3 className="text-[1.35rem] font-semibold tracking-[-0.05em] text-foreground">
                {style.archetype}
              </h3>
              <p className="max-w-[28rem] text-[0.9rem] leading-6 text-muted-foreground">
                {style.detail}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.15rem] bg-background/62 p-4">
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                  Formality spread
                </p>
                <p className="mt-2 text-[1.02rem] font-semibold tracking-[-0.04em] text-foreground">
                  {style.formalityLabel}
                </p>
                <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                  {style.formalityValue}
                </p>
              </div>

              <div className="rounded-[1.15rem] bg-background/62 p-4">
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                  Signature colors
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {style.signatureColors.slice(0, 4).map((entry) => (
                    <div key={entry.color} className="flex items-center gap-2 rounded-full border border-border/45 px-2.5 py-1.5">
                      <span
                        className="size-2.5 rounded-full border border-black/5"
                        style={{ backgroundColor: entry.swatch }}
                        aria-hidden="true"
                      />
                      <span className="text-[0.8rem] text-foreground/80">
                        {entry.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.2rem] bg-background/62 p-4">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                Recurring formulas
              </p>
              <div className="mt-3 space-y-3">
                {style.formulas.length > 0 ? style.formulas.map((formula) => (
                  <div key={formula.label} className="flex items-center justify-between gap-4 border-b border-border/30 pb-3 last:border-0 last:pb-0">
                    <span className="text-[0.92rem] leading-6 text-foreground">
                      {formula.label}
                    </span>
                    <span className="text-[0.82rem] text-muted-foreground/74">
                      {formula.count}x
                    </span>
                  </div>
                )) : (
                  <p className="text-[0.88rem] leading-6 text-muted-foreground">
                    Formulas will appear once a few combinations start repeating often enough to matter.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[1.2rem] bg-background/62 p-4">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                Strongest patterns
              </p>
              <div className="mt-3 space-y-3">
                {style.patterns.length > 0 ? style.patterns.map((pattern) => (
                  <div key={pattern.label} className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[0.9rem] text-foreground">
                        {pattern.label}
                      </span>
                      <span className="text-[0.78rem] text-muted-foreground/70">
                        {pattern.strength}%
                      </span>
                    </div>
                    <PatternStrength strength={pattern.strength} />
                    <p className={cn(
                      'text-[0.82rem] leading-5 text-muted-foreground',
                      !pattern.detail && 'hidden',
                    )}>
                      {pattern.detail}
                    </p>
                  </div>
                )) : (
                  <p className="text-[0.88rem] leading-6 text-muted-foreground">
                    The pattern layer fills in once wear history is strong enough to reveal repeat behavior.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </InsightsSection>
  );
}
