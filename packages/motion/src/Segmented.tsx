import { useId, useLayoutEffect, useRef, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { springs, useReducedMotion } from "./hooks.js";

export interface SegmentedProps {
  options: Array<string | { value: string; label: string }>;
  value?: string;
  label?: string;
  onChange?: (value: string) => void;
}

const useIsoLayoutEffect = typeof window === "undefined" ? () => {} : useLayoutEffect;

/** A segmented control whose selection pill springs between options. Bind value to ui.* and set it on change. */
export function Segmented({ options, value, label, onChange }: SegmentedProps) {
  const reduce = useReducedMotion();
  const id = useId();
  const opts = (Array.isArray(options) ? options : []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const [inner, setInner] = useState(opts[0]?.value ?? "");
  const current = value ?? inner;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [box, setBox] = useState({ x: 0, w: 0 });
  const idx = Math.max(0, opts.findIndex((o) => o.value === current));
  useIsoLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[idx];
      if (el) setBox({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    const parent = refs.current[idx]?.parentElement;
    if (parent) ro.observe(parent);
    return () => ro.disconnect();
  }, [idx, opts.length]);
  const s = useSpring({ x: box.x, w: box.w, immediate: reduce || box.w === 0, config: springs.snap });
  const pick = (v: string) => {
    setInner(v);
    onChange?.(v);
  };
  return (
    <div data-agentable-segmented="">
      {label ? (
        <span data-agentable-label="" id={`${id}-l`}>
          {label}
        </span>
      ) : null}
      <div
        role="radiogroup"
        aria-labelledby={label ? `${id}-l` : undefined}
        data-agentable-segmented-track=""
        onKeyDown={(e) => {
          const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
          if (!d || !opts.length) return;
          e.preventDefault();
          const n = (idx + d + opts.length) % opts.length;
          pick(opts[n]!.value);
          refs.current[n]?.focus();
        }}
      >
        <animated.span data-agentable-segmented-pill="" aria-hidden="true" style={{ transform: s.x.to((x) => `translateX(${x}px)`), width: s.w }} />
        {opts.map((o, i) => (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={i === idx}
            tabIndex={i === idx ? 0 : -1}
            onClick={() => pick(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
