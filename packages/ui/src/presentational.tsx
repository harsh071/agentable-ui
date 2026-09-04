import type { ComponentType, ReactNode } from "react";
import type { JSONSchema } from "@agentable/core";

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
  value: string;
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
  items: Array<{ key: string; value: string }>;
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
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div data-agentable-progress="">
      {label ? <span>{label}</span> : null}
      <progress value={value} max={max} aria-label={label} />
      <span>{Math.round(pct)}%</span>
    </div>
  );
}

const str = (description?: string): JSONSchema => (description ? { type: "string", description } : { type: "string" });

/** The generative-UI catalog for @agentable/ui. Pass to <AgentSurface components={uiCatalog}>. */
export const uiCatalog = {
  Text: { component: Text, description: "A paragraph, heading, or code block.", props: { type: "object", properties: { text: str(), variant: { type: "string", enum: ["body", "muted", "heading", "code"] } }, required: ["text"] } },
  Card: { component: Card, description: "A titled container for other components.", props: { type: "object", properties: { title: str(), subtitle: str() } }, childrenProp: "children" },
  Stat: { component: Stat, description: "One metric with optional delta and trend.", props: { type: "object", properties: { label: str(), value: str("Formatted value, e.g. $12.4k"), delta: str("e.g. +4.2%"), trend: { type: "string", enum: ["up", "down", "flat"] } }, required: ["label", "value"] } },
  StatGroup: { component: StatGroup, description: "Lays out several Stat components in a row.", props: { type: "object", properties: {} }, childrenProp: "children" },
  Callout: { component: Callout, description: "An info, success, warning, or error note.", props: { type: "object", properties: { title: str(), text: str(), kind: { type: "string", enum: ["info", "success", "warning", "error"] } }, required: ["text"] } },
  KeyValue: { component: KeyValue, description: "A definition list of key/value pairs.", props: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { key: str(), value: str() }, required: ["key", "value"] } } }, required: ["items"] } },
  SimpleTable: { component: SimpleTable, description: "A small static table.", props: { type: "object", properties: { caption: str(), columns: { type: "array", items: { type: "string" } }, rows: { type: "array", items: { type: "array", items: { type: ["string", "number"] } } } }, required: ["columns", "rows"] } },
  List: { component: List, description: "A bulleted or numbered list.", props: { type: "object", properties: { items: { type: "array", items: { type: "string" } }, ordered: { type: "boolean" } }, required: ["items"] } },
  Stack: { component: Stack, description: "Arranges children in a row or column.", props: { type: "object", properties: { direction: { type: "string", enum: ["row", "column"] } } }, childrenProp: "children" },
  Progress: { component: Progress, description: "A progress bar.", props: { type: "object", properties: { label: str(), value: { type: "number" }, max: { type: "number" } }, required: ["value"] } },
} satisfies Record<string, CatalogEntry<never>>;
