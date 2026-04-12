import { useLanguage } from '@/contexts/LanguageContext';

interface WardrobeHealthRadarProps {
  axes: { label: string; value: number }[];
}

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function polygonPoints(cx: number, cy: number, radii: number[], startAngle: number) {
  return radii
    .map((r, i) => {
      const angle = startAngle + (i * 2 * Math.PI) / radii.length;
      const pt = polarToCartesian(cx, cy, r, angle);
      return `${pt.x},${pt.y}`;
    })
    .join(' ');
}

export function WardrobeHealthRadar({ axes }: WardrobeHealthRadarProps) {
  const { t } = useLanguage();

  const n = axes.length;
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 68;
  const startAngle = -Math.PI / 2; // start at top

  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridOpacities = [0.06, 0.09, 0.12, 0.18];

  const axisAngles = axes.map((_, i) => startAngle + (i * 2 * Math.PI) / n);

  const dataRadii = axes.map((axis) => (Math.min(Math.max(axis.value, 0), 100) / 100) * maxR);
  const dataPoints = dataRadii
    .map((r, i) => {
      const pt = polarToCartesian(cx, cy, r, axisAngles[i]);
      return `${pt.x},${pt.y}`;
    })
    .join(' ');

  return (
    <div className="mx-[var(--page-px)] mb-4 bg-card/30 border-[0.5px] border-border/40 rounded-[18px] p-[18px]">
      <div className="mb-3">
        <span className="text-foreground font-medium" style={{ fontSize: 13 }}>
          {t('insights.wardrobeHealth') || 'Wardrobe Health'}
        </span>
        <p className="text-foreground mt-0.5" style={{ fontSize: 10, opacity: 0.4 }}>
          {t('insights.wardrobeHealthDesc') || 'How balanced your closet is'}
        </p>
      </div>

      <div className="flex justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Grid polygons */}
          {gridLevels.map((level, li) => {
            const radii = new Array(n).fill(level * maxR);
            const pts = polygonPoints(cx, cy, radii, startAngle);
            return (
              <polygon
                key={li}
                points={pts}
                fill="none"
                stroke={`hsl(var(--foreground) / ${gridOpacities[li]})`}
                strokeWidth={0.75}
              />
            );
          })}

          {/* Axis lines */}
          {axisAngles.map((angle, i) => {
            const outer = polarToCartesian(cx, cy, maxR, angle);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={outer.x}
                y2={outer.y}
                stroke="hsl(var(--foreground) / 0.07)"
                strokeWidth={0.75}
              />
            );
          })}

          {/* Data polygon */}
          <polygon
            points={dataPoints}
            fill="hsl(var(--accent) / 0.12)"
            stroke="hsl(var(--accent) / 0.5)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />

          {/* Data dots */}
          {dataRadii.map((r, i) => {
            const pt = polarToCartesian(cx, cy, r, axisAngles[i]);
            return (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={2.5}
                fill="hsl(var(--accent))"
                opacity={0.7}
              />
            );
          })}

          {/* Labels */}
          {axes.map((axis, i) => {
            const labelR = maxR + 14;
            const pt = polarToCartesian(cx, cy, labelR, axisAngles[i]);
            return (
              <text
                key={i}
                x={pt.x}
                y={pt.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={8}
                fill="hsl(var(--foreground) / 0.35)"
                fontFamily="DM Sans, sans-serif"
              >
                {axis.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
