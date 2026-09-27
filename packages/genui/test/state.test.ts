import { afterEach, describe, expect, it } from "vitest";
import { validateSpec } from "../src/spec.js";
import { createUiStore, getPath, interpolate } from "../src/state.js";

afterEach(() => {
  delete (Object.prototype as Record<string, unknown>).polluted;
});

describe("state paths", () => {
  it.each(["ui.__proto__.polluted", "ui.constructor.prototype.polluted", "ui.a.__proto__.polluted", "ui.x[0].__proto__.polluted"])(
    "rejects %s without touching Object.prototype",
    (path) => {
      const store = createUiStore();
      expect(() => store.dispatch({ type: "set", path, value: true })).toThrow(/reserved key/);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(store.get()).toEqual({});
    },
  );

  it("rejects a reserved key that arrives through {{value}} interpolation", () => {
    const store = createUiStore({ rows: {} });
    const action = interpolate({ type: "set" as const, path: "ui.rows.{{value}}.polluted", value: true }, { value: "__proto__" }, { data: {}, ui: store.get() });
    expect(() => store.dispatch(action)).toThrow(/reserved key/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("reads own properties only", () => {
    const state = { data: { orders: [{ id: 1 }] }, ui: {} };
    expect(getPath(state, "data.orders[0].id")).toBe(1);
    expect(getPath(state, "data.constructor")).toBeUndefined();
    expect(getPath(state, "data.toString")).toBeUndefined();
    expect(getPath(state, "data.orders.constructor.constructor")).toBeUndefined();
  });

  it("still writes ordinary nested paths", () => {
    const store = createUiStore();
    store.dispatch([
      { type: "set", path: "ui.form.name", value: "Ada" },
      { type: "push", path: "ui.items", value: 1 },
      { type: "increment", path: "ui.count" },
    ]);
    expect(store.get()).toEqual({ form: { name: "Ada" }, items: [1], count: 1 });
  });

  it("fails validation for specs that bind or write reserved keys", async () => {
    const catalog = { Text: { props: { type: "object", properties: { text: { type: "string" } } } as never, events: { click: "onClick" } } };
    const allowed = new Set(["Text"]);
    const bound = await validateSpec({ component: "Text", bind: { text: "data.__proto__" } }, catalog, allowed);
    expect(bound.ok).toBe(false);
    const written = await validateSpec({ component: "Text", on: { click: [{ type: "set", path: "ui.__proto__.x", value: 1 }] } }, catalog, allowed);
    expect(written.ok).toBe(false);
  });
});
