import { animated, useTrail } from "@react-spring/web";
import { useInView, useReducedMotion } from "./hooks.js";

export interface HeadlineProps {
  text: string;
  /** Small label above, e.g. "Week 42". */
  eyebrow?: string;
  /** Supporting line below. */
  sub?: string;
  /** Words to paint with the accent gradient, matched case-insensitively. */
  highlight?: string[];
  size?: "md" | "lg" | "xl";
}

/** A hero headline that rises in word by word, with optional gradient highlights. */
export function Headline({ text, eyebrow, sub, highlight, size = "lg" }: HeadlineProps) {
  const reduce = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>();
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const marks = new Set((highlight ?? []).map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")));
  const trail = useTrail(words.length + 2, {
    from: { o: 0, y: 22, b: 6 },
    to: seen ? { o: 1, y: 0, b: 0 } : { o: 0, y: 22, b: 6 },
    immediate: reduce,
    config: { tension: 300, friction: 26 },
  });
  const st = (i: number) => {
    const t = trail[i]!;
    return { opacity: t.o, transform: t.y.to((y) => (y === 0 ? "none" : `translateY(${y}px)`)), filter: t.b.to((b) => (b > 0.05 ? `blur(${b}px)` : "none")) };
  };
  return (
    <div data-agentable-headline={size} ref={ref}>
      {eyebrow ? (
        <animated.span data-agentable-headline-eyebrow="" style={st(0)}>
          {eyebrow}
        </animated.span>
      ) : null}
      <h2 aria-label={text}>
        {words.map((w, i) => (
          <animated.span key={i} aria-hidden="true" data-mark={marks.has(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")) ? "" : undefined} style={st(Math.min(i, words.length - 1))}>
            {w}
            {i < words.length - 1 ? " " : ""}
          </animated.span>
        ))}
      </h2>
      {sub ? (
        <animated.p data-agentable-headline-sub="" style={st(words.length + 1)}>
          {sub}
        </animated.p>
      ) : null}
    </div>
  );
}
