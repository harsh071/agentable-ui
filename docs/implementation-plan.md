# Agentable — Original implementation plan

> **Historical design document (4 September 2026).** This records the original proposal, assumptions, and milestones. It is not the current API or browser-support reference. Start with the [README](../README.md), [package guides](../packages/ui/README.md), and the [tested conformance report](../conformance/REPORT.md). Platform dates, benchmarks, package counts, and proposed APIs below describe the plan at the time.

> Research current to **4 Sep 2026**. Published version: https://claude.ai/code/artifact/fe9a5021-b9ac-4137-84b2-8ae740f62208

**Status of the platform we're targeting:** `document.modelContext` · Chrome 149+ origin trial · Edge 147 native · origin trial ends 16 Nov 2026 · API surface still moving · W3C WebML CG draft.

---

## 1. Ground truth: what the platform actually looks like today

WebMCP lets a page hand an AI agent a set of callable tools instead of making it guess at buttons. The shape that matters is the current spec IDL — note the entry point is on `document`, not `navigator`:

```webidl
partial interface Document {
  [SecureContext, SameObject] readonly attribute ModelContext modelContext;
};

[Exposed=Window, SecureContext]
interface ModelContext : EventTarget {
  Promise<undefined> registerTool(ModelContextTool tool, optional RegisterOptions options = {});
  Promise<sequence<RegisteredTool>> getTools(optional GetToolOptions options = {});
  Promise<DOMString> executeTool(RegisteredTool tool, optional object input = {}, optional ExecOptions o = {});

  attribute EventHandler ontoolchange;
};

dictionary ModelContextTool {
  required DOMString name;          // <= 30 chars (Chrome guidance)
  USVString title;
  required DOMString description;   // <= 500 chars
  object inputSchema;               // JSON Schema
  required ToolExecuteCallback execute;
  ToolAnnotations annotations;      // readOnly / consequential / untrustedContent hints
};
```

### Three facts that shape the design

- **The entry point has moved twice.** `window.agent` -> `navigator.modelContext` -> `document.modelContext` (July 2026). Chrome currently aliases the old name; nothing promises it survives the origin trial, which ends **16 Nov 2026**. Any code that names the global directly is code we will rewrite.
- **Chrome publishes character budgets, not tool-count budgets.** 30 chars for names, 500 for tool descriptions, 150 for parameter descriptions, 1.5K for a single tool's output. Nobody caps how many tools you register — which is exactly where a component library gets dangerous.
- **Deployment is close to zero.** Two browsers ship it; almost no production site uses it; ChatGPT's desktop browser added support in Aug 2026 and Gemini-in-Chrome is still catching up. Practical consequence: *the agent layer cannot be the reason someone installs this.* The components have to be worth using with the agent layer switched off.

> **Don't build another shadcn.** Progress already bolted WebMCP onto Kendo UI; React hook wrappers exist (`use-webmcp-tool` from Chrome, `@mcp-b/react-webmcp`, `usewebmcp`). All of them register tools. **None of them manage the tool budget.** That gap is the product.

---

## 2. The problem: a component library is a tool-count bomb

Auto-registration is the obvious feature and the obvious trap. A table registers query/sort/filter. A form registers fill and submit. A dialog registers open and close. On a real dashboard with 40 agent-enabled components, that is roughly 120 tool schemas pushed into the agent's context before it has read a single word of the page.

| Strategy | Resident tools | Approx. context |
| --- | --: | --: |
| Naive auto-registration | ~120 | ~24K tokens |
| Route-scoped only | ~35 | ~7K tokens |
| **Agentable tier-0 resident** | **<= 12** | **~2K tokens** |

Tool-selection accuracy degrades well before the context fills — the widely cited threshold is around 20 concurrent tools. Published progressive-disclosure results in the MCP-server world report an order-of-magnitude context reduction from loading schemas on demand rather than upfront. The same arithmetic applies here, and a component library is the layer with enough structural knowledge to do it automatically.

**So the thesis is inverted from the existing libraries:** the interesting engineering is not *registering* tools. It is deciding, continuously, which small subset of a large latent tool surface is currently worth the agent's attention.

---

## 3. Architecture: five packages, one descriptor

