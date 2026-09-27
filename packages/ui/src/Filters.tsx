import { useMemo, useRef, useState } from "react";
import type { JSONSchema } from "@agentable-ui/core";
import { useAgentCapability } from "./useAgentCapability.js";
import type { AgentProp } from "./types.js";

export type FilterDef =
  | { id: string; label: string; type: "select"; options: Array<{ value: string; label?: string }>; describe?: string }
  | { id: string; label: string; type: "text"; describe?: string; placeholder?: string }
  | { id: string; label: string; type: "boolean"; describe?: string }
  | { id: string; label: string; type: "range"; min?: number; max?: number; step?: number; describe?: string }
  | { id: string; label: string; type: "date"; describe?: string };

export type FilterValues = Record<string, unknown>;

export interface FiltersProps {
  filters: FilterDef[];
  value?: FilterValues;
  defaultValue?: FilterValues;
  onChange?: (values: FilterValues) => void;
  agent?: AgentProp;
  /** What the filters narrow ("orders"). */
  noun?: string;
  className?: string;
  showReset?: boolean;
}

/**
 * A filter bar. One tool sets any subset of filters (or resets them), so a
 * page with nine filters still costs one schema.
 */
export function Filters({ filters, value: controlled, defaultValue, onChange, agent, noun = "results", className, showReset = true }: FiltersProps) {
  const [inner, setInner] = useState<FilterValues>(defaultValue ?? {});
  const value = controlled ?? inner;
  const valueRef = useRef(value);
  valueRef.current = value;
  const [agentActive, setAgentActive] = useState(false);

  const setValue = (next: FilterValues) => {
    valueRef.current = next;
    if (controlled === undefined) setInner(next);
    onChange?.(next);
  };
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const set = (id: string, v: unknown) => {
    const next = { ...value };
    if (v === undefined || v === "" || v === null) delete next[id];
    else next[id] = v;
    setValue(next);
  };

  const schema = useMemo<JSONSchema>(() => {
    const properties: Record<string, JSONSchema> = {};
    for (const f of filters) {
      const s: JSONSchema = {};
      if (f.describe) s.description = f.describe;
      switch (f.type) {
        case "select":
          s.type = "string";
          s.enum = f.options.map((o) => o.value);
          break;
        case "text":
        case "date":
          s.type = "string";
          break;
        case "boolean":
          s.type = "boolean";
          break;
        case "range":
          s.type = "object";
          s.properties = { min: { type: "number" }, max: { type: "number" } };
          break;
      }
      properties[f.id] = s;
    }
    properties.reset = { type: "boolean", description: "Clear all filters first." };
    return { type: "object", properties };
  }, [filters]);

  const summary = filters.map((f) => `${f.id}${f.describe ? ` (${f.describe})` : ""}`).join(", ");

  useAgentCapability<FilterValues & { reset?: boolean }, unknown>(
    "filters",
    agent,
    useMemo(
      () => ({
        description: `Set filters that narrow the ${noun}. Provide any subset; omitted filters are unchanged unless reset is true. Filters: ${summary}.`,
        inputSchema: schema,
        annotations: { readOnlyHint: false, consequentialHint: false },
        confirm: false,
        execute: (args) => {
          const { reset, ...rest } = args;
          const next: FilterValues = reset ? {} : { ...valueRef.current };
          for (const [k, v] of Object.entries(rest)) {
            if (!filtersRef.current.some((f) => f.id === k)) continue;
            if (v === null || v === "" || v === undefined) delete next[k];
            else next[k] = v;
          }
          setValueRef.current(next);
          setAgentActive(true);
          setTimeout(() => setAgentActive(false), 1200);
          return { filters: next };
        },
      }),
      [noun, summary, schema],
    ),
  );

  const activeCount = Object.keys(value).length;

  return (
    <div role="group" aria-label="Filters" className={className} data-agentable-filters="" data-agent={agent?.name} data-agent-active={agentActive ? "" : undefined}>
      {filters.map((f) => {
        const v = value[f.id];
        const id = `filter-${f.id}`;
        return (
          <div key={f.id} data-agentable-filter={f.id} data-active={v !== undefined ? "" : undefined}>
            <label htmlFor={id} data-agentable-label="">
              {f.label}
            </label>
            {f.type === "select" ? (
              <select id={id} value={(v as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} data-agentable-input="">
                <option value="">Any</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label ?? o.value}
                  </option>
                ))}
              </select>
            ) : f.type === "boolean" ? (
              <input id={id} type="checkbox" checked={Boolean(v)} onChange={(e) => set(f.id, e.target.checked ? true : undefined)} />
            ) : f.type === "range" ? (
              <span data-agentable-range="">
                <input id={id} type="number" placeholder="min" min={f.min} max={f.max} step={f.step} value={(v as { min?: number })?.min ?? ""} onChange={(e) => set(f.id, { ...(v as object), min: e.target.value === "" ? undefined : Number(e.target.value) })} data-agentable-input="" />
                <input aria-label={`${f.label} max`} type="number" placeholder="max" min={f.min} max={f.max} step={f.step} value={(v as { max?: number })?.max ?? ""} onChange={(e) => set(f.id, { ...(v as object), max: e.target.value === "" ? undefined : Number(e.target.value) })} data-agentable-input="" />
              </span>
            ) : (
              <input id={id} type={f.type === "date" ? "date" : "text"} placeholder={f.type === "text" ? f.placeholder : undefined} value={(v as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} data-agentable-input="" />
            )}
          </div>
        );
      })}
      {showReset ? (
        <button type="button" onClick={() => setValue({})} disabled={!activeCount} data-agentable-button="" data-agentable-filters-reset="">
          Reset{activeCount ? ` (${activeCount})` : ""}
        </button>
      ) : null}
    </div>
  );
}

/** Apply filter values to rows using plain field comparisons. Handy for demos and simple pages. */
export function applyFilters<Row extends Record<string, unknown>>(rows: Row[], values: FilterValues): Row[] {
  return rows.filter((row) =>
    Object.entries(values).every(([k, v]) => {
      const cell = row[k];
      if (v === undefined || v === "") return true;
      if (typeof v === "boolean") return Boolean(cell) === v;
      if (v && typeof v === "object") {
        const { min, max } = v as { min?: number; max?: number };
        const n = typeof cell === "number" ? cell : Number(cell);
        if (min !== undefined && n < min) return false;
        if (max !== undefined && n > max) return false;
        return true;
      }
      return String(cell ?? "").toLowerCase() === String(v).toLowerCase() || String(cell ?? "").toLowerCase().includes(String(v).toLowerCase());
    }),
  );
}
