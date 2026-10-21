import { useId, useState, type ReactNode } from "react";

/**
 * Data-bound collections and display components for generated UI.
 *
 * Collections take an array (usually bound to `$data.*`) and fire per-item
 * events with the whole item, so a program can act on one row:
 *
 *   list = Checklist($data.items, toggle: @Tool("toggle_item", {id: $event.id}))
 *
 * Every component renders sensibly when its bound value is missing or not yet
 * loaded (an empty array, no crash), because generated programs often bind to
 * data that arrives later.
 */

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const keyOf = (item: { id?: unknown }, i: number) => (item && (typeof item.id === "string" || typeof item.id === "number") ? String(item.id) : `i${i}`);

// ---------- Checklist ----------

export interface ChecklistItem {
  id?: string | number;
  text: string;
  done?: boolean;
  note?: string;
}
export interface ChecklistProps {
  items: ChecklistItem[];
  title?: string;
  /** Text shown when there are no items. */
  empty?: string;
  /** Fires with the item when its box is ticked or unticked. */
  onToggle?: (item: ChecklistItem) => void;
  /** Fires with the item when its remove button is pressed. The button only shows when bound. */
  onRemove?: (item: ChecklistItem) => void;
}
export function Checklist({ items, title, empty = "Nothing here yet.", onToggle, onRemove }: ChecklistProps) {
  const list = arr<ChecklistItem>(items);
  const id = useId();
  const done = list.filter((i) => i?.done).length;
  return (
    <div data-agentable-checklist="">
      {title ? (
        <div data-agentable-collection-head="">
          <span id={id}>{title}</span>
          {list.length ? <span data-agentable-count="">{`${done}/${list.length}`}</span> : null}
        </div>
      ) : null}
      {list.length === 0 ? (
        <p data-agentable-empty="">{empty}</p>
      ) : (
        <ul aria-labelledby={title ? id : undefined}>
          {list.map((item, i) => (
            <li key={keyOf(item, i)} data-done={item?.done ? "" : undefined}>
              <label>
                <input type="checkbox" checked={!!item?.done} disabled={!onToggle} onChange={() => onToggle?.(item)} />
                <span data-agentable-checklist-text="">
                  {item?.text}
                  {item?.note ? <small>{item.note}</small> : null}
                </span>
              </label>
              {onRemove ? (
                <button type="button" data-agentable-icon-button="" aria-label={`Remove ${item?.text ?? "item"}`} onClick={() => onRemove(item)}>
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- ItemList ----------

export interface ListItem {
  id?: string | number;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  href?: string;
}
export interface ItemListProps {
  items: ListItem[];
  title?: string;
  empty?: string;
  /** Fires with the item when a row is chosen. Rows are buttons only when bound. */
  onSelect?: (item: ListItem) => void;
}
export function ItemList({ items, title, empty = "Nothing here yet.", onSelect }: ItemListProps) {
  const list = arr<ListItem>(items);
  return (
    <div data-agentable-itemlist="">
      {title ? (
        <div data-agentable-collection-head="">
          <span>{title}</span>
          {list.length ? <span data-agentable-count="">{list.length}</span> : null}
        </div>
      ) : null}
      {list.length === 0 ? (
        <p data-agentable-empty="">{empty}</p>
      ) : (
        <ul>
          {list.map((item, i) => {
            const body = (
              <>
                <span data-agentable-itemlist-main="">
                  <span data-agentable-itemlist-title="">{item?.title}</span>
                  {item?.subtitle ? <span data-agentable-itemlist-subtitle="">{item.subtitle}</span> : null}
                </span>
                {item?.badge ? <Badge text={item.badge} /> : null}
                {item?.meta ? <span data-agentable-itemlist-meta="">{item.meta}</span> : null}
              </>
            );
            return (
              <li key={keyOf(item, i)}>
                {onSelect ? (
                  <button type="button" data-agentable-row-button="" onClick={() => onSelect(item)}>
                    {body}
                  </button>
                ) : safeHref(item?.href) ? (
                  <a data-agentable-row-button="" href={safeHref(item.href)} target="_blank" rel="noopener noreferrer">
                    {body}
                  </a>
                ) : (
                  <div data-agentable-row="">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------- Timeline ----------

export interface TimelineItem {
  id?: string | number;
  time: string;
  title: string;
  detail?: string;
  done?: boolean;
}
export interface TimelineProps {
  items: TimelineItem[];
  onSelect?: (item: TimelineItem) => void;
}
export function Timeline({ items, onSelect }: TimelineProps) {
  const list = arr<TimelineItem>(items);
  return (
    <ol data-agentable-timeline="">
      {list.map((item, i) => (
        <li key={keyOf(item, i)} data-done={item?.done ? "" : undefined}>
          <span data-agentable-timeline-time="">{item?.time}</span>
          <span data-agentable-timeline-dot="" aria-hidden="true" />
          <div data-agentable-timeline-body="">
            {onSelect ? (
              <button type="button" data-agentable-link-button="" onClick={() => onSelect(item)}>
                {item?.title}
              </button>
            ) : (
              <strong>{item?.title}</strong>
            )}
            {item?.detail ? <p>{item.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------- small display pieces ----------

export interface BadgeProps {
  text: string;
  kind?: "neutral" | "info" | "success" | "warning" | "danger" | "accent";
}
export function Badge({ text, kind = "neutral" }: BadgeProps) {
  return (
    <span data-agentable-badge="" data-kind={kind}>
      {text}
    </span>
  );
}

export function Divider() {
  return <hr data-agentable-divider="" />;
}

function safeHref(href?: string) {
  if (!href) return undefined;
  try {
    const u = new URL(href, "https://example.invalid");
    return u.protocol === "https:" || u.protocol === "http:" ? href : undefined;
  } catch {
    return undefined;
  }
}

function safeSrc(src?: string) {
  if (!src) return undefined;
  if (/^data:image\/(png|jpe?g|gif|webp|avif);/i.test(src)) return src;
  return safeHref(src);
}

export interface ImageProps {
  src: string;
  alt?: string;
  caption?: string;
}
export function Image({ src, alt = "", caption }: ImageProps) {
  const safe = safeSrc(src);
  const [failed, setFailed] = useState(false);
  if (!safe || failed) return caption ? <p data-agentable-text="muted">{caption}</p> : null;
  return (
    <figure data-agentable-image="">
      <img src={safe} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

export interface LinkCardProps {
  href: string;
  title: string;
  description?: string;
}
export function LinkCard({ href, title, description }: LinkCardProps) {
  const safe = safeHref(href);
  let host = "";
  try {
    host = safe ? new URL(safe).hostname.replace(/^www\./, "") : "";
  } catch {
    /* relative link */
  }
  const body = (
    <>
      <span data-agentable-linkcard-title="">{title}</span>
      {description ? <span data-agentable-linkcard-description="">{description}</span> : null}
      {host ? <span data-agentable-linkcard-host="">{host}</span> : null}
    </>
  );
  return safe ? (
    <a data-agentable-linkcard="" href={safe} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  ) : (
    <div data-agentable-linkcard="">{body}</div>
  );
}

export interface GridProps {
  columns?: 2 | 3 | 4;
  children?: ReactNode;
}
export function Grid({ columns = 2, children }: GridProps) {
  return (
    <div data-agentable-grid="" style={{ ["--ag-grid-columns" as string]: columns }}>
      {children}
    </div>
  );
}

// ---------- Chart ----------

export interface ChartProps {
  kind?: "bar" | "line" | "area";
  data: Array<Record<string, string | number>>;
  /** Key of the x-axis category in each row. */
  x: string;
  /** Keys of numeric series to plot. */
  series: string[];
  title?: string;
  /** Fires with the row when a bar or point is chosen. */
  onSelect?: (row: Record<string, string | number>) => void;
}

const W = 560;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 44 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

const fmt = (n: number) => (Math.abs(n) >= 1000 ? `${+(n / 1000).toFixed(1)}k` : `${+n.toFixed(2)}`);

/** A dependency-free SVG chart: bars, lines or areas over one category axis. */
export function Chart({ kind = "bar", data, x, series, title, onSelect }: ChartProps) {
  const rows = arr<Record<string, string | number>>(data);
  const keys = arr<string>(series).filter((s) => typeof s === "string");
  const titleId = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (!rows.length || !keys.length) {
    return <p data-agentable-empty="">{title ? `${title}: no data yet.` : "No data yet."}</p>;
  }
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v)) || 0;
  const values = rows.flatMap((r) => keys.map((k) => num(r[k])));
  const min = Math.min(0, ...values);
  const max = niceMax(Math.max(...values, 0));
  const span = max - min || 1;
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const band = iw / rows.length;
  const y = (v: number) => PAD.top + ih - ((v - min) / span) * ih;
  const cx = (i: number) => PAD.left + band * i + band / 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + span * t);
  const labelEvery = Math.ceil(rows.length / 8);

  return (
    <figure data-agentable-chart="" data-kind={kind}>
      {title ? <figcaption id={titleId}>{title}</figcaption> : null}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : `${kind} chart`}>
        {ticks.map((t) => (
          <g key={t}>
            <line data-agentable-chart-grid="" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text data-agentable-chart-axis="" x={PAD.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {fmt(t)}
            </text>
          </g>
        ))}
        {rows.map((r, i) =>
          i % labelEvery === 0 ? (
            <text key={i} data-agentable-chart-axis="" x={cx(i)} y={H - 8} textAnchor="middle">
              {String(r[x] ?? "")}
            </text>
          ) : null,
        )}
        {keys.map((k, si) => {
          const color = `var(--ag-series-${(si % 5) + 1})`;
          if (kind === "bar") {
            const bw = Math.max(2, (band * 0.72) / keys.length);
            return rows.map((r, i) => {
              const v = num(r[k]);
              const top = y(Math.max(v, 0));
              const h = Math.abs(y(v) - y(0));
              return (
                <rect
                  key={`${k}${i}`}
                  x={cx(i) - (bw * keys.length) / 2 + bw * si}
                  y={top}
                  width={bw - 1}
                  height={Math.max(h, 0.5)}
                  rx={2}
                  fill={color}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              );
            });
          }
          const pts = rows.map((r, i) => `${cx(i)},${y(num(r[k]))}`);
          return (
            <g key={k}>
              {kind === "area" ? (
                <path d={`M${cx(0)},${y(0)} L${pts.join(" L")} L${cx(rows.length - 1)},${y(0)} Z`} fill={color} opacity={0.16} />
              ) : null}
              <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {rows.map((r, i) => (
                <circle key={i} cx={cx(i)} cy={y(num(r[k]))} r={hover === i ? 4 : 2.5} fill={color} />
              ))}
            </g>
          );
        })}
        {rows.map((r, i) => (
          <rect
            key={`hit${i}`}
            data-agentable-chart-hit=""
            x={PAD.left + band * i}
            y={PAD.top}
            width={band}
            height={ih}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={onSelect ? () => onSelect(r) : undefined}
            style={onSelect ? { cursor: "pointer" } : undefined}
          >
            <title>{`${String(r[x] ?? "")}: ${keys.map((k) => `${k} ${fmt(num(r[k]))}`).join(", ")}`}</title>
          </rect>
        ))}
      </svg>
      {keys.length > 1 ? (
        <div data-agentable-chart-legend="">
          {keys.map((k, si) => (
            <span key={k}>
              <i style={{ background: `var(--ag-series-${(si % 5) + 1})` }} />
              {k}
            </span>
          ))}
        </div>
      ) : null}
    </figure>
  );
}
