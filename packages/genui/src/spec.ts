import { toJsonSchema, validateInput, type SchemaInput } from "@agentable-ui/core";
import { getPath, isStatePath, type StateAction, type SurfaceState } from "./state.js";

/** Call a tool through the registry. The result lands in `into` (a ui.* path) when given. */
export interface ToolAction {
  type: "tool";
  name: string;
  args?: Record<string, unknown>;
  into?: string;
}

export type UIAction = StateAction | ToolAction;

export interface UISpec {
  component: string;
  /** Stable id, needed to target the node with patch ops. */
  id?: string;
  props?: Record<string, unknown>;
  /** propName -> state path ("data.orders.open", "ui.selected.name"). Resolved on every render. */
  bind?: Record<string, string>;
  /** eventName -> actions, run in order when the component fires the event. */
  on?: Record<string, UIAction[]>;
  /** Render only while this state path is truthy ("!path" for falsy). */
  when?: string;
  children?: UISpec[];
}

/** Incremental edits to the presented tree. */
export type SurfaceOp =
  | { op: "add"; parent: string; node: UISpec; index?: number }
  /** Replace the node with the same id. Its children are kept unless `node.children` is given. */
  | { op: "update"; node: UISpec }
  | { op: "remove"; id: string }
  /** Write surface state; `path` must be under ui. */
  | { op: "set"; path: string; value: unknown };

/** The slice of a catalog entry validation needs. */
export interface ValidatableEntry {
  props: SchemaInput;
  childrenProp?: string;
  events?: Record<string, string>;
}

export interface SpecIssue {
  path: string;
  message: string;
}

export interface ValidateOptions {
  maxDepth?: number;
  maxNodes?: number;
  /** State that bindings and `when` resolve against. Bound data.* paths must exist. */
  state?: SurfaceState;
  /** Tool names that `tool` actions may call. None when absent. */
  tools?: ReadonlySet<string>;
}

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const STATE_ACTIONS = new Set(["set", "merge", "push", "remove", "increment", "toggle"]);

export function isVisible(node: Pick<UISpec, "when">, state: SurfaceState): boolean {
  if (!node.when) return true;
  const neg = node.when.startsWith("!");
  const v = getPath(state, neg ? node.when.slice(1) : node.when);
  return neg ? !v : !!v;
}

/** Static props overlaid with bound values that currently resolve. */
export function resolveProps(node: UISpec, state: SurfaceState): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(node.props ?? {}) };
  for (const [prop, path] of Object.entries(node.bind ?? {})) {
    const v = getPath(state, path);
    if (v !== undefined) out[prop] = v;
  }
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function actionIssues(a: unknown, path: string, tools: ReadonlySet<string> | undefined): SpecIssue[] {
  if (!isObject(a) || typeof a.type !== "string") return [{ path, message: "Each action needs a type." }];
  if (a.type === "tool") {
    const out: SpecIssue[] = [];
    if (typeof a.name !== "string" || !tools?.has(a.name)) {
      const allowed = tools?.size ? [...tools].join(", ") : "(none)";
      out.push({ path: `${path}.name`, message: `Unknown tool "${String(a.name)}". Callable: ${allowed}.` });
    }
    if (a.args !== undefined && !isObject(a.args)) out.push({ path: `${path}.args`, message: "args must be an object." });
    if (a.into !== undefined && !isStatePath(a.into, ["ui"])) out.push({ path: `${path}.into`, message: "into must be a ui.* path." });
    return out;
  }
  if (!STATE_ACTIONS.has(a.type)) return [{ path: `${path}.type`, message: `Unknown action "${a.type}". Use set, merge, push, remove, increment, toggle or tool.` }];
  if (!isStatePath(a.path, ["ui"])) return [{ path: `${path}.path`, message: "Actions may only write ui.* paths; data.* is read-only." }];
  if ((a.type === "set" || a.type === "push") && !("value" in a)) return [{ path, message: `${a.type} needs a value.` }];
  if (a.type === "merge" && !isObject(a.value)) return [{ path: `${path}.value`, message: "merge needs an object value." }];
  if (a.type === "increment" && a.by !== undefined && typeof a.by !== "number") return [{ path: `${path}.by`, message: "by must be a number." }];
  return [];
}

