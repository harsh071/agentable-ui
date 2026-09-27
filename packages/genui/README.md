# @agentable-ui/genui

Generative UI for Agentable: the agent describes what to render, you keep control of what can be rendered.

```bash
npm install @agentable-ui/genui @agentable-ui/ui @agentable-ui/react @agentable-ui/core
```

```tsx
import { AgentSurface } from "@agentable-ui/genui";
import { uiCatalog } from "@agentable-ui/ui";

<AgentSurface components={uiCatalog} name="present" maxNodes={60} />;
```

That declares a `present` tool whose input schema is generated from the catalog. The agent sends a UI spec; the component tree it can produce is exactly the catalog you passed and nothing else.

## Why one tool

Exposing a tool per component burns the budget and lets the agent invent markup. A single `present` tool with a generated schema keeps the cost flat and the output constrained.

## Validation

`validateSpec(spec, catalog, allowed, opts)` runs before anything renders and rejects unknown components, bad prop shapes, specs deeper than `maxDepth` (default 6) and specs larger than `maxNodes` (default 60). Failures come back to the agent as structured issues it can correct, not as a thrown error.

- `catalogSchema(catalog, allowed)` — the generated JSON Schema for the `present` tool.
- `renderSpec(spec, catalog)` — render a validated spec yourself.

## Interactive surfaces

Nodes can do more than display props:

```jsonc
{
  "component": "RecordTable", "id": "orders",
  "bind": { "rows": "data.paid" },                       // read app data
  "on": { "select": [{ "type": "set", "path": "ui.selected", "value": "{{value}}" }] }
}
{
  "component": "Button", "when": "ui.selected", "props": { "label": "Refund this order" },
  "on": { "press": [{ "type": "tool", "name": "refund_order", "args": { "id": "{{ui.selected.id}}" }, "into": "ui.last" }] }
}
```

- `data.*` is what you pass as `<AgentSurface data={...}>`. It is read-only to generated UI and re-renders when it changes.
- `ui.*` belongs to the surface. Actions (`set`, `merge`, `push`, `remove`, `increment`, `toggle`) may only write here.
- `tool` actions call registered tools through `agentable.invokeCapability`, so confirmation, caching and invalidation work exactly as for an agent. Only tools an agent could reach (tier 0 or 1) are callable; narrow them with `tools={[...]}` or turn them off with `tools={false}`.
- `present({ ops })` patches the current tree by node id (`add`, `update`, `remove`, `set`) instead of resending it.
- With `data` set, a read-only `<name>_state` tool returns the shape of `data`, the current `ui` state and the tree.
- Catalog entries declare events as `events: { press: "onPress" }`: event name to callback prop, whose first argument becomes `{{value}}`.

## Catalog entries

```ts
const catalog = {
  Stat: {
    component: Stat,
    props: z.object({ label: z.string(), value: z.string(), delta: z.string().optional() }),
    description: "A single headline number.",
  },
};
```

`props` accepts a JSON Schema object or any Standard Schema validator. `uiCatalog` from [`@agentable-ui/ui`](../ui) is a ready-made set.

MIT
