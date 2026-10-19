# WebMCP conformance report

Generated 2026-10-19 against real Chrome with `--enable-features=WebMCP`. 45/45 checks green.

Red rows are facts about the platform that differ from the documented spec, or library gates that failed. Every row is asserted in `conformance/tests`, never mocked.

## platform

| | Check | Expected | Actual |
|---|---|---|---|
| 🟢 | browser | Chrome >= 149 with --enable-features=WebMCP | 155.0.8059.84 |
| 🟢 | document.modelContext present | true | true |
| 🟢 | navigator.modelContext alias | false (moved July 2026) | false |
| 🟢 | window.agent alias | false | false |
| 🟢 | ModelContext is an EventTarget | true | true |

## idl

| | Check | Expected | Actual |
|---|---|---|---|
| 🟢 | methods | constructor, executeTool, getTools, ontoolchange, registerTool | constructor, executeTool, getTools, ontoolchange, registerTool |
| 🟢 | unregisterTool | absent (use AbortSignal) | absent |

## lifecycle

| | Check | Expected | Actual |
|---|---|---|---|
| 🟢 | registerTool return value | undefined | undefined |
| 🟢 | AbortSignal unregisters | t1 only after abort | t1,t2 -> t1 |
| 🟢 | duplicate name | InvalidStateError | InvalidStateError: Duplicate tool name |
| 🟢 | pre-aborted signal | AbortError | AbortError: signal is aborted without reason |
| 🟢 | toolchange fires per register/unregister | >= 3 | 3 |
| 🟢 | abort during pending execute | pending invocation completes after unregistering | resolved:done |

## execute

| | Check | Expected | Actual |
|---|---|---|---|
| 🟢 | getTools().inputSchema type | object | object |
| 🟢 | object input | accepted as object | {"got":{"text":"hi"}} |
| 🟢 | JSON-string input | rejected (input must be an object) | TypeError: Failed to execute 'executeTool' on 'ModelContext': invalid input object: value is not an object |
| 🟢 | output | string, objects JSON-serialized | {"got":{"text":"hi"}} |
| 🟢 | schema validation by browser | none (library must validate) | {"got":{"nope":1}} |
| 🟢 | 1500-char output limit enforced | no (guidance only; library truncates) | 5000 chars returned |
| 🟢 | thrown error surfaces as | generic UnknownError (library returns structured error text instead) | UnknownError: Tool was executed but the invocation failed. For example, the script function threw an error |

## limits

| | Check | Expected | Actual |
|---|---|---|---|
| 🟢 | 31-char name | guidance only | accepted |
| 🟢 | 501-char description | guidance only | accepted |

## annotations

| | Check | Expected | Actual |
|---|---|---|---|
| 🟢 | reflected by getTools() | readOnlyHint, untrustedContentHint (consequentialHint dropped) | {"consequentialHint":true,"readOnlyHint":true,"untrustedContentHint":true} |

## exposedTo

| | Check | Expected | Actual |
|---|---|---|---|
| 🟢 | secure origin list | accepted | accepted |
| 🟢 | wildcard | SecurityError | SecurityError: Only secure origins are allowed in the exposedTo list. |

## core

