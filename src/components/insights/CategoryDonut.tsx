import { useLanguage } from '@/contexts/LanguageContext';

interface CategoryDonutProps {
  segments: { label: string; count: number }[];
  total: number;
}

export function CategoryDonut({ segments, total }: CategoryDonutProps) {
  const { t } = useLanguage();

  const size = 100;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 38;
  const innerR = 26;
  const strokeWidth = outerR - innerR;
  const trackR = innerR + strokeWidth / 2;
  const circumference = 2 * Math.PI * trackR;

  // Filter to top segments that have count > 0
  const validSegments = segments.filter((s) => s.count > 0).slice(0, 6);
  const segTotal = validSegments.reduce((sum, s) => sum + s.count, 0);

  // Build arc segments
  let offset = 0;
  const arcs = validSegments.map((seg, i) => {
    const fraction = segTotal > 0 ? seg.count / segTotal : 0;
    const dashArray = `${fraction * circumference - 2} ${circumference - (fraction * circumference - 2)}`;
    const dashOffset = -(offset * circumference) + circumference / 4; // rotate start to top
    const arcOffset = -dashOffset + circumference;
    offset += fraction;
    const opacityStep = 0.9 - i * 0.13;
    return { seg, dashArray, arcOffset: -(offset * circumference) + circumference / 4, opacityBase: opacityStep, fraction };
  });

  // Recompute properly
  let runningOffset = 0;
  const arcSegments = validSegments.map((seg, i) => {
    const fraction = segTotal > 0 ? seg.count / segTotal : 0;
    const dash = fraction * circumference - 2;
    const gap = circumference - dash;
    // dashOffset positions the start of the stroke; circumference/4 rotates to 12 o'clock
    const dashOffset = circumference / 4 - runningOffset * circumference;
    runningOffset += fraction;
    const opacity = Math.max(0.2, 0.9 - i * 0.13);
    return { seg, dash, gap, dashOffset, opacity };
  });

  return (
    <div className="bg-card/30 border-[0.5px] border-border/40 rounded-[18px] p-[14px] flex flex-col items-center">
      <span className="text-foreground font-medium mb-3 self-start" style={{ fontSize: 12 }}>
        {t('insights.categories') || 'Categories'}
      </span>

      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={trackR}
            fill="none"
            stroke="hsl(var(--border) / 0.3)"
            strokeWidth={strokeWidth}
          />
          {/* Segments */}
          {arcSegments.map(({ seg, dash, gap, dashOffset, opacity }, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={trackR}
              fill="none"
              stroke={`hsl(var(--accent) / ${opacity})`}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-foreground font-semibold"
            style={{ fontSize: 18, fontFamily: 'DM Sans, sans-serif', lineHeight: 1 }}
          >
            {total}
          </span>
          <span className="text-foreground" style={{ fontSize: 9, opacity: 0.4 }}>
            {t('insights.items') || 'items'}
          </span>
        </div>
      </div>
    </div>
  );
}
