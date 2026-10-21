---
"@agentable-ui/ui": patch
---

Fix DataTable rows rendering as flex boxes. ItemList's static rows used `data-agentable-row`, the same hook as DataTable rows, so the ItemList row style broke table layout. ItemList now uses `data-agentable-itemlist-row`; DataTable keeps `data-agentable-row`.
