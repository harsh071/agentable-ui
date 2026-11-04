import { animated, to } from "@react-spring/web";
import { useTilt } from "./hooks.js";

export type HoloFoil = "silver" | "gold" | "aurora" | "rainbow";

export interface HoloCardProps {
  title: string;
  subtitle?: string;
  /** Big glyph or emoji at the top, e.g. "⚡". */
  emblem?: string;
  /** https URL of art for the card. */
  image?: string;
  /** Short labelled numbers, e.g. [{label:"Speed", value:"92"}]. */
  stats?: Array<{ label: string; value: string | number }>;
  tags?: string[];
  /** Footer text, e.g. a rarity or a date. */
  footer?: string;
  foil?: HoloFoil;
}

/**
 * A collectible "holo" card: tilts toward the pointer, and a foil gradient
 * and glare slide across it as it moves. Good for achievements, profiles,
 * a summary someone will screenshot.
 */
export function HoloCard({ title, subtitle, emblem, image, stats, tags, footer, foil = "silver" }: HoloCardProps) {
  const t = useTilt({ max: 14, scale: 1.04 });
  return (
    <div data-agentable-holo-wrap="">
      <animated.article data-agentable-holo="" data-foil={foil} {...t.bind} style={t.style}>
        <animated.span
          data-agentable-holo-foil=""
          aria-hidden="true"
          style={{
            opacity: t.glare.o.to((o) => 0.25 + o * 0.5),
            backgroundPosition: to([t.glare.x, t.glare.y], (x, y) => `${x}% ${y}%`),
          }}
        />
        <animated.span
          data-agentable-holo-glare=""
          aria-hidden="true"
          style={{
            opacity: t.glare.o,
            background: to([t.glare.x, t.glare.y], (x, y) => `radial-gradient(farthest-corner circle at ${x}% ${y}%, rgba(255,255,255,.55) 0%, rgba(255,255,255,.12) 30%, rgba(0,0,0,.18) 90%)`),
          }}
        />
        <div data-agentable-holo-content="">
          <header>
            {emblem ? <span data-agentable-holo-emblem="">{emblem}</span> : null}
            <div>
              <h3>{title}</h3>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </header>
          {image ? <img src={image} alt="" loading="lazy" draggable={false} /> : null}
          {stats?.length ? (
            <dl>
              {stats.slice(0, 4).map((s, i) => (
                <div key={i}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {tags?.length ? (
            <ul>
              {tags.slice(0, 6).map((tag, i) => (
                <li key={i}>{tag}</li>
              ))}
            </ul>
          ) : null}
          {footer ? <footer>{footer}</footer> : null}
        </div>
      </animated.article>
    </div>
  );
}
