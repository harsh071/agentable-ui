import { useEffect, useRef } from "react";
import { animated, useSpring } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import { springs, useReducedMotion } from "./hooks.js";

export interface CompareProps {
  /** https URL of the "before" image. */
  before: string;
  /** https URL of the "after" image. */
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  alt?: string;
  /** Starting split, 0-100. */
  start?: number;
}

/** A before/after image slider. Drag anywhere, or focus the handle and use ←/→. */
export function Compare({ before, after, beforeLabel = "Before", afterLabel = "After", alt = "", start = 50 }: CompareProps) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [s, api] = useSpring(() => ({ p: reduce ? start : 8, config: springs.soft }));
  // A small "peek" on mount shows the slider moves.
  useEffect(() => {
    void api.start({ p: start, delay: 250, immediate: reduce, config: springs.wobble });
  }, [api, start, reduce]);

  const setFromX = (clientX: number, immediate: boolean) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    void api.start({ p: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)), immediate });
  };
  const bind = useDrag(({ xy: [x], active }) => setFromX(x, active), { pointer: { touch: true } });

  return (
    <figure data-agentable-compare="">
      <div data-agentable-compare-box="" ref={box} {...bind()} style={{ touchAction: "pan-y" }}>
        <img src={after} alt={alt ? `${alt} (${afterLabel})` : afterLabel} loading="lazy" draggable={false} />
        <animated.div data-agentable-compare-before="" style={{ clipPath: s.p.to((p) => `inset(0 ${100 - p}% 0 0)`) }}>
          <img src={before} alt={alt ? `${alt} (${beforeLabel})` : beforeLabel} loading="lazy" draggable={false} />
        </animated.div>
        <span data-agentable-compare-label="before">{beforeLabel}</span>
        <span data-agentable-compare-label="after">{afterLabel}</span>
        <animated.div data-agentable-compare-handle="" style={{ left: s.p.to((p) => `${p}%`) }}>
          <button
            type="button"
            role="slider"
            aria-label={`${beforeLabel} / ${afterLabel} split`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(s.p.get())}
            onKeyDown={(e) => {
              const d = e.key === "ArrowLeft" ? -5 : e.key === "ArrowRight" ? 5 : 0;
              if (d) {
                e.preventDefault();
                void api.start({ p: Math.max(0, Math.min(100, s.p.get() + d)) });
              }
            }}
          >
            ‹ ›
          </button>
        </animated.div>
      </div>
    </figure>
  );
}
