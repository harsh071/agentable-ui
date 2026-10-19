# @agentable-ui/ui

Headless, agent-callable React components. Every component takes one `agent` prop and becomes a tool.

```bash
npm install @agentable-ui/ui @agentable-ui/react @agentable-ui/core
```

```tsx
import { AgentableProvider } from "@agentable-ui/react";
import { DataTable, ActionBar, Toaster } from "@agentable-ui/ui";
import "@agentable-ui/ui/styles.css";

<AgentableProvider budget={12}>
  <DataTable
    rows={orders}
    columns={columns}
    agent={{ name: "query_orders", project: ["id", "customer", "total", "status"], cache: { ttl: 30_000, tags: ["orders"] } }}
  />
  <ActionBar
    agent={{ name: "run_order_action", title: "Order actions" }}
    actions={[
      { id: "mark_paid", label: "Mark paid", describe: "Set selected orders to paid", onAction: markPaid },
      { id: "ship", label: "Ship", describe: "Set selected orders to shipped", onAction: ship },
    ]}
  />
  <Toaster agent={{ name: "read_notifications", group: "page", tier: 1 }} />
</AgentableProvider>;
```

Omit the `agent` prop and the component is ordinary — no tool, no registry, no cost.

## Components

| Component | Tools it declares |
|---|---|
| `Form` + `Field` | One submit tool whose input schema is derived from the fields. |
| `DataTable` | A query tool (filter, sort, project, paginate) and a select tool. |
| `Combobox` | Select an option by label or value, ranked by exact, prefix, then substring match. |
| `ActionBar` | Fan-in: many actions collapse into one tool with an `action` enum. |
| `Dialog` | Open/close; tools inside it mount only while it is open. |
| `Tabs`, `Nav` | Navigate by value or href. |
| `Filters` | One tool for the whole filter set. |
| `Pagination` | Page navigation. |
| `Toaster` | `toast()` imperatively; the agent reads notifications back. |

`uiCatalog` exports presentational primitives (`Text`, `Card`, `Stat`, `StatGroup`, `Callout`, `KeyValue`, `SimpleTable`, `List`, `Stack`, `Progress`) and interactive ones with events (`Button`, `TextInput`, `Select`, `Checkbox`, `RecordTable`) for use with [`@agentable-ui/genui`](../genui).

## The `agent` prop

```ts
{
  name: string;            // tool name, <= 30 chars
  id?: string;             // capability id, defaults to `<component>.<name>`
  description?: string;    // overrides the generated description
  title?: string;
  group?: string;
  tier?: 0 | 1 | 2;
  priority?: number;
  confirm?: boolean | string;
  cache?: CacheOptions | false;
  invalidates?: string[];
  project?: string[];      // fields to keep in output
  maxChars?: number;       // output cap, default 1500
  exposedTo?: string[];
}
```

Each component picks safe defaults: read-only components cache and skip confirmation, mutating ones ask first.

## Styling

`@agentable-ui/ui/styles.css` is a plain stylesheet with no build step. Components are headless — they carry `data-agentable-*` attributes, so you can drop the stylesheet and use your own, or import the Tailwind preset from `@agentable-ui/ui/tailwind`.

Also exported for reuse outside the components: `applyQuery`, `applyFilters`, `matchOptions`, `resolveOption`, `useAgentCapability`.

MIT

### Styled controls and native button props

Import `@agentable-ui/ui/styles.css` once for the default light/dark theme. Override
`--ag-*` CSS variables or the documented `data-agentable-*` hooks to match your app.
Buttons accept native button props (including `ref`, `type`, `aria-*`, `className`,
and `onClick`), rich children, a size, and a loading state:

```tsx
<Button variant="primary" size="lg" loading={saving} onClick={save}>
  Save changes
</Button>
<Button variant="ghost" size="sm" aria-label="Close" onClick={close}>×</Button>
```

`loading` disables interaction and sets `aria-busy`. Existing `label` and `onPress`
props continue to work for generated UI. `onClick` runs before `onPress`; calling
`event.preventDefault()` cancels `onPress`. Variants are `default`, `primary`,
`danger`, and `ghost`; sizes are `sm`, `md` (default), and `lg`.

For tables, pass `getRowId` when records have no `id` and their source order can
change. Selection stays stable through table search, sorting, and pagination.
Avoid caching query tools when repeating a query must also reapply visible UI state.
