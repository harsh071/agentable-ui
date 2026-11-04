import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animated, to, useSpring } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import { useAgentCapability, type AgentProp } from "@agentable-ui/ui";
import { Confetti } from "./Confetti.js";
import { springs, useReducedMotion } from "./hooks.js";

export interface Flashcard {
  front: string;
  back: string;
  hint?: string;
}

export interface FlashcardGrade {
  index: number;
  card: Flashcard;
  known: boolean;
}

export interface FlashcardsProps {
  cards: Flashcard[];
  title?: string;
  /** Fired each time a card is graded. */
  onGrade?: (grade: FlashcardGrade) => void;
  /** Fired when every card is known. */
  onFinish?: (result: { total: number; firstTry: number; reviews: number }) => void;
  /** Lets an agent flip, grade and read the deck. */
  agent?: AgentProp;
}

type Dir = 1 | -1;

interface CardViewProps {
  card: Flashcard;
  pos: number;
  flipped: boolean;
  onFlip: () => void;
  onGone: (dir: Dir) => void;
  throwRef: React.MutableRefObject<((dir: Dir) => void) | null>;
}

function CardView({ card, pos, flipped, onFlip, onGone, throwRef }: CardViewProps) {
  const reduce = useReducedMotion();
  const top = pos === 0;
  const [s, api] = useSpring(() => ({ x: 0, rot: 0, y: pos * 14, scale: 1 - pos * 0.05, flip: 0, o: 1, config: springs.enter, immediate: reduce }));
  const gone = useRef(false);

  useEffect(() => {
    api.start({ y: pos * 14, scale: 1 - pos * 0.05, immediate: reduce });
  }, [pos, api, reduce]);
  useEffect(() => {
    api.start({ flip: flipped ? 180 : 0, config: { tension: 260, friction: 22 }, immediate: reduce });
  }, [flipped, api, reduce]);

  const fling = useCallback(
    (dir: Dir, vx = 0.5) => {
      if (gone.current) return;
      gone.current = true;
      api.start({
        x: dir * (typeof window === "undefined" ? 700 : window.innerWidth * 0.9),
        rot: dir * 22 + vx * dir * 10,
        o: 0,
        immediate: reduce,
        config: { tension: 200, friction: 30 },
        onRest: () => onGone(dir),
      });
    },
    [api, onGone, reduce],
  );
  if (top) throwRef.current = fling;

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], tap }) => {
      if (tap) return onFlip();
      if (!active && (Math.abs(mx) > 110 || (vx > 0.6 && Math.abs(mx) > 30))) return fling((mx > 0 ? 1 : -1) as Dir, vx);
      void dx;
      api.start({ x: active ? mx : 0, rot: active ? mx / 14 : 0, scale: active ? 1.03 : 1, immediate: (k) => active && k === "x", config: springs.snap });
    },
    { enabled: top, filterTaps: true, axis: "x" },
  );

  return (
    <animated.div
      data-agentable-flashcard=""
      data-pos={pos}
      {...(top ? bind() : {})}
      style={{
        zIndex: 10 - pos,
        opacity: s.o,
        transform: to([s.x, s.y, s.rot, s.scale], (x, y, r, sc) => `translate3d(${x}px, ${y}px, 0) rotate(${r}deg) scale(${sc})`),
        touchAction: "pan-y",
      }}
    >
      <animated.div data-agentable-flashcard-inner="" style={{ transform: s.flip.to((f) => `perspective(1200px) rotateY(${f}deg)`) }}>
        <div data-agentable-flashcard-face="front" aria-hidden={flipped}>
          <span data-agentable-flashcard-tag="">Question</span>
          <p>{card.front}</p>
          {card.hint ? <small>Hint: {card.hint}</small> : null}
          <span data-agentable-flashcard-cue="">Tap to flip</span>
        </div>
        <div data-agentable-flashcard-face="back" aria-hidden={!flipped}>
          <span data-agentable-flashcard-tag="">Answer</span>
          <p>{card.back}</p>
          <span data-agentable-flashcard-cue="">Swipe → if you knew it, ← to see it again</span>
        </div>
      </animated.div>
      {top ? (
        <>
          <animated.span data-agentable-flashcard-stamp="know" style={{ opacity: s.x.to((x) => Math.max(0, Math.min(1, x / 110))) }}>
            Got it
          </animated.span>
          <animated.span data-agentable-flashcard-stamp="again" style={{ opacity: s.x.to((x) => Math.max(0, Math.min(1, -x / 110))) }}>
            Again
          </animated.span>
        </>
      ) : null}
    </animated.div>
  );
}

/**
 * A swipeable study deck. Tap or press Space to flip; swipe right (→) when you
 * knew it, left (←) to see it again later. Missed cards go to the back of the
 * deck until every card is known.
 */
