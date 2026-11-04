import { useEffect, useMemo, useRef } from "react";
import { animated, to, useSpring, type SpringValue } from "@react-spring/web";
import { springs, useInView, useReducedMotion } from "./hooks.js";

export type SceneShape = "circle" | "square" | "ring" | "pill" | "triangle" | "diamond";
export type SceneMotion = "none" | "float" | "bob" | "spin" | "pulse" | "orbit" | "drift" | "sway";

export interface SceneItem {
  /** shape (default), text, glyph (an emoji or symbol), image, or line. */
  kind?: "shape" | "text" | "glyph" | "image" | "line";
  shape?: SceneShape;
  /** Centre position, 0-100 (% of the stage). For a line, its start. */
  x: number;
  y: number;
  /** Line end, 0-100. */
  x2?: number;
  y2?: number;
  /** Size in px (shapes, glyphs, images). w/h override for non-square shapes. */
  size?: number;
  w?: number;
  h?: number;
  /** Depth, -100 (far) to 100 (near): parallax under the pointer and 3D depth when the stage tilts. */
  z?: number;
  rotate?: number;
  /** Theme token (accent, ink, muted, line, panel, bg, success, warning, danger, s1-s5) or a hex / rgb() / hsl() colour. */
  color?: string;
  opacity?: number;
  /** text / glyph content, or alt text for an image. */
  text?: string;
  /** image: https URL. */
  src?: string;
  /** text weight, 300-800. */
  weight?: number;
  motion?: SceneMotion;
  /** 0.25-3. */
  speed?: number;
  /** Delay before this item enters, in ms. */
  delay?: number;
  /** orbit: radius in px around (x, y). */
  radius?: number;
}

export interface SceneProps {
  items: SceneItem[];
  /** Stage height in px. Default 320. */
  height?: number;
  /** none, panel, ink (dark), grid or dots. */
  background?: "none" | "panel" | "ink" | "grid" | "dots";
  /** Tilt the whole stage in 3D toward the pointer. */
  tilt?: boolean;
  /** What the scene shows, for screen readers. */
  label?: string;
  /** Short caption under the stage. */
  caption?: string;
}

const TOKENS: Record<string, string> = {
  accent: "var(--ag-accent)",
  ink: "var(--ag-fg)",
  fg: "var(--ag-fg)",
  muted: "var(--ag-muted)",
  line: "var(--ag-line)",
  panel: "var(--ag-panel)",
  bg: "var(--ag-bg)",
  success: "var(--ag-success)",
  warning: "var(--ag-warning)",
  danger: "var(--ag-danger)",
  s1: "var(--ag-series-1)",
  s2: "var(--ag-series-2)",
  s3: "var(--ag-series-3)",
  s4: "var(--ag-series-4)",
  s5: "var(--ag-series-5)",
};
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\(\s*[\d.%\s,/-]+\))$/i;

/** Theme token or a validated literal colour; anything else falls back to ink. */
export function sceneColor(c: string | undefined, fallback = "var(--ag-fg)"): string {
  if (!c) return fallback;
  const t = TOKENS[c.trim().toLowerCase()];
  if (t) return t;
  return SAFE_COLOR.test(c.trim()) ? c.trim() : fallback;
}

const num = (n: unknown, lo: number, hi: number, d: number) => (typeof n === "number" && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d);
const SAFE_SRC = /^https:\/\//i;

function ShapeBody({ it, color }: { it: SceneItem; color: string }) {
  const shape = it.shape ?? "circle";
  const style: React.CSSProperties = {};
  if (shape === "ring") style.boxShadow = `inset 0 0 0 ${Math.max(2, (it.size ?? 40) * 0.09)}px ${color}`;
  else if (shape === "triangle") {
    style.background = color;
    style.clipPath = "polygon(50% 4%, 96% 92%, 4% 92%)";
  } else style.background = color;
  return <span data-agentable-scene-shape={shape} style={style} />;
}

