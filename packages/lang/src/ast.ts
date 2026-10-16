/** The syntax tree of an Agentable Lang program: one statement per line, `name = Expression`. */

export type Expr =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "boolean"; value: boolean }
  | { kind: "null" }
  | { kind: "array"; items: Expr[] }
  | { kind: "object"; entries: Array<[string, Expr]> }
  /** Another statement's name: a node used as a child. */
  | { kind: "ref"; name: string }
  /** `$ui.selected.id`, `$data.rows`, `$event`; `!$ui.x` only in `when:`. */
  | { kind: "path"; path: string; negated: boolean }
  /** `Component(args)` */
  | { kind: "call"; name: string; args: Arg[] }
  /** `@Action(args)` */
  | { kind: "action"; name: string; args: Arg[] };

export interface Arg {
  /** Named argument (`label: "x"`); positional when absent. */
  name?: string;
  expr: Expr;
}

export interface Statement {
  name: string;
  expr: Expr;
  /** 1-based line number in the program. */
  line: number;
}

export type ErrorCode =
  | "parse-failed"
  | "unknown-component"
  | "unknown-action"
  | "unknown-arg"
  | "excess-args"
  | "missing-required"
  | "bad-arg"
  | "unresolved-ref"
  | "reused-node"
  | "cycle"
  | "no-root"
  | "not-a-component";

export interface LangError {
  code: ErrorCode;
  message: string;
  /** 1-based line; 0 when the error is about the whole program. */
  line: number;
  /** "error" drops the statement or argument; "warning" keeps rendering. */
  severity: "error" | "warning";
}
