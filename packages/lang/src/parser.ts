import type { Expr, LangError, Statement } from "./ast.js";
import { LineParser } from "./lexer.js";

export interface Program {
  statements: Statement[];
  errors: LangError[];
}

/**
 * Parse a whole program: one statement per line, `#` or `//` comments,
 * blank lines ignored. A bad line is reported and skipped; the rest still
 * parses. Later statements with the same name replace earlier ones.
 *
 * `name.arg = expr` lines are shorthand for a named argument on the
 * component statement `name` (models write these naturally, e.g.
 * `input.change = @Set($ui.q, $event)`). They apply after all lines are
 * read, so order doesn't matter, and the last one for an argument wins.
 */
export function parseProgram(text: string): Program {
  const statements: Statement[] = [];
  const errors: LangError[] = [];
  const byName = new Map<string, number>();
  const props: Array<{ name: string; prop: string; expr: Expr; line: number }> = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const line = idx + 1;
    const src = stripComment(raw);
    if (!src.trim()) return;
    try {
      const { name, prop, expr } = new LineParser(src).statement();
      if (prop) {
        props.push({ name, prop, expr, line });
        return;
      }
      const st: Statement = { name, expr, line };
      const prev = byName.get(name);
      if (prev !== undefined) statements[prev] = st;
      else {
        byName.set(name, statements.length);
        statements.push(st);
      }
    } catch (e) {
      errors.push({ code: "parse-failed", message: `Line ${line}: ${e instanceof Error ? e.message : String(e)}`, line, severity: "error" });
    }
  });
  for (const p of props) {
    const idx = byName.get(p.name);
    const target = idx === undefined ? undefined : statements[idx];
    if (!target || target.expr.kind !== "call") {
      errors.push({
        code: "parse-failed",
        message: `Line ${p.line}: "${p.name}.${p.prop} = …" needs a component statement named "${p.name}". You can also pass it inline: ${p.name} = Component(…, ${p.prop}: …).`,
        line: p.line,
        severity: "error",
      });
      continue;
    }
    // Replace an existing named argument of the same name; otherwise append it.
    const args = target.expr.args.filter((a) => a.name !== p.prop);
    statements[idx!] = { ...target, expr: { ...target.expr, args: [...args, { name: p.prop, expr: p.expr }] } };
  }
  return { statements, errors };
}

/** Drop a trailing `# comment` or `// comment` outside of strings. */
function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "#" || (c === "/" && line[i + 1] === "/")) return line.slice(0, i);
  }
  return line;
}

/**
 * Split streamed text into the part that is safe to parse and the trailing
 * partial line. A program is complete only when `done` is true; until then
 * the last unterminated line is held back.
 */
export function stableText(text: string, done: boolean): string {
  if (done) return text;
  const nl = text.lastIndexOf("\n");
  return nl < 0 ? "" : text.slice(0, nl + 1);
}
