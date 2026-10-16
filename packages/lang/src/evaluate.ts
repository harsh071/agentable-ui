import type { Arg, Expr, LangError, Statement } from "./ast.js";
import type { Signature } from "./library.js";

/** The node tree the renderer draws: structurally the same as @agentable-ui/genui's UISpec. */
export interface UINode {
  component: string;
  id?: string;
  props?: Record<string, unknown>;
  bind?: Record<string, string>;
  on?: Record<string, UIAction[]>;
  when?: string;
  children?: UINode[];
}

export type UIAction =
  | { type: "set"; path: string; value: unknown }
  | { type: "merge"; path: string; value: Record<string, unknown> }
  | { type: "push"; path: string; value: unknown }
  | { type: "remove"; path: string }
  | { type: "increment"; path: string; by?: number }
  | { type: "toggle"; path: string }
  | { type: "tool"; name: string; args?: Record<string, unknown>; into?: string }
  | { type: "message"; text: string };

export interface EvalResult {
  root: UINode | null;
  /** Node count in `root`. */
  nodes: number;
  /** Names used as children that no statement defines yet. Expected while streaming. */
  unresolved: string[];
  errors: LangError[];
}

const isRefList = (x: Expr): boolean => x.kind === "ref" || (x.kind === "array" && x.items.every((i) => i.kind === "ref"));

/** Built-in actions: name -> positional parameters. `path` params must be $ui.* paths. */
const ACTIONS: Record<string, { type: UIAction["type"]; params: Array<{ name: string; kind: "path" | "value" | "string" | "number" | "object"; required?: boolean }> }> = {
  Set: { type: "set", params: [{ name: "path", kind: "path", required: true }, { name: "value", kind: "value", required: true }] },
  Merge: { type: "merge", params: [{ name: "path", kind: "path", required: true }, { name: "value", kind: "object", required: true }] },
  Push: { type: "push", params: [{ name: "path", kind: "path", required: true }, { name: "value", kind: "value", required: true }] },
  Remove: { type: "remove", params: [{ name: "path", kind: "path", required: true }] },
  Increment: { type: "increment", params: [{ name: "path", kind: "path", required: true }, { name: "by", kind: "number" }] },
  Toggle: { type: "toggle", params: [{ name: "path", kind: "path", required: true }] },
  Tool: { type: "tool", params: [{ name: "name", kind: "string", required: true }, { name: "args", kind: "object" }, { name: "into", kind: "path" }] },
  Say: { type: "message", params: [{ name: "text", kind: "string", required: true }] },
};

export const ACTION_NAMES = Object.keys(ACTIONS);

/**
 * Turn parsed statements into a node tree using the library's signatures.
 * Positional arguments map to props in signature order, then to children.
 * Named arguments may be props, `children`, `when`, or an event name.
 */
