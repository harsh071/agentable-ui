# @agentable-ui/devtools

An in-page overlay that shows exactly what an agent sees: resident tools, budget pressure, cache hit rate, schema sizes, and a console for calling tools by hand.

```bash
npm install @agentable-ui/devtools
```

## React

```tsx
import { AgentableDevtools } from "@agentable-ui/devtools/react";

<AgentableProvider budget={12}>
  <App />
  <AgentableDevtools position="bottom-right" />
</AgentableProvider>;
```

## Anywhere else

```ts
import { mountDevtools } from "@agentable-ui/devtools";

const handle = mountDevtools(agentable, { position: "bottom-right", shortcut: "alt+a" });
handle.toggle();
handle.unmount();
```

It is a custom element (`<agentable-devtools>`) in a shadow root, so it cannot inherit or leak your page styles. React is an optional peer dependency, needed only for the `/react` entry point.

## Panels

- **Overview** — resident vs declared capabilities, budget used, estimated token cost, cache hits/misses, adapter availability.
- **Capabilities** — every declaration with its tier, group, priority, and schema size in characters; see what the budgeter evicted and why.
- **Console** — call any resident tool with JSON input and read the exact string the agent would receive, including truncation and pagination.
- **Warnings** — limit violations, evictions, duplicate names, missing confirm handlers.

## Options

| Option | Default | |
|---|---|---|
| `position` | `"bottom-right"` | Corner for the toggle button. |
| `open` | `false` | Start with the panel open. |
| `shortcut` | `"alt+a"` | Toggle shortcut; `null` disables it. |
| `container` | `document.body` | Mount target. |

Devtools exist so a developer without a WebMCP-capable browser can still build and verify agent behaviour: the overlay reads the registry directly and works with or without `document.modelContext`.

MIT