function SceneNode({ it, index, live, px, py, tilt }: { it: SceneItem; index: number; live: boolean; px: SpringValue<number>; py: SpringValue<number>; tilt: boolean }) {
  const reduce = useReducedMotion();
  const kind = it.kind ?? "shape";
  const z = num(it.z, -100, 100, 0);
  const speed = num(it.speed, 0.25, 3, 1);
  const color = sceneColor(it.color, kind === "shape" ? "var(--ag-accent)" : "var(--ag-fg)");
  const motion = it.motion ?? "none";
  const radius = num(it.radius, 4, 400, 60);

  // Entrance: each item pops in on its own, in order.
  const enter = useSpring({ e: live ? 1 : 0, delay: reduce ? 0 : num(it.delay, 0, 10000, index * 70), immediate: reduce, config: springs.enter });
  // Loop phase.
  const [loop, api] = useSpring(() => ({ t: 0 }));
  useEffect(() => {
    if (reduce || !live || motion === "none") return;
    if (motion === "spin" || motion === "orbit") void api.start({ from: { t: 0 }, to: { t: 1 }, loop: true, config: { duration: (motion === "orbit" ? 8000 : 10000) / speed } });
    else void api.start({ from: { t: 0 }, to: { t: 1 }, loop: { reverse: true }, config: { tension: 16 * speed, friction: 7 } });
    return () => {
      api.stop();
    };
  }, [motion, speed, live, reduce, api]);

  if (kind === "line") return null;
  const size = num(it.size, 4, 600, kind === "text" ? 18 : 40);
  const w = num(it.w, 2, 1200, size);
  const h = num(it.h, 2, 1200, kind === "shape" && it.shape === "pill" ? size * 0.42 : size);
  const baseRot = num(it.rotate, -360, 360, 0);
  const depth = z / 100;

  const transform = to([enter.e, loop.t, px, py], (e, t, x, y) => {
    let dx = x * depth * 22;
    let dy = y * depth * 22;
    let r = baseRot;
    let s = 0.6 + e * 0.4;
    if (motion === "float") dy -= t * 10;
    if (motion === "bob") {
      dy -= t * 5;
      r += t * 3;
    }
    if (motion === "drift") {
      dx += t * 14;
      dy -= t * 8;
    }
    if (motion === "sway") r += (t - 0.5) * 10;
    if (motion === "pulse") s *= 1 + t * 0.12;
    if (motion === "spin") r += t * 360;
    if (motion === "orbit") {
      dx += Math.cos(t * Math.PI * 2) * radius;
      dy += Math.sin(t * Math.PI * 2) * radius * 0.62;
    }
    const tz = tilt ? ` translateZ(${z * 0.8}px)` : "";
    return `translate(-50%, -50%) translate3d(${dx}px, ${dy + (1 - e) * 16}px, 0)${tz} rotate(${r}deg) scale(${s})`;
  });

  const style = {
    left: `${num(it.x, -20, 120, 50)}%`,
    top: `${num(it.y, -20, 120, 50)}%`,
    width: kind === "text" ? undefined : w,
    height: kind === "text" ? undefined : h,
    opacity: enter.e.to((e) => e * num(it.opacity, 0, 1, 1)),
    transform,
    zIndex: Math.round(z + 200),
    color,
  };

  if (kind === "text")
    return (
      <animated.span data-agentable-scene-item="text" style={{ ...style, fontSize: size, fontWeight: num(it.weight, 300, 800, 600) }}>
        {it.text}
      </animated.span>
    );
  if (kind === "glyph")
    return (
      <animated.span data-agentable-scene-item="glyph" style={{ ...style, fontSize: size * 0.82 }}>
        {it.text}
      </animated.span>
    );
  if (kind === "image")
    return it.src && SAFE_SRC.test(it.src) ? (
      <animated.span data-agentable-scene-item="image" style={style}>
        <img src={it.src} alt={it.text ?? ""} loading="lazy" draggable={false} />
      </animated.span>
    ) : null;
  return (
    <animated.span data-agentable-scene-item="shape" style={style}>
      <ShapeBody it={it} color={color} />
    </animated.span>
  );
}

function SceneLines({ items, live }: { items: SceneItem[]; live: boolean }) {
  const reduce = useReducedMotion();
  const lines = items.map((it, i) => ({ it, i })).filter(({ it }) => it.kind === "line");
  const s = useSpring({ d: live ? 0 : 1, immediate: reduce, delay: 200, config: { tension: 60, friction: 20 } });
  if (!lines.length) return null;
  return (
    <svg data-agentable-scene-lines="" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {lines.map(({ it, i }) => {
        const x1 = num(it.x, -20, 120, 0);
        const y1 = num(it.y, -20, 120, 0);
        const x2 = num(it.x2, -20, 120, 100);
        const y2 = num(it.y2, -20, 120, 100);
        // Grows from its start to its end; non-scaling strokes keep an even width on a stretched viewBox.
        return (
          <animated.line
            key={i}
            x1={x1}
            y1={y1}
            x2={s.d.to((d) => x2 + (x1 - x2) * d)}
            y2={s.d.to((d) => y2 + (y1 - y2) * d)}
            stroke={sceneColor(it.color, "var(--ag-line)")}
            strokeWidth={num(it.size, 1, 12, 1.5)}
            strokeOpacity={num(it.opacity, 0, 1, 1)}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/**
 * A stage for spring-animated illustrations. Place shapes, glyphs, text,
 * images and lines by percentage; give each a depth and a motion. The stage
 * parallaxes under the pointer and can tilt in 3D. Use it for diagrams,
 * explainers, hero art, orbits, anything a static image would do worse.
 */
export function Scene({ items, height = 320, background = "panel", tilt = false, label, caption }: SceneProps) {
  const reduce = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>();
  const list = useMemo(() => (Array.isArray(items) ? items.filter((it) => it && typeof it === "object").slice(0, 48) : []), [items]);
  const box = useRef<HTMLDivElement | null>(null);
  const [p, api] = useSpring(() => ({ x: 0, y: 0, config: springs.soft }));
  const h = num(height, 120, 900, 320);

  const describe = label ?? (list.map((it) => it.text).filter(Boolean).join(", ") || "Animated illustration");

  return (
    <figure data-agentable-scene="" ref={ref}>
      <animated.div
        ref={box}
        data-agentable-scene-stage={background}
        data-tilt={tilt ? "" : undefined}
        role="img"
        aria-label={describe}
        style={{
          height: h,
          transform: tilt ? to([p.x, p.y], (x, y) => `perspective(1000px) rotateX(${-y * 8}deg) rotateY(${x * 10}deg)`) : undefined,
        }}
        onPointerMove={(e) => {
          if (reduce || e.pointerType === "touch") return;
          const r = e.currentTarget.getBoundingClientRect();
          void api.start({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 });
        }}
        onPointerLeave={() => api.start({ x: 0, y: 0 })}
      >
        <SceneLines items={list} live={seen} />
        {list.map((it, i) => (
          <SceneNode key={i} it={it} index={i} live={seen} px={p.x} py={p.y} tilt={tilt} />
        ))}
      </animated.div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
