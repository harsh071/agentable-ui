import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { uiCatalog } from "@agentable-ui/ui";
import { createLibrary } from "@agentable-ui/lang";
import { Renderer } from "../src/renderer.js";
import { createUiStore, getPath, parsePath } from "../src/state.js";

afterEach(cleanup);

const state = {
  data: {
    items: [
      { id: "a", text: "Passport", done: true, status: "packed" },
      { id: "b", text: "Charger", status: "in bag" },
      { id: "c", text: "Umbrella", done: false, status: "archived" },
    ],
  },
  ui: {},
};

describe("path filters", () => {
  it("parses selectors into typed keys", () => {
    expect(parsePath('data.items[done=true].length')).toEqual(["data", "items", { field: "done", op: "=", value: true }, "length"]);
    expect(parsePath('data.items[status!="in bag"]')).toEqual(["data", "items", { field: "status", op: "!=", value: "in bag" }]);
    expect(() => parsePath("data.items[__proto__=1]")).toThrow(/reserved key/);
    expect(() => parsePath("data.items[oops]")).toThrow(/bad selector/);
  });

  it("filters arrays, treats a missing boolean as false, and counts", () => {
    expect(getPath(state, "data.items[done=true]")).toEqual([state.data.items[0]]);
    expect(getPath(state, "data.items[done=false].length")).toBe(2);
    expect(getPath(state, 'data.items[status!="archived"].length')).toBe(2);
    expect(getPath(state, "data.items[done=true][0].text")).toBe("Passport");
    expect(getPath(state, "data.missing[done=true]")).toBeUndefined();
  });

  it("rejects writes through a filter", () => {
    const store = createUiStore({ list: [{ done: true }] });
    expect(() => store.dispatch({ type: "set", path: "ui.list[done=true]", value: [] })).toThrow(/read-only/);
  });

  it("lexes filters in Lang programs", () => {
    const lib = createLibrary(uiCatalog);
    const r = lib.parse('root = Progress(value: $data.items[done=true].length, max: $data.items.length, label: "Packed")');
    expect(r.errors).toEqual([]);
    expect(r.root?.bind).toEqual({ value: "data.items[done=true].length", max: "data.items.length" });
  });

  it("renders a count bound through a filter", async () => {
    const program = 'root = Progress(value: $data.items[done=true].length, max: $data.items.length, label: "Packed")';
    const view = render(<Renderer components={uiCatalog} response={program} data={state.data} />);
    expect(await view.findByText("33%")).toBeTruthy();
  });
});
