import { LIMITS } from "./limits.js";
import type { OutputOptions } from "./types.js";

export interface ShapeResult {
  /** The string handed to the agent. */
  text: string;
  truncated: boolean;
  hasMore: boolean;
  cursor?: string;
}

export const CURSOR_PARAM = "cursor";

export function encodeCursor(offset: number): string {
  return btoa(JSON.stringify({ o: offset }));
}

export function decodeCursor(cursor: unknown): number {
  if (typeof cursor !== "string" || !cursor) return 0;
  try {
    const parsed = JSON.parse(atob(cursor)) as { o?: unknown };
    return typeof parsed.o === "number" && parsed.o >= 0 ? Math.floor(parsed.o) : 0;
  } catch {
    return 0;
  }
}

/** Keep only listed fields (dot paths) on an object. */
export function project(value: unknown, fields: string[]): unknown {
  if (Array.isArray(value)) return value.map((v) => project(v, fields));
  if (!value || typeof value !== "object") return value;
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const [head, ...rest] = f.split(".");
    if (!head || !(head in src)) continue;
    if (rest.length === 0) out[head] = src[head];
    else {
      const nested = project(src[head], [rest.join(".")]);
      if (nested && typeof nested === "object" && Object.keys(nested as object).length) {
        out[head] = out[head] && typeof out[head] === "object"
          ? { ...(out[head] as object), ...(nested as object) }
          : nested;
      }
    }
  }
  return out;
}

export function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Project, paginate, then hard-truncate. Arrays shrink page by page until the
 * envelope fits `maxChars`, and the envelope carries `has_more` + `cursor` so
 * the agent knows to ask again rather than seeing a silently cut string.
 */
export function shape(raw: unknown, opts: OutputOptions | undefined, offset = 0): ShapeResult {
  const maxChars = opts?.maxChars ?? LIMITS.toolOutput;
  let value = raw;
  if (opts?.project?.length) value = project(value, opts.project);

  const paginate = opts?.paginate;
  if (paginate && Array.isArray(value)) {
    const total = value.length;
    const requested = typeof paginate === "object" && paginate.pageSize ? paginate.pageSize : total;
    let size = Math.max(1, Math.min(requested, total - offset));
    let text = "";
    let hasMore = false;
    // Shrink until it fits. Always return at least one item.
    for (;;) {
      const items = value.slice(offset, offset + size);
      hasMore = offset + size < total;
      const envelope: Record<string, unknown> = { items, total, has_more: hasMore };
      if (hasMore) envelope.cursor = encodeCursor(offset + size);
      text = JSON.stringify(envelope);
      if (text.length <= maxChars || size <= 1) break;
      size = Math.max(1, Math.floor(size / 2));
    }
    if (text.length > maxChars) {
      // A single item does not fit. Truncate it explicitly.
      return { text: hardTruncate(text, maxChars), truncated: true, hasMore, ...(hasMore ? { cursor: encodeCursor(offset + 1) } : {}) };
    }
    return { text, truncated: false, hasMore, ...(hasMore ? { cursor: encodeCursor(offset + size) } : {}) };
  }

  const text = stringify(value);
  if (text.length <= maxChars) return { text, truncated: false, hasMore: false };
  return { text: hardTruncate(text, maxChars), truncated: true, hasMore: false };
}

const TRUNCATED_SUFFIX = " …[truncated]";

export function hardTruncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const keep = Math.max(0, maxChars - TRUNCATED_SUFFIX.length);
  return text.slice(0, keep) + TRUNCATED_SUFFIX;
}
