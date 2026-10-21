/**
 * Surface state. Two roots: `data` is the app's, read-only to generated UI;
 * `ui` belongs to the surface and is the only thing actions may write.
 */

export interface SurfaceState {
  data: Record<string, unknown>;
  ui: Record<string, unknown>;
}

/** Keys that reach an object's prototype. Paths come from agents and user input, so they are never followed. */
const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/** A read-only list filter in a path: `items[done=true]`, `items[status!="archived"]`. */
export interface PathFilter {
  field: string;
  op: "=" | "!=";
  value: string | number | boolean;
}

export type PathKey = string | number | PathFilter;

const isFilter = (k: PathKey): k is PathFilter => typeof k === "object";

function literal(raw: string): string | number | boolean {
  if (raw.startsWith('"')) return raw.slice(1, -1);
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

/**
 * "a.b[0].c" -> ["a", "b", 0, "c"]; "items[done=true]" -> ["items", {field: "done", op: "=", value: true}].
 * Throws on __proto__, prototype and constructor segments, and on malformed selectors.
 */
export function parsePath(path: string): PathKey[] {
  if (!path) return [];
  const keys: PathKey[] = [];
  let i = 0;
  while (i < path.length) {
    const c = path[i];
    if (c === ".") {
      i++;
      continue;
    }
    const rest = path.slice(i);
    if (c === "[") {
      const index = /^\[(\d+)\]/.exec(rest);
      if (index) {
        keys.push(Number(index[1]));
        i += index[0].length;
        continue;
      }
      const filter = /^\[([A-Za-z_][A-Za-z0-9_]*)(!?=)("[^"\]]*"|[A-Za-z0-9_.-]+)\]/.exec(rest);
      if (!filter) throw new Error(`Path "${path}" has a bad selector; use [0] or [field=value].`);
      keys.push({ field: filter[1]!, op: filter[2] as PathFilter["op"], value: literal(filter[3]!) });
      i += filter[0].length;
      continue;
    }
    const seg = /^[^.[\]]+/.exec(rest)![0];
    keys.push(/^\d+$/.test(seg) ? Number(seg) : seg);
    i += seg.length;
  }
  for (const k of keys) {
    const name = isFilter(k) ? k.field : k;
    if (typeof name === "string" && UNSAFE_KEYS.has(name)) throw new Error(`Path "${path}" uses the reserved key "${name}".`);
  }
  return keys;
}

function matches(item: unknown, f: PathFilter): boolean {
  const v = item !== null && typeof item === "object" && Object.hasOwn(item, f.field) ? (item as Record<string, unknown>)[f.field] : undefined;
  // Booleans compare by truthiness so a missing `done` counts as `done=false`.
  const eq = typeof f.value === "boolean" ? Boolean(v) === f.value : v !== undefined && v !== null && String(v) === String(f.value);
  return f.op === "=" ? eq : !eq;
}

/** Read a path, following own properties only. Filters narrow arrays. Undefined for missing or unsafe paths. */
export function getPath(obj: unknown, path: string): unknown {
  let keys: PathKey[];
  try {
    keys = parsePath(path);
  } catch {
    return undefined;
  }
  let cur: unknown = obj;
  for (const key of keys) {
    if (isFilter(key)) {
      if (!Array.isArray(cur)) return undefined;
      cur = cur.filter((item) => matches(item, key));
      continue;
    }
    if (cur == null || typeof cur !== "object" || !Object.hasOwn(cur, key)) return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

/** True for "data.x" / "ui.x" (and "!ui.x" when `negatable`). */
export function isStatePath(path: unknown, roots: ReadonlyArray<"data" | "ui"> = ["data", "ui"], negatable = false): path is string {
  if (typeof path !== "string") return false;
  const p = negatable && path.startsWith("!") ? path.slice(1) : path;
  let keys: PathKey[];
  try {
    keys = parsePath(p);
  } catch {
    return false;
  }
  const head = keys[0];
  return typeof head === "string" && (roots as readonly string[]).includes(head) && keys.length > 1;
}

function setPath(obj: Record<string, unknown>, keys: Array<string | number>, value: unknown): void {
  if (!keys.length) throw new Error("Cannot replace the whole ui state.");
  let cur: Record<string | number, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!;
    const next = keys[i + 1]!;
    if (!Object.hasOwn(cur, k) || cur[k] == null || typeof cur[k] !== "object") cur[k] = typeof next === "number" ? [] : {};
    cur = cur[k] as Record<string | number, unknown>;
  }
  const last = keys[keys.length - 1]!;
  if (value === undefined) {
    if (Array.isArray(cur) && typeof last === "number") cur.splice(last, 1);
    else delete cur[last];
  } else cur[last] = value;
}

export type StateAction =
  | { type: "set"; path: string; value: unknown }
  | { type: "merge"; path: string; value: Record<string, unknown> }
  | { type: "push"; path: string; value: unknown }
  | { type: "remove"; path: string }
  | { type: "increment"; path: string; by?: number }
  | { type: "toggle"; path: string };

/** Keys under `ui` for a "ui.x.y" path. Throws for anything outside ui. */
function uiKeys(path: string): Array<string | number> {
  const keys = parsePath(path);
  if (keys[0] !== "ui" || keys.length < 2) throw new Error(`Actions may only write ui.* paths (got "${path}").`);
  if (keys.some(isFilter)) throw new Error(`Filters like [field=value] are read-only (got "${path}").`);
  return keys.slice(1) as Array<string | number>;
}

function reduce(ui: Record<string, unknown>, a: StateAction): void {
  const keys = uiKeys(a.path);
  const cur = getPath({ ui }, a.path);
  switch (a.type) {
    case "set":
      return setPath(ui, keys, a.value);
    case "merge":
      if (cur !== undefined && (typeof cur !== "object" || cur === null || Array.isArray(cur))) throw new Error(`merge target "${a.path}" is not an object`);
      return setPath(ui, keys, { ...(cur as object), ...a.value });
    case "push":
      if (cur !== undefined && !Array.isArray(cur)) throw new Error(`push target "${a.path}" is not an array`);
      return setPath(ui, keys, [...((cur as unknown[]) ?? []), a.value]);
    case "remove":
      return setPath(ui, keys, undefined);
    case "increment":
      if (cur !== undefined && typeof cur !== "number") throw new Error(`increment target "${a.path}" is not a number`);
      return setPath(ui, keys, ((cur as number) ?? 0) + (a.by ?? 1));
    case "toggle":
      return setPath(ui, keys, !cur);
  }
}

export interface UiStore {
  get(): Record<string, unknown>;
  /** Apply actions all-or-nothing. Throws, leaving state untouched, if any fails. */
  dispatch(actions: StateAction | StateAction[]): void;
  replace(next: Record<string, unknown>): void;
  subscribe(fn: () => void): () => void;
}

export function createUiStore(initial: Record<string, unknown> = {}): UiStore {
  let ui = structuredClone(initial);
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    get: () => ui,
    dispatch(actions) {
      const list = Array.isArray(actions) ? actions : [actions];
      const draft = structuredClone(ui);
      for (const a of list) reduce(draft, a);
      ui = draft;
      emit();
    },
    replace(next) {
      ui = structuredClone(next);
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

const PLACEHOLDER = /\{\{\s*([^}]+?)\s*\}\}/g;
const WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;

function resolveExpr(expr: string, payload: Record<string, unknown>, state: SurfaceState): unknown {
  if (isStatePath(expr)) return getPath(state, expr);
  return getPath(payload, expr);
}

/**
 * Substitute `{{…}}` placeholders in action values.
 *   {{value}} / {{value.id}}   the event's value, or a field of it
 *   {{ui.x}} / {{data.x}}      surface state at the time of the event
 * A string that is exactly one placeholder keeps the resolved type; embedded
 * placeholders (e.g. "ui.rows[{{value}}].done") are stringified.
 */
export function interpolate<T>(input: T, payload: Record<string, unknown>, state: SurfaceState): T {
  const sub = (v: unknown): unknown => {
    if (typeof v === "string") {
      const whole = v.match(WHOLE);
      if (whole) return resolveExpr(whole[1]!, payload, state) ?? null;
      if (!v.includes("{{")) return v;
      return v.replace(PLACEHOLDER, (_, expr: string) => {
        const r = resolveExpr(expr, payload, state);
        return r == null ? "" : typeof r === "object" ? JSON.stringify(r) : String(r);
      });
    }
    if (Array.isArray(v)) return v.map(sub);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sub(x)]));
    return v;
  };
  return sub(input) as T;
}
