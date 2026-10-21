# @agentable-ui/genui

## 0.3.1

### Patch Changes

- 6e72118: Fixes from embedding Agentable in a host app (Bits):
  
  - core: `executeModelContextTool(mc, name, args)` calls a registered WebMCP tool the way an external agent would, handling both input encodings Chrome has shipped (object in 155, JSON string in 154). Snapshot groups now carry the `ToolScope describe` text as `description`.
  - lang: a literal `null` counts as the value for `@Set` and `@Push` (`@Set($ui.sel, null)` no longer reports a missing value).
  - genui: when the host passes `onActionError`, `Renderer` and `AgentSurface` no longer also render the error inline.
  - ui: the confirm and dialog modals keep `margin: auto` under CSS resets like Tailwind preflight; fields inside gap-spaced containers drop their extra bottom margin; buttons in column stacks and cards no longer stretch to full width.
  - devtools: groups and tool rows show the group's description, with the id as a tooltip.
- Updated dependencies [6e72118]
  - @agentable-ui/core@0.2.0
  - @agentable-ui/lang@0.2.1
  - @agentable-ui/react@0.1.1

## 0.3.0

### Minor Changes

- eda787f: Read paths can filter and count lists: `$data.items[done=true]`, `$data.items[status!="archived"]`, `$data.items[done=true].length`. Booleans compare by truthiness so a missing field counts as `false`. Filters are read-only; writing `ui.*` through a filter is rejected. `parsePath` now returns `PathKey[]` (filters are `{ field, op, value }` objects), exported with the `PathFilter` type. The Lang prompt documents the syntax.

### Patch Changes

- Updated dependencies [eda787f]
  - @agentable-ui/lang@0.2.0

## 0.2.0

### Minor Changes

- 0cc80e8: Add Agentable Lang support. genui gains a streaming `<Renderer>` for Agentable Lang programs, `program` on `present`, a `message` action with `onMessage`, and a `prune` option for `validateSpec`. ui: `Progress` shows 0 instead of NaN for an unbound value, plus polished generated-surface styles. `@agentable-ui/lang` (new, 0.1.0) is the framework-free parser, streaming parser, prompt generator and serializer.
