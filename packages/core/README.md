# @agentable-ui/core

Framework-free WebMCP capability registry: tiers, budgeter, cache, output shaper, adapters.

Knows nothing about React, and nothing about WebMCP beyond a single adapter file. Zero dependencies.

```bash
npm install @agentable-ui/core
```

## Usage

```ts
import { createAgentable, webmcpAdapter } from "@agentable-ui/core";

const agentable = createAgentable({
  budget: 12,
  adapters: [webmcpAdapter()],
  confirm: async (req) => window.confirm(req.message),
});

const handle = agentable.declare({
  id: "orders.query",
  group: "orders",
  tool: {
    name: "query_orders",
    description: "Filter and sort the orders table.",
    inputSchema: z.object({ status: z.string().optional() }),
    annotations: { readOnlyHint: true },
    execute: (args) => search(args),
  },
});

handle.release(); // unregisters
```

## What it does

**Budget.** A hard cap on tools visible to the agent at any moment. Tier 0 is resident, tier 1 is indexed by a `list_capabilities` meta tool and loadable via `open_capability`, tier 2 is dormant. Eviction order: priority desc → most recently opened → declared tier → most recently declared.

**Fan-in.** Capabilities sharing a `fanIn` bucket collapse into one tool with an `action` enum, so eight buttons cost one tool.

**Schemas.** `inputSchema` accepts a JSON Schema object or any [Standard Schema](https://standardschema.dev) validator (zod 4, valibot 1) via `~standard.jsonSchema`. Nothing is bundled; `setSchemaConverter` plugs in anything else. The library validates every call, because the browser does not.

**Output.** `shape()` projects fields, paginates by cursor, and hard-truncates to a character cap. Chrome enforces none of this.

**Cache.** TTL and tag-based, on by default for read-only tools, invalidated by `invalidates` after a successful mutation.

**Confirmation.** Tools default to consequential unless `annotations.readOnlyHint` is set. A consequential call goes through the `confirm` handler first; a decline returns a structured `{"error": "...", "declined": true}` string rather than throwing, because thrown errors reach the agent as an opaque `UnknownError`. With no `confirm` handler, consequential calls are declined (fail closed); pass `confirm: false` to run them unconfirmed on purpose.

## Adapters

```ts
import { webmcpAdapter, findModelContext } from "@agentable-ui/core/adapters/webmcp";
import { memoryAdapter } from "@agentable-ui/core/adapters/memory";
import { bridgeAdapter } from "@agentable-ui/core/adapters/bridge";
```

- `webmcpAdapter()` — `document.modelContext`. Defers unregistration until in-flight executions settle, because Chrome rejects a pending `executeTool()` when its tool disappears mid-flight.
- `memoryAdapter()` — the normalized tool list without a browser. Used by devtools and tests.
- `bridgeAdapter()` — `postMessage` transport for extensions and iframes.

## Also exported

`applyBudget`, `ToolCache`, `shape`, `project`, `hardTruncate`, `encodeCursor`/`decodeCursor`, `toJsonSchema`, `validateInput`, `checkLimits`, `estimateTokens`, `inferAnnotations`, `errorText`, `defineCapability`.

MIT
