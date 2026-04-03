import type { InsightsDashboardViewModel } from '@/components/insights/useInsightsDashboardAdapter';
import { InsightsSection } from '@/components/insights/InsightsSection';

function barWidth(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(Math.min((value / max) * 100, 100), 6);
}

function getFormalityBand(center: number | null, spread: InsightsDashboardViewModel['style']['formalitySpread']) {
  if (center == null || !spread) {
    return { left: 0, width: 0, marker: 0 };
  }

  const spreadValue = spread === 'narrow' ? 0.45 : spread === 'wide' ? 1.45 : 0.95;
  const start = Math.max(1, center - spreadValue);
  const end = Math.min(5, center + spreadValue);

  return {
    left: ((start - 1) / 4) * 100,
    width: Math.max(((end - start) / 4) * 100, 10),
    marker: ((center - 1) / 4) * 100,
  };
}

export function InsightsStyleIdentitySection({
  style,
}: {
  style: InsightsDashboardViewModel['style'];
}) {
  const band = getFormalityBand(style.formalityCenter, style.formalitySpread);
  const formulaMax = Math.max(...style.formulas.map((formula) => formula.count), 1);

  return (
    <InsightsSection
      id="style-identity"
      eyebrow="Style identity"
      title="Style DNA"
      description={style.caption}
    >
      <div className="grid gap-7 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" data-testid="style-dna-section">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <p className="label-editorial text-foreground/56">Archetype</p>
            <h3 className="text-[1.44rem] font-semibold tracking-[-0.05em] text-foreground">
              {style.archetype}
            </h3>
          </div>

          <div className="space-y-3 border-y border-border/24 py-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                  Formality range
                </p>
                <p className="mt-2 text-[0.98rem] font-medium tracking-[-0.04em] text-foreground">
                  {style.formalityLabel}
                </p>
              </div>
              <p className="text-[0.78rem] text-muted-foreground/68">
                {style.formalityValue}
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative h-2 rounded-full bg-secondary/75">
                {style.formalityCenter != null ? (
                  <>
                    <div
                      className="absolute top-0 h-full rounded-full bg-accent/18"
                      style={{ left: `${band.left}%`, width: `${band.width}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-background bg-accent"
                      style={{ left: `calc(${band.marker}% - 0.375rem)` }}
                    />
                  </>
                ) : null}
              </div>
              <div className="flex items-center justify-between text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground/52">
                {[1, 2, 3, 4, 5].map((tick) => (
                  <span key={tick}>{tick}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                Signature colors
              </p>
              <p className="text-[0.78rem] text-muted-foreground/68">
                Top five worn tones
              </p>
            </div>

            <div className="overflow-hidden rounded-full bg-secondary/75">
              <div className="flex h-4">
                {style.signatureColors.map((entry) => (
                  <div
                    key={entry.color}
                    title={`${entry.label} ${entry.percentage}%`}
                    style={{ width: `${Math.max(entry.percentage, 8)}%`, backgroundColor: entry.swatch }}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {style.signatureColors.map((entry) => (
                <div key={entry.color} className="inline-flex items-center gap-2 rounded-full border border-border/40 px-3 py-1.5">
                  <span
                    className="size-2.5 rounded-full border border-black/5"
                    style={{ backgroundColor: entry.swatch }}
                    aria-hidden="true"
                  />
                  <span className="text-[0.8rem] text-foreground/82">
                    {entry.label}
                  </span>
                  <span className="text-[0.75rem] text-muted-foreground/66">
                    {entry.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                Recurring formulas
              </p>
              <p className="text-[0.8rem] text-muted-foreground/72">
                Ranked by repeat count
              </p>
            </div>

            <div className="space-y-3">
              {style.formulas.length > 0 ? style.formulas.map((formula) => (
                <div key={formula.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[0.9rem] text-foreground">
                      {formula.label}
                    </span>
                    <span className="text-[0.78rem] text-muted-foreground/68">
                      {formula.count}x
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary/75">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${barWidth(formula.count, formulaMax)}%` }}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-[0.86rem] leading-6 text-muted-foreground">
                  Formula bars appear once combinations start repeating.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                Strongest patterns
              </p>
              <p className="text-[0.8rem] text-muted-foreground/72">
                Strength from backend behavior
              </p>
            </div>

            <div className="space-y-3">
              {style.patterns.length > 0 ? style.patterns.map((pattern) => (
                <div key={pattern.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[0.9rem] text-foreground">
                      {pattern.label}
                    </span>
                    <span className="text-[0.78rem] text-muted-foreground/68">
                      {pattern.strength}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary/75">
                    <div
                      className="h-full rounded-full bg-foreground/42"
                      style={{ width: `${barWidth(pattern.strength, 100)}%` }}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-[0.86rem] leading-6 text-muted-foreground">
                  Pattern strength appears once wear history is deep enough.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </InsightsSection>
  );
}
