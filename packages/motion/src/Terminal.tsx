import { useEffect, useState } from "react";
import { useInView, useReducedMotion } from "./hooks.js";

export interface TerminalProps {
  /** Lines to show. Lines starting with "$ " are typed as commands; others print as output. */
  lines: string[];
  title?: string;
  /** Characters per second for commands. */
  speed?: number;
}

/** A terminal window that types its commands out and prints their output, once it scrolls into view. */
export function Terminal({ lines, title = "zsh", speed = 42 }: TerminalProps) {
  const reduce = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>();
  const all = (Array.isArray(lines) ? lines : []).map(String);
  const [line, setLine] = useState(0);
  const [chars, setChars] = useState(0);
  const sig = all.join("\n");

  useEffect(() => {
    setLine(0);
    setChars(0);
  }, [sig]);

  const finished = reduce || line >= all.length;
  useEffect(() => {
    if (!seen || finished) return;
    const cur = all[line] ?? "";
    const isCmd = cur.startsWith("$ ");
    if (!isCmd) {
      const t = setTimeout(() => {
        setLine((l) => l + 1);
        setChars(0);
      }, 90);
      return () => clearTimeout(t);
    }
    if (chars < cur.length) {
      const t = setTimeout(() => setChars((c) => c + 1), 1000 / speed + (Math.random() * 30 - 10));
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setLine((l) => l + 1);
      setChars(0);
    }, 380);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, line, chars, finished, sig, speed]);

  const shown = finished ? all : [...all.slice(0, line), ...(all[line]?.startsWith("$ ") ? [all[line]!.slice(0, Math.max(2, chars))] : [])];
  return (
    <div data-agentable-terminal="" ref={ref}>
      <div data-agentable-terminal-bar="" aria-hidden="true">
        <span data-agentable-device-lights="">
          <i />
          <i />
          <i />
        </span>
        <span>{title}</span>
        <span />
      </div>
      <pre aria-label={all.join("\n")}>
        <code aria-hidden="true">
          {shown.map((l, i) => (
            <span key={i} data-kind={l.startsWith("$ ") ? "cmd" : "out"}>
              {l.startsWith("$ ") ? (
                <>
                  <b>$</b>
                  {l.slice(1)}
                </>
              ) : (
                l
              )}
              {"\n"}
            </span>
          ))}
          <span data-agentable-terminal-caret="" />
        </code>
      </pre>
    </div>
  );
}
