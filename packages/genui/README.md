# @agentable-ui/genui

Render model-generated interfaces using components you allow. Use `Renderer` for text streamed by your application, or `AgentSurface` for an in-page agent that calls a `present` tool.

## Install

```bash
npm install @agentable-ui/genui @agentable-ui/ui @agentable-ui/react @agentable-ui/core
```

## Render a program

This complete example renders a static program. Replace `program` with the accumulated text from your model stream and set `isStreaming` while chunks arrive.

```tsx
import { Renderer } from "@agentable-ui/genui";
import { uiCatalog } from "@agentable-ui/ui";
import "@agentable-ui/ui/styles.css";

const program = `root = Card("Order summary", [total])
total = Stat("Revenue", "$48.2k")`;

export default function Summary() {
  return <Renderer components={uiCatalog} response={program} isStreaming={false} />;
}
```

`response` is the **full text received so far**, not just the newest chunk. Complete lines render as they arrive; interactions stay disabled until streaming finishes. `onError` receives structured parsing and validation issues. Your app owns model requests, credentials, and streaming transport.

## Give a browser agent a surface

```tsx
import { AgentableProvider } from "@agentable-ui/react";
import { AgentSurface } from "@agentable-ui/genui";
import { uiCatalog } from "@agentable-ui/ui";
import "@agentable-ui/ui/styles.css";

export default function App() {
  return (
    <AgentableProvider>
      <AgentSurface components={uiCatalog} name="present" maxNodes={60} />
    </AgentableProvider>
  );
}
```

The surface declares one `present` tool with a schema derived from its currently allowed catalog. An agent can supply either a program or a JSON tree:

```json
{"program":"root = Card(\"Hello\")"}
```

```json
{"root":{"component":"Card","props":{"title":"Hello"}}}
```

A single tool avoids one tool per visual component; its schema size still depends on the catalog. Use a focused catalog and inspect the result in devtools.

## Bind data and handle events

- `$data.*` in Lang (or `data.*` in JSON bindings) reads application data passed through `data`. Generated UI cannot write to it.
- `$ui.*` is local interface state. Actions can set, merge, push, remove, increment, or toggle it.
- A catalog entry maps event names to callback props, for example `events: { press: "onPress" }`.
- `when` conditionally shows a node. `@Say` forwards a message to `onMessage`.

For example:

```text
root = Stack([input, greeting])
input = TextInput("Name", value: $ui.name, change: @Set($ui.name, $event))
greeting = Text("Thanks for sharing your name.", when: $ui.name)
```

Tool routing differs by host:

| Host | Tool configuration |
|---|---|
| `Renderer` | `tools={{ tool_name: callback }}` supplies callbacks. Missing names can fall back to a mounted Agentable registry. Direct callbacks follow your application's policies. |
| `AgentSurface` | `tools={["tool_name"]}` narrows callable registry tools; `tools={false}` disables tool actions. Registry calls retain confirmation, caching, and invalidation. |

`AgentSurface` can also patch the current tree with `present({ ops })`, using node ids and `add`, `update`, `remove`, or `set` operations. When `data` is supplied, a read-only `<name>_state` tool reports the data shape, UI state, and current tree; set `stateTool={false}` to omit it.

## Validation and custom catalogs

```tsx
import { Stat } from "@agentable-ui/ui";

const catalog = {
  Stat: {
    component: Stat,
    description: "A headline number.",
    props: {
      type: "object",
      properties: {
        label: { type: "string" },
        value: { type: "string" },
      },
      required: ["label", "value"],
    },
  },
};
```

Catalog schemas accept JSON Schema or supported Standard Schema validators. Unknown components, invalid props, and excessive depth/node counts produce structured issues. `AgentSurface` defaults to depth 6 and 60 nodes. Renderer prunes invalid nodes so valid parts can remain visible; validation options depend on the host.

Lower-level exports include `validateSpec`, `catalogSchema`, and `renderSpec`. Validate before calling `renderSpec` directly.

See [lang](../lang) for syntax, prompts, and parsing; [ui](../ui) for the built-in catalog.

MIT licensed.
