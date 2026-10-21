# @agentable-ui/ui

## 0.2.0

### Minor Changes

- fffadeb: Add data-bound collections and display components to the generative-UI catalog: `Checklist` (toggle/remove events), `ItemList` (select), `Timeline` (select), `Chart` (bar/line/area SVG, select), `Badge`, `Image`, `LinkCard`, `Grid` and `Divider`. Per-item events fire with the item, so programs can call `@Tool("toggle_item", {id: $event.id})`. Collections render empty states for unbound data, links and images accept only safe URLs, and chart colors use new `--ag-series-1…5` tokens.

### Patch Changes

- f179db2: Polish shared controls and add native button props, rich children, sizes, a ghost variant, and loading state while preserving label/onPress usage. Fix index-based table selection after sorting, tab keyboard focus, duplicate filter IDs, and cleared range filters. Mark exported CSS as a side effect so bundlers preserve it.

## 0.1.1

### Patch Changes

- 0cc80e8: Add Agentable Lang support. genui gains a streaming `<Renderer>` for Agentable Lang programs, `program` on `present`, a `message` action with `onMessage`, and a `prune` option for `validateSpec`. ui: `Progress` shows 0 instead of NaN for an unbound value, plus polished generated-surface styles. `@agentable-ui/lang` (new, 0.1.0) is the framework-free parser, streaming parser, prompt generator and serializer.
