import { createElement, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { animated, to, useSpring } from "@react-spring/web";
import { springs, useReducedMotion } from "./hooks.js";

/*
 * Mount-order stagger. Everything that mounts in the same frame (a first
 * render, or the nodes one streamed line adds) queues up and enters in a
 * cascade; the queue resets on the next frame.
 */
let queued = 0;
let resetScheduled = false;
function nextDelay(step: number): number {
  const d = Math.min(queued, 14) * step;
  queued++;
  if (!resetScheduled) {
    resetScheduled = true;
    const reset = () => {
      queued = 0;
      resetScheduled = false;
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(reset);
    else setTimeout(reset, 16);
  }
  return d;
}

export type EnterStyle = "rise" | "pop" | "fade" | "slide";

export interface EnterProps {
  children?: ReactNode;
  variant?: EnterStyle;
  /** Delay between siblings that mount together, in ms. */
  stagger?: number;
}

const FROM: Record<EnterStyle, { o: number; y: number; x: number; s: number; b: number }> = {
  rise: { o: 0, y: 14, x: 0, s: 0.985, b: 4 },
  pop: { o: 0, y: 6, x: 0, s: 0.92, b: 0 },
  fade: { o: 0, y: 0, x: 0, s: 1, b: 6 },
  slide: { o: 0, y: 0, x: -14, s: 1, b: 0 },
};

/** Springs its content in once, on mount. */
export function Enter({ children, variant = "rise", stagger = 45 }: EnterProps) {
  const reduce = useReducedMotion();
  const [delay] = useState(() => nextDelay(stagger));
  const from = FROM[variant];
  const [style] = useSpring(
    () => ({
      from,
      to: { o: 1, y: 0, x: 0, s: 1, b: 0 },
      delay: reduce ? 0 : delay,
      immediate: reduce,
      config: springs.enter,
    }),
    [],
  );
  // At rest, transform and filter are "none": they would otherwise trap position:fixed content.
  return (
    <animated.div
      data-agentable-enter={variant}
      style={{
        opacity: style.o,
        transform: to([style.x, style.y, style.s], (x, y, s) => (x === 0 && y === 0 && s === 1 ? "none" : `translate3d(${x}px, ${y}px, 0) scale(${s})`)),
        filter: style.b.to((b) => (b > 0.05 ? `blur(${b}px)` : "none")),
      }}
    >
      {children}
    </animated.div>
  );
}

/** Wrap a component so every instance springs in when it mounts. */
export function withEnter<P extends object>(Inner: ComponentType<P>, variant: EnterStyle = "rise"): ComponentType<P> {
  function Entered(props: P) {
    return <Enter variant={variant}>{createElement(Inner, props)}</Enter>;
  }
  Entered.displayName = `Enter(${Inner.displayName ?? Inner.name ?? "Component"})`;
  return Entered;
}

/** Splits "$48.2k" into a prefix, the number, and a suffix, keeping its formatting. */
export function parseNumber(value: string | number): { pre: string; n: number; post: string; decimals: number; commas: boolean } | null {
  const text = String(value);
  const m = /-?\d[\d,]*(\.\d+)?|-?\.\d+/.exec(text);
  if (!m) return null;
  const raw = m[0];
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return { pre: text.slice(0, m.index), n, post: text.slice(m.index + raw.length), decimals: m[1] ? m[1].length - 1 : 0, commas: raw.includes(",") || Math.abs(n) >= 10000 };
}

export function formatNumber(n: number, decimals: number, commas: boolean): string {
  const fixed = n.toFixed(decimals);
  if (!commas) return fixed;
  const [i, f] = fixed.split(".");
  return `${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${f ? `.${f}` : ""}`;
}

/** A number that springs from its last value to the new one. Text without a number renders as is. */
export function Ticker({ value, className }: { value: string | number; className?: string }) {
  const reduce = useReducedMotion();
  const parsed = useMemo(() => parseNumber(value), [value]);
  const [s] = useSpring(() => ({ from: { n: 0 }, to: { n: parsed?.n ?? 0 }, immediate: reduce || !parsed, config: springs.fill }), [parsed?.n, reduce]);
  if (!parsed) return <span className={className}>{value}</span>;
  return (
    <animated.span className={className} aria-label={String(value)}>
      {s.n.to((n) => `${parsed.pre}${formatNumber(n, parsed.decimals, parsed.commas)}${parsed.post}`)}
    </animated.span>
  );
}

export interface SpringStatProps {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down" | "flat";
}

/** Stat whose value counts up and whose delta pops in after it. Same data hooks as the ui Stat. */
export function SpringStat({ label, value, delta, trend }: SpringStatProps) {
  const reduce = useReducedMotion();
  const t = trend ?? (delta ? (delta.trim().startsWith("-") ? "down" : "up") : undefined);
  const [pop] = useSpring(() => ({ from: { s: 0.6, o: 0 }, to: { s: 1, o: 1 }, delay: 380, immediate: reduce, config: springs.wobble }), [delta]);
  return (
    <div data-agentable-stat="" data-trend={t} data-agentable-motion-stat="">
      <span data-agentable-stat-label="">{label}</span>
      <span data-agentable-stat-value="">
        <Ticker value={value} />
      </span>
      {delta ? (
        <animated.span data-agentable-stat-delta="" style={{ opacity: pop.o, transform: pop.s.to((s) => `scale(${s})`), transformOrigin: "left center" }}>
          {t === "up" ? "▲ " : t === "down" ? "▼ " : ""}
          {delta}
        </animated.span>
      ) : null}
    </div>
  );
}

export interface SpringProgressProps {
  label?: string;
  value: number;
  max?: number;
}

/** A progress bar that springs to its value, with a sheen while filling. */
export function SpringProgress({ label, value, max = 100 }: SpringProgressProps) {
  const reduce = useReducedMotion();
  const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const pct = max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
  const [s] = useSpring(() => ({ from: { p: 0 }, to: { p: pct }, delay: 120, immediate: reduce, config: springs.fill }), [pct]);
  const [seen, setSeen] = useState(false);
  useEffect(() => setSeen(true), []);
  return (
    <div data-agentable-progress="" data-agentable-motion-progress="" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      {label ? <span>{label}</span> : null}
      <div data-agentable-motion-track="">
        <animated.div data-agentable-motion-fill="" data-filling={seen && !reduce ? "" : undefined} style={{ width: s.p.to((p) => `${p}%`) }} />
      </div>
      <animated.span data-agentable-motion-pct="">{s.p.to((p) => `${Math.round(p)}%`)}</animated.span>
    </div>
  );
}
