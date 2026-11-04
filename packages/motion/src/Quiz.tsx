import { useEffect, useMemo, useRef, useState } from "react";
import { animated, to, useSpring, useTransition } from "@react-spring/web";
import { Confetti } from "./Confetti.js";
import { Ring } from "./Rings.js";
import { springs, useReducedMotion } from "./hooks.js";
import { Collapse } from "./Collapse.js";

export interface QuizQuestion {
  question: string;
  choices: string[];
  /** Index of the correct choice. */
  answer: number;
  explain?: string;
}

export interface QuizAnswer {
  index: number;
  choice: string;
  correct: boolean;
}

export interface QuizProps {
  questions: QuizQuestion[];
  title?: string;
  onAnswer?: (answer: QuizAnswer) => void;
  onFinish?: (result: { score: number; total: number }) => void;
}

const LETTERS = "ABCDEFGH";

function Choice({ text, i, state, onPick, disabled }: { text: string; i: number; state: "idle" | "right" | "wrong" | "reveal"; onPick: () => void; disabled: boolean }) {
  const reduce = useReducedMotion();
  const [s, api] = useSpring(() => ({ x: 0, sc: 1 }));
  useEffect(() => {
    if (reduce) return;
    if (state === "wrong") void api.start({ to: [{ x: -9 }, { x: 8 }, { x: -6 }, { x: 4 }, { x: 0 }], config: { tension: 900, friction: 18 } });
    if (state === "right") void api.start({ to: [{ sc: 1.045 }, { sc: 1 }], config: springs.wobble });
  }, [state, api, reduce]);
  return (
    <animated.button
      type="button"
      data-agentable-quiz-choice={state}
      disabled={disabled}
      aria-pressed={state === "right" || state === "wrong"}
      onClick={onPick}
      style={{ transform: to([s.x, s.sc], (x, sc) => `translateX(${x}px) scale(${sc})`) }}
    >
      <span data-agentable-quiz-letter="">{state === "right" || state === "reveal" ? "✓" : state === "wrong" ? "✕" : LETTERS[i]}</span>
      <span>{text}</span>
    </animated.button>
  );
}

/**
 * A multiple-choice quiz, one question at a time. Wrong picks shake and
 * reveal the right one, the explanation springs open, streaks are counted,
 * and the end shows a score ring.
 */
export function Quiz({ questions, title, onAnswer, onFinish }: QuizProps) {
  const reduce = useReducedMotion();
  const qs = useMemo(
    () => (Array.isArray(questions) ? questions.filter((q) => q && typeof q.question === "string" && Array.isArray(q.choices) && q.choices.length > 1) : []),
    [questions],
  );
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const finished = at >= qs.length && qs.length > 0;
  const reported = useRef(false);

  useEffect(() => {
    if (finished && !reported.current) {
      reported.current = true;
      onFinish?.({ score, total: qs.length });
    }
  }, [finished, score, qs.length, onFinish]);

  const [flame, flameApi] = useSpring(() => ({ s: 1 }));
  useEffect(() => {
    if (streak >= 2) void flameApi.start({ from: { s: 0.4 }, to: { s: 1 }, config: springs.wobble, immediate: reduce });
  }, [streak, flameApi, reduce]);

  const transitions = useTransition(finished ? -1 : at, {
    key: `${attempt}:${finished ? "end" : at}`,
    from: { o: 0, x: 40 },
    enter: { o: 1, x: 0 },
    leave: { o: 0, x: -40, position: "absolute" as const },
    config: springs.enter,
    immediate: reduce,
  });

  if (!qs.length) return <p data-agentable-motion-empty="">No questions yet.</p>;

  const pick = (i: number) => {
    if (picked !== null) return;
    const q = qs[at]!;
    const correct = i === q.answer;
    setPicked(i);
    if (correct) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else setStreak(0);
    onAnswer?.({ index: at, choice: q.choices[i] ?? "", correct });
  };
  const next = () => {
    setPicked(null);
    setAt((a) => a + 1);
  };
  const retry = () => {
    setAt(0);
    setPicked(null);
    setScore(0);
    setStreak(0);
    setAttempt((a) => a + 1);
    reported.current = false;
  };
  const pct = qs.length ? score / qs.length : 0;

  return (
    <section data-agentable-quiz="" aria-label={title ?? "Quiz"}>
      <header>
        {title ? <h3>{title}</h3> : <span />}
        <span data-agentable-quiz-meta="">
          {streak >= 2 && !finished ? (
            <animated.span data-agentable-quiz-streak="" style={{ transform: flame.s.to((s) => `scale(${s})`) }}>
              🔥 {streak}
            </animated.span>
          ) : null}
          <span>{finished ? `${qs.length}/${qs.length}` : `${at + 1}/${qs.length}`}</span>
        </span>
      </header>
      <div data-agentable-quiz-dots="" aria-hidden="true">
        {qs.map((_, i) => (
          <i key={i} data-state={i < at ? "done" : i === at && !finished ? "now" : "todo"} />
        ))}
      </div>
      <div data-agentable-quiz-stage="">
        {transitions((style, idx) =>
          idx === -1 ? (
            <animated.div data-agentable-quiz-end="" role="status" style={{ opacity: style.o, transform: style.x.to((x) => `translateX(${x}px)`) }}>
              <Confetti fire={pct >= 0.7 ? attempt + 1 : 0} />
              <Ring value={score} max={qs.length} size={132} label={`${Math.round(pct * 100)}%`} sublabel={`${score} of ${qs.length}`} color={pct >= 0.7 ? "var(--ag-success)" : pct >= 0.4 ? "var(--ag-warning)" : "var(--ag-danger)"} />
              <strong>{pct === 1 ? "Perfect score!" : pct >= 0.7 ? "Nicely done." : pct >= 0.4 ? "Getting there." : "Worth another go."}</strong>
              <button type="button" data-agentable-button="primary" onClick={retry}>
                Try again
              </button>
            </animated.div>
          ) : (
            <animated.div data-agentable-quiz-card="" style={{ opacity: style.o, transform: style.x.to((x) => `translateX(${x}px)`) }}>
              <p data-agentable-quiz-question="">{qs[idx]!.question}</p>
              <div data-agentable-quiz-choices="" role="group">
                {qs[idx]!.choices.map((c, i) => {
                  const q = qs[idx]!;
                  const showing = idx === at ? picked : null;
                  const state = showing === null ? "idle" : i === showing ? (i === q.answer ? "right" : "wrong") : i === q.answer ? "reveal" : "idle";
                  return <Choice key={i} i={i} text={c} state={state} disabled={showing !== null} onPick={() => pick(i)} />;
                })}
              </div>
              <Collapse open={idx === at && picked !== null}>
                <div data-agentable-quiz-feedback="" data-correct={picked === qs[idx]!.answer ? "" : undefined} role="status">
                  <strong>{picked === qs[idx]!.answer ? "Correct." : `Not quite — it's ${LETTERS[qs[idx]!.answer]}.`}</strong>
                  {qs[idx]!.explain ? <p>{qs[idx]!.explain}</p> : null}
                  <button type="button" data-agentable-button="primary" onClick={next}>
                    {at + 1 < qs.length ? "Next question →" : "See results"}
                  </button>
                </div>
              </Collapse>
            </animated.div>
          ),
        )}
      </div>
    </section>
  );
}
