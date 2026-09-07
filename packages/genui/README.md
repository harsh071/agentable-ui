# @agentable/genui

Generative UI for Agentable: the agent describes what to render, you keep control of what can be rendered.

```bash
npm install @agentable/genui @agentable/ui @agentable/react @agentable/core
```

```tsx
import { AgentSurface } from "@agentable/genui";
import { uiCatalog } from "@agentable/ui";

<AgentSurface components={uiCatalog} name="present" maxNodes={60} />;
```

That declares one tool, `present`, whose input schema is generated from the catalog. The agent sends a UI spec; the component tree it can produce is exactly the catalog you passed and nothing else.

## Why one tool

Exposing a tool per component burns the budget and lets the agent invent markup. A single `present` tool with a generated schema keeps the cost flat and the output constrained.

## Validation

`validateSpec(spec, catalog, allowed, opts)` runs before anything renders and rejects unknown components, bad prop shapes, specs deeper than `maxDepth` (default 6) and specs larger than `maxNodes` (default 60). Failures come back to the agent as structured issues it can correct, not as a thrown error.

- `catalogSchema(catalog, allowed)` — the generated JSON Schema for the `present` tool.
- `renderSpec(spec, catalog)` — render a validated spec yourself.

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

`props` accepts a JSON Schema object or any Standard Schema validator. `uiCatalog` from [`@agentable/ui`](../ui) is a ready-made set.

MIT
