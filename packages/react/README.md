# @agentable-ui/react

Connect React components to the [Agentable registry](../core). Use a provider for setup, hooks for custom tools, and scopes to group related features.

## Install

```bash
npm install @agentable-ui/react @agentable-ui/core
```

Requires React 18.2+ or React 19. Use a client component in frameworks that distinguish server and client components.

## Add a tool

```tsx
import { AgentableProvider, useTool } from "@agentable-ui/react";

function OrderSummary() {
  useTool({
    name: "count_orders",
    description: "Return the number of demo orders.",
    annotations: { readOnlyHint: true },
    execute: () => ({ count: 2 }),
  });
  return <p>2 orders</p>;
}

export default function App() {
  return (
    <AgentableProvider budget={12}>
      <OrderSummary />
    </AgentableProvider>
  );
}
```

The provider owns one registry and adds the WebMCP adapter plus a built-in confirmation dialog. Browser support is optional for rendering your app. Add [devtools](../devtools) to inspect and call tools locally.

## Provider options

| Prop | Purpose |
|---|---|
| `budget` | Maximum resident tools, including discovery tools; default 12. |
| `confirm` | Custom async confirmation handler. Omit for the built-in dialog. `false` explicitly disables confirmation. |
| `renderConfirm` | Customize the confirmation UI. |
| `agentable` | Supply an existing registry instead of creating one. |

For full registry options, see [core](../core). Imported registries retain their own configuration.

## Declare tools

**`useTool(options)`** is the shorthand for a single tool. Give it `name`, `description`, `inputSchema` when needed, and `execute`. Its capability id defaults to `tool.<name>`. Set `enabled: false` to disable it without unmounting.

**`useCapability(capability | null)`** accepts the full descriptor, including tier, priority, group, fan-in, and render metadata. Pass `null` to remove the declaration.

Callbacks use the latest render's values. Changing a callback alone does not re-register the tool; changing its static descriptor can. Tool names and capability ids should stay stable across renders.

Mark pure reads with `annotations: { readOnlyHint: true }`. They skip confirmation and cache by default. Use `cache: false` if each call must re-read changing state or update UI. Mutations ask for confirmation unless explicitly configured otherwise.

## Group a feature

```tsx
import { ToolScope } from "@agentable-ui/react";

<ToolScope group="orders" describe="Order management" demoteAfter={5000}>
  <OrderSummary />
</ToolScope>
```

Scopes provide group metadata to descendants. When their region stays offscreen for `demoteAfter` milliseconds, eligible tools move from tier 0 to tier 1. Scrolling back restores their eligibility within the budget. Offscreen is different from unmounted: an unmounted component releases its declaration.

## Read registry state

| Hook | Returns |
|---|---|
| `useAgentable()` | Nearest registry, or `null` outside a provider. |
| `useAgentableSnapshot()` | Current tools, budget, cache stats, adapters, warnings, and token estimate. Re-renders on registry changes. |
| `useAgentPresent()` | Whether the registry has received an agent invocation. This is a heuristic, not a browser presence event. |

## Lifecycle and rendering

Registration happens in effects, so SSR does not register browser tools. Declarations are reference-counted, and provider cleanup is deferred to survive React StrictMode's development mount cycle. Without a provider, optional `agent` props are inert and a warning is emitted.

MIT licensed.
