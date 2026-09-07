# @agentable/react

React bindings for [`@agentable/core`](../core): `AgentableProvider`, `useCapability`, `useTool`, `ToolScope`.

```bash
npm install @agentable/react @agentable/core
```

## Usage

```tsx
import { AgentableProvider, useTool } from "@agentable/react";

function App() {
  return (
    <AgentableProvider budget={12}>
      <Orders />
    </AgentableProvider>
  );
}

function Orders() {
  useTool({
    name: "refresh_orders",
    description: "Reload the orders list.",
    annotations: { readOnlyHint: true },
    execute: () => refetch(),
  });
  return <table>…</table>;
}
```

## API

**`<AgentableProvider>`** creates the registry with the WebMCP adapter and a built-in confirmation dialog. Pass `confirm` for your own handler, `confirm={false}` to disable it (a dev warning is logged), `renderConfirm` for custom UI, or `agentable` to bring your own registry.

**`useCapability(cap | null)`** declares a full capability descriptor. The registry only sees a new declaration when the static shape changes, so a fresh `execute` closure every render costs nothing. Pass `null` to switch the agent layer off for that component.

**`useTool(options)`** is the shorthand for a single hand-rolled tool; `id` defaults to `tool.<name>`, and `enabled: false` disables it without unmounting.

**`<ToolScope group describe>`** groups the capabilities inside it and demotes them from tier 0 to tier 1 once the region has been offscreen for `demoteAfter` ms (default 5000). Scrolling back promotes them again with no re-declare.

**`useAgentableSnapshot()`** returns the live registry snapshot — resident tools, budget, cache stats, adapters, warnings, estimated tokens. Re-renders on every registry change, so use it sparingly. **`useAgentPresent()`** is true once the first agent call arrives.

**`useAgentable()`** returns the registry from the nearest provider, or `null`.

## SSR and StrictMode

Registration happens in effects only, so nothing runs during SSR. Declarations are refcounted and identity-stable across re-renders. The provider defers its `dispose()` by a macrotask so StrictMode's mount → unmount → remount cycle cannot tear down the registry the second mount reuses.

MIT
