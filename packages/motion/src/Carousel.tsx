import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { animated, useSpring } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import { useAgentCapability, type AgentProp } from "@agentable-ui/ui";
import { springs, useReducedMotion } from "./hooks.js";

export interface CarouselProps {
  children?: ReactNode;
  title?: string;
  /** Slide labels for dots and the agent. */
  labels?: string[];
  /** Advance every n seconds; pauses on hover or focus. */
  autoplay?: number;
  onChange?: (index: number) => void;
  agent?: AgentProp;
}

/**
 * Swipeable slides of any content. Drag with rubber-banding at the ends,
 * arrows and dots, ←/→ when focused, and an optional agent tool to go to a slide.
 */
export function Carousel({ children, title, labels, autoplay, onChange, agent }: CarouselProps) {
  const reduce = useReducedMotion();
  const slides = Children.toArray(children);
  const n = slides.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const width = useRef(0);
  const viewport = useRef<HTMLDivElement>(null);
  const [s, api] = useSpring(() => ({ x: 0, config: springs.enter }));

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(n - 1, next));
    setI(clamped);
    onChange?.(clamped);
  };
  useEffect(() => {
    void api.start({ x: -i * 100, immediate: reduce });
  }, [i, api, reduce]);
  useEffect(() => {
    if (!autoplay || paused || n < 2 || reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), autoplay * 1000);
    return () => clearInterval(t);
  }, [autoplay, paused, n, reduce]);

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], first, cancel }) => {
      if (first) width.current = viewport.current?.offsetWidth || 1;
      const pct = (mx / width.current) * 100;
      const atEdge = (i === 0 && mx > 0) || (i === n - 1 && mx < 0);
      if (active) {
        void api.start({ x: -i * 100 + (atEdge ? pct * 0.25 : pct), immediate: true });
        if (Math.abs(pct) > 60) cancel();
        return;
      }
      if (Math.abs(pct) > 18 || vx > 0.5) go(i + (dx > 0 || mx > 0 ? -1 : 1));
      else void api.start({ x: -i * 100 });
    },
    { axis: "x", filterTaps: true, pointer: { touch: true } },
  );

  const name = (k: number) => labels?.[k] ?? `Slide ${k + 1}`;
  useAgentCapability<{ slide: number }, unknown>("carousel", agent, {
    description: `Show a slide of the carousel${title ? ` "${title}"` : ""}. Slides: ${Array.from({ length: n }, (_, k) => `${k}: ${name(k)}`).join(", ")}.`,
    inputSchema: { type: "object", properties: { slide: { type: "integer", minimum: 0, maximum: Math.max(0, n - 1) } }, required: ["slide"] },
    annotations: { readOnlyHint: false, consequentialHint: false },
    confirm: false,
    execute: ({ slide }) => {
      go(slide);
      return { slide, label: name(slide) };
    },
  });

  if (!n) return null;
  return (
    <section
      data-agentable-carousel=""
      aria-roledescription="carousel"
      aria-label={title ?? "Carousel"}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(i + 1);
        if (e.key === "ArrowLeft") go(i - 1);
      }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {title ? <h3>{title}</h3> : null}
      <div data-agentable-carousel-viewport="" ref={viewport} {...bind()} style={{ touchAction: "pan-y" }}>
        <animated.div data-agentable-carousel-track="" style={{ transform: s.x.to((x) => `translate3d(${x}%, 0, 0)`) }}>
          {slides.map((slide, k) => (
            <div key={k} data-agentable-carousel-slide="" role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${n}: ${name(k)}`} aria-hidden={k !== i} inert={k !== i || undefined}>
              {slide}
            </div>
          ))}
        </animated.div>
      </div>
      {n > 1 ? (
        <div data-agentable-carousel-nav="">
          <button type="button" data-agentable-button="ghost" aria-label="Previous slide" disabled={i === 0} onClick={() => go(i - 1)}>
            ←
          </button>
          <div data-agentable-carousel-dots="">
            {slides.map((_, k) => (
              <button key={k} type="button" aria-label={`Go to ${name(k)}`} aria-current={k === i} onClick={() => go(k)} />
            ))}
          </div>
          <button type="button" data-agentable-button="ghost" aria-label="Next slide" disabled={i === n - 1} onClick={() => go(i + 1)}>
            →
          </button>
        </div>
      ) : null}
    </section>
  );
}