| | Check | Expected | Actual |
|---|---|---|---|
| 🟢 | capabilities declared | 120 | 120 |
| 🟢 | resident tools in getTools() | <= 12 | 12: g0_c0, g0_c1, g0_c2, g0_c3, g0_c4, g1_c0, g1_c1, g1_c2, g1_c3, g1_c4, list_capabilities, open_capability |
| 🟢 | estimated context | < 2500 tokens | ~320 tokens |
| 🟢 | list_capabilities via executeTool | index of unloaded groups | g0 [5]: g0_c5, g0_c6, g0_c7, g0_c8, g0_c9 g1 [5]: g1_c5, g1_c6, g1_c7, g1_c8, g1_c9 g10 [10]: g10_c0, g10_c1, g10_c2, g10_c3, g10_c4, g10_c5, g10_c6, g10_c7, g1 |
| 🟢 | open_capability promotes a group | g7 tools loaded, count still <= 12 | 12: g0_c0, g0_c1, g0_c2, g1_c0, g1_c1, g1_c2, g7_c0, g7_c1, g7_c2, g7_c3, list_capabilities, open_capability |
| 🟢 | toolchange fired on promotion | > 0 | 20 |
| 🟢 | execute through Chrome | {"group":7,"i":0,"q":"hello"} | {"group":7,"i":0,"q":"hello"} |
| 🟢 | library validates input | {"error":"Invalid input." ...} | {"error":"Invalid input.","issues":[{"path":"q","message":"expected string, got integer"}]} |
| 🟢 | budget warnings emitted for evictions | > 0 | 20 |

## demo

| | Check | Expected | Actual |
|---|---|---|---|
| 🟢 | resident tools on /demo | <= 12 | 12: choose_customer, get_dashboard_stats, list_capabilities, navigate, open_capability, query_orders, query_orders_select, reports_page, run_order_action, set_order_filters, settings_tab, update_profile |
| 🟢 | step 1: query_orders (filter+sort+project) | pending EU orders, no email column | {"items":[{"id":"ORD-1097","customer":"Ken Thompson","total":990.87,"status":"pending","region":"EU"},{"id":"ORD-1090","customer":"Frances Allen","total":970.57,"status":"pending","region":"EU"},{"id" |
| 🟢 | step 2: query_orders_select | 3 rows selected in the UI | {"selected":["ORD-1097","ORD-1090","ORD-1047"]} |
| 🟢 | step 3: run_order_action mark_paid (fan-in) | orders updated, toast shown | {"updated":["ORD-1097","ORD-1090","ORD-1047"]} |
| 🟢 | consequential action gated by confirm dialog | user decline returns declined:true | {"error":"The user declined this action.","declined":true} |
| 🟢 | list_capabilities index | lists evicted/unloaded groups only | billing [1]: invoice_dialog \| page [1]: read_notifications |
| 🟢 | dialog tool mounts form tool | create_invoice appears after invoice_dialog{open:true} | 12: choose_customer, create_invoice, get_dashboard_stats, invoice_dialog, list_capabilities, navigate, open_capability, query_orders, query_orders_select, reports_page, settings_tab, update_profile |
| 🟢 | form fill + submit via confirm dialog | invoiceId returned, toast shown, dialog closed | {"invoiceId":"INV-2388"} |
| 🟢 | combobox select by label | Grace Hopper selected | {"selected":{"value":"cust_2","label":"Grace Hopper","description":"grace.hopper@example.com"}} |
| 🟢 | read_notifications after actions | includes 'Invoice created' | ["Invoice created","Marked paid 3 orders"] |
| 🟢 | phase 05 gate: agent drives the docs site | navigate + search_docs return results | ["faq","mechanisms"] |

## Playwright specs

- 🟢 entry point is document.modelContext (not navigator, not window.agent)
- 🟢 IDL surface matches the spec draft
- 🟢 registerTool + AbortSignal lifecycle, duplicate names, toolchange
- 🟢 executeTool encoding: object input, string output, validation and truncation
- 🟢 limits and annotations: what Chrome enforces vs reflects
- 🟢 unregistering a tool preserves a pending invocation
- 🟢 phase 01 gate: 120 declared capabilities resolve to <= 12 tools in getTools()
- 🟢 phase 04 gate: an agent completes a three-step task on the demo through real WebMCP
- 🟢 demo supports search, real CSV export, and keyboard settings navigation
- 🟢 demo fits mobile viewport without page overflow
- 🟢 all documentation pages render and search indexes the actual examples
- 🟢 code can be copied and section links work on direct loads
- 🟢 mobile navigation and long reference content fit the viewport