export function Flashcards({ cards, title, onGrade, onFinish, agent }: FlashcardsProps) {
  const safe = useMemo(() => (Array.isArray(cards) ? cards.filter((c) => c && typeof c.front === "string") : []), [cards]);
  const [queue, setQueue] = useState<number[]>(() => safe.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(() => new Set());
  const [missed, setMissed] = useState<Set<number>>(() => new Set());
  const [reviews, setReviews] = useState(0);
  const [round, setRound] = useState(0);
  // How many times each card has re-entered the deck; part of its key so a returning card mounts fresh.
  const [laps, setLaps] = useState<Record<number, number>>({});
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const throwRef = useRef<((dir: Dir) => void) | null>(null);
  const finishedRef = useRef(false);

  // A new set of cards starts a new deck.
  const sig = safe.map((c) => c.front).join("\u0000");
  useEffect(() => {
    setQueue(safe.map((_, i) => i));
    setKnown(new Set());
    setMissed(new Set());
    setReviews(0);
    setLaps({});
    setFlipped(false);
    finishedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const done = safe.length > 0 && queue.length === 0;
  const progress = safe.length ? known.size / safe.length : 0;
  const bar = useSpring({ p: progress * 100, config: springs.fill });

  const onGone = useCallback(
    (dir: Dir) => {
      const head = queueRef.current[0];
      if (head === undefined) return;
      const isKnown = dir === 1;
      const rest = queueRef.current.slice(1);
      if (isKnown) {
        setKnown((k) => new Set(k).add(head));
        setQueue(rest);
      } else {
        setMissed((m) => new Set(m).add(head));
        setReviews((r) => r + 1);
        setLaps((l) => ({ ...l, [head]: (l[head] ?? 0) + 1 }));
        setQueue([...rest, head]);
      }
      setFlipped(false);
      onGrade?.({ index: head, card: safe[head]!, known: isKnown });
    },
    [onGrade, safe],
  );

  useEffect(() => {
    if (done && !finishedRef.current) {
      finishedRef.current = true;
      setRound((r) => r + 1);
      onFinish?.({ total: safe.length, firstTry: safe.length - missed.size, reviews });
    }
  }, [done, onFinish, safe.length, missed.size, reviews]);

  const restart = (onlyMissed: boolean) => {
    const next = onlyMissed ? [...missed] : safe.map((_, i) => i);
    setQueue(next);
    setKnown(onlyMissed ? new Set(safe.map((_, i) => i).filter((i) => !missed.has(i))) : new Set());
    setMissed(new Set());
    setReviews(0);
    setFlipped(false);
    finishedRef.current = false;
  };

  const grade = (dir: Dir) => throwRef.current?.(dir);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (done) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setFlipped((f) => !f);
    } else if (e.key === "ArrowRight") grade(1);
    else if (e.key === "ArrowLeft") grade(-1);
  };

  const stateRef = useRef({ queue, flipped, known, safe });
  stateRef.current = { queue, flipped, known, safe };
  useAgentCapability<{ action: "state" | "flip" | "know" | "again" }, unknown>("flashcards", agent, {
    description: `A flashcard deck${title ? ` "${title}"` : ""} of ${safe.length} cards. action: state reads the current card; flip turns it; know/again grades it.`,
    inputSchema: { type: "object", properties: { action: { type: "string", enum: ["state", "flip", "know", "again"] } }, required: ["action"] },
    annotations: { readOnlyHint: false, consequentialHint: false },
    confirm: false,
    execute: ({ action }) => {
      const st = stateRef.current;
      const head = st.queue[0];
      if (action === "flip") setFlipped((f) => !f);
      if (action === "know") grade(1);
      if (action === "again") grade(-1);
      return { remaining: st.queue.length, known: st.known.size, total: st.safe.length, current: head === undefined ? null : { front: st.safe[head]!.front, back: st.flipped || action === "flip" ? st.safe[head]!.back : undefined } };
    },
  });

  if (!safe.length) return <p data-agentable-motion-empty="">No cards yet.</p>;

  return (
    <section data-agentable-flashcards="" tabIndex={0} onKeyDown={onKeyDown} aria-roledescription="flashcard deck" aria-label={title ?? "Flashcards"}>
      <header>
        {title ? <h3>{title}</h3> : <span />}
        <span data-agentable-flashcards-count="">
          {known.size}/{safe.length}
        </span>
      </header>
      <div data-agentable-motion-track="">
        <animated.div data-agentable-motion-fill="" style={{ width: bar.p.to((p) => `${p}%`) }} />
      </div>
      <div data-agentable-flashcards-stage="">
        {done ? (
          <div data-agentable-flashcards-done="" role="status">
            <Confetti fire={round} />
            <strong>Deck complete</strong>
            <p>
              {safe.length - missed.size} of {safe.length} on the first try{reviews ? `, ${reviews} review${reviews === 1 ? "" : "s"}` : ""}.
            </p>
            <div data-agentable-motion-row="">
              {missed.size ? (
                <button type="button" data-agentable-button="primary" onClick={() => restart(true)}>
                  Review {missed.size} missed
                </button>
              ) : null}
              <button type="button" data-agentable-button="" onClick={() => restart(false)}>
                Study again
              </button>
            </div>
          </div>
        ) : (
          queue
            .slice(0, 3)
            .map((idx, pos) => <CardView key={`${idx}.${laps[idx] ?? 0}`} card={safe[idx]!} pos={pos} flipped={pos === 0 && flipped} onFlip={() => setFlipped((f) => !f)} onGone={onGone} throwRef={throwRef} />)
            .reverse()
        )}
      </div>
      {!done ? (
        <div data-agentable-motion-row="" data-agentable-flashcards-actions="">
          <button type="button" data-agentable-button="" onClick={() => grade(-1)} aria-keyshortcuts="ArrowLeft">
            ← Again
          </button>
          <button type="button" data-agentable-button="ghost" onClick={() => setFlipped((f) => !f)} aria-keyshortcuts="Space">
            Flip
          </button>
          <button type="button" data-agentable-button="primary" onClick={() => grade(1)} aria-keyshortcuts="ArrowRight">
            Got it →
          </button>
        </div>
      ) : null}
    </section>
  );
}
