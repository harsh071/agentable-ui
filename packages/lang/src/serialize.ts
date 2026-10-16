import type { UIAction, UINode } from "./evaluate.js";
import type { Library } from "./library.js";

/**
 * Write a node tree as a program. Positional arguments are used while the
 * props line up with the signature; named arguments after the first gap.
 * Useful for showing a JSON spec as the language, and for measuring both.
 */
export function serialize(root: UINode, lib: Library): string {
  const lines: string[] = [];
  const taken = new Set<string>();
  const nameFor = (n: UINode, i: number): string => {
    let base = n.id ?? `${n.component.toLowerCase()}${i}`;
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(base)) base = `n${i}`;
    let name = base;
    let k = 2;
    while (taken.has(name)) name = `${base}${k++}`;
    taken.add(name);
    return name;
  };
  let counter = 0;
  // Pre-order: a parent's line comes before its children's, so a streaming
  // renderer has the root as soon as line one lands.
  const walk = (n: UINode, forced?: string): string => {
    const name = forced ?? nameFor(n, counter++);
    const at = lines.length;
    lines.push("");
    const kids = (n.children ?? []).map((c) => walk(c));
    lines[at] = `${name} = ${call(n, kids, lib)}`;
    return name;
  };
  taken.add("root");
  walk(root, "root");
  return lines.join("\n");
}

function call(n: UINode, kids: string[], lib: Library): string {
  const sig = lib.signatures[n.component];
  const props = n.props ?? {};
  const bind = n.bind ?? {};
  const args: string[] = [];
  let positional = true;
  const order = sig?.props ?? Object.keys(props);
  for (const p of order) {
    const has = p in props || p in bind;
    if (!has) {
      positional = false;
      continue;
    }
    const v = p in bind ? `$${bind[p]}` : value(props[p]);
    args.push(positional ? v : `${p}: ${v}`);
  }
  for (const p of Object.keys(props)) if (!order.includes(p)) args.push(`${p}: ${value(props[p])}`);
  if (kids.length) args.push(positional && sig?.childrenProp ? `[${kids.join(", ")}]` : `children: [${kids.join(", ")}]`);
  if (n.when) args.push(`when: ${n.when.startsWith("!") ? `!$${n.when.slice(1)}` : `$${n.when}`}`);
  for (const [ev, actions] of Object.entries(n.on ?? {})) {
    const list = actions.map(action);
    args.push(`${ev}: ${list.length === 1 ? list[0] : `[${list.join(", ")}]`}`);
  }
  return `${n.component}(${args.join(", ")})`;
}

function action(a: UIAction): string {
  switch (a.type) {
    case "set":
      return `@Set($${a.path}, ${template(a.value)})`;
    case "merge":
      return `@Merge($${a.path}, ${template(a.value)})`;
    case "push":
      return `@Push($${a.path}, ${template(a.value)})`;
    case "remove":
      return `@Remove($${a.path})`;
    case "increment":
      return a.by === undefined ? `@Increment($${a.path})` : `@Increment($${a.path}, ${a.by})`;
    case "toggle":
      return `@Toggle($${a.path})`;
    case "tool": {
      const parts = [JSON.stringify(a.name)];
      if (a.args) parts.push(template(a.args));
      if (a.into) parts.push(`$${a.into}`);
      return `@Tool(${parts.join(", ")})`;
    }
    case "message":
      return `@Say(${JSON.stringify(a.text)})`;
  }
}

/** {{value}} -> $event, {{ui.x}} -> $ui.x; anything else is a literal. */
function template(v: unknown): string {
  if (typeof v === "string") {
    const m = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(v);
    if (m) {
      const p = m[1]!;
      return p === "value" ? "$event" : p.startsWith("value.") ? `$event.${p.slice(6)}` : `$${p}`;
    }
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return `[${v.map(template).join(", ")}]`;
  if (v && typeof v === "object") return `{${Object.entries(v).map(([k, x]) => `${key(k)}: ${template(x)}`).join(", ")}}`;
  return JSON.stringify(v) ?? "null";
}

function value(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(value).join(", ")}]`;
  if (v && typeof v === "object") return `{${Object.entries(v).map(([k, x]) => `${key(k)}: ${value(x)}`).join(", ")}}`;
  return JSON.stringify(v) ?? "null";
}

const key = (k: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : JSON.stringify(k));
