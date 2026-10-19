import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AgentableProvider } from "@agentable-ui/react";
import { DataTable } from "../src/DataTable.js";
import { Tabs } from "../src/Tabs.js";
import { Filters } from "../src/Filters.js";
import { Button } from "../src/presentational.js";

afterEach(cleanup);

test("index-based row selection survives sorting and search", () => {
  const onSelectionChange = vi.fn();
  const view = render(<AgentableProvider><DataTable rows={[{ name: "Zoe" }, { name: "Ada" }]} columns={[{ key: "name", header: "Name" }]} selectable onSelectionChange={onSelectionChange} /></AgentableProvider>);
  fireEvent.click(view.getByText("Name"));
  fireEvent.click(view.getByLabelText("Select 1"));
  expect(onSelectionChange).toHaveBeenLastCalledWith(["1"]);
  fireEvent.change(view.getByRole("searchbox"), { target: { value: "Zoe" } });
  fireEvent.click(view.getByLabelText("Select 0"));
  expect(onSelectionChange).toHaveBeenLastCalledWith(["1", "0"]);
});

test("tab keyboard navigation focuses the selected tab and skips disabled tabs", () => {
  const view = render(<AgentableProvider><Tabs tabs={[
    { value: "a", label: "First", content: "First panel" },
    { value: "b", label: "Disabled", disabled: true, content: "Hidden" },
    { value: "c", label: "Last", content: "Last panel" },
  ]} /></AgentableProvider>);
  const first = view.getByRole("tab", { name: "First" });
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowRight" });
  expect(document.activeElement).toBe(view.getByRole("tab", { name: "Last" }));
  expect(view.getByRole("tabpanel").textContent).toBe("Last panel");
  fireEvent.keyDown(document.activeElement!, { key: "Home" });
  expect(document.activeElement).toBe(first);
});

test("filter instances have distinct labels and cleared ranges are removed", () => {
  const onChange = vi.fn();
  const filters = [{ id: "total", label: "Total", type: "range" as const }];
  const view = render(<AgentableProvider><Filters filters={filters} onChange={onChange} /><Filters filters={filters} /></AgentableProvider>);
  const inputs = view.getAllByLabelText("Total");
  expect(inputs[0]!.id).not.toBe(inputs[1]!.id);
  fireEvent.change(inputs[0]!, { target: { value: "10" } });
  fireEvent.change(inputs[0]!, { target: { value: "" } });
  expect(onChange).toHaveBeenLastCalledWith({});
});

test("Button supports native props, rich children, loading and legacy onPress", () => {
  const onPress = vi.fn();
  const view = render(<Button aria-label="Save profile" loading onPress={onPress}><strong>Save</strong></Button>);
  expect(view.getByRole("button").hasAttribute("disabled")).toBe(true);
  view.rerender(<Button label="Save" onPress={onPress} />);
  fireEvent.click(view.getByRole("button"));
  expect(onPress).toHaveBeenCalledOnce();
  view.rerender(<Button label="Save" onClick={(event) => event.preventDefault()} onPress={onPress} />);
  fireEvent.click(view.getByRole("button"));
  expect(onPress).toHaveBeenCalledOnce();
});
