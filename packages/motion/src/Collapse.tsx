import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animated, useSpring } from "@react-spring/web";
import { springs, useReducedMotion } from "./hooks.js";

const useIsoLayoutEffect = typeof window === "undefined" ? () => {} : useLayoutEffect;

/** Springs its height between 0 and its content's measured height. Content stays mounted. */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  useIsoLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    setH(el.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s = useSpring({ h: open ? h : 0, o: open ? 1 : 0, immediate: reduce, config: springs.enter });
  return (
    <animated.div data-agentable-collapse="" aria-hidden={!open} inert={!open || undefined} style={{ height: s.h, opacity: s.o, overflow: "hidden" }}>
      <div ref={inner}>{children}</div>
    </animated.div>
  );
}
