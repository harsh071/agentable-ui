import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { uiCatalog } from "@agentable-ui/ui";
import { Renderer } from "../src/renderer.js";

afterEach(cleanup);

test("a data-bound Checklist sends the toggled item's id to @Tool", async () => {
  const toggle = vi.fn(() => ({ ok: true }));
  const program = `root = Checklist($data.items, title: "Packing", toggle: @Tool("toggle_item", {id: $event.id}))`;
  const view = render(
    <Renderer components={uiCatalog} response={program} data={{ items: [{ id: "p1", text: "Passport" }, { id: "p2", text: "Charger" }] }} tools={{ toggle_item: toggle }} />,
  );
  fireEvent.click(await view.findByLabelText("Charger"));
  await waitFor(() => expect(toggle).toHaveBeenCalledWith({ id: "p2" }));
});

test("Grid, Chart and ItemList parse and render from a program", async () => {
  const program = `root = Grid([chart, list], columns: 2)
chart = Chart($data.weeks, x: "week", series: ["km"], kind: "line", title: "Distance")
list = ItemList($data.runs, title: "Runs")`;
  const view = render(
    <Renderer
      components={uiCatalog}
      response={program}
      data={{ weeks: [{ week: "W1", km: 12 }, { week: "W2", km: 18 }], runs: [{ id: 1, title: "Tempo", meta: "8 km" }] }}
    />,
  );
  expect(await view.findByText("Distance")).toBeTruthy();
  expect(view.getByText("Tempo")).toBeTruthy();
});