/**
 * Validate a spec against the catalog. Unknown props are dropped; unknown
 * components, bad props, dangling data bindings and writes outside ui.* fail.
 * Nodes hidden by `when` skip the checks that depend on bound values: their
 * data (a selection, say) legitimately does not exist until they show.
 */
export async function validateSpec(
  spec: UISpec,
  catalog: Record<string, ValidatableEntry>,
  allowed: Set<string>,
  opts: ValidateOptions = {},
): Promise<{ ok: true; spec: UISpec; nodes: number } | { ok: false; issues: SpecIssue[] }> {
  const maxDepth = opts.maxDepth ?? 6;
  const maxNodes = opts.maxNodes ?? 60;
  const state: SurfaceState = opts.state ?? { data: {}, ui: {} };
  const issues: SpecIssue[] = [];
  const ids = new Set<string>();
  let nodes = 0;

  async function walk(node: UISpec, path: string, depth: number, parentHidden: boolean): Promise<UISpec | null> {
    nodes++;
    if (nodes > maxNodes) {
      issues.push({ path, message: `More than ${maxNodes} nodes.` });
      return null;
    }
    if (depth > maxDepth) {
      issues.push({ path, message: `Deeper than ${maxDepth} levels.` });
      return null;
    }
    if (!node || typeof node !== "object" || typeof node.component !== "string") {
      issues.push({ path, message: "Each node needs a component name." });
      return null;
    }
    const entry = catalog[node.component];
    if (!entry || !allowed.has(node.component)) {
      issues.push({ path, message: `Unknown component "${node.component}". Allowed: ${[...allowed].join(", ")}.` });
      return null;
    }
    const out: UISpec = { component: node.component };
    const before = issues.length;

    if (node.id !== undefined) {
      if (typeof node.id !== "string" || !ID_PATTERN.test(node.id)) issues.push({ path: `${path}.id`, message: "id must match [a-zA-Z0-9_-]+." });
      else if (ids.has(node.id)) issues.push({ path: `${path}.id`, message: `Duplicate id "${node.id}".` });
      else {
        ids.add(node.id);
        out.id = node.id;
      }
    }

    if (node.when !== undefined) {
      if (!isStatePath(node.when, ["data", "ui"], true)) issues.push({ path: `${path}.when`, message: 'when must be a state path like "ui.selected" or "!data.done".' });
      else out.when = node.when;
    }
    const hidden = parentHidden || (out.when !== undefined && !isVisible(out, state));

    const schema = toJsonSchema(entry.props);
    const known = new Set(Object.keys((schema.properties as object) ?? {}));

    const bind: Record<string, string> = {};
    let unresolved = false;
    if (node.bind !== undefined) {
      if (!isObject(node.bind)) issues.push({ path: `${path}.bind`, message: "bind must map prop names to state paths." });
      else
        for (const [prop, sp] of Object.entries(node.bind)) {
          const at = `${path}.bind.${prop}`;
          if (!known.has(prop)) issues.push({ path: at, message: `"${node.component}" has no prop "${prop}".` });
          else if (!isStatePath(sp)) issues.push({ path: at, message: 'Bind to a state path under data.* or ui.*, e.g. "data.orders.open".' });
          else {
            bind[prop] = sp;
            if (getPath(state, sp) === undefined) {
              unresolved = true;
              if (!hidden && sp.startsWith("data.")) issues.push({ path: at, message: `State path "${sp}" does not exist.` });
            }
          }
        }
      if (Object.keys(bind).length) out.bind = bind;
    }

    const raw = isObject(node.props) ? node.props : {};
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) if (known.has(k)) cleaned[k] = v;
    if (hidden || unresolved) {
      // Bound values are not there yet; the schema check runs once they are.
      out.props = cleaned;
    } else {
      const result = await validateInput(entry.props, resolveProps({ ...out, props: cleaned }, state));
      if (!result.ok) {
        for (const i of result.issues) issues.push({ path: `${path}.props${i.path ? "." + i.path : ""}`, message: i.message });
      } else {
        const value = { ...(result.value as Record<string, unknown>) };
        for (const prop of Object.keys(bind)) delete value[prop];
        out.props = value;
      }
    }

    if (node.on !== undefined) {
      const events = entry.events ?? {};
      if (!isObject(node.on)) issues.push({ path: `${path}.on`, message: "on must map event names to action lists." });
      else {
        const on: Record<string, UIAction[]> = {};
        for (const [ev, actions] of Object.entries(node.on)) {
          const at = `${path}.on.${ev}`;
          if (!(ev in events)) {
            const names = Object.keys(events);
            issues.push({ path: at, message: `"${node.component}" has no event "${ev}".${names.length ? ` Events: ${names.join(", ")}.` : ""}` });
          } else if (!Array.isArray(actions)) issues.push({ path: at, message: "Handlers are lists of actions." });
          else {
            actions.forEach((a, i) => issues.push(...actionIssues(a, `${at}[${i}]`, opts.tools)));
            on[ev] = actions as UIAction[];
          }
        }
        if (Object.keys(on).length) out.on = on;
      }
    }

    if (Array.isArray(node.children) && node.children.length) {
      if (!entry.childrenProp) {
        issues.push({ path: `${path}.children`, message: `"${node.component}" does not accept children.` });
      } else {
        const kids: UISpec[] = [];
        for (let i = 0; i < node.children.length; i++) {
          const kid = await walk(node.children[i]!, `${path}.children[${i}]`, depth + 1, hidden);
          if (kid) kids.push(kid);
        }
        out.children = kids;
      }
    }
    return issues.length > before ? null : out;
  }

  const cleaned = await walk(spec, "root", 1, false);
  if (issues.length || !cleaned) return { ok: false, issues };
  return { ok: true, spec: cleaned, nodes };
}

