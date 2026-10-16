import type { Library } from "./library.js";

export interface PromptOptions {
  /** Opening paragraph; replaces the default. */
  preamble?: string;
  /** Extra rules appended to the language rules. */
  rules?: string[];
  /** Example programs; replace the default one. Each is `{ ask, program }`. */
  examples?: Array<{ ask: string; program: string }>;
  /** Tools that @Tool may call: name and a one-line description. */
  tools?: Array<{ name: string; description?: string }>;
  /** A compact description of $data.* the program may bind to (e.g. from genui's shapeOf). */
  data?: unknown;
  /** Set false to leave out the state and action rules for display-only use. */
  interactive?: boolean;
}

const DEFAULT_EXAMPLE = {
  ask: "Show August revenue, orders and refunds, and a note that we are on track.",
  program: `root = Stack([stats, note])
stats = StatGroup([rev, orders, refunds])
rev = Stat("Revenue", "$48.2k", "+6.1%", "up")
orders = Stat("Orders", "140", "+12", "up")
refunds = Stat("Refunds", "9", "-2", "down")
note = Callout("On track", "Revenue is ahead of target by 4%.", "success")`,
};

/** Build the system prompt that teaches a model the language and this library. */
export function buildPrompt(lib: Library, opts: PromptOptions = {}): string {
  const interactive = opts.interactive ?? true;
  const out: string[] = [];
  out.push(
    opts.preamble ??
      "You answer by writing a user interface in Agentable Lang, a small line-based language. Each line defines one node: `name = Component(args)`. The host renders the lines as they stream, so write the root first and keep programs short.",
  );
  out.push("");
  out.push("Rules:");
  const rules = [
    "One statement per line, `name = Component(...)`. Names are [a-zA-Z0-9_-]. The entry is the statement named `root`.",
    "Arguments are positional in the order shown below, or named (`kind: \"success\"`). Use `null` to skip an optional positional argument.",
    "Children are a list of statement names, `Stack([a, b])` or `Card(\"Title\", [a, b])`; a bare list anywhere in the arguments is the children. A name may be used once. Forward references are fine.",
    "Strings use double quotes. Lists use [], objects use {key: value}. Numbers, true, false and null are literal.",
    "Only the components listed below exist. Do not invent components, arguments or events.",
    "Lines starting with # are comments. Do not wrap the program in code fences or add prose before or after it.",
  ];
  if (interactive) {
    rules.push(
      "State: `$data.x` reads app data (read-only); `$ui.x` is interface state you own. Pass a path as an argument to bind that prop, e.g. `rows: $data.paid`.",
      "`when: $ui.selected` shows a node only while that path is truthy; `when: !$ui.done` while it is falsy.",
      "Events take actions: `press: @Set($ui.selected, $event)` or a list `[@Set(...), @Tool(...)]`. `$event` is the value the event fired with; `$event.id` a field of it.",
      "Actions: @Set(path, value) @Merge(path, object) @Push(path, value) @Remove(path) @Increment(path, by?) @Toggle(path) @Tool(name, args?, into?) @Say(text). Paths written by actions must be $ui.*.",
    );
  }
  rules.push(...(opts.rules ?? []));
  for (const r of rules) out.push(`- ${r}`);
  out.push("");
  out.push("Components:");
  for (const line of lib.signatureLines()) out.push(`- ${line}`);
  if (interactive && opts.tools?.length) {
    out.push("");
    out.push("Tools @Tool may call (the host confirms consequential ones with the user):");
    for (const t of opts.tools) out.push(`- ${t.name}${t.description ? `: ${t.description}` : ""}`);
  }
  if (interactive && opts.data !== undefined) {
    out.push("");
    out.push(`Shape of $data: ${JSON.stringify(opts.data)}`);
  }
  const examples = opts.examples ?? [DEFAULT_EXAMPLE];
  if (examples.length) {
    out.push("");
    out.push(examples.length > 1 ? "Examples:" : "Example:");
    for (const ex of examples) {
      out.push(`Ask: ${ex.ask}`);
      out.push("Program:");
      out.push(ex.program.trim());
      out.push("");
    }
    out.pop();
  }
  return out.join("\n");
}
