import { useId, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { Collapse } from "./Collapse.js";
import { springs, useReducedMotion } from "./hooks.js";

export interface AccordionItem {
  title: string;
  body: string;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Allow several sections open at once. */
  multiple?: boolean;
  /** Index open at first. */
  open?: number;
  onToggle?: (item: { index: number; open: boolean; title: string }) => void;
}

function Chevron({ open }: { open: boolean }) {
  const reduce = useReducedMotion();
  const s = useSpring({ r: open ? 180 : 0, immediate: reduce, config: springs.snap });
  return (
    <animated.svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: s.r.to((r) => `rotate(${r}deg)`) }}>
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </animated.svg>
  );
}

/** Expandable sections that spring open. Good for FAQs, steps and "show the details". */
export function Accordion({ items, multiple = false, open, onToggle }: AccordionProps) {
  const id = useId();
  const list = Array.isArray(items) ? items : [];
  const [openSet, setOpenSet] = useState<Set<number>>(() => new Set(typeof open === "number" ? [open] : []));
  const toggle = (i: number) => {
    const willOpen = !openSet.has(i);
    setOpenSet((prev) => {
      const next = new Set(multiple ? prev : []);
      if (willOpen) next.add(i);
      else next.delete(i);
      return next;
    });
    onToggle?.({ index: i, open: willOpen, title: list[i]?.title ?? "" });
  };
  return (
    <div data-agentable-accordion="">
      {list.map((it, i) => {
        const isOpen = openSet.has(i);
        return (
          <div key={i} data-agentable-accordion-item="" data-open={isOpen ? "" : undefined}>
            <button type="button" id={`${id}-h${i}`} aria-expanded={isOpen} aria-controls={`${id}-p${i}`} onClick={() => toggle(i)}>
              <span>{it.title}</span>
              <Chevron open={isOpen} />
            </button>
            <div id={`${id}-p${i}`} role="region" aria-labelledby={`${id}-h${i}`}>
              <Collapse open={isOpen}>
                <p>{it.body}</p>
              </Collapse>
            </div>
          </div>
        );
      })}
    </div>
  );
}
