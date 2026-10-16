import type { Expr, Arg } from "./ast.js";

/**
 * A recursive-descent parser for one statement line. Kept deliberately
 * small: strings, numbers, booleans, null, arrays, objects, refs, $paths,
 * Component(args) and @Action(args).
 */
export class LineParser {
  private i = 0;
  constructor(private readonly src: string) {}

  /** Parse `name = expr`; throws a plain Error with a message on bad syntax. */
  statement(): { name: string; expr: Expr } {
    this.ws();
    const name = this.ident();
    if (!name) throw new Error("A statement starts with a name, e.g. `root = Stack([...])`.");
    this.ws();
    if (!this.eat("=")) throw new Error(`Expected "=" after "${name}".`);
    this.ws();
    const expr = this.expr();
    this.ws();
    if (this.i < this.src.length) throw new Error(`Unexpected "${this.src[this.i]}" after the expression.`);
    return { name, expr };
  }

  private ws() {
    while (this.i < this.src.length && /\s/.test(this.src[this.i]!)) this.i++;
  }

  private eat(s: string): boolean {
    if (this.src.startsWith(s, this.i)) {
      this.i += s.length;
      return true;
    }
    return false;
  }

  private ident(): string | null {
    const m = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(this.src.slice(this.i));
    if (!m) return null;
    this.i += m[0].length;
    return m[0];
  }

  private expr(): Expr {
    const c = this.src[this.i];
    if (c === undefined) throw new Error("Expected a value.");
    if (c === '"' || c === "'") return { kind: "string", value: this.string() };
    if (c === "[") return this.array();
    if (c === "{") return this.object();
    if (c === "$") return this.path(false);
    if (c === "!") {
      this.i++;
      this.ws();
      if (this.src[this.i] !== "$") throw new Error('"!" may only negate a $path.');
      return this.path(true);
    }
    if (c === "@") {
      this.i++;
      const name = this.ident();
      if (!name) throw new Error('Expected an action name after "@".');
      this.ws();
      if (!this.eat("(")) throw new Error(`Expected "(" after @${name}.`);
      return { kind: "action", name, args: this.args() };
    }
    if (c === "-" || /[0-9]/.test(c)) return this.number();
    const name = this.ident();
    if (!name) throw new Error(`Unexpected "${c}".`);
    if (name === "true" || name === "false") return { kind: "boolean", value: name === "true" };
    if (name === "null") return { kind: "null" };
    this.ws();
    if (this.eat("(")) return { kind: "call", name, args: this.args() };
    return { kind: "ref", name };
  }

  /** After "(": comma-separated args, positional or `name: expr`, up to ")". */
  private args(): Arg[] {
    const out: Arg[] = [];
    this.ws();
    if (this.eat(")")) return out;
    for (;;) {
      this.ws();
      let name: string | undefined;
      const save = this.i;
      const id = this.ident();
      this.ws();
      if (id && this.eat(":")) {
        name = id;
        this.ws();
      } else this.i = save;
      const expr = this.expr();
      out.push(name ? { name, expr } : { expr });
      this.ws();
      if (this.eat(")")) return out;
      if (!this.eat(",")) throw new Error('Expected "," or ")" in the argument list.');
    }
  }

  private array(): Expr {
    this.i++; // [
    const items: Expr[] = [];
    this.ws();
    if (this.eat("]")) return { kind: "array", items };
    for (;;) {
      this.ws();
      items.push(this.expr());
      this.ws();
      if (this.eat("]")) return { kind: "array", items };
      if (!this.eat(",")) throw new Error('Expected "," or "]" in the list.');
    }
  }

  private object(): Expr {
    this.i++; // {
    const entries: Array<[string, Expr]> = [];
    this.ws();
    if (this.eat("}")) return { kind: "object", entries };
    for (;;) {
      this.ws();
      const c = this.src[this.i];
      const key = c === '"' || c === "'" ? this.string() : this.ident();
      if (!key) throw new Error("Expected a key in the object.");
      this.ws();
      if (!this.eat(":")) throw new Error(`Expected ":" after key "${key}".`);
      this.ws();
      entries.push([key, this.expr()]);
      this.ws();
      if (this.eat("}")) return { kind: "object", entries };
      if (!this.eat(",")) throw new Error('Expected "," or "}" in the object.');
    }
  }

  private string(): string {
    const quote = this.src[this.i]!;
    this.i++;
    let out = "";
    for (;;) {
      const c = this.src[this.i];
      if (c === undefined) throw new Error("Unterminated string.");
      this.i++;
      if (c === quote) return out;
      if (c === "\\") {
        const n = this.src[this.i];
        this.i++;
        if (n === "n") out += "\n";
        else if (n === "t") out += "\t";
        else if (n === "u") {
          const hex = this.src.slice(this.i, this.i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error("Bad \\u escape.");
          out += String.fromCharCode(parseInt(hex, 16));
          this.i += 4;
        } else if (n !== undefined) out += n;
        continue;
      }
      out += c;
    }
  }

  private number(): Expr {
    const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(this.src.slice(this.i));
    if (!m) throw new Error("Bad number.");
    this.i += m[0].length;
    return { kind: "number", value: Number(m[0]) };
  }

  private path(negated: boolean): Expr {
    this.i++; // $
    const head = this.ident();
    if (!head) throw new Error('Expected a name after "$", e.g. $ui.selected.');
    let path = head;
    for (;;) {
      if (this.src[this.i] === ".") {
        this.i++;
        const seg = this.ident();
        if (!seg) throw new Error(`Expected a segment after "." in $${path}.`);
        path += `.${seg}`;
        continue;
      }
      if (this.src[this.i] === "[") {
        const m = /^\[(\d+)\]/.exec(this.src.slice(this.i));
        if (!m) throw new Error(`Only numeric indexes are allowed in $${path}[...].`);
        this.i += m[0].length;
        path += `[${m[1]}]`;
        continue;
      }
      return { kind: "path", path, negated };
    }
  }
}