export function evaluate(statements: Statement[], signatures: Record<string, Signature>): EvalResult {
  const errors: LangError[] = [];
  const unresolved = new Set<string>();
  const byName = new Map(statements.map((s) => [s.name, s]));
  const used = new Set<string>();
  let nodes = 0;

  const rootStatement = byName.get("root") ?? statements[0];
  if (!rootStatement) return { root: null, nodes: 0, unresolved: [], errors };
  if (rootStatement.name !== "root") errors.push({ code: "no-root", message: `No "root" statement; using "${rootStatement.name}".`, line: rootStatement.line, severity: "warning" });

  function node(st: Statement, stack: string[]): UINode | null {
    if (stack.includes(st.name)) {
      errors.push({ code: "cycle", message: `"${st.name}" contains itself.`, line: st.line, severity: "error" });
      return null;
    }
    if (used.has(st.name)) {
      errors.push({ code: "reused-node", message: `"${st.name}" is used in more than one place; define a second statement.`, line: st.line, severity: "error" });
      return null;
    }
    const e = st.expr;
    if (e.kind !== "call") {
      errors.push({ code: "not-a-component", message: `"${st.name}" must be a component call like Card(...).`, line: st.line, severity: "error" });
      return null;
    }
    const sig = signatures[e.name];
    if (!sig) {
      errors.push({ code: "unknown-component", message: `Unknown component "${e.name}". Components: ${Object.keys(signatures).join(", ")}.`, line: st.line, severity: "error" });
      return null;
    }
    used.add(st.name);
    nodes++;
    const out: UINode = { component: e.name, id: st.name };
    const props: Record<string, unknown> = {};
    const bind: Record<string, string> = {};
    const on: Record<string, UIAction[]> = {};
    let childExprs: Expr | undefined;

    const slots = [...sig.props, ...(sig.childrenProp ? ["children"] : [])];
    let pos = 0;
    for (const arg of e.args) {
      let key = arg.name;
      if (!key) {
        // A list of names (or one name) is the children wherever it sits.
        if (sig.childrenProp && isRefList(arg.expr)) key = "children";
        else if (pos >= sig.props.length) {
          errors.push({ code: "excess-args", message: `${e.name} takes ${slots.length} arguments; extra ones dropped.`, line: st.line, severity: "warning" });
          break;
        } else key = slots[pos++]!;
      }
      if (key === "children") {
        if (!sig.childrenProp) errors.push({ code: "unknown-arg", message: `${e.name} does not take children.`, line: st.line, severity: "warning" });
        else childExprs = arg.expr;
        continue;
      }
      if (key === "when") {
        if (arg.expr.kind !== "path" || !/^(ui|data)\./.test(arg.expr.path)) errors.push({ code: "bad-arg", message: `when: must be a $ui.* or $data.* path.`, line: st.line, severity: "warning" });
        else out.when = `${arg.expr.negated ? "!" : ""}${arg.expr.path}`;
        continue;
      }
      if (sig.events.includes(key)) {
        const list = actionList(arg.expr, st, e.name, key);
        if (list) on[key] = list;
        continue;
      }
      if (!sig.props.includes(key)) {
        errors.push({ code: "unknown-arg", message: `${e.name} has no argument "${key}". Arguments: ${slots.join(", ")}${sig.events.length ? `; events: ${sig.events.join(", ")}` : ""}.`, line: st.line, severity: "warning" });
        continue;
      }
      if (arg.expr.kind === "null") continue;
      if (arg.expr.kind === "path") {
        if (arg.expr.negated || !/^(ui|data)\./.test(arg.expr.path)) errors.push({ code: "bad-arg", message: `${key}: bind to a $ui.* or $data.* path.`, line: st.line, severity: "warning" });
        else bind[key] = arg.expr.path;
        continue;
      }
      const v = literal(arg.expr, st, `${e.name}(${key})`);
      if (v !== undefined) props[key] = v;
    }

    if (Object.keys(props).length) out.props = props;
    if (Object.keys(bind).length) out.bind = bind;
    if (Object.keys(on).length) out.on = on;

    if (childExprs) {
      const items = childExprs.kind === "array" ? childExprs.items : [childExprs];
      const kids: UINode[] = [];
      for (const item of items) {
        if (item.kind !== "ref") {
          errors.push({ code: "bad-arg", message: `${e.name} children must be names of other statements.`, line: st.line, severity: "warning" });
          continue;
        }
        const target = byName.get(item.name);
        if (!target) {
          unresolved.add(item.name);
          continue;
        }
        const kid = node(target, [...stack, st.name]);
        if (kid) kids.push(kid);
      }
      out.children = kids;
    }
    return out;
  }

  /** Literal JSON for a prop: no refs, paths or actions inside. */
  function literal(x: Expr, st: Statement, where: string): unknown {
    switch (x.kind) {
      case "string":
      case "number":
      case "boolean":
        return x.value;
      case "null":
        return null;
      case "array":
        return x.items.map((i) => literal(i, st, where)).filter((v) => v !== undefined);
      case "object":
        return Object.fromEntries(x.entries.map(([k, v]) => [k, literal(v, st, where)]).filter(([, v]) => v !== undefined));
      default:
        errors.push({ code: "bad-arg", message: `${where}: ${x.kind === "ref" ? "a node reference" : x.kind === "path" ? "a $path" : "a call"} is not allowed inside a value. Bind a whole prop with $ui.x or $data.x instead.`, line: st.line, severity: "warning" });
        return undefined;
    }
  }

  /** Action argument: paths become {{templates}} resolved when the event fires. */
  function template(x: Expr, st: Statement, where: string): unknown {
    switch (x.kind) {
      case "path":
        if (x.negated) {
          errors.push({ code: "bad-arg", message: `${where}: "!" is only allowed in when:.`, line: st.line, severity: "warning" });
          return undefined;
        }
        return `{{${x.path === "event" ? "value" : x.path.startsWith("event.") ? `value.${x.path.slice(6)}` : x.path}}}`;
      case "array":
        return x.items.map((i) => template(i, st, where)).filter((v) => v !== undefined);
      case "object":
        return Object.fromEntries(x.entries.map(([k, v]) => [k, template(v, st, where)]).filter(([, v]) => v !== undefined));
      default:
        return literal(x, st, where);
    }
  }

  function actionList(x: Expr, st: Statement, comp: string, event: string): UIAction[] | null {
    const items = x.kind === "array" ? x.items : [x];
    const out: UIAction[] = [];
    for (const item of items) {
      if (item.kind !== "action") {
        errors.push({ code: "bad-arg", message: `${comp} ${event}: expected an @Action, e.g. @Set($ui.x, $event).`, line: st.line, severity: "warning" });
        continue;
      }
      const a = action(item.name, item.args, st, `${comp} ${event}`);
      if (a) out.push(a);
    }
    return out.length ? out : null;
  }

  function action(name: string, args: Arg[], st: Statement, where: string): UIAction | null {
    const def = ACTIONS[name];
    if (!def) {
      errors.push({ code: "unknown-action", message: `${where}: unknown action @${name}. Actions: ${ACTION_NAMES.map((n) => `@${n}`).join(", ")}.`, line: st.line, severity: "warning" });
      return null;
    }
    const out: Record<string, unknown> = { type: def.type };
    let pos = 0;
    for (const arg of args) {
      const p = arg.name ? def.params.find((q) => q.name === arg.name) : def.params[pos++];
      if (!p) {
        errors.push({ code: "excess-args", message: `${where}: @${name} takes ${def.params.map((q) => q.name).join(", ")}.`, line: st.line, severity: "warning" });
        continue;
      }
      const x = arg.expr;
      if (p.kind === "path") {
        if (x.kind !== "path" || x.negated || !x.path.startsWith("ui.")) {
          errors.push({ code: "bad-arg", message: `${where}: @${name} ${p.name} must be a $ui.* path.`, line: st.line, severity: "warning" });
          return null;
        }
        out[p.name] = x.path;
        continue;
      }
      if (x.kind === "null") continue;
      const v = template(x, st, `${where} @${name}`);
      if (v === undefined) continue;
      if (p.kind === "string" && typeof v !== "string") {
        errors.push({ code: "bad-arg", message: `${where}: @${name} ${p.name} must be a string.`, line: st.line, severity: "warning" });
        return null;
      }
      if (p.kind === "number" && typeof v !== "number") {
        errors.push({ code: "bad-arg", message: `${where}: @${name} ${p.name} must be a number.`, line: st.line, severity: "warning" });
        return null;
      }
      if (p.kind === "object" && (typeof v !== "object" || v === null || Array.isArray(v))) {
        errors.push({ code: "bad-arg", message: `${where}: @${name} ${p.name} must be an object.`, line: st.line, severity: "warning" });
        return null;
      }
      out[p.name] = v;
    }
    for (const p of def.params) {
      if (p.required && out[p.name] === undefined) {
        errors.push({ code: "missing-required", message: `${where}: @${name} needs ${p.name}.`, line: st.line, severity: "warning" });
        return null;
      }
    }
    return out as UIAction;
  }

  const root = node(rootStatement, []);
  return { root, nodes, unresolved: [...unresolved], errors };
}
