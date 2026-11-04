import { useState } from "react";
import { animated, useSprings } from "@react-spring/web";
import { springs, useInView, useReducedMotion } from "./hooks.js";
import { sceneColor } from "./Scene.js";

export interface Layer {
  title: string;
  detail?: string;
  /** Short note on the plane's edge, e.g. "HTTP" or "v2". */
  tag?: string;
  /** Theme token or colour for the plane's edge. */
  color?: string;
}

export interface LayersProps {
  /** Top layer first. */
  layers: Layer[];
  title?: string;
  onSelect?: (layer: Layer & { index: number }) => void;
}

/**
 * A stack of planes in 3D that pulls apart when you look at it. Pick a layer
 * to lift it out and read its detail. For architectures, protocols, anything
 * built in layers.
 */
export function Layers({ layers, title, onSelect }: LayersProps) {
  const reduce = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>();
  const list = (Array.isArray(layers) ? layers : []).filter((l) => l && typeof l.title === "string").slice(0, 8);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const spread = open || sel !== null ? 46 : 14;
  const n = list.length;
  const planes = useSprings(
    n,
    list.map((_, i) => {
      const fromTop = i;
      const lift = sel === i ? 26 : 0;
      return {
        z: seen ? (n - 1 - fromTop) * spread + lift : 0,
        o: seen ? (sel === null || sel === i ? 1 : 0.45) : 0,
        delay: reduce ? 0 : i * 60,
        immediate: reduce,
        config: springs.enter,
      };
    }),
  );
  if (!n) return null;
  const current = sel !== null ? list[sel] : null;
  return (
    <figure data-agentable-layers="" ref={ref}>
      {title ? <figcaption>{title}</figcaption> : null}
      <div data-agentable-layers-body="">
        <div
          data-agentable-layers-stage=""
          onPointerEnter={() => setOpen(true)}
          onPointerLeave={() => setOpen(false)}
          style={{ height: 150 + n * 34 + (open || sel !== null ? n * 22 : 0) }}
        >
          <div data-agentable-layers-iso="">
            {planes.map((sp, i) => {
              const l = list[i]!;
              return (
                <animated.button
                  key={i}
                  type="button"
                  data-agentable-layer=""
                  data-selected={sel === i ? "" : undefined}
                  aria-pressed={sel === i}
                  onClick={() => {
                    const next = sel === i ? null : i;
                    setSel(next);
                    if (next !== null) onSelect?.({ ...l, index: i });
                  }}
                  style={{
                    transform: sp.z.to((z) => `translateZ(${z}px)`),
                    opacity: sp.o,
                    zIndex: n - i,
                    borderColor: l.color ? sceneColor(l.color) : undefined,
                  }}
                >
                  <span>{l.title}</span>
                  {l.tag ? <small>{l.tag}</small> : null}
                </animated.button>
              );
            })}
          </div>
        </div>
        <div data-agentable-layers-detail="" aria-live="polite">
          {current ? (
            <>
              <strong>{current.title}</strong>
              {current.detail ? <p>{current.detail}</p> : null}
            </>
          ) : (
            <ol>
              {list.map((l, i) => (
                <li key={i}>
                  <button type="button" onClick={() => setSel(i)}>
                    {l.title}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </figure>
  );
}
