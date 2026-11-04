import { animated, useSpring, useSprings } from "@react-spring/web";
import { springs, useInView, useReducedMotion } from "./hooks.js";
import { Ticker } from "./enter.js";

const SERIES = ["var(--ag-series-4)", "var(--ag-series-2)", "var(--ag-series-1)", "var(--ag-series-3)", "var(--ag-agent)"];

export interface RingProps {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}

/** One progress ring that springs closed when it scrolls into view. */
export function Ring({ value, max = 100, size = 120, color = "var(--ag-accent)", label, sublabel }: RingProps) {
  const reduce = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>();
  const stroke = Math.max(8, size * 0.11);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = max > 0 ? Math.max(0, Math.min(1, (Number(value) || 0) / max)) : 0;
  const s = useSpring({ p: seen ? p : 0, immediate: reduce, config: springs.fill, delay: 150 });
  return (
    <div ref={ref} data-agentable-ring="" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${label ?? ""} ${Math.round(p * 100)}%`.trim()}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={stroke} />
        <animated.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={s.p.to((v) => c * (1 - v))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {label || sublabel ? (
        <div data-agentable-ring-center="">
          {label ? <strong>{label}</strong> : null}
          {sublabel ? <span>{sublabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export interface RingItem {
  label: string;
  value: number;
  max?: number;
  /** Shown next to the label, e.g. "420 / 600 kcal". Defaults to the percentage. */
  detail?: string;
}

export interface RingsProps {
  rings: RingItem[];
  title?: string;
  size?: number;
}

/**
 * Concentric activity rings (Move, Exercise, Stand style). Each ring springs
 * closed in turn; a ring past 100% keeps going and laps itself.
 */
export function Rings({ rings, title, size = 168 }: RingsProps) {
  const reduce = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>();
  const items = (Array.isArray(rings) ? rings : []).slice(0, 5);
  const stroke = Math.max(10, size * 0.085);
  const gap = stroke * 0.28;
  const springsArr = useSprings(
    items.length,
    items.map((it, i) => {
      const p = (it.max ?? 100) > 0 ? Math.max(0, Math.min(2, (Number(it.value) || 0) / (it.max ?? 100))) : 0;
      return { p: seen ? p : 0, delay: 120 + i * 140, immediate: reduce, config: springs.fill };
    }),
  );
  const half = size / 2;
  return (
    <figure data-agentable-rings="" ref={ref}>
      {title ? <figcaption>{title}</figcaption> : null}
      <div data-agentable-rings-body="">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={items.map((it) => `${it.label} ${Math.round(((Number(it.value) || 0) / (it.max ?? 100)) * 100)}%`).join(", ")}>
          {items.map((it, i) => {
            const r = half - stroke / 2 - i * (stroke + gap);
            if (r <= stroke / 2) return null;
            const c = 2 * Math.PI * r;
            const color = SERIES[i % SERIES.length]!;
            const sp = springsArr[i]!;
            return (
              <g key={i} transform={`rotate(-90 ${half} ${half})`}>
                <circle cx={half} cy={half} r={r} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={stroke} />
                <animated.circle cx={half} cy={half} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={sp.p.to((v) => c * (1 - Math.min(1, v)))} />
                {/* The lap past 100%, drawn on top with a soft shadow at its head. */}
                <animated.circle
                  cx={half}
                  cy={half}
                  r={r}
                  fill="none"
                  stroke={color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={sp.p.to((v) => c * (1 - Math.max(0, v - 1)))}
                  style={{ filter: "drop-shadow(0 0 3px rgba(0,0,0,.35))", opacity: sp.p.to((v) => (v > 1 ? 1 : 0)) }}
                />
              </g>
            );
          })}
        </svg>
        <ul data-agentable-rings-legend="">
          {items.map((it, i) => (
            <li key={i}>
              <i style={{ background: SERIES[i % SERIES.length] }} />
              <span>{it.label}</span>
              <strong>{it.detail ? it.detail : <Ticker value={`${Math.round(((Number(it.value) || 0) / (it.max ?? 100)) * 100)}%`} />}</strong>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
