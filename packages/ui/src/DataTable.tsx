import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { JSONSchema } from "@agentable/core";
import { listForDescription, useAgentCapability } from "./useAgentCapability.js";
import type { AgentProp } from "./types.js";

export interface Column<Row> {
  key: string;
  header: ReactNode;
  /** Short label the agent sees. Defaults to key. */
  describe?: string;
  render?: (row: Row) => ReactNode;
  /** Value used for sorting, filtering, and agent output. Defaults to row[key]. */
  value?: (row: Row) => unknown;
  sortable?: boolean;
  /** Exclude from agent output. */
  agentHidden?: boolean;
  align?: "left" | "right" | "center";
  width?: string | number;
}

export interface Sort {
  column: string;
  dir: "asc" | "desc";
}

export interface TableQuery {
  query?: string;
  sort?: Sort;
  filter?: Record<string, string | number | boolean>;
  limit?: number;
}

export interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  getRowId?: (row: Row, index: number) => string;
  agent?: AgentProp & {
    /** Add a second tool that selects rows by id. Default: on when `selectable`. */
    select?: boolean;
  };
  /** Controlled query state. */
  query?: TableQuery;
  defaultQuery?: TableQuery;
  onQueryChange?: (q: TableQuery) => void;
  selectable?: boolean;
  selected?: string[];
  onSelectionChange?: (ids: string[]) => void;
  caption?: ReactNode;
  emptyMessage?: ReactNode;
  className?: string;
  /** Rows per visual page. Default 25. */
  pageSize?: number;
  /** Human-readable name for what rows are ("orders"). */
  noun?: string;
}

/**
 * A table that exposes one query tool (search, sort, filter) instead of one
 * tool per column. What the agent asks for is what the user sees.
 */
