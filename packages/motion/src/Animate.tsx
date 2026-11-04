import { useEffect, type ReactNode } from "react";
import { animated, to, useSpring } from "@react-spring/web";
import { springs, useInView, useReducedMotion, useTilt } from "./hooks.js";

export const ENTER_PRESETS = ["rise", "fade", "pop", "zoom", "flip", "unfold", "slide-left", "slide-right", "drop", "blur"] as const;
export const LOOP_PRESETS = ["float", "bob", "breathe", "pulse", "sway", "spin", "wiggle", "drift"] as const;
export const INTERACT_PRESETS = ["tilt", "lift", "magnet"] as const;
export type AnimatePreset = (typeof ENTER_PRESETS)[number] | (typeof LOOP_PRESETS)[number] | (typeof INTERACT_PRESETS)[number];

export interface AnimateProps {
  children?: ReactNode;
  /** Entrance (plays once when scrolled into view), loop (keeps moving) or interaction (responds to the pointer). */
  preset?: AnimatePreset;
  /** Delay in ms before an entrance or loop starts. */
  delay?: number;
  /** 0.25 (slow) to 3 (fast). */
  speed?: number;
  /** Loop strength, 0.25 to 3. */
  amount?: number;
}

type V = { o: number; x: number; y: number; s: number; r: number; rx: number; ry: number; b: number; sy: number };
const REST: V = { o: 1, x: 0, y: 0, s: 1, r: 0, rx: 0, ry: 0, b: 0, sy: 1 };

const ENTER_FROM: Record<(typeof ENTER_PRESETS)[number], Partial<V>> = {
  rise: { o: 0, y: 24 },
  fade: { o: 0 },
  pop: { o: 0, s: 0.8 },
  zoom: { o: 0, s: 1.12, b: 8 },
  flip: { o: 0, rx: -70 },
  unfold: { o: 0, sy: 0 },
  "slide-left": { o: 0, x: 40 },
  "slide-right": { o: 0, x: -40 },
  drop: { o: 0, y: -40 },
  blur: { o: 0, b: 14 },
};

/** One loop leg: from REST toward this offset and back. Scaled by `amount`. */
const LOOP_TO: Record<Exclude<(typeof LOOP_PRESETS)[number], "spin">, Partial<V>> = {
  float: { y: -10 },
  bob: { y: -5, r: 1.2 },
  breathe: { s: 1.04 },
  pulse: { s: 1.08, o: 0.82 },
  sway: { r: 3.5 },
  wiggle: { r: -4, x: 2 },
  drift: { x: 10, y: -6 },
};

const clamp = (n: unknown, lo: number, hi: number, d: number) => (typeof n === "number" && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d);

/**
 * Give any node motion: an entrance when it scrolls into view, a gentle loop,
 * or a response to the pointer. Reduced motion shows the node at rest.
 */
export function Animate({ children, preset = "rise", delay = 0, speed = 1, amount = 1 }: AnimateProps) {
  const reduce = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>();
  const sp = clamp(speed, 0.25, 3, 1);
  const amt = clamp(amount, 0.25, 3, 1);
  const wait = clamp(delay, 0, 10000, 0);
  const isEnter = (ENTER_PRESETS as readonly string[]).includes(preset);
  const isLoop = (LOOP_PRESETS as readonly string[]).includes(preset);
  const tilt = useTilt({ max: 10 * amt, scale: 1.02, disabled: preset !== "tilt" });

  const [v, api] = useSpring(() => ({ ...REST, ...(isEnter && !reduce ? ENTER_FROM[preset as keyof typeof ENTER_FROM] : {}) }));

  useEffect(() => {
    if (reduce) {
      void api.start({ ...REST, immediate: true });
      return;
    }
    if (isEnter) {
      if (seen) void api.start({ ...REST, delay: wait, config: { tension: 220 * sp, friction: 22 } });
      return;
    }
    if (!isLoop || !seen) return;
    if (preset === "spin") {
      void api.start({ from: { r: 0 }, to: { r: 360 }, loop: true, delay: wait, config: { duration: 9000 / sp } });
    } else {
      const leg = LOOP_TO[preset as keyof typeof LOOP_TO];
      const target: Partial<V> = {};
      for (const [k, val] of Object.entries(leg) as Array<[keyof V, number]>) target[k] = k === "s" || k === "o" ? 1 + (val - 1) * amt : val * amt;
      void api.start({ from: REST, to: target, loop: { reverse: true }, delay: wait, config: { tension: 18 * sp, friction: 7 } });
    }
    return () => {
      api.stop();
    };
  }, [preset, seen, reduce, isEnter, isLoop, sp, amt, wait, api]);

  const interactive =
    preset === "lift"
      ? {
          onPointerEnter: () => !reduce && api.start({ y: -6 * amt, s: 1.015, config: springs.snap }),
          onPointerLeave: () => api.start({ y: 0, s: 1, config: springs.snap }),
        }
      : preset === "magnet"
        ? {
            onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
              if (reduce || e.pointerType === "touch") return;
              const r = e.currentTarget.getBoundingClientRect();
              void api.start({ x: ((e.clientX - r.left) / r.width - 0.5) * 16 * amt, y: ((e.clientY - r.top) / r.height - 0.5) * 16 * amt, config: springs.soft });
            },
            onPointerLeave: () => api.start({ x: 0, y: 0, config: springs.wobble }),
          }
        : preset === "tilt"
          ? tilt.bind
          : {};

  const transform =
    preset === "tilt"
      ? tilt.style.transform
      : to([v.x, v.y, v.s, v.r, v.rx, v.ry, v.sy], (x, y, s, r, rx, ry, sy) =>
          x === 0 && y === 0 && s === 1 && r === 0 && rx === 0 && ry === 0 && sy === 1
            ? "none"
            : `perspective(900px) translate3d(${x}px, ${y}px, 0) rotate(${r}deg) rotateX(${rx}deg) rotateY(${ry}deg) scale(${s}) scaleY(${sy})`,
        );

  return (
    <animated.div
      ref={ref}
      data-agentable-animate={preset}
      {...interactive}
      style={{
        opacity: v.o,
        transform,
        transformOrigin: preset === "unfold" ? "top center" : preset === "sway" || preset === "bob" ? "bottom center" : "center",
        filter: v.b.to((b) => (b > 0.05 ? `blur(${b}px)` : "none")),
      }}
    >
      {children}
    </animated.div>
  );
}
