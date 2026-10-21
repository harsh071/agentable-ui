# @agentable-ui/core

## 0.2.0

### Minor Changes

- 6e72118: Fixes from embedding Agentable in a host app (Bits):
  
  - core: `executeModelContextTool(mc, name, args)` calls a registered WebMCP tool the way an external agent would, handling both input encodings Chrome has shipped (object in 155, JSON string in 154). Snapshot groups now carry the `ToolScope describe` text as `description`.
  - lang: a literal `null` counts as the value for `@Set` and `@Push` (`@Set($ui.sel, null)` no longer reports a missing value).
  - genui: when the host passes `onActionError`, `Renderer` and `AgentSurface` no longer also render the error inline.
  - ui: the confirm and dialog modals keep `margin: auto` under CSS resets like Tailwind preflight; fields inside gap-spaced containers drop their extra bottom margin; buttons in column stacks and cards no longer stretch to full width.
  - devtools: groups and tool rows show the group's description, with the id as a tooltip.

## 0.1.1

### Patch Changes

- Rebuild a tool when its capability is released and declared again, so a remounted component's tool no longer runs the old, released instance.
