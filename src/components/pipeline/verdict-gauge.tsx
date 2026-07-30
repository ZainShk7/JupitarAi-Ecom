import { cn } from "@/lib/utils";

const SIZE_CONFIG = {
  sm: { diameter: 28, strokeWidth: 4 },
  lg: { diameter: 176, strokeWidth: 10 },
} as const;

export type GaugeSize = keyof typeof SIZE_CONFIG;

// 270° arc, gap centered at the bottom — a dial, not a full ring.
const SWEEP_START = 135; // degrees; 0° = 3 o'clock, clockwise
const SWEEP_DEGREES = 270;
// The scale is always [0, 3 * minMarginPercent], so the bar sits at a fixed
// fraction of the sweep regardless of what minMarginPercent actually is.
const BAR_FRACTION = 1 / 3;

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export interface VerdictGaugeProps {
  marginPercent: number | null;
  minMarginPercent: number;
  size?: GaugeSize;
  className?: string;
}

export function VerdictGauge({
  marginPercent,
  minMarginPercent,
  size = "sm",
  className,
}: VerdictGaugeProps) {
  const { diameter, strokeWidth } = SIZE_CONFIG[size];
  const r = diameter / 2 - strokeWidth / 2 - 1;
  const cx = diameter / 2;
  const cy = diameter / 2;

  const scaleMax = minMarginPercent > 0 ? minMarginPercent * 3 : 60;
  const fraction = marginPercent == null ? 0 : Math.max(0, Math.min(1, marginPercent / scaleMax));

  const barAngle = SWEEP_START + BAR_FRACTION * SWEEP_DEGREES;
  const barInner = polarPoint(cx, cy, r - strokeWidth / 2 - 2, barAngle);
  const barOuter = polarPoint(cx, cy, r + strokeWidth / 2 + 2, barAngle);

  const label =
    marginPercent == null ? "Margin unknown" : `Margin ${marginPercent.toFixed(1)} percent`;

  return (
    <svg
      width={diameter}
      height={diameter}
      viewBox={`0 0 ${diameter} ${diameter}`}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={label}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--color-hairline)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="75 100"
        transform={`rotate(135 ${cx} ${cy})`}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={size === "lg" ? "url(#verdict-gauge-gradient-lg)" : "var(--color-copper)"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${fraction * 75} 100`}
        transform={`rotate(135 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray 160ms ease-out" }}
      />
      <line
        x1={barInner.x}
        y1={barInner.y}
        x2={barOuter.x}
        y2={barOuter.y}
        stroke="var(--color-ink-dim)"
        strokeWidth={1}
      />
      {size === "lg" ? (
        <defs>
          <linearGradient id="verdict-gauge-gradient-lg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-copper)" />
            <stop offset="100%" stopColor="var(--color-copper-bright)" />
          </linearGradient>
        </defs>
      ) : null}
    </svg>
  );
}
