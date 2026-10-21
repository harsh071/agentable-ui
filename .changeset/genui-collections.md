---
"@agentable-ui/ui": minor
---

Add data-bound collections and display components to the generative-UI catalog: `Checklist` (toggle/remove events), `ItemList` (select), `Timeline` (select), `Chart` (bar/line/area SVG, select), `Badge`, `Image`, `LinkCard`, `Grid` and `Divider`. Per-item events fire with the item, so programs can call `@Tool("toggle_item", {id: $event.id})`. Collections render empty states for unbound data, links and images accept only safe URLs, and chart colors use new `--ag-series-1…5` tokens.
