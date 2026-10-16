import { describe, expect, it } from "vitest";
import { createLibrary, serialize } from "../src/index.js";

const str = { type: "string" };
const lib = createLibrary({
  Stack: { description: "Column or row.", props: { type: "object", properties: { direction: { type: "string", enum: ["row", "column"] } } }, childrenProp: "children" },
  Stat: { description: "One metric.", props: { type: "object", properties: { label: str, value: { type: ["string", "number"] }, delta: str, trend: { type: "string", enum: ["up", "down"] } }, required: ["label", "value"] } },
  Button: { description: "A button.", props: { type: "object", properties: { label: str, variant: str }, required: ["label"] }, events: { press: "onPress" } },
  Table: { description: "Rows.", props: { type: "object", properties: { rows: { type: "array", items: { type: "object" } } }, required: ["rows"] }, events: { select: "onSelect" } },
});

describe("parse", () => {
  it("maps positional and named args, children and forward refs", () => {
    const r = lib.parse(`root = Stack([a, b], direction: "row")\na = Stat("Revenue", "$48k", "+6%", "up")\nb = Stat(label: "Orders", value: 140)`);
    expect(r.errors).toEqual([]);
    expect(r.root).toEqual({
      component: "Stack",
      id: "root",
      props: { direction: "row" },
      children: [
        { component: "Stat", id: "a", props: { label: "Revenue", value: "$48k", delta: "+6%", trend: "up" } },
        { component: "Stat", id: "b", props: { label: "Orders", value: 140 } },
      ],
    });
    expect(r.nodes).toBe(3);
  });

  it("turns $paths into bindings, when and event actions into on", () => {
    const r = lib.parse(`root = Stack([t, b])
t = Table($data.paid, select: @Set($ui.selected, $event))
b = Button("Refund", "danger", when: $ui.selected, press: [@Tool("refund_order", {id: $event.id, reason: $ui.reason}, $ui.last), @Remove($ui.selected)])`);
    expect(r.errors).toEqual([]);
    const [t, b] = r.root!.children!;
    expect(t).toEqual({ component: "Table", id: "t", bind: { rows: "data.paid" }, on: { select: [{ type: "set", path: "ui.selected", value: "{{value}}" }] } });
    expect(b!.when).toBe("ui.selected");
    expect(b!.on!.press).toEqual([
      { type: "tool", name: "refund_order", args: { id: "{{value.id}}", reason: "{{ui.reason}}" }, into: "ui.last" },
      { type: "remove", path: "ui.selected" },
    ]);
  });

  it("reports and drops bad statements, keeps the rest", () => {
    const r = lib.parse(`root = Stack([a, b, c])\na = Chart([1,2])\nb = Stat("x", 1, 2, 3, 4, 5)\nc = Stat("ok", 1\n`);
    expect(r.root!.children!.map((c) => c.id)).toEqual(["b"]);
    expect(r.errors.map((e) => e.code).sort()).toEqual(["excess-args", "parse-failed", "unknown-component"]);
    expect(r.root!.children![0]!.props).toEqual({ label: "x", value: 1, delta: 2, trend: 3 });
  });

  it("rejects a state write outside ui.* and an action in a prop", () => {
    const r = lib.parse(`root = Button("x", press: @Set($data.n, 1))\n`);
    expect(r.root!.on).toBeUndefined();
    expect(r.errors[0]!.code).toBe("bad-arg");
  });

  it("falls back to the first statement without a root and warns", () => {
    const r = lib.parse(`a = Stat("x", 1)`);
    expect(r.root!.id).toBe("a");
    expect(r.errors[0]).toMatchObject({ code: "no-root", severity: "warning" });
  });

  it("last definition wins; comments and blank lines are ignored", () => {
    const r = lib.parse(`# a comment\nroot = Stat("x", 1) // trailing\n\nroot = Stat("y", 2)`);
    expect(r.root!.props).toEqual({ label: "y", value: 2 });
    expect(r.errors).toEqual([]);
  });
});

describe("stream", () => {
  it("holds back the unterminated line and resolves children as they land", () => {
    const sp = lib.stream();
    let r = sp.push("root = Stack([a, b])\na = Stat(\"Rev");
    expect(r.root!.children).toEqual([]);
    expect(r.unresolved).toEqual(["a", "b"]);
    expect(r.errors).toEqual([]);
    r = sp.push('enue", "$48k")\n');
    expect(r.root!.children!.map((c) => c.id)).toEqual(["a"]);
    expect(r.unresolved).toEqual(["b"]);
    r = sp.push('b = Stat("Orders", 140)', true);
    expect(r.complete).toBe(true);
    expect(r.root!.children!.map((c) => c.id)).toEqual(["a", "b"]);
    expect(r.unresolved).toEqual([]);
  });
});

describe("prompt", () => {
  it("lists signatures with optional markers, events and actions", () => {
    const p = lib.prompt({ tools: [{ name: "refund_order", description: "Refund a paid order." }] });
    expect(p).toContain('Stat(label: string, value: string|number, delta?: string, trend?: "up"|"down") — One metric.');
    expect(p).toContain("Stack(direction?: \"row\"|\"column\", children?: [nodes]) — Column or row.");
    expect(p).toContain("Button(label: string, variant?: string) · events: press — A button.");
    expect(p).toContain("@Tool(name, args?, into?)");
    expect(p).toContain("- refund_order: Refund a paid order.");
  });
});

describe("serialize", () => {
  it("round-trips a tree through the language, root line first", () => {
    const src = `root = Stack([t, b], direction: "row")
t = Table($data.paid, select: @Set($ui.selected, $event))
b = Button("Refund", when: $ui.selected, press: [@Tool("refund_order", {id: $event.id}, $ui.last), @Say("done")])`;
    const first = lib.parse(src);
    const text = serialize(first.root!, lib);
    expect(text.split("\n")[0]).toMatch(/^root = Stack\(/);
    expect(lib.parse(text).root).toEqual(first.root);
  });
});