```
AUTHORING   @agentable-ui/ui        @agentable-ui/react       your own code
            styled components    useTool, ToolScope,    defineCapability()
            declaring caps       provider (SSR safe)
                          |
                          v   capability descriptors
CONTROL     Registry             Budgeter               Cache            Shaper
            dedupe, refcount,    caps residents,        TTL + tag        project,
            scope, tiers         evicts by priority     invalidation     paginate, truncate
                          |
                          v   normalized tools
TRANSPORT   webmcpAdapter        bridgeAdapter          inspectorAdapter
            document.model-      postMessage ->         devtools + test
            Context (+fallback)  extension / MCP-B      harness
                          |
                          v
CONSUMER    Browser agent (Gemini in Chrome, ChatGPT desktop, Copilot in Edge)
```

Everything below `@agentable-ui/core` is replaceable. Core knows nothing about React or about WebMCP.

### The single descriptor

One object describes a capability, and it feeds **both** the agent tool and — later — the generative-UI catalog entry. This is the piece that makes gen-UI a small addition rather than a second system:

```ts
export interface Capability<A = unknown, R = unknown> {
  id: string;                // "orders.table.query" — stable, dot-scoped
  tier?: 0 | 1 | 2;          // 0 resident · 1 unlockable · 2 dormant
  group?: string;            // unlocked together: "orders"
  priority?: number;         // eviction order inside a tier

  tool?: {
    name: string;            // validated <=30 chars at dev time
    description: string;     // validated <=500
    inputSchema?: JSONSchema;
    annotations?: { readOnlyHint?: boolean; consequentialHint?: boolean;
                    untrustedContentHint?: boolean };
    execute: (args: A, ctx: ExecuteContext) => R | Promise<R>;

    cache?: { ttl?: number; tags?: string[]; key?: (a: A) => string };
    invalidates?: string[];  // cache tags cleared after this runs
    output?: { maxChars?: number; project?: string[]; paginate?: boolean };
  };

  render?: {                 // same source of truth -> generative UI
    component: string;
    props: JSONSchema;
  };
}
```

The transport boundary is the whole hedge against a moving spec:

```ts
export interface AgentAdapter {
  readonly id: string;
  available(): boolean;
  register(tool: NormalizedTool): Promise<() => void>;   // returns unregister
  onToolChange?(cb: () => void): () => void;
}
```

When the origin trial ends or the entry point moves a third time, we change roughly forty lines in one file and ship a patch release. Nothing above the adapter mentions `document.modelContext`.

---

## 4. Mechanisms: six ways the surface stays small

These are the load-bearing features. Each is independently testable and independently useful.

| Mechanism | What it does | Where | Default |
| --- | --- | --- | --- |
| **Scope** | Only mounted components register. An `IntersectionObserver` demotes long-offscreen groups from tier 0 to tier 1 instead of unregistering, so a scroll-back is instant. | react / registry | on |
| **Tier gate** | Tier 0 is always exposed. Everything else sits behind two meta-tools: `list_capabilities` returns a one-line index; `open_capability(group)` promotes a group and fires `toolchange`. Full schemas are materialized only on promotion. | core/registry | on |
| **Fan-in** | Collapses N sibling tools into one parameterized tool with an enum. Twelve toolbar buttons become `run_action({ action })` — one schema instead of twelve. | core/registry | opt-in |
| **Cache** | Read-only tools memoize on canonical-serialized args with a TTL. Mutating tools declare `invalidates` tags; matching entries are dropped on success. Repeated agent probing costs nothing. | core/cache | on for readOnly |
| **Shape** | Output passes through field projection, cursor pagination, then a hard truncate at Chrome's 1.5K with an explicit `has_more` + `cursor`, so the agent knows to ask again rather than seeing a silently cut string. | core/shaper | on |
| **Budget** | A hard cap on resident tools (default 12). Exceeding it evicts the lowest-priority tier-0 entry to tier 1 and logs a dev warning naming both tools. Character limits are validated at registration, not discovered in production. | core/budgeter | 12 resident |

### Progressive disclosure, concretely

```ts
// Resident at all times — two tools, ~180 tokens total.
{
  name: "list_capabilities",
  description: "List capability groups available on this page. Call open_capability to load one.",
  annotations: { readOnlyHint: true },
  execute: () => registry.index()
  // -> "orders (6): query, filter, export…  ·  billing (4): …  ·  settings (9): …"
}

// The unlock. Promoting fires toolchange; the agent re-reads getTools().
{
  name: "open_capability",
  description: "Load the tools for one capability group.",
  inputSchema: { type: "object", properties: { group: { type: "string" } },
                 required: ["group"] },
  execute: ({ group }) => registry.promote(group)
}
```

