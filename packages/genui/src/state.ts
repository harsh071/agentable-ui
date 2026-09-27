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

/** "a.b[0].c" -> ["a", "b", 0, "c"]. Throws on __proto__, prototype and constructor segments. */
export function parsePath(path: string): Array<string | number> {
  if (!path) return [];
  const keys = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .map((p) => (/^\d+$/.test(p) ? Number(p) : p));
  for (const k of keys) if (typeof k === "string" && UNSAFE_KEYS.has(k)) throw new Error(`Path "${path}" uses the reserved key "${k}".`);
  return keys;
}

/** Read a path, following own properties only. Undefined for missing or unsafe paths. */
export function getPath(obj: unknown, path: string): unknown {
  let keys: Array<string | number>;
  try {
    keys = parsePath(path);
  } catch {
    return undefined;
  }
  let cur: unknown = obj;
  for (const key of keys) {
    if (cur == null || typeof cur !== "object" || !Object.hasOwn(cur, key)) return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

/** True for "data.x" / "ui.x" (and "!ui.x" when `negatable`). */
export function isStatePath(path: unknown, roots: ReadonlyArray<"data" | "ui"> = ["data", "ui"], negatable = false): path is string {
  if (typeof path !== "string") return false;
  const p = negatable && path.startsWith("!") ? path.slice(1) : path;
  let keys: Array<string | number>;
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
  return keys.slice(1);
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
