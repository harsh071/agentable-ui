---
"@agentable-ui/lang": minor
"@agentable-ui/genui": minor
---

Read paths can filter and count lists: `$data.items[done=true]`, `$data.items[status!="archived"]`, `$data.items[done=true].length`. Booleans compare by truthiness so a missing field counts as `false`. Filters are read-only; writing `ui.*` through a filter is rejected. `parsePath` now returns `PathKey[]` (filters are `{ field, op, value }` objects), exported with the `PathFilter` type. The Lang prompt documents the syntax.
