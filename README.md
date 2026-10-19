# Agentable UI

React components that people and AI agents can use together. A person searches a table on the page; an agent calls a tool declared by the same table. Add one optional `agent` prop to supported controls.

[Documentation](https://agentable.interfacesforhuman.com/#/docs/intro) · [Demo](https://agentable.interfacesforhuman.com/#/demo) · [Playground](https://agentable.interfacesforhuman.com/#/playground)

## Start with a working table

In an existing React 18.2+ app:

```bash
npm install @agentable-ui/ui @agentable-ui/react @agentable-ui/core
npm install -D @agentable-ui/devtools
```

```tsx
import { AgentableProvider } from "@agentable-ui/react";
import { DataTable } from "@agentable-ui/ui";
import { AgentableDevtools } from "@agentable-ui/devtools/react";
import "@agentable-ui/ui/styles.css";

const orders = [
  { id: "ORD-1001", customer: "Ada Lovelace", total: 129 },
  { id: "ORD-1002", customer: "Grace Hopper", total: 249 },
];
const columns = [
  { key: "id", header: "Order" },
  { key: "customer", header: "Customer" },
  { key: "total", header: "Total" },
];

export default function App() {
  return (
    <AgentableProvider budget={12}>
      <DataTable
        rows={orders}
        columns={columns}
        noun="orders"
        agent={{ name: "query_orders", cache: false }}
      />
      <AgentableDevtools />
    </AgentableProvider>
  );
}
```

Run your app, click **Agent** (or press **Alt+A**), and open **Console**. Call `query_orders` with `{"query":"Ada"}`. The table updates and returns matching orders. Call it with `{}` to reset.

`cache: false` ensures each call reapplies the table's visible state. Pure read-only tools cache by default; see [caching](packages/core/README.md#caching) before enabling it for callbacks with UI effects.

No AI model, API key, or browser flag is required for this local workflow. In frameworks with server components, put the example in a client component. Keep devtools available in builds that import it, or exclude that import from production.

## Choose your path

| You want to… | Start here |
|---|---|
| Add a table, form, dialog, or action bar | [UI components](packages/ui/README.md) |
| Expose your existing React app's actions | [React provider and hooks](packages/react/README.md) |
| Build a framework-free integration | [Core registry](packages/core/README.md) |
| Inspect and call tools without an agent | [Devtools](packages/devtools/README.md) |
| Parse model-written UI programs | [Agentable Lang](packages/lang/README.md) |
| Render streamed programs or expose a `present` tool | [Generative UI](packages/genui/README.md) |

## How the agent layer works

A supported component's `agent` prop declares a capability: a tool name, inputs, and callback. The registry decides which capabilities to expose, and the WebMCP adapter registers them with the browser when available.

The tool budget defaults to twelve resident tools, including discovery tools:

| Tier | Availability |
|---|---|
| `0` | Eligible to stay resident, subject to the budget. |
| `1` | Indexed by `list_capabilities`, then loaded by `open_capability`. |
| `2` | Dormant until application code promotes it. |

Related ActionBar actions share one tool. Only mounted components declare tools; ToolScope can demote groups after they stay offscreen. The budget bounds the tool list, but the project does not claim a benchmarked model-accuracy improvement.

Inputs are validated before execution. Results can be projected, paginated, and capped in length. React provides a confirmation dialog for consequential agent calls. Component defaults vary: forms ask before submission, destructive actions ask, and UI navigation does not. Your application still owns authentication, authorization, and business rules.

## Generate UI with the same components

A model can write a short Agentable Lang program:

```text
root = Stack([stats, note])
stats = StatGroup([revenue, orders])
revenue = Stat("Revenue", "$48.2k")
orders = Stat("Orders", 140)
note = Callout("On track", "Ahead of target by 4%.", "success")
```

`createLibrary(uiCatalog).prompt()` describes the catalog to a model. `Renderer` validates and renders the response as complete lines arrive. `AgentSurface` exposes a `present` tool for in-page agents. The application handles model requests and streaming; the library handles parsing, validation, and rendering.

## Run this repository

The site build requires Node.js 20.19+ or 22.12+ (Vite's supported versions). Use the package-manager version specified in `package.json`.

```bash
pnpm install
pnpm build
pnpm dev
```

The local site serves the [docs](http://127.0.0.1:5173/#/docs/intro), [orders demo](http://127.0.0.1:5173/#/demo), and [playground](http://127.0.0.1:5173/#/playground). UI source edits hot-reload in development.

```bash
pnpm typecheck
pnpm --filter @agentable-ui/site docs:check
pnpm test
pnpm --filter @agentable-ui/site build
pnpm test:conformance
pnpm conformance:report
```

Unit tests cover library behavior. The conformance suite launches installed Chrome with `--enable-features=WebMCP` and tests the real browser API, registry, demo agent workflow, and interface behavior. The [checked-in report](conformance/REPORT.md) records the browser version and findings; browser behavior is version-specific.

## Browser support

The React interface and devtools work without WebMCP. Browser-agent access needs a compatible implementation. The site shows adapter availability in its header. For the setup tested by this repository, quit Chrome and relaunch with the feature enabled:

```bash
# macOS
open -a "Google Chrome" --args --enable-features=WebMCP
```

WebMCP is experimental. Use the conformance suite to verify the browser version you intend to support. The current checked-in run uses object inputs to `document.modelContext.executeTool()` and receives string outputs. Agentable's adapters isolate the rest of the library from platform changes.

## Documentation for tools and assistants

[/llms.txt](apps/site/public/llms.txt) is the short text guide. `/llms-full.txt` adds every package README and is regenerated by the site's build script. These files provide a text alternative to the JavaScript-rendered docs site.

The [original implementation plan](docs/implementation-plan.md) is historical context, not the current API reference. Changelogs in each package record published versions; unreleased source changes are described by changesets.

## Related projects

Part of [Interfaces for Humans](https://www.interfacesforhuman.com): Agentable supplies components, [Agentable Studio](https://studio.interfacesforhuman.com) builds apps using them, and [RUI](https://rui.interfacesforhuman.com) checks generated interfaces. Model calls and evaluation services stay outside this component library.

MIT licensed.
