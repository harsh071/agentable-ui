import { useId, type ComponentType, type ReactNode, type ComponentPropsWithRef } from "react";
import type { JSONSchema } from "@agentable-ui/core";
import { Badge, Chart, Checklist, Divider, Grid, Image, ItemList, LinkCard, Timeline } from "./collections.js";

/**
 * Presentational components an agent may compose through the generative-UI
 * `present` tool. Each carries a JSON Schema for its props; the schema is the
 * catalog entry and the runtime validator.
 */
export interface CatalogEntry<P = Record<string, unknown>> {
  component: ComponentType<P>;
  description: string;
  props: JSONSchema;
  /** Which prop, if any, receives child nodes. */
  childrenProp?: keyof P & string;
  /** Events the component fires: event name -> callback prop, called with the event's value. */
  events?: Record<string, keyof P & string>;
}

export interface TextProps {
  text: string;
  variant?: "body" | "muted" | "heading" | "code";
}
export function Text({ text, variant = "body" }: TextProps) {
  if (variant === "heading") return <h3 data-agentable-text="heading">{text}</h3>;
  if (variant === "code") return <pre data-agentable-text="code">{text}</pre>;
  return <p data-agentable-text={variant}>{text}</p>;
}

export interface CardProps {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}
export function Card({ title, subtitle, children }: CardProps) {
  return (
    <section data-agentable-card="">
      {title ? (
        <header data-agentable-card-header="">
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </header>
      ) : null}
      <div data-agentable-card-body="">{children}</div>
    </section>
  );
}

export interface StatProps {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down" | "flat";
}
export function Stat({ label, value, delta, trend }: StatProps) {
  return (
    <div data-agentable-stat="" data-trend={trend}>
      <span data-agentable-stat-label="">{label}</span>
      <span data-agentable-stat-value="">{value}</span>
      {delta ? <span data-agentable-stat-delta="">{delta}</span> : null}
    </div>
  );
}

export interface StatGroupProps {
  children?: ReactNode;
}
export function StatGroup({ children }: StatGroupProps) {
  return <div data-agentable-statgroup="">{children}</div>;
}

export interface CalloutProps {
  title?: string;
  text: string;
  kind?: "info" | "success" | "warning" | "error";
}
export function Callout({ title, text, kind = "info" }: CalloutProps) {
  return (
    <div role={kind === "error" ? "alert" : "note"} data-agentable-callout="" data-kind={kind}>
      {title ? <strong>{title}</strong> : null}
      <p>{text}</p>
    </div>
  );
}

