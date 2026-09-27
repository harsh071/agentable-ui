import { StrictMode } from "react";
import { render, cleanup, act } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { memoryAdapter } from "@agentable-ui/core/adapters/memory";
import { AgentableProvider } from "../src/AgentableProvider.js";
import { useCapability } from "../src/useCapability.js";
import { useAgentableSnapshot } from "../src/snapshot.js";

afterEach(cleanup);

function Greeter() {
  useCapability({
    id: "demo.greet",
    tool: {
      name: "greet",
      description: "Say hello.",
      annotations: { readOnlyHint: true },
      execute: () => "hi",
    },
  });
  return null;
}

let seen: ReturnType<typeof useAgentableSnapshot> | undefined;
function Probe() {
  seen = useAgentableSnapshot();
  return null;
}

/**
 * StrictMode mounts, unmounts and remounts with the same useState value. A
 * synchronous dispose() in the provider's cleanup killed the very registry the
 * second mount reuses: adapters were cleared and notify() short-circuited, so
 * the page registered zero tools in dev while production builds worked.
 */
test("survives the StrictMode mount/unmount/remount cycle", async () => {
  const adapter = memoryAdapter();
  await act(async () => {
    render(
      <StrictMode>
        <AgentableProvider budget={12} adapters={[adapter]}>
          <Greeter />
          <Probe />
        </AgentableProvider>
      </StrictMode>,
    );
  });

  expect(adapter.tools().map((t) => t.name)).toContain("greet");
  expect(seen?.adapters.map((a) => a.id)).toContain("memory");
  expect(seen?.budget.used).toBeGreaterThan(0);
  await expect(adapter.execute("greet", {})).resolves.toBe("hi");
});

test("disposes for real when the provider unmounts", async () => {
  const adapter = memoryAdapter();
  let unmount!: () => void;
  await act(async () => {
    ({ unmount } = render(
      <StrictMode>
        <AgentableProvider budget={12} adapters={[adapter]}>
          <Greeter />
        </AgentableProvider>
      </StrictMode>,
    ));
  });
  expect(adapter.tools()).toHaveLength(1);

  await act(async () => {
    unmount();
    // The deferred teardown runs on the next macrotask when no remount cancels it.
    await new Promise((r) => setTimeout(r, 1));
  });
  expect(adapter.tools()).toHaveLength(0);
});
