import { useState } from "react";
import { animated, useSpring, useTransition } from "@react-spring/web";
import { Confetti } from "./Confetti.js";
import { springs, useReducedMotion } from "./hooks.js";

export interface LessonStep {
  title: string;
  body: string;
  /** Optional code or formula shown under the body. */
  code?: string;
  /** Optional big glyph or emoji for the step. */
  emoji?: string;
}

export interface LessonProps {
  steps: LessonStep[];
  title?: string;
  /** Fired with the step index each time it changes. */
  onStep?: (index: number) => void;
  /** Fired when the last step is completed. */
  onComplete?: () => void;
}

/**
 * A guided, one-step-at-a-time explainer. Steps slide in the direction you
 * move, a progress rail fills as you go, and the last step ends with a cheer.
 */
export function Lesson({ steps, title, onStep, onComplete }: LessonProps) {
  const reduce = useReducedMotion();
  const list = (Array.isArray(steps) ? steps : []).filter((s) => s && typeof s.title === "string");
  const [[at, dir], setAt] = useState<[number, number]>([0, 1]);
  const [done, setDone] = useState(0);
  const rail = useSpring({ p: list.length ? ((done ? list.length : at + 1) / list.length) * 100 : 0, config: springs.fill, immediate: reduce });
  const transitions = useTransition(at, {
    from: { o: 0, x: dir * 48 },
    enter: { o: 1, x: 0 },
    leave: { o: 0, x: -dir * 48, position: "absolute" as const },
    config: springs.enter,
    immediate: reduce,
  });
  if (!list.length) return <p data-agentable-motion-empty="">No steps yet.</p>;
  const go = (n: number) => {
    const next = Math.max(0, Math.min(list.length - 1, n));
    if (next === at) return;
    setAt([next, next > at ? 1 : -1]);
    onStep?.(next);
  };
  const last = at === list.length - 1;
  return (
    <section data-agentable-lesson="" aria-label={title ?? "Lesson"}>
      <header>
        {title ? <h3>{title}</h3> : <span />}
        <span>
          Step {at + 1} of {list.length}
        </span>
      </header>
      <div data-agentable-motion-track="">
        <animated.div data-agentable-motion-fill="" style={{ width: rail.p.to((p) => `${p}%`) }} />
      </div>
      <ol data-agentable-lesson-rail="" aria-label="Steps">
        {list.map((s, i) => (
          <li key={i}>
            <button type="button" aria-current={i === at ? "step" : undefined} data-state={i < at || done ? "done" : i === at ? "now" : "todo"} onClick={() => go(i)} title={s.title}>
              {i < at || done ? "✓" : i + 1}
            </button>
          </li>
        ))}
      </ol>
      <div data-agentable-lesson-stage="" aria-live="polite">
        <Confetti fire={done} count={30} />
        {transitions((style, i) => {
          const s = list[i]!;
          return (
            <animated.article data-agentable-lesson-step="" style={{ opacity: style.o, transform: style.x.to((x) => (x === 0 ? "none" : `translateX(${x}px)`)) }}>
              {s.emoji ? <span data-agentable-lesson-emoji="">{s.emoji}</span> : null}
              <h4>{s.title}</h4>
              <p>{s.body}</p>
              {s.code ? <pre>{s.code}</pre> : null}
            </animated.article>
          );
        })}
      </div>
      <div data-agentable-motion-row="">
        <button type="button" data-agentable-button="ghost" disabled={at === 0} onClick={() => go(at - 1)}>
          ← Back
        </button>
        <button
          type="button"
          data-agentable-button="primary"
          onClick={() => {
            if (!last) return go(at + 1);
            setDone((d) => d + 1);
            onComplete?.();
          }}
        >
          {last ? (done ? "Done ✓" : "Finish") : "Next →"}
        </button>
      </div>
    </section>
  );
}
