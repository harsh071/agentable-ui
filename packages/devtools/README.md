# @agentable-ui/devtools

Inspect the tools an agent can use and call them yourself. The panel reads the registry directly, so it works without a WebMCP browser or an AI assistant.

## Install

```bash
npm install -D @agentable-ui/devtools
```

## Add to React

Mount devtools inside the same provider as your app:

```tsx
import { AgentableProvider } from "@agentable-ui/react";
import { AgentableDevtools } from "@agentable-ui/devtools/react";

<AgentableProvider>
  <YourApp />
  <AgentableDevtools position="bottom-right" />
</AgentableProvider>
```

Click **Agent** or press **Alt+A** to open the panel. In **Console**, choose a tool, enter its JSON inputs, and run it. For a query tool, try `{"query":"Ada"}`. Consequential calls still show the configured confirmation prompt.

Keep the package available wherever you import it. If your deployment omits devDependencies, make sure devtools imports are excluded from that production build or install the package as a runtime dependency.

## Use without React

```ts
import { mountDevtools } from "@agentable-ui/devtools";

// agentable is the registry created by createAgentable().
const handle = mountDevtools(agentable, {
  position: "bottom-right",
  shortcut: "alt+a",
});
handle.toggle();
handle.unmount();
```

The panel is a custom element in a shadow root, so its styles are isolated. React is an optional peer dependency used only by the `/react` entry point.

## Find what you need

| Panel | Use it to |
|---|---|
| Overview | Check resident tools, budget, token estimates, cache stats, and adapter availability. |
| Capabilities | Inspect all declarations, tiers, groups, priority, schema size, and eviction reasons. |
| Console | Run a resident tool with JSON input and inspect its result, including output shaping. |
| Warnings | Investigate budget pressure, limit warnings, duplicate names, and confirmation configuration. |

## Options

| Option | Default | Purpose |
|---|---|---|
| `position` | `"bottom-right"` | Toggle button position. |
| `open` | `false` | Open on mount. |
| `shortcut` | `"alt+a"` | Toggle shortcut; `null` disables it. |
| `container` | `document.body` | Mount target for the framework-free API. |

## Troubleshooting

- **Tool is missing:** check Capabilities. It may be unmounted, dormant, or outside the resident budget.
- **WebMCP is unavailable:** local Console calls still work; check your target browser separately.
- **Call waits:** look for the confirmation dialog and approve or decline it.
- **Result is stale:** inspect cache settings and invalidation tags. Use `cache: false` for callbacks that must run every time.

See [core](../core) for registry behavior and [react](../react) for provider setup.

MIT licensed.
