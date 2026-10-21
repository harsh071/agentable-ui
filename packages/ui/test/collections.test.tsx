import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Badge, Chart, Checklist, Image, ItemList, LinkCard, Timeline } from "../src/collections.js";
import { uiCatalog } from "../src/presentational.js";

afterEach(cleanup);

test("Checklist fires toggle and remove with the item and shows progress", () => {
  const onToggle = vi.fn();
  const onRemove = vi.fn();
  const items = [
    { id: "a", text: "Milk", done: true },
    { id: "b", text: "Eggs" },
  ];
  const view = render(<Checklist title="Groceries" items={items} onToggle={onToggle} onRemove={onRemove} />);
  expect(view.getByText("1/2")).toBeTruthy();
  fireEvent.click(view.getByLabelText("Eggs"));
  expect(onToggle).toHaveBeenCalledWith(items[1]);
  fireEvent.click(view.getByLabelText("Remove Milk"));
  expect(onRemove).toHaveBeenCalledWith(items[0]);
});

test("Checklist without handlers is read-only and survives unbound data", () => {
  const view = render(<Checklist items={undefined as never} />);
  expect(view.getByText("Nothing here yet.")).toBeTruthy();
  view.rerender(<Checklist items={[{ text: "Read" }]} />);
  expect((view.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
  expect(view.queryByRole("button")).toBeNull();
});

test("ItemList rows become buttons only when select is bound", () => {
  const onSelect = vi.fn();
  const items = [{ id: 1, title: "Dune", subtitle: "Herbert", badge: "Reading" }];
  const view = render(<ItemList items={items} />);
  expect(view.queryByRole("button")).toBeNull();
  view.rerender(<ItemList items={items} onSelect={onSelect} />);
  fireEvent.click(view.getByRole("button"));
  expect(onSelect).toHaveBeenCalledWith(items[0]);
});

test("links and images drop unsafe URLs", () => {
  const view = render(
    <>
      <LinkCard href="javascript:alert(1)" title="Bad" />
      <LinkCard href="https://www.example.com/a" title="Good" />
      <Image src="javascript:alert(1)" caption="no image" />
    </>,
  );
  expect(view.getAllByRole("link")).toHaveLength(1);
  expect(view.getByText("example.com")).toBeTruthy();
  expect(view.queryByRole("img")).toBeNull();
  expect(view.getByText("no image")).toBeTruthy();
});

test("Chart draws one bar per row and series, and handles empty data", () => {
  const data = [
    { month: "Jan", runs: 4, km: 20 },
    { month: "Feb", runs: 6, km: 31 },
  ];
  const { container, rerender, getByText } = render(<Chart kind="bar" data={data} x="month" series={["runs", "km"]} title="Training" />);
  expect(container.querySelectorAll("rect[rx]")).toHaveLength(4);
  expect(getByText("Jan")).toBeTruthy();
  rerender(<Chart data={[]} x="month" series={["runs"]} title="Training" />);
  expect(getByText("Training: no data yet.")).toBeTruthy();
});

test("Timeline and Badge render their content", () => {
  const view = render(
    <>
      <Timeline items={[{ time: "9:00", title: "Flight", done: true }, { time: "13:00", title: "Check in", detail: "Alfama" }]} />
      <Badge text="Booked" kind="success" />
    </>,
  );
  expect(view.getByText("Alfama")).toBeTruthy();
  expect(view.getByText("Booked").getAttribute("data-kind")).toBe("success");
});

test("every new component is in the catalog with its events", () => {
  for (const name of ["Checklist", "ItemList", "Timeline", "Chart", "Badge", "Image", "LinkCard", "Grid", "Divider"]) {
    expect(uiCatalog).toHaveProperty(name);
  }
  expect(uiCatalog.Checklist.events).toEqual({ toggle: "onToggle", remove: "onRemove" });
});