export function DataTable<Row extends object>({
  columns,
  rows,
  getRowId,
  agent,
  query: controlled,
  defaultQuery,
  onQueryChange,
  selectable,
  selected: controlledSelected,
  onSelectionChange,
  caption,
  emptyMessage = "No rows.",
  className,
  pageSize = 25,
  noun = "rows",
}: DataTableProps<Row>) {
  const [inner, setInner] = useState<TableQuery>(defaultQuery ?? {});
  const query = controlled ?? inner;
  const [innerSelected, setInnerSelected] = useState<string[]>([]);
  const selected = controlledSelected ?? innerSelected;
  const [page, setPage] = useState(0);
  const [agentHighlight, setAgentHighlight] = useState(false);

  const setQuery = useCallback(
    (q: TableQuery) => {
      if (controlled === undefined) setInner(q);
      onQueryChange?.(q);
      setPage(0);
    },
    [controlled, onQueryChange],
  );
  const setSelected = useCallback(
    (ids: string[]) => {
      if (controlledSelected === undefined) setInnerSelected(ids);
      onSelectionChange?.(ids);
    },
    [controlledSelected, onSelectionChange],
  );

  const rowId = useCallback((row: Row, i: number) => (getRowId ? getRowId(row, i) : "id" in row ? String((row as { id: unknown }).id) : String(i)), [getRowId]);
  const colValue = useCallback((col: Column<Row>, row: Row) => (col.value ? col.value(row) : (row as Record<string, unknown>)[col.key]), []);

  const visible = useMemo(() => applyQuery(rows, columns, query, colValue), [rows, columns, query, colValue]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageRows = visible.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => {
    if (page >= pageCount) setPage(0);
  }, [page, pageCount]);

  const latest = useRef({ rows, columns, query, colValue, rowId, visible });
  latest.current = { rows, columns, query, colValue, rowId, visible };

  const agentColumns = columns.filter((c) => !c.agentHidden);
  const sortable = agentColumns.filter((c) => c.sortable !== false).map((c) => c.key);
  const inputSchema = useMemo<JSONSchema>(
    () => ({
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search across all columns." },
        sort: {
          type: "object",
          properties: { column: { type: "string", enum: sortable }, dir: { type: "string", enum: ["asc", "desc"] } },
          required: ["column"],
        },
        filter: {
          type: "object",
          description: `Exact-match per column: ${listForDescription(agentColumns.map((c) => c.key), 120)}.`,
          additionalProperties: { type: ["string", "number", "boolean"] },
        },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Max rows to return." },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortable.join(","), agentColumns.map((c) => c.key).join(",")],
  );

  const columnList = listForDescription(agentColumns.map((c) => (c.describe ? `${c.key} (${c.describe})` : c.key)), 260);

  useAgentCapability<TableQuery, unknown>(
    "table",
    agent,
    useMemo(
      () => ({
        description: `Query the ${noun} table. Applies the search, sort, and filter to the visible table and returns matching rows. Columns: ${columnList}.`,
        inputSchema,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        paginate: true,
        execute: (args) => {
          const { rows, columns, colValue } = latest.current;
          const next: TableQuery = { query: args.query, sort: args.sort, filter: args.filter };
          setQuery(next);
          flash(setAgentHighlight);
          const result = applyQuery(rows, columns, next, colValue);
          const limit = args.limit ?? 50;
          return result.slice(0, limit).map((row, i) => toRecord(row, columns, colValue, latest.current.rowId(row, i)));
        },
      }),
      [noun, columnList, inputSchema, setQuery],
    ),
  );

  const selectEnabled = !!agent && (agent.select ?? !!selectable);
  // Output shaping, caching, and description overrides belong to the query tool only.
  const selectAgent = useMemo(
    () => (agent && selectEnabled ? { ...agent, project: undefined, cache: undefined, maxChars: undefined, description: undefined, title: undefined, confirm: undefined } : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agent?.name, agent?.id, agent?.group, agent?.tier, agent?.priority, agent?.exposedTo, selectEnabled],
  );
  useAgentCapability<{ ids: string[]; mode?: "replace" | "add" | "remove" | "clear" }, unknown>(
    "table",
    selectAgent,
    useMemo(
      () => ({
        idSuffix: ".select",
        description: `Select ${noun} in the table by id. Selected rows are what actions operate on.`,
        inputSchema: {
          type: "object",
          properties: {
            ids: { type: "array", items: { type: "string" }, description: "Row ids (from the query tool)." },
            mode: { type: "string", enum: ["replace", "add", "remove", "clear"], description: "Default replace." },
          },
          required: ["ids"],
        },
        annotations: { readOnlyHint: false, consequentialHint: false },
        confirm: false,
        execute: (args) => {
          const { rows, rowId } = latest.current;
          const known = new Set(rows.map((r, i) => rowId(r, i)));
          const wanted = (args.ids ?? []).filter((id) => known.has(id));
          const unknown = (args.ids ?? []).filter((id) => !known.has(id));
          let next: string[];
          switch (args.mode) {
            case "add":
              next = [...new Set([...selected, ...wanted])];
              break;
            case "remove":
              next = selected.filter((id) => !wanted.includes(id));
              break;
            case "clear":
              next = [];
              break;
            default:
              next = wanted;
          }
          setSelected(next);
          flash(setAgentHighlight);
          return { selected: next, ...(unknown.length ? { unknown } : {}) };
        },
      }),
      [noun, selected, setSelected],
    ),
  );

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r, i) => selected.includes(rowId(r, page * pageSize + i)));

  const toggleSort = (key: string) => {
    const dir = query.sort?.column === key && query.sort.dir === "asc" ? "desc" : "asc";
    setQuery({ ...query, sort: { column: key, dir } });
  };

  return (
    <div className={className} data-agentable-table="" data-agent={agent?.name} data-agent-active={agentHighlight ? "" : undefined}>
      <div data-agentable-table-toolbar="">
        <input
          type="search"
          value={query.query ?? ""}
          onChange={(e) => setQuery({ ...query, query: e.target.value || undefined })}
          placeholder={`Search ${noun}...`}
          aria-label={`Search ${noun}`}
          data-agentable-input=""
        />
        {query.filter && Object.keys(query.filter).length ? (
          <div data-agentable-table-filters="">
            {Object.entries(query.filter).map(([k, v]) => (
              <button
                key={k}
                type="button"
                data-agentable-chip=""
                onClick={() => {
                  const { [k]: _drop, ...rest } = query.filter!;
                  setQuery({ ...query, filter: Object.keys(rest).length ? rest : undefined });
                }}
                aria-label={`Remove filter ${k}`}
              >
                {k}: {String(v)} &times;
              </button>
            ))}
          </div>
        ) : null}
        <span data-agentable-table-count="">
          {visible.length} {noun}
          {selected.length ? ` · ${selected.length} selected` : ""}
        </span>
      </div>
      <div data-agentable-table-scroll="">
        <table>
          {caption ? <caption>{caption}</caption> : null}
          <thead>
            <tr>
              {selectable ? (
                <th data-agentable-th="select">
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={allOnPageSelected}
                    onChange={(e) => {
                      const ids = pageRows.map((r, i) => rowId(r, page * pageSize + i));
                      setSelected(e.target.checked ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id)));
                    }}
                  />
                </th>
              ) : null}
              {columns.map((c) => {
                const active = query.sort?.column === c.key;
                const sortableCol = c.sortable !== false;
                return (
                  <th
                    key={c.key}
                    data-agentable-th={c.key}
                    aria-sort={active ? (query.sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                    style={{ textAlign: c.align, width: c.width }}
                  >
                    {sortableCol ? (
                      <button type="button" onClick={() => toggleSort(c.key)} data-agentable-sort={active ? query.sort!.dir : "none"}>
                        {c.header}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} data-agentable-empty="">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => {
                const id = rowId(row, page * pageSize + i);
                const isSelected = selected.includes(id);
                return (
                  <tr key={id} data-agentable-row={id} aria-selected={selectable ? isSelected : undefined} data-selected={isSelected ? "" : undefined}>
                    {selectable ? (
                      <td>
                        <input type="checkbox" aria-label={`Select ${id}`} checked={isSelected} onChange={(e) => setSelected(e.target.checked ? [...selected, id] : selected.filter((s) => s !== id))} />
                      </td>
                    ) : null}
                    {columns.map((c) => (
                      <td key={c.key} style={{ textAlign: c.align }}>
                        {c.render ? c.render(row) : formatCell(colValue(c, row))}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div data-agentable-table-pager="">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} data-agentable-button="">
            Previous
          </button>
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} data-agentable-button="">
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

function flash(set: (v: boolean) => void) {
  set(true);
  setTimeout(() => set(false), 1200);
}

function formatCell(v: unknown): ReactNode {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (v instanceof Date) return v.toLocaleDateString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function toRecord<Row>(row: Row, columns: Column<Row>[], colValue: (c: Column<Row>, r: Row) => unknown, id: string): Record<string, unknown> {
  const out: Record<string, unknown> = { id };
  for (const c of columns) {
    if (c.agentHidden) continue;
    const v = colValue(c, row);
    out[c.key] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

export function applyQuery<Row>(rows: Row[], columns: Column<Row>[], q: TableQuery, colValue: (c: Column<Row>, r: Row) => unknown): Row[] {
  let out = rows;
  const cols = columns.filter((c) => !c.agentHidden);
  if (q.query) {
    const needle = q.query.toLowerCase();
    out = out.filter((r) => cols.some((c) => String(colValue(c, r) ?? "").toLowerCase().includes(needle)));
  }
  if (q.filter) {
    for (const [key, val] of Object.entries(q.filter)) {
      const col = cols.find((c) => c.key === key);
      if (!col) continue;
      out = out.filter((r) => {
        const v = colValue(col, r);
        if (typeof v === "string" && typeof val === "string") return v.toLowerCase() === val.toLowerCase();
        return v === val || String(v) === String(val);
      });
    }
  }
  if (q.sort) {
    const col = columns.find((c) => c.key === q.sort!.column);
    if (col) {
      const dir = q.sort.dir === "desc" ? -1 : 1;
      out = [...out].sort((a, b) => compare(colValue(col, a), colValue(col, b)) * dir);
    }
  }
  return out;
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}