**One honest gap.** The spec gives no signal for "an agent is present." There is no presence event to gate on. So the heuristic is: register tier 0 unconditionally (it is two tools and costs nothing), and defer all group materialization until the first `execute` arrives — the first tool call *is* the presence signal. Document this as a heuristic, and revisit if the CG adds a presence primitive.

---

## 5. Component API: one prop, or none at all

Agent behavior is a prop, never a wrapper. Omit it and the component is ordinary — and the agent code tree-shakes out.

```tsx
// A form derives its inputSchema from its own field metadata.
<Form
  agent={{ name: "create_invoice", group: "billing", confirm: true }}
  onSubmit={createInvoice}
>
  <Field name="customer" required describe="Customer's legal name" />
  <Field name="amountCents" type="integer" min={1} describe="Amount in cents" />
</Form>

// A table exposes one query tool, not one per column.
<DataTable
  agent={{ name: "query_orders", group: "orders",
           project: ["id", "customer", "total", "status"],  // output shaping
           cache: { ttl: 30_000, tags: ["orders"] } }}
  columns={cols} rows={rows}
/>

// Twelve actions, one schema.
<ActionBar agent={{ name: "run_order_action", fanIn: true }} actions={actions} />

// Anything hand-rolled uses the same registry.
useTool({
  name: "apply_coupon",
  description: "Apply a discount code to the current cart.",
  inputSchema: z.object({ code: z.string() }),   // zod -> JSON Schema at build
  annotations: { consequentialHint: true },
  invalidates: ["cart"],
  execute: ({ code }) => cart.applyCoupon(code),
});
```

### Safety defaults

- `consequentialHint: true` is inferred for anything that mutates, and such tools render a real confirmation in the page before resolving. The user watches the action happen — that visibility is WebMCP's core trust property, and we don't spend it.
- `exposedTo` defaults to same-origin. Cross-origin exposure is explicit, per-capability, and logged in devtools.
- Any tool returning user-generated or third-party content gets `untrustedContentHint` automatically — the table and comment primitives set it without being asked.

---

## 6. Generative UI: the catalog you already wrote

Deliberately last. Built on the descriptor, not beside it.

Because every capability may carry a `render` entry, the component catalog a generative-UI system needs is a projection of the registry we already maintain — same names, same JSON Schemas, same validation. No second registry to keep in sync.

The shipping pattern is the one that has settled across the ecosystem: a single `present` tool whose argument is a validated JSON tree of component names and props, rendered through an allowlist.

```tsx
<AgentSurface />   // renders whatever `present` was last called with

// registered automatically when a surface is mounted:
{
  name: "present",
  description: "Render a UI response using this app's components.",
  inputSchema: registry.catalogSchema(),   // allowlisted union, generated
  execute: (spec) => surface.render(validate(spec))
}
```

Two rules keep this safe and cheap: props are validated against the catalog schema before render, and the catalog schema itself is tier-gated like everything else, so a page with sixty renderable components still advertises a bounded union.

---

## 7. Engineering decisions worth pinning now

| Area | Decision | Why |
| --- | --- | --- |
| repo | pnpm workspaces + changesets, independent versioning | Core will version faster than UI while the spec moves. |
| build | TypeScript, tsdown, ESM-only, explicit `exports` map, `sideEffects: false` | The agent layer must vanish from bundles that don't use it. |
| core deps | zero | Core is the piece other people will want to reuse under a different UI kit. |
| schema | Standard Schema interface; zod and valibot both accepted, JSON Schema emitted | WebMCP wants JSON Schema; authors want types. Don't force one validator. |
| styling | Headless primitives + unstyled `data-*` hooks; a Tailwind preset ships separately | Keeps the agent value proposition independent of anyone's design system. |
| tests | **Playwright against real Chrome with `--enable-features`, gating every release** | See the note below. This is the one place to spend extra effort. |
| license | MIT | Nothing here benefits from restriction; adoption is the only scarce resource. |

### Mocked tests are actively dangerous here

There is a published post-mortem of a migration where eight WebMCP tools registered nothing in a real browser while a fully mocked suite stayed green — the mock implemented the old `navigator` surface. Our contract suite must run against a real Chrome build, assert against `getTools()`, and fail loudly when the entry point moves. Unit tests may mock; the release gate may not.

