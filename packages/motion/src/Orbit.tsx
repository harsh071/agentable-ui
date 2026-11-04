import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { animated, useSpring } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import { springs, useReducedMotion } from "./hooks.js";

export interface OrbitProps {
  children?: ReactNode;
  /** Card width in px. Default 220. */
  width?: number;
  /** Seconds per item when auto-rotating; 0 = off. Pauses on hover. */
  autoplay?: number;
  /** Camera tilt in degrees, -30 to 30. */
  tilt?: number;
  /** Names for the cards, read by screen readers. */
  labels?: string[];
  onChange?: (index: number) => void;
}

/**
 * Cards on a 3D ring. Drag to spin (it settles on the nearest card), click a
 * card to bring it forward, or use ←/→. Only the front card is interactive.
 */
export function Orbit({ children, width = 220, autoplay = 0, tilt = -8, labels, onChange }: OrbitProps) {
  const reduce = useReducedMotion();
  const cards = Children.toArray(children).slice(0, 12);
  const n = cards.length;
  // A few cards sit on an arc of a larger ring, so neighbours stay visible at an angle; 7+ fill the whole ring and wrap.
  const slots = Math.max(n, 7);
  const wraps = n >= slots;
  const step = n ? 360 / slots : 0;
  const w = Math.max(140, Math.min(360, Number(width) || 220));
  const radius = n > 1 ? Math.round(w / 2 / Math.tan(Math.PI / slots) + 16) : 0;
  const [front, setFront] = useState(0);
  const [paused, setPaused] = useState(false);
  const angle = useRef(0);
  const [s, api] = useSpring(() => ({ a: 0, config: springs.enter }));

  const goTo = (raw: number) => {
    const i = wraps ? raw : Math.max(0, Math.min(n - 1, raw));
    rawIndex.current = i;
    const idx = ((i % n) + n) % n;
    // i is unwrapped (can pass n or go negative), so the ring always takes the short way round.
    const target = -i * step;
    angle.current = target;
    setFront(idx);
    onChange?.(idx);
    void api.start({ a: target, immediate: reduce });
  };
  const rawIndex = useRef(0);
  const go = (delta: number) => {
    rawIndex.current += delta;
    goTo(rawIndex.current);
  };

  useEffect(() => {
    if (!autoplay || paused || reduce || n < 2) return;
    const t = setInterval(() => (!wraps && rawIndex.current >= n - 1 ? goTo(0) : go(1)), Math.max(1, autoplay) * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, paused, reduce, n]);

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], memo = angle.current }) => {
      const a = memo + mx * 0.35;
      if (active) {
        void api.start({ a, immediate: true });
        return memo;
      }
      const fling = a + dx * vx * 40;
      rawIndex.current = Math.round(-fling / step);
      goTo(rawIndex.current);
      return memo;
    },
    { axis: "x", filterTaps: true, pointer: { touch: true } },
  );

  if (!n) return null;
  const name = (i: number) => labels?.[i] ?? `Card ${i + 1}`;
  return (
    <section
      data-agentable-orbit=""
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      style={{ height: Math.round(w * 1.25) + 60 }}
    >
      <div data-agentable-orbit-viewport="" {...bind()} style={{ touchAction: "pan-y" }}>
        <animated.div
          data-agentable-orbit-ring=""
          style={{ width: w, transform: s.a.to((a) => `translateZ(${-radius}px) rotateX(${Math.max(-30, Math.min(30, Number(tilt) || 0))}deg) rotateY(${a}deg)`) }}
        >
          {cards.map((card, i) => {
            const isFront = i === front;
            return (
              <animated.div
                key={i}
                data-agentable-orbit-card=""
                data-front={isFront ? "" : undefined}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${n}: ${name(i)}`}
                aria-hidden={!isFront}
                inert={!isFront || undefined}
                onClick={() => {
                  if (isFront) return;
                  let d = i - front;
                  if (wraps) {
                    d = ((d % n) + n) % n;
                    if (d > n / 2) d -= n;
                  }
                  go(d);
                }}
                style={{
                  width: w,
                  transform: `rotateY(${i * step}deg) translateZ(${radius}px)`,
                  opacity: s.a.to((a) => {
                    const rel = ((((i * step + a) % 360) + 540) % 360) - 180;
                    return 1 - Math.min(1, Math.abs(rel) / 180) * 0.7;
                  }),
                }}
              >
                {card}
              </animated.div>
            );
          })}
        </animated.div>
      </div>
      {n > 1 ? (
        <div data-agentable-orbit-nav="">
          <button type="button" data-agentable-button="ghost" aria-label="Previous" disabled={!wraps && front === 0} onClick={() => go(-1)}>
            ←
          </button>
          <span aria-live="polite">
            {front + 1} / {n}
          </span>
          <button type="button" data-agentable-button="ghost" aria-label="Next" disabled={!wraps && front === n - 1} onClick={() => go(1)}>
            →
          </button>
        </div>
      ) : null}
    </section>
  );
}
