import { useMemo } from "react";
import { animated, easings, useSprings } from "@react-spring/web";
import { useReducedMotion } from "./hooks.js";

// Theme colours only: the accent plus ink tones, so a celebration still looks like the product.
const COLORS = ["var(--ag-accent)", "var(--ag-fg)", "var(--ag-muted)", "var(--ag-accent)", "var(--ag-line)"];

export interface ConfettiProps {
  /** Change this to fire another burst. */
  fire: number;
  count?: number;
}

/** A burst of paper from the center of the nearest positioned parent. Decorative; skipped under reduced motion. */
export function Confetti({ fire, count = 28 }: ConfettiProps) {
  const reduce = useReducedMotion();
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const speed = 120 + Math.random() * 180;
        return {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 160,
          spin: (Math.random() - 0.5) * 900,
          color: COLORS[i % COLORS.length],
          w: 5 + Math.random() * 5,
          round: Math.random() > 0.6,
        };
      }),
    // A new set of trajectories per burst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fire, count],
  );
  const [items] = useSprings(
    bits.length,
    () => ({ from: { t: 0 }, to: { t: 1 }, reset: true, config: { duration: 1400, easing: easings.easeOutCubic } }),
    [fire],
  );
  if (!fire || reduce) return null;
  return (
    <div data-agentable-confetti="" aria-hidden="true">
      {items.map((sp, i) => {
        const b = bits[i]!;
        return (
          <animated.span
            key={`${fire}-${i}`}
            style={{
              width: b.w,
              height: b.round ? b.w : b.w * 1.8,
              borderRadius: b.round ? "50%" : 2,
              background: b.color,
              opacity: sp.t.to((t) => (t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25)),
              transform: sp.t.to((t) => `translate(${b.vx * t}px, ${b.vy * t + 420 * t * t}px) rotate(${b.spin * t}deg)`),
            }}
          />
        );
      })}
    </div>
  );
}