/**
 * Apply patch ops to a tree. Returns the new tree plus the state writes to
 * dispatch; throws with a message naming the op that failed. The caller
 * validates the result before committing, so a bad batch changes nothing.
 */
export function applyOps(root: UISpec, ops: SurfaceOp[]): { root: UISpec; state: StateAction[] } {
  let tree = structuredClone(root);
  const state: StateAction[] = [];
  const matches = (n: UISpec, id: string) => n.id === id || (id === "root" && n === tree);

  ops.forEach((op, i) => {
    const at = `ops[${i}]`;
    if (!isObject(op)) throw new Error(`${at}: each op must be an object.`);
    if (op.op === "set") {
      state.push({ type: "set", path: op.path, value: op.value });
      return;
    }
    if (op.op === "add") {
      const parent = find(tree, (n) => matches(n, op.parent));
      if (!parent) throw new Error(`${at}: no node with id "${op.parent}".`);
      const kids = (parent.children ??= []);
      const idx = typeof op.index === "number" ? Math.max(0, Math.min(op.index, kids.length)) : kids.length;
      kids.splice(idx, 0, op.node);
      return;
    }
    if (op.op === "update") {
      const id = op.node?.id;
      if (!id) throw new Error(`${at}: update needs node.id.`);
      const target = find(tree, (n) => n.id === id);
      if (!target) throw new Error(`${at}: no node with id "${id}".`);
      const next: UISpec = { ...op.node, children: op.node.children ?? target.children };
      if (target === tree) tree = next;
      else replaceIn(tree, target, next);
      return;
    }
    if (op.op === "remove") {
      const target = find(tree, (n) => n.id === op.id);
      if (!target) throw new Error(`${at}: no node with id "${op.id}".`);
      if (target === tree) throw new Error(`${at}: cannot remove the root; present null to clear.`);
      replaceIn(tree, target, null);
      return;
    }
    throw new Error(`${at}: unknown op "${String((op as { op?: unknown }).op)}". Use add, update, remove or set.`);
  });
  return { root: tree, state };
}

function find(node: UISpec, pred: (n: UISpec) => boolean): UISpec | undefined {
  if (pred(node)) return node;
  for (const c of node.children ?? []) {
    const hit = find(c, pred);
    if (hit) return hit;
  }
  return undefined;
}

function replaceIn(node: UISpec, target: UISpec, next: UISpec | null): boolean {
  const kids = node.children;
  if (!kids) return false;
  const i = kids.indexOf(target);
  if (i >= 0) {
    if (next) kids[i] = next;
    else kids.splice(i, 1);
    return true;
  }
  return kids.some((c) => replaceIn(c, target, next));
}
