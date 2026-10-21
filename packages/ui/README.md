# @agentable-ui/ui

React controls for people and agents, with an optional default theme. Add an `agent` prop to a supported control to declare its tools. Leave the prop off to use it as an ordinary component.

## Install

```bash
npm install @agentable-ui/ui @agentable-ui/react @agentable-ui/core
```

## Start with a table

```tsx
import { AgentableProvider } from "@agentable-ui/react";
import { DataTable } from "@agentable-ui/ui";
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
    <AgentableProvider>
      <DataTable
        rows={orders}
        columns={columns}
        agent={{ name: "query_orders", cache: false }}
      />
    </AgentableProvider>
  );
}
```

Call `query_orders` with `{"query":"Ada"}` to update the table and return matching rows. Add [devtools](../devtools) to try this without a browser agent.

## Callable controls

| Component | Agent behavior | Confirmation default |
|---|---|---|
| `Form` + `Field` | Submit values using a schema derived from fields. | Asks before agent submission. |
| `DataTable` | Search, sort, and filter; selection tool when selectable (or explicitly enabled). | Query and selection do not ask. |
| `Combobox` | Search options or select by label/value. | Does not ask. |
| `ActionBar` | Choose an action id; fan-in shares one tool by default. | Destructive actions ask. |
| `Dialog` | Open/close; child tools mount while open. | Does not ask. |
| `Tabs` | Switch tabs; inactive panels unmount. | Does not ask. |
| `Nav` | Navigate by href or label. | Does not ask. |
| `Filters` | Set part of a filter set, or reset it. | Does not ask. |
| `Pagination` | Navigate to a page. | Does not ask. |
| `Toaster` | Read notifications created with `toast()`. | Read-only. |

These defaults describe agent calls. Human interaction uses your normal event handlers. Explicit confirmation settings can override them.

## Forms and actions

```tsx
import { Form, Field, ActionBar } from "@agentable-ui/ui";

<Form
  agent={{ name: "create_invoice" }}
  onSubmit={(values) => createInvoice(values)}
>
  <Field name="customer" label="Customer" required />
  <Field name="amountCents" label="Amount (cents)" type="integer" min={1} required />
</Form>

<ActionBar
  agent={{ name: "order_actions", invalidates: ["orders"] }}
  actions={[
    { id: "ship", label: "Ship", onAction: ship },
    { id: "refund", label: "Refund", destructive: true, onAction: refund },
  ]}
/>
```

Provide your application's `createInvoice`, `ship`, and `refund` callbacks. Return a useful result for the agent. Use `describe` on fields and actions to explain their purpose.

## Shared agent options

| Option | Purpose |
|---|---|
| `name` | Stable tool name. Keep it within the 30-character guidance. |
| `id` | Optional capability id; otherwise derived from component and name. |
| `group`, `tier`, `priority` | Availability and budget preference. Tier 0 is still subject to eviction. |
| `description`, `title` | Override generated tool descriptions and labels. |
| `confirm` | Override confirmation with `true`, `false`, or a message. |
| `cache` | Cache configuration or `false`. Read-only queries cache by default. |
| `invalidates` | Tags cleared after a successful agent mutation. |
| `project` | Fields retained in tool output. |
| `maxChars` | Output cap; default 1,500. |
| `exposedTo` | Explicit browser exposure configuration. |

A cached call skips its callback. Set `cache: false` on table query tools if repeated calls must reapply visible state. For pure reads, use tags and invalidate them when data changes; human callbacks do not automatically clear registry caches.

For tables, use stable record `id` values or provide `getRowId`. Index-based IDs survive internal search and sort, but a changing source order needs a stable key. `agentHidden` excludes a column from agent output; use `project` to further limit fields. Neither replaces server-side access control.

## Theme and custom styles

Import `@agentable-ui/ui/styles.css` once. It follows system light/dark mode; set `data-theme="light"` or `data-theme="dark"` on the root HTML element to choose explicitly.

```css
:root {
  --ag-accent: #2563eb;
  --ag-accent-fg: #ffffff;
  --ag-radius: 10px;
  --ag-font: system-ui, sans-serif;
}
```

Other tokens include `--ag-bg`, `--ag-panel`, `--ag-fg`, `--ag-muted`, `--ag-line`, `--ag-success`, `--ag-warning`, and `--ag-danger`. Scope them to a parent element for local themes. Styles target `data-agentable-*` hooks, so you can override or replace them. The optional `@agentable-ui/ui/tailwind` preset supplies matching tokens and state variants.

## Button API

The source checkout includes native button props and refs, rich children, sizes, a ghost variant, and loading state. Check your installed release when using these additions.

```tsx
import { Button } from "@agentable-ui/ui";

<Button variant="primary" size="lg" loading={saving} onClick={save}>
  Save changes
</Button>
<Button variant="ghost" size="sm" aria-label="Close" onClick={close}>×</Button>
```

Variants: `default`, `primary`, `danger`, `ghost`. Sizes: `sm`, `md` (default), `lg`. Loading disables interaction and sets `aria-busy`. Existing `label` and `onPress` remain supported. `onClick` runs first; `preventDefault()` cancels `onPress`.

Button is presentational and does not take `agent`. Use ActionBar for callable actions.

## Generative UI catalog

`uiCatalog` describes presentational components (`Text`, `Card`, `Stat`, `StatGroup`, `Callout`, `KeyValue`, `SimpleTable`, `List`, `Stack`, `Grid`, `Progress`, `Badge`, `Divider`, `Image`, `LinkCard`, `Chart`) and interactive ones (`Button`, `TextInput`, `Select`, `Checkbox`, `RecordTable`, `Checklist`, `ItemList`, `Timeline`). Use it with [genui](../genui) or [lang](../lang).

### Data-bound collections

`Checklist`, `ItemList`, `Timeline` and `Chart` take an array, usually bound to `$data.*`, and fire per-item events with the whole item. A program can then act on one row:

```text
root = Card("Packing", [list])
list = Checklist($data.items, toggle: @Tool("toggle_item", {id: $event.id}), remove: @Tool("remove_item", {id: $event.id}))
```

| Component | Item shape | Events |
|---|---|---|
| `Checklist` | `{id, text, done?, note?}` | `toggle`, `remove` (the remove button only shows when bound) |
| `ItemList` | `{id, title, subtitle?, meta?, badge?, href?}` | `select` (rows are buttons only when bound) |
| `Timeline` | `{id?, time, title, detail?, done?}` | `select` |
| `Chart` | rows with the `x` key and each `series` key; `kind` is `bar`, `line` or `area` | `select` (fires with the row) |

Collections render an empty state instead of failing when the bound value is missing. `Image` and `LinkCard` accept only `http(s)` URLs (and `data:image/*` for images). Chart colors come from `--ag-series-1` to `--ag-series-5`.

Utility exports: `applyQuery`, `applyFilters`, `matchOptions`, `resolveOption`, and `useAgentCapability`.

MIT licensed.
