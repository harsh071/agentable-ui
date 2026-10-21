# @agentable-ui/genui

## 0.3.0

### Minor Changes

- eda787f: Read paths can filter and count lists: `$data.items[done=true]`, `$data.items[status!="archived"]`, `$data.items[done=true].length`. Booleans compare by truthiness so a missing field counts as `false`. Filters are read-only; writing `ui.*` through a filter is rejected. `parsePath` now returns `PathKey[]` (filters are `{ field, op, value }` objects), exported with the `PathFilter` type. The Lang prompt documents the syntax.

### Patch Changes

- Updated dependencies [eda787f]
  - @agentable-ui/lang@0.2.0

## 0.2.0

### Minor Changes

- 0cc80e8: Add Agentable Lang support. genui gains a streaming `<Renderer>` for Agentable Lang programs, `program` on `present`, a `message` action with `onMessage`, and a `prune` option for `validateSpec`. ui: `Progress` shows 0 instead of NaN for an unbound value, plus polished generated-surface styles. `@agentable-ui/lang` (new, 0.1.0) is the framework-free parser, streaming parser, prompt generator and serializer.
