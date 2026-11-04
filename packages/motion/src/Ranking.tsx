import { animated, useTransition } from "@react-spring/web";
import { Ticker } from "./enter.js";
import { springs, useInView, useReducedMotion } from "./hooks.js";

export interface RankingItem {
  id?: string | number;
  label: string;
  value: number;
  /** Emoji or short glyph before the label. */
  icon?: string;
  /** Formatted value; defaults to the number. */
  display?: string;
}

export interface RankingProps {
  items: RankingItem[];
  title?: string;
  /** Show at most this many rows. */
  limit?: number;
  /** Lowest first instead of highest. */
  ascending?: boolean;
  onSelect?: (item: RankingItem) => void;
}

const ROW = 46;
const SERIES = ["var(--ag-series-1)", "var(--ag-series-2)", "var(--ag-series-3)", "var(--ag-series-4)", "var(--ag-agent)"];

/**
 * A ranked bar list. When bound data changes, rows spring to their new places
 * and bars to their new lengths, like a bar-chart race.
 */
export function Ranking({ items, title, limit = 10, ascending = false, onSelect }: RankingProps) {
  const reduce = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>();
  const list = (Array.isArray(items) ? items : []).filter((it) => it && typeof it.label === "string");
  const sorted = [...list].sort((a, b) => (ascending ? a.value - b.value : b.value - a.value)).slice(0, limit);
  const max = Math.max(1, ...sorted.map((it) => Math.abs(Number(it.value) || 0)));
  const colorOf = new Map(list.map((it, i) => [String(it.id ?? it.label), SERIES[i % SERIES.length]!]));
  const rows = sorted.map((it, rank) => ({ it, rank, key: String(it.id ?? it.label), w: seen ? (Math.abs(Number(it.value) || 0) / max) * 100 : 0 }));
  const transitions = useTransition(rows, {
    keys: (r) => r.key,
    from: (r) => ({ y: r.rank * ROW + 12, o: 0, w: 0 }),
    enter: (r) => ({ y: r.rank * ROW, o: 1, w: r.w }),
    update: (r) => ({ y: r.rank * ROW, o: 1, w: r.w }),
    leave: { o: 0 },
    trail: 40,
    config: springs.enter,
    immediate: reduce,
  });
  return (
    <figure data-agentable-ranking="" ref={ref}>
      {title ? <figcaption>{title}</figcaption> : null}
      <ol style={{ height: rows.length * ROW }}>
        {transitions((style, r) => (
          <animated.li
            key={r.key}
            style={{ transform: style.y.to((y) => `translateY(${y}px)`), opacity: style.o, height: ROW }}
            data-rank={r.rank + 1}
            onClick={onSelect ? () => onSelect(r.it) : undefined}
            data-selectable={onSelect ? "" : undefined}
          >
            <span data-agentable-ranking-pos="">{r.rank + 1}</span>
            <div data-agentable-ranking-main="">
              <div data-agentable-ranking-label="">
                <span>
                  {r.it.icon ? <span aria-hidden="true">{r.it.icon} </span> : null}
                  {r.it.label}
                </span>
                <strong>
                  <Ticker value={r.it.display ?? r.it.value} />
                </strong>
              </div>
              <div data-agentable-ranking-bar="">
                <animated.i style={{ width: style.w.to((w) => `${w}%`), background: colorOf.get(r.key) }} />
              </div>
            </div>
          </animated.li>
        ))}
      </ol>
    </figure>
  );
}