export interface KeyValueProps {
  items: Array<{ key: string; value: string | number }>;
}
export function KeyValue({ items }: KeyValueProps) {
  return (
    <dl data-agentable-keyvalue="">
      {items.map((it, i) => (
        <div key={i}>
          <dt>{it.key}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface SimpleTableProps {
  columns: string[];
  rows: Array<Array<string | number>>;
  caption?: string;
}
export function SimpleTable({ columns, rows, caption }: SimpleTableProps) {
  return (
    <div data-agentable-table-scroll="">
      <table data-agentable-simpletable="">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface ListProps {
  items: string[];
  ordered?: boolean;
}
export function List({ items, ordered }: ListProps) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag data-agentable-list="">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </Tag>
  );
}

export interface StackProps {
  direction?: "row" | "column";
  children?: ReactNode;
}
export function Stack({ direction = "column", children }: StackProps) {
  return <div data-agentable-stack={direction}>{children}</div>;
}

export interface ProgressProps {
  label?: string;
  value: number;
  max?: number;
}
export function Progress({ label, value, max = 100 }: ProgressProps) {
  // A bound value may not exist yet (ui.* starts empty); show 0 rather than NaN.
  const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const pct = max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
  return (
    <div data-agentable-progress="">
      {label ? <span>{label}</span> : null}
      <progress value={v} max={max} aria-label={label} />
      <span>{Math.round(pct)}%</span>
    </div>
  );
}

export interface ButtonProps extends Omit<ComponentPropsWithRef<"button">, "children"> {
  /** Use children for rich content, or label for generated UI. */
  children?: ReactNode;
  label?: string;
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  onPress?: () => void;
}
export function Button({ label, children, variant = "default", size = "md", loading = false, disabled, onPress, onClick, type = "button", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      data-agentable-button={variant === "default" ? "" : variant}
      data-size={size}
      data-busy={loading ? "" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onPress?.();
      }}
    >
      {children ?? label}
    </button>
  );
}

export interface TextInputProps {
  label: string;
  value?: string | number;
  placeholder?: string;
  kind?: "text" | "number" | "email" | "date";
  onChange?: (value: string | number) => void;
  onSubmit?: (value: string | number) => void;
}
export function TextInput({ label, value, placeholder, kind = "text", onChange, onSubmit }: TextInputProps) {
  const id = useId();
  const read = (raw: string) => (kind === "number" && raw !== "" ? Number(raw) : raw);
  return (
    <div data-agentable-field="" data-type={kind}>
      <label htmlFor={id} data-agentable-label="">
        {label}
      </label>
      <input
        id={id}
        data-agentable-input=""
        type={kind}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange?.(read(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.(read(e.currentTarget.value));
        }}
      />
    </div>
  );
}

export interface SelectProps {
  label: string;
  options: Array<string | { value: string; label: string }>;
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}
export function Select({ label, options, value, placeholder, onChange }: SelectProps) {
  const id = useId();
  return (
    <div data-agentable-field="" data-type="select">
      <label htmlFor={id} data-agentable-label="">
        {label}
      </label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)}>
        <option value="" disabled>
          {placeholder ?? "Choose..."}
        </option>
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export interface CheckboxProps {
  label: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}
export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  const id = useId();
  return (
    <div data-agentable-field="" data-type="boolean">
      <input id={id} type="checkbox" checked={!!checked} onChange={(e) => onChange?.(e.target.checked)} />
      <label htmlFor={id} data-agentable-label="">
        {label}
      </label>
    </div>
  );
}

export interface RecordTableProps {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  caption?: string;
  /** Fired with the whole row when one is chosen. */
  onSelect?: (row: Record<string, unknown>) => void;
}
export function RecordTable({ columns, rows, caption, onSelect }: RecordTableProps) {
  const cell = (v: unknown) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <div data-agentable-table-scroll="">
      <table data-agentable-simpletable="" data-selectable={onSelect ? "" : undefined}>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            {onSelect ? <th aria-label="Actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key}>{cell(r[c.key])}</td>
              ))}
              {onSelect ? (
                <td>
                  <button type="button" data-agentable-button="" onClick={() => onSelect(r)}>
                    Select
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const str = (description?: string): JSONSchema => (description ? { type: "string", description } : { type: "string" });

/** The generative-UI catalog for @agentable-ui/ui. Pass to <AgentSurface components={uiCatalog}>. */
export const uiCatalog = {
  Text: { component: Text, description: "A paragraph, heading, or code block.", props: { type: "object", properties: { text: str(), variant: { type: "string", enum: ["body", "muted", "heading", "code"] } }, required: ["text"] } },
  Card: { component: Card, description: "A titled container for other components.", props: { type: "object", properties: { title: str(), subtitle: str() } }, childrenProp: "children" },
  Stat: { component: Stat, description: "One metric with optional delta and trend.", props: { type: "object", properties: { label: str(), value: { type: ["string", "number"], description: "Formatted value, e.g. $12.4k" }, delta: str("e.g. +4.2%"), trend: { type: "string", enum: ["up", "down", "flat"] } }, required: ["label", "value"] } },
  StatGroup: { component: StatGroup, description: "Lays out several Stat components in a row.", props: { type: "object", properties: {} }, childrenProp: "children" },
  Callout: { component: Callout, description: "An info, success, warning, or error note.", props: { type: "object", properties: { title: str(), text: str(), kind: { type: "string", enum: ["info", "success", "warning", "error"] } }, required: ["text"] } },
  KeyValue: { component: KeyValue, description: "A definition list of key/value pairs.", props: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { key: str(), value: { type: ["string", "number"] } }, required: ["key", "value"] } } }, required: ["items"] } },
  SimpleTable: { component: SimpleTable, description: "A small static table.", props: { type: "object", properties: { caption: str(), columns: { type: "array", items: { type: "string" } }, rows: { type: "array", items: { type: "array", items: { type: ["string", "number"] } } } }, required: ["columns", "rows"] } },
  List: { component: List, description: "A bulleted or numbered list.", props: { type: "object", properties: { items: { type: "array", items: { type: "string" } }, ordered: { type: "boolean" } }, required: ["items"] } },
  Stack: { component: Stack, description: "Arranges children in a row or column.", props: { type: "object", properties: { direction: { type: "string", enum: ["row", "column"] } } }, childrenProp: "children" },
  Progress: { component: Progress, description: "A progress bar.", props: { type: "object", properties: { label: str(), value: { type: "number" }, max: { type: "number" } }, required: ["value"] } },
  Button: { component: Button, description: "A button. Label says what happens.", props: { type: "object", properties: { label: str(), variant: { type: "string", enum: ["default", "primary", "danger", "ghost"] }, size: { type: "string", enum: ["sm", "md", "lg"] }, loading: { type: "boolean" }, disabled: { type: "boolean" } }, required: ["label"] }, events: { press: "onPress" } },
  TextInput: { component: TextInput, description: "A labelled text or number input. Bind value to ui.* and set it on change.", props: { type: "object", properties: { label: str(), value: { type: ["string", "number"] }, placeholder: str(), kind: { type: "string", enum: ["text", "number", "email", "date"] } }, required: ["label"] }, events: { change: "onChange", submit: "onSubmit" } },
  Select: { component: Select, description: "A labelled dropdown.", props: { type: "object", properties: { label: str(), options: { type: "array", items: { type: ["string", "object"] } }, value: str(), placeholder: str() }, required: ["label", "options"] }, events: { change: "onChange" } },
  Checkbox: { component: Checkbox, description: "A labelled checkbox.", props: { type: "object", properties: { label: str(), checked: { type: "boolean" } }, required: ["label"] }, events: { change: "onChange" } },
  Grid: { component: Grid, description: "Lays out children in 2-4 equal columns (stacks on narrow screens).", props: { type: "object", properties: { columns: { type: "integer", enum: [2, 3, 4] } } }, childrenProp: "children" },
  Checklist: { component: Checklist, description: "Checkable items, usually bound to a data.* array of {id, text, done, note?}. toggle and remove fire with the item.", props: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { id: { type: ["string", "number"] }, text: str(), done: { type: "boolean" }, note: str() }, required: ["text"] } }, title: str(), empty: str("Shown when there are no items") }, required: ["items"] }, events: { toggle: "onToggle", remove: "onRemove" } },
  ItemList: { component: ItemList, description: "Rows of {id, title, subtitle?, meta?, badge?, href?}, usually bound to a data.* array. select fires with the item.", props: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { id: { type: ["string", "number"] }, title: str(), subtitle: str(), meta: str(), badge: str(), href: str() }, required: ["title"] } }, title: str(), empty: str("Shown when there are no items") }, required: ["items"] }, events: { select: "onSelect" } },
  Timeline: { component: Timeline, description: "Time-ordered steps or events {time, title, detail?, done?}. select fires with the item.", props: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { id: { type: ["string", "number"] }, time: str(), title: str(), detail: str(), done: { type: "boolean" } }, required: ["time", "title"] } } }, required: ["items"] }, events: { select: "onSelect" } },
  Chart: { component: Chart, description: "A bar, line or area chart of numeric series over a category axis. data rows hold the x key and each series key.", props: { type: "object", properties: { data: { type: "array", items: { type: "object" } }, x: str("Key of the category in each row"), series: { type: "array", items: { type: "string" } }, kind: { type: "string", enum: ["bar", "line", "area"] }, title: str() }, required: ["data", "x", "series"] }, events: { select: "onSelect" } },
  Badge: { component: Badge, description: "A small status label.", props: { type: "object", properties: { text: str(), kind: { type: "string", enum: ["neutral", "info", "success", "warning", "danger", "accent"] } }, required: ["text"] } },
  Image: { component: Image, description: "An image from an https URL with optional caption.", props: { type: "object", properties: { src: str("https URL"), alt: str(), caption: str() }, required: ["src"] } },
  LinkCard: { component: LinkCard, description: "A link to a web page shown as a card (title, description, host).", props: { type: "object", properties: { href: str("https URL"), title: str(), description: str() }, required: ["href", "title"] } },
  Divider: { component: Divider, description: "A horizontal rule between sections.", props: { type: "object", properties: {} } },
  RecordTable: { component: RecordTable, description: "A table of records; bind rows to a data.* array. select fires with the row.", props: { type: "object", properties: { caption: str(), columns: { type: "array", items: { type: "object", properties: { key: str(), label: str() }, required: ["key", "label"] } }, rows: { type: "array", items: { type: "object" } } }, required: ["columns", "rows"] }, events: { select: "onSelect" } },
} satisfies Record<string, CatalogEntry<never>>;
