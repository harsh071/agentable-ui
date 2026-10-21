# @agentable-ui/core

A framework-free registry for tools that agents can call. It manages which tools are available, validates inputs, asks for confirmation, and shapes results. No React or runtime dependencies.

## Install

```bash
npm install @agentable-ui/core
```

## Declare your first tool

This example uses plain JSON Schema; a validator library is optional.

```ts
import { createAgentable, webmcpAdapter } from "@agentable-ui/core";

const orders = [
  { id: "ORD-1001", status: "paid" },
  { id: "ORD-1002", status: "pending" },
];
const agentable = createAgentable({
  budget: 12,
  adapters: [webmcpAdapter()],
  confirm: async (request) => window.confirm(request.message),
});

const handle = agentable.declare({
  id: "orders.query",
  group: "orders",
  tool: {
    name: "query_orders",
    description: "Return orders, optionally filtered by status.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string" } },
    },
    annotations: { readOnlyHint: true },
    execute: (args) => {
      const { status } = args as { status?: string };
      return orders.filter((order) => !status || order.status === status);
    },
  },
});

// When this feature is removed:
handle.release();
// When the whole application is removed:
agentable.dispose();
```

The WebMCP adapter registers tools when a compatible browser API is available. For React apps, use [AgentableProvider](../react), which also supplies a confirmation dialog.

## Availability and the tool budget

The budget limits **resident tools**, including discovery tools. It defaults to 12.

| Tier | Meaning |
|---|---|
| `0` | Preferred for residency, subject to the budget. |
| `1` | Discoverable with `list_capabilities`, then loaded using `open_capability`. |
| `2` | Dormant; application code must promote it. |

Use `group` to load related capabilities together and `priority` to decide what stays when space is limited. A higher priority wins; recency and declared tier break ties. Tier 0 does not guarantee residency.

Capabilities in the same `fanIn` bucket share a tool with an `action` enum. This is how [ActionBar](../ui) presents a row of actions as one tool.

## Inputs and results

`inputSchema` accepts JSON Schema or a Standard Schema validator with JSON Schema conversion support. The library performs validation before calling `execute`; browser validation is not assumed. `setSchemaConverter` supports other conversion strategies.

Results pass through `tool.output`:

```ts
output: {
  project: ["id", "status"],
  paginate: { pageSize: 20 },
  maxChars: 1500,
}
```

`project` keeps selected fields. Pagination supplies a cursor for the next result page. The character cap bounds returned text; inspect `has_more` and pagination metadata when consuming results.

## Caching

Read-only tools cache results by canonical input arguments, with a default TTL of 30 seconds. Override with `cache: { ttl, tags }`, or disable with `cache: false`. Successful calls with `invalidates: ["orders"]` clear matching tags.

A cache hit skips `execute`. Disable caching when a call must also update visible UI or read state that changes outside tagged mutations. Human interactions do not automatically invalidate registry caches.

## Confirmation

Tools are consequential by default unless annotations or an explicit `confirm` override say otherwise. Consequential calls use the configured confirmation handler before execution.

- `tool.confirm: "Archive this order?"` sets a custom prompt.
- `tool.confirm: false` skips confirmation for that tool.
- Without a registry confirmation handler, consequential calls are declined.
- `createAgentable({ confirm: false })` explicitly disables confirmation globally.

A declined call returns structured error text with `declined: true`. Execution failures are returned as structured error text rather than exposing a thrown browser error. Confirmation is a user interaction policy; it does not replace your application's authorization checks.

## Adapters

| Import | Purpose |
|---|---|
| `@agentable-ui/core/adapters/webmcp` | `webmcpAdapter`, `findModelContext`: browser integration. Prefers `document.modelContext`, with legacy fallbacks. `executeModelContextTool(mc, name, args)` calls a registered tool the way an external agent would, handling both input encodings Chrome has shipped (an object in 155, a JSON string in 154). |
| `@agentable-ui/core/adapters/memory` | `memoryAdapter`: normalized tools for local invocation and tests. |
| `@agentable-ui/core/adapters/bridge` | `bridgeAdapter`: postMessage transport for extensions and iframes. |

The WebMCP adapter waits for in-flight executions before unregistering a tool, preserving compatibility with older browser behavior. See the repository's [conformance report](../../conformance/REPORT.md) for the tested Chrome version.

## Other exports

`applyBudget`, `ToolCache`, `shape`, `project`, `hardTruncate`, `encodeCursor`, `decodeCursor`, `toJsonSchema`, `validateInput`, `checkLimits`, `estimateTokens`, `inferAnnotations`, `errorText`, and `defineCapability` are available for lower-level integrations.

MIT licensed.
