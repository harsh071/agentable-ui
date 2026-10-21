import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { uiCatalog } from "@agentable-ui/ui";
import { Renderer } from "../src/renderer.js";

afterEach(cleanup);

const program = 'root = Button("Save", press: @Tool("save"))';
const tools = { save: () => ({ error: "Disk full" }) };

test("action errors show inline when the host doesn't handle them", async () => {
  const view = render(<Renderer components={uiCatalog} response={program} tools={tools} />);
  fireEvent.click(await view.findByRole("button", { name: "Save" }));
  expect(await view.findByRole("alert")).toBeTruthy();
});

test("a host onActionError owns the error; it isn't repeated inline", async () => {
  const onActionError = vi.fn();
  const view = render(<Renderer components={uiCatalog} response={program} tools={tools} onActionError={onActionError} />);
  fireEvent.click(await view.findByRole("button", { name: "Save" }));
  await waitFor(() => expect(onActionError).toHaveBeenCalledWith("Disk full", expect.anything()));
  expect(view.queryByRole("alert")).toBeNull();
});
