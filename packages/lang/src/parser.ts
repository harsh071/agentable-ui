import type { LangError, Statement } from "./ast.js";
import { LineParser } from "./lexer.js";

export interface Program {
  statements: Statement[];
  errors: LangError[];
}

/**
 * Parse a whole program: one statement per line, `#` or `//` comments,
 * blank lines ignored. A bad line is reported and skipped; the rest still
 * parses. Later statements with the same name replace earlier ones.
 */
export function parseProgram(text: string): Program {
  const statements: Statement[] = [];
  const errors: LangError[] = [];
  const byName = new Map<string, number>();
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const line = idx + 1;
    const src = stripComment(raw);
    if (!src.trim()) return;
    try {
      const { name, expr } = new LineParser(src).statement();
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
