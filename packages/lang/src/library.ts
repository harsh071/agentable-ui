import { estimateTokens, toJsonSchema, type JSONSchema, type SchemaInput } from "@agentable-ui/core";
import type { LangError } from "./ast.js";
import { ACTION_NAMES, evaluate, type EvalResult, type UINode } from "./evaluate.js";
import { parseProgram, stableText } from "./parser.js";
import { buildPrompt, type PromptOptions } from "./prompt.js";

/** What the language needs to know about a component. The same shape as a genui catalog entry; extra keys are ignored. */
export interface LibraryEntry {
  description: string;
  props: SchemaInput;
  childrenProp?: string;
  /** Event name -> callback prop. Only the keys matter here. */
  events?: Record<string, string>;
}

export type LibraryInput = Record<string, LibraryEntry>;

/** The resolved, ordered contract of one component. */
export interface Signature {
  name: string;
  description: string;
  /** Prop names in positional order. */
  props: string[];
  required: Set<string>;
  /** Rendered `name?: type` per prop. */
  types: Record<string, string>;
  childrenProp?: string;
  events: string[];
  schema: JSONSchema;
}

export interface ParseResult extends EvalResult {
  /** True once the whole program is in; partial input renders what has arrived. */
  complete: boolean;
  /** Characters and estimated tokens of the program text parsed. */
  chars: number;
  tokens: number;
}

export interface Library {
  signatures: Record<string, Signature>;
  root: string | undefined;
  /** Parse and evaluate a complete program. */
  parse(text: string): ParseResult;
  /** A parser that accepts the text received so far; `set(text, done)` re-evaluates. */
  stream(): StreamingParser;
  /** The system prompt that teaches a model this library. */
  prompt(options?: PromptOptions): string;
  /** One line per component, as the prompt shows them. */
  signatureLines(): string[];
}

export interface StreamingParser {
  /** Re-parse with the full text so far. The last unterminated line is held back until `done`. */
  set(text: string, done?: boolean): ParseResult;
  /** Append a chunk. */
  push(chunk: string, done?: boolean): ParseResult;
  result(): ParseResult;
}

export function createLibrary(components: LibraryInput, options: { root?: string } = {}): Library {
  const signatures: Record<string, Signature> = {};
  for (const [name, entry] of Object.entries(components)) signatures[name] = signature(name, entry);
  if (options.root && !signatures[options.root]) throw new Error(`root "${options.root}" is not in the library.`);

  const parseText = (text: string, complete: boolean): ParseResult => {
    const program = parseProgram(text);
    const evaluated = evaluate(program.statements, signatures);
    let errors: LangError[] = [...program.errors, ...evaluated.errors];
    // A missing root is normal mid-stream; the final result reports it.
    if (!complete) errors = errors.filter((e) => e.code !== "no-root");
    return { ...evaluated, errors, complete, chars: text.length, tokens: estimateTokens(text.length) };
  };

  const lib: Library = {
    signatures,
    root: options.root,
    parse: (text) => parseText(text, true),
    stream() {
      let buffer = "";
      let last = parseText("", false);
      const set = (text: string, done = false) => {
        buffer = text;
        last = parseText(stableText(text, done), done);
        return last;
      };
      return { set, push: (chunk, done) => set(buffer + chunk, done), result: () => last };
    },
    prompt: (opts) => buildPrompt(lib, opts),
    signatureLines: () => Object.values(signatures).map(signatureLine),
  };
  return lib;
}

function signature(name: string, entry: LibraryEntry): Signature {
  let schema: JSONSchema;
  try {
    schema = toJsonSchema(entry.props);
  } catch {
    schema = { type: "object", properties: {} };
  }
  const properties = (schema.properties ?? {}) as Record<string, JSONSchema>;
  const required = new Set(((schema.required as string[] | undefined) ?? []).filter((k) => k in properties));
  const props = Object.keys(properties);
  const types: Record<string, string> = {};
  for (const p of props) types[p] = typeName(properties[p]!, 0);
  return { name, description: entry.description, props, required, types, childrenProp: entry.childrenProp, events: Object.keys(entry.events ?? {}), schema };
}

/** A compact type for a prompt: string, number, "a"|"b", T[], {k: T}. */
export function typeName(s: JSONSchema, depth: number): string {
  if (Array.isArray(s.enum)) return s.enum.map((v) => JSON.stringify(v)).join("|");
  if (Array.isArray(s.anyOf)) return (s.anyOf as JSONSchema[]).map((x) => typeName(x, depth)).join("|");
  if (Array.isArray(s.oneOf)) return (s.oneOf as JSONSchema[]).map((x) => typeName(x, depth)).join("|");
  const t = Array.isArray(s.type) ? (s.type as string[]) : s.type ? [String(s.type)] : [];
  if (t.length > 1) return t.map((x) => typeName({ ...s, type: x }, depth)).join("|");
  const type = t[0] ?? "any";
  if (type === "array") return `${typeName((s.items as JSONSchema | undefined) ?? {}, depth + 1)}[]`;
  if (type === "object") {
    const props = (s.properties ?? {}) as Record<string, JSONSchema>;
    const keys = Object.keys(props);
    if (!keys.length || depth >= 2) return "object";
    const req = new Set((s.required as string[] | undefined) ?? []);
    return `{${keys.map((k) => `${k}${req.has(k) ? "" : "?"}: ${typeName(props[k]!, depth + 1)}`).join(", ")}}`;
  }
  if (type === "integer") return "number";
  return type;
}

export function signatureLine(sig: Signature): string {
  const args = sig.props.map((p) => `${p}${sig.required.has(p) ? "" : "?"}: ${sig.types[p]}`);
  if (sig.childrenProp) args.push("children?: [nodes]");
  const events = sig.events.length ? ` · events: ${sig.events.join(", ")}` : "";
  return `${sig.name}(${args.join(", ")})${events} — ${sig.description}`;
}

export { ACTION_NAMES };
export type { UINode };
