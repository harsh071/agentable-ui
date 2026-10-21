---
"@agentable-ui/lang": minor
---

Accept `name.arg = value` lines as shorthand for a named argument on the component statement `name` (for example `input.change = @Set($ui.q, $event)`). Models write this naturally; previously it failed with `Expected "=" after "input"` and cost a retry. Prop lines apply after all lines are read, replace an inline argument of the same name, and report a clear error when no component statement has that name. The plain `Expected "="` error now includes an example statement.
