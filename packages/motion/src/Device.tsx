import { useEffect, useState, type ReactNode } from "react";
import { animated, to, useSpring } from "@react-spring/web";
import { springs, useReducedMotion, useTilt } from "./hooks.js";

export type DeviceKind = "phone" | "tablet" | "laptop" | "browser" | "watch";
export type DeviceFinish = "midnight" | "silver" | "starlight" | "sierra" | "rose";

export interface DeviceProps {
  kind?: DeviceKind;
  /** Content on the screen. Generated UI goes here. */
  children?: ReactNode;
  /** A screenshot to show instead of children (https URL). */
  src?: string;
  /** Address bar text for `browser`, app title elsewhere. */
  url?: string;
  /** Caption under the device. */
  caption?: string;
  finish?: DeviceFinish;
  /** Follow the pointer in 3D. Default true. */
  tilt?: boolean;
  /** Gently bob while idle. Default false. */
  float?: boolean;
  /** Time shown in the phone status bar. Default 9:41. */
  time?: string;
}

function StatusBar({ time }: { time: string }) {
  return (
    <div data-agentable-device-status="" aria-hidden="true">
      <span>{time}</span>
      <span data-agentable-device-island="" />
      <span data-agentable-device-glyphs="">
        <i data-sig="" />
        <i data-wifi="" />
        <i data-batt="" />
      </span>
    </div>
  );
}

function Chrome({ url }: { url?: string }) {
  return (
    <div data-agentable-device-chrome="" aria-hidden="true">
      <span data-agentable-device-lights="">
        <i />
        <i />
        <i />
      </span>
      <span data-agentable-device-url="">{url ?? "localhost"}</span>
      <span />
    </div>
  );
}

/**
 * A pretty device frame with live content on its screen. It rises in with a
 * product-shot reveal, tilts toward the pointer and catches a moving glare.
 */
export function Device({ kind = "phone", children, src, url, caption, finish = "midnight", tilt = true, float = false, time = "9:41" }: DeviceProps) {
  const reduce = useReducedMotion();
  const t = useTilt({ max: kind === "laptop" || kind === "browser" ? 5 : 9, scale: 1.015, disabled: !tilt });
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(true), []);
  const reveal = useSpring({ r: shown ? 0 : 1, immediate: reduce, config: { tension: 120, friction: 20 } });

  const screen = src ? <img data-agentable-device-shot="" src={src} alt={url ?? caption ?? ""} loading="lazy" /> : children;

  return (
    <figure data-agentable-device={kind} data-finish={finish} data-float={float ? "" : undefined}>
      <animated.div
        data-agentable-device-stage=""
        {...t.bind}
        style={{
          opacity: reveal.r.to((r) => 1 - r),
          transform: to(
            [reveal.r, t.springs.rx, t.springs.ry, t.springs.scale],
            (r, rx, ry, sc) => `perspective(1100px) translateY(${r * 40}px) rotateX(${rx + r * 22}deg) rotateY(${ry}deg) scale(${sc - r * 0.06})`,
          ),
        }}
      >
        <div data-agentable-device-body="">
          {kind === "watch" ? <span data-agentable-device-crown="" aria-hidden="true" /> : null}
          {kind === "phone" ? <span data-agentable-device-buttons="" aria-hidden="true" /> : null}
          <div data-agentable-device-screen="">
            {kind === "phone" ? <StatusBar time={time} /> : null}
            {kind === "browser" ? <Chrome url={url} /> : null}
            {kind === "laptop" ? <span data-agentable-device-notch="" aria-hidden="true" /> : null}
            <div data-agentable-device-content="">{screen}</div>
            {kind === "phone" ? <span data-agentable-device-home="" aria-hidden="true" /> : null}
            <animated.span
              data-agentable-device-glare=""
              aria-hidden="true"
              style={{
                opacity: t.glare.o.to((o) => o * 0.55),
                background: to([t.glare.x, t.glare.y], (x, y) => `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,.35), rgba(255,255,255,0) 55%)`),
              }}
            />
          </div>
        </div>
        {kind === "laptop" ? <div data-agentable-device-base="" aria-hidden="true" /> : null}
      </animated.div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
