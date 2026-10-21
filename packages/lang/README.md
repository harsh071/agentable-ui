# @agentable-ui/lang

Parse, stream, and generate prompts for model-written UI programs. Each line names a component and its arguments. The package is framework-free and makes no model or network calls. Use [genui](../genui) to render the result.

```bash
npm install @agentable-ui/lang @agentable-ui/core
```

## Read a program

```txt
root = Stack([stats, note])
stats = StatGroup([rev, orders])
rev = Stat("Revenue", "$48.2k", "+6.1%", "up")
orders = Stat("Orders", 140, "+12", "up")
note = Callout("On track", "Ahead of target by 4%.", "success")
```

## Parse or stream a response

The built-in catalog comes from `@agentable-ui/ui`; install it separately if you use this example. `createLibrary` also accepts your own catalog, without React.

```ts
import { createLibrary } from "@agentable-ui/lang";
import { uiCatalog } from "@agentable-ui/ui";

const library = createLibrary(uiCatalog);
const system = library.prompt({ tools: [{ name: "refund_order", description: "Refund a paid order." }] });

// Your application sends system with the user's message to a model.
// Parse a finished response:
const result = library.parse('root = Text("Hello")');
console.log(result.root, result.errors);

// Or feed successive chunks to the streaming parser:
const parser = library.stream();
parser.push('root = Text("Hel');
parser.push('lo")\n');
const finished = parser.push("", true); // flush the final partial line
```

## Syntax at a glance

- One statement per line: `name = Component(args)`. The entry is `root`. Forward references are fine; the last definition of a name wins.
- Arguments are positional in the component's declared prop order, or named: `Callout("On track", text: "Ahead by 4%.")`. `null` skips an optional positional argument.
- `name.arg = value` lines set one named argument on the component statement `name`, e.g. `save.press = @Say("saved")`. They apply after the whole program is read, so order doesn't matter; the last one wins. Inline named arguments are the canonical form, and `serialize` writes that form.
- Children are a list of statement names, wherever they sit: `Stack([a, b])`, `Card("Title", [a, b])`, or `children: [a, b]`. A name may be used once.
- Strings in double quotes, lists in `[]`, objects in `{key: value}`, numbers, `true`, `false`, `null`. `#` starts a comment.
- State: `$data.x` reads app data (read-only); `$ui.x` is state the interface owns. A path given as an argument binds that prop: `rows: $data.paid`.
- Read paths can filter and count lists: `$data.items[done=true]`, `$data.items[status!="archived"]`, `$data.items[done=true].length`. A missing boolean field counts as `false`. Filters are read-only; actions can't write through them.
- `when: $ui.selected` shows a node while the path is truthy, `when: !$ui.done` while falsy.
- Events are named arguments holding actions: `press: @Set($ui.selected, $event)` or a list `[@Set(...), @Tool(...)]`. `$event` is the event's value, `$event.id` a field of it.
- Actions: `@Set(path, value)`, `@Merge(path, object)`, `@Push(path, value)`, `@Remove(path)`, `@Increment(path, by?)`, `@Toggle(path)`, `@Tool(name, args?, into?)`, `@Say(text)`. Written paths must be `$ui.*`.

A bad line is dropped with a structured error and the rest still renders. Unknown components, unknown arguments, excess arguments and bad action arguments are reported with codes (`unknown-component`, `unknown-arg`, `excess-args`, `bad-arg`, `missing-required`, `parse-failed`, `cycle`, `reused-node`, `no-root`) a host can feed back to the model.

## API reference

- `createLibrary(catalog, { root? })` — a catalog is `{ Name: { description, props, childrenProp?, events? } }`; `props` is JSON Schema or any Standard Schema (zod 4, valibot 1). The `uiCatalog` from `@agentable-ui/ui` works as is.
- `library.prompt({ preamble?, rules?, examples?, tools?, data?, interactive? })` — the system prompt: rules, one signature line per component, tools, an example.
- `library.parse(text)` — `{ root, nodes, unresolved, errors, chars, tokens }`.
- `library.stream()` — `set(text, done?)` / `push(chunk, done?)`; the last unterminated line is held back until `done`.
- `serialize(tree, library)` — a node tree as a program, root line first.
- `parseProgram`, `evaluate`, `signatureLine`, `typeName` for lower-level use.

The node tree it produces is the same `{ component, props, bind, on, when, children }` shape `@agentable-ui/genui` validates and renders, so a program and a JSON tree are interchangeable everywhere, including the `present` tool.

## Rendering and error handling

Parsing returns a tree and structured errors; it does not execute application tools. Pass the accumulated program to `Renderer` from `@agentable-ui/genui` to display it. In Lang, `$event` is the event payload; the JSON tree representation uses `{{value}}`.

Handle `errors` and `unresolved` separately. Forward references can remain unresolved while streaming. Pass `done: true` on the final push so the parser processes the final line even without a newline. Token figures are estimates, not a guaranteed reduction compared with JSON.

MIT licensed.