---

## 8. Sequence: twelve weeks, six gates

Each phase ships something usable. Nothing here needs the phase after it to be worth merging.

**00 — Conformance spike.** Before any library code: register a tool by hand in Chrome with `chrome://flags/#enable-webmcp-testing`, confirm the live IDL against the spec, and write the Playwright harness that asserts it. Record what's actually there versus what's documented.
*Gate: a red/green conformance report checked into the repo.*

**01 — `@agentable-ui/core`.** Registry with refcounting and dedupe, tier model, budgeter with eviction, cache with tag invalidation, output shaper, adapter interface, and the WebMCP adapter. Framework-free and fully testable headlessly.
*Gate: 120 declared capabilities resolve to <=12 resident tools, verified in a real browser.*

**02 — `@agentable-ui/react`.** `<AgentableProvider>`, `useTool`, `useCapability`, `<ToolScope>`. SSR-safe, StrictMode-safe, no double registration, stable identity across re-render.
*Gate: drop-in on an existing app with no component rewrite.*

**03 — `@agentable-ui/devtools`.** Moved ahead of the components deliberately. An in-page overlay: resident tools, budget usage, cache hit rate, schema-size ranking, and a tool console that invokes capabilities without needing an agent or a Chrome flag.
*Gate: a developer with no WebMCP-capable browser can build and verify agent behavior.*

**04 — `@agentable-ui/ui`, first ten.** Form + Field, DataTable, Combobox, ActionBar, Dialog, Tabs, Nav, Filters, Pagination, Toast. Each ships its capability declaration, its docs, and a real agent scenario test.
*Gate: a demo app where an agent completes a three-step task end to end.*

**05 — `@agentable-ui/genui` + docs.** `<AgentSurface>`, catalog schema generation, validated rendering. The docs site is built with the library and is itself the flagship demo — its own search, navigation, and examples are agent-callable.
*Gate: an agent can drive the docs site to answer a question about the docs site.*

---

## 9. Risks

**The spec moves again, or the origin trial lapses.** Likely, not hypothetical — two renames already. Mitigated by the adapter boundary and the real-browser conformance gate. If WebMCP stalls entirely, core plus the bridge adapter still delivers value to extension-based agents, and the components remain a normal library.

**Nobody is calling these tools yet.** Adoption is genuinely near zero. This is why phase 4 comes after devtools and why the agent prop is optional: the library has to be chosen for the components, with the agent layer as upside.

**Prompt injection through tool output.** Untrusted page content flowing into an agent is the known attack class. Automatic `untrustedContentHint`, confirm-gated mutations, and same-origin-by-default `exposedTo` are the baseline; a security review belongs at the phase-4 gate, not at launch.

**Our budget heuristics are guesses.** The 12-tool default and the tiering rules are informed estimates, not measurements. Phase 3's devtools exist partly to generate the data that replaces them.

### Four open calls

- **Headless base** — build primitives ourselves, or sit on Base UI / Radix? Faster and more accessible on day one, but adds a dependency the "zero-dep core" story has to explain.
- **Framework scope for v1** — React-only ships in twelve weeks. Core is framework-free by design, so Vue and Svelte adapters are cheap later, but only if we resist shipping them early.
- **Open source now or after phase 4** — public from commit one buys feedback while the spec is still moving; public after phase 4 buys a first impression that isn't a skeleton.
- **Name** — `agentable` is the repo, and the npm scope is the one thing that's painful to change later.

---

## Sources

- [W3C WebMCP spec — webmachinelearning/webmcp](https://github.com/webmachinelearning/webmcp)
- [Chrome for Developers — WebMCP](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome for Developers — WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [Chrome for Developers — Declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api)
- [GoogleChromeLabs/use-webmcp-tool](https://github.com/GoogleChromeLabs/use-webmcp-tool)
- [WebMCP-org/npm-packages](https://github.com/WebMCP-org/npm-packages)
- [The State of WebMCP, July 2026](https://www.spronta.com/blog/state-of-webmcp-july-2026/)
- [Telerik & Kendo UI meet WebMCP](https://www.telerik.com/blogs/telerik-and-kendo-meet-webmcp)
- [MCP progressive disclosure](https://www.solo.io/blog/mcp-progressive-disclosure)
