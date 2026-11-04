import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { to, useSpring, type SpringConfig } from "@react-spring/web";

/** Shared spring feels, so every component moves like part of one system. */
export const springs = {
  /** Entrances: settles quickly with a hint of overshoot. */
  enter: { tension: 280, friction: 24 } satisfies SpringConfig,
  /** Snappy feedback: presses, toggles, indicators. */
  snap: { tension: 520, friction: 32 } satisfies SpringConfig,
  /** Soft: tilt, glare, things that follow the pointer. */
  soft: { tension: 170, friction: 26 } satisfies SpringConfig,
  /** Slow fills: rings, gauges, counters. */
  fill: { tension: 90, friction: 22 } satisfies SpringConfig,
  /** Wobbly: celebrations. */
  wobble: { tension: 300, friction: 12 } satisfies SpringConfig,
} as const;

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener?.("change", cb);
  return () => mq.removeEventListener?.("change", cb);
};
const read = () => (typeof window !== "undefined" && !!window.matchMedia?.(QUERY).matches);

/**
 * True when the person asked the OS for less motion. Components pass it as
 * `immediate`, so values still change but jump straight to where they land.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

/** True once the element has scrolled into view (fires once). */
export function useInView<T extends Element>(margin = "0px 0px -10% 0px"): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, seen]);
  return [ref, seen];
}

export interface TiltOptions {
  /** Max rotation in degrees. */
  max?: number;
  /** Scale while hovered. */
  scale?: number;
  disabled?: boolean;
}

/**
 * Pointer-following 3D tilt. Spread `bind` on the element and use `style`
 * (rotateX/rotateY/scale) plus `glare` (x/y in %, o opacity) for highlights.
 */
export function useTilt({ max = 10, scale = 1.02, disabled = false }: TiltOptions = {}) {
  const reduce = useReducedMotion();
  const off = disabled || reduce;
  const [s, api] = useSpring(() => ({ rx: 0, ry: 0, scale: 1, gx: 50, gy: 50, go: 0, config: springs.soft }));
  const bind = {
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      if (off || e.pointerType === "touch") return;
      const r = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      api.start({ rx: (0.5 - py) * max * 2, ry: (px - 0.5) * max * 2, scale, gx: px * 100, gy: py * 100, go: 1 });
    },
    onPointerLeave() {
      api.start({ rx: 0, ry: 0, scale: 1, go: 0 });
    },
  };
  const style = {
    transform: to([s.rx, s.ry, s.scale], (rx, ry, sc) => `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${sc})`),
  };
  return { bind, style, glare: { x: s.gx, y: s.gy, o: s.go }, springs: s };
}
