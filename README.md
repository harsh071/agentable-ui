# Agentable

A React component library that registers itself with the agent. WebMCP-native, budget-managed.

WebMCP lets a page hand an AI agent callable tools instead of making it guess at buttons. Registering tools is the easy part. The hard part is deciding, continuously, which small subset of a large latent tool surface is worth the agent's attention — Agentable is built around that problem.

```tsx
import { AgentableProvider } from "@agentable/react";
import { DataTable } from "@agentable/ui";
import "@agentable/ui/styles.css";

<AgentableProvider budget={12}>
  <DataTable
    rows={orders}
    columns={columns}
    agent={{ name: "query_orders", group: "orders", project: ["id", "customer", "total", "status"], cache: { ttl: 30_000, tags: ["orders"] } }}
  />
</AgentableProvider>;
```

That one `agent` prop declares a capability. The registry decides whether it is resident in `document.modelContext`, reachable through `open_capability`, or dormant.

## Packages

| Package | What it is |
|---|---|
| [`@agentable/core`](packages/core) | Framework-free capability registry: tiers, budgeter, cache, output shaper, adapters. No React, no WebMCP beyond one adapter file. |
| [`@agentable/react`](packages/react) | `AgentableProvider`, `useCapability`, `useTool`, `ToolScope`, snapshot hooks. |
| [`@agentable/ui`](packages/ui) | Headless agent-callable components: Form, DataTable, Combobox, ActionBar, Dialog, Tabs, Nav, Filters, Pagination, Toaster. |
| [`@agentable/genui`](packages/genui) | Generative UI: `AgentSurface` plus a single validated `present` tool over a component catalog. |
| [`@agentable/devtools`](packages/devtools) | In-page overlay (<kbd>Alt</kbd>+<kbd>A</kbd>) showing exactly what an agent sees. |

## The core idea: a tool budget

A real dashboard has hundreds of possible actions. Agents degrade badly past a few dozen tools, so Agentable keeps a hard cap (12 by default) on what is visible at any moment:

- **Tier 0** — resident, always in `getTools()`.
- **Tier 1** — indexed by a `list_capabilities` meta tool and loadable on demand via `open_capability`.
- **Tier 2** — dormant; app code only.

Capabilities are grouped, prioritised, and evicted by a budgeter (priority desc → most recently opened → declared tier → most recently declared). Fan-in collapses many related actions into one tool with an `action` enum. Output is shaped, paginated by cursor, and hard-truncated, because the browser enforces none of that.

The demo declares over 120 capabilities and holds 12 resident, at roughly 320 tokens of context.

## Getting started

```bash
pnpm install
pnpm build          # tsdown, all packages
pnpm dev            # docs + demo site on http://localhost:5173
pnpm test           # vitest unit tests
pnpm test:conformance   # real Chrome, real WebMCP
```

`pnpm dev` serves the docs, the orders demo (`/#/demo`) and a generative-UI playground (`/#/playground`). WebMCP tools only appear in a browser that supports it:

```bash
open -a "Google Chrome" --args --enable-features=WebMCP
```

Without the flag the app still runs; the header simply reads "WebMCP off" and the devtools overlay shows the tool surface anyway. That is deliberate — you can develop and verify agent behaviour without a WebMCP-capable browser.

## Testing against the real platform

Mocked tests are actively dangerous here: a mocked suite will happily stay green while zero tools reach the browser. The conformance suite launches installed Chrome with `--enable-features=WebMCP`, asserts the entry point and IDL, then drives the demo through `document.modelContext.executeTool()` end to end. Nothing in it is mocked.

```bash
pnpm test:conformance
pnpm conformance:report   # writes conformance/REPORT.md
```

[`conformance/REPORT.md`](conformance/REPORT.md) is the red/green record of what Chrome actually does, including where it diverges from the spec draft (`document.modelContext` only; input must be a JSON string; no schema validation; no output truncation; thrown errors collapse to `UnknownError`).

## Design notes

- **Zero dependencies** beyond React. Standard Schema validators (zod 4, valibot 1) are used when present, via `~standard.jsonSchema`, but nothing is bundled.
- **Adapters** decouple the library from the platform: `webmcpAdapter`, `memoryAdapter` (tests, devtools), `bridgeAdapter` (postMessage).
- **Consequential tools are gated** by a confirmation the user sees, and a declined call returns a structured `{"error": ..., "declined": true}` rather than throwing.
- **SSR-safe and StrictMode-safe**: registration happens in effects and is refcounted.

See [docs/implementation-plan.md](docs/implementation-plan.md) for the full design.

## License

MIT
