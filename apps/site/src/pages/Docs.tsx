import { useMemo, useState, type ReactNode } from "react";
import { useTool } from "@agentable-ui/react";

interface Doc {
  id: string;
  group: string;
  title: string;
  summary: string;
  body: ReactNode;
  /** Plain text for search. */
  text: string;
}

const DOCS: Doc[] = [
  {
    id: "intro",
    group: "Start",
    title: "Agentable",
    summary: "A component library that registers itself with the agent.",
    text: "WebMCP lets a page hand an AI agent callable tools instead of buttons. Agentable is a React component library where every component can declare its capability with one prop, plus a framework-free core that keeps the tool surface small. The interesting engineering is not registering tools, it is deciding continuously which small subset of a large latent tool surface is worth the agent's attention.",
    body: (
      <>
        <div className="hero">
          <h1>A component library that registers itself with the agent.</h1>
          <p className="lede">
            WebMCP lets a page hand an AI agent callable tools instead of making it guess at buttons. Agentable gives you React components that declare their tools with one prop, and a framework-free core that keeps the tool count small enough for agents to use well.
          </p>
        </div>
        <div className="grid">
          <div className="card">
            <h3>One prop</h3>
            <p className="muted">
              <code>agent=&#123;&#123; name: "query_orders" &#125;&#125;</code> on a table exposes one query tool. Omit it and the component is ordinary.
            </p>
          </div>
          <div className="card">
            <h3>Budgeted</h3>
            <p className="muted">120 declared capabilities resolve to twelve or fewer resident tools. Everything else is one <code>open_capability</code> call away.</p>
          </div>
          <div className="card">
            <h3>Real-browser tested</h3>
            <p className="muted">
              The conformance suite runs against real Chrome with <code>--enable-features=WebMCP</code> and fails loudly when the entry point moves.
            </p>
          </div>
        </div>
        <h2>Install</h2>
        <pre>{`pnpm add @agentable-ui/ui @agentable-ui/react @agentable-ui/core
pnpm add -D @agentable-ui/devtools`}</pre>
        <h2>Use</h2>
        <pre>{`import { AgentableProvider } from "@agentable-ui/react";
import { DataTable, Form, Field } from "@agentable-ui/ui";
import "@agentable-ui/ui/styles.css";

export function App() {
  return (
    <AgentableProvider>
      <DataTable
        columns={cols} rows={rows}
        agent={{ name: "query_orders", group: "orders", project: ["id", "customer", "total"] }}
      />
      <Form agent={{ name: "create_invoice", group: "billing" }} onSubmit={createInvoice}>
        <Field name="customer" required describe="Customer's legal name" />
        <Field name="amountCents" type="integer" min={1} describe="Amount in cents" />
      </Form>
    </AgentableProvider>
  );
}`}</pre>
        <p>
          Then open the <a href="#/demo">demo</a>, press <kbd>Alt</kbd>+<kbd>A</kbd>, and use the console tab to call tools without an agent.
        </p>
      </>
    ),
  },
  {
    id: "plain-english",
    group: "Start",
    title: "In plain English",
    summary: "What this is, why it helps, and what does and does not work today.",
    text: "Plain English explainer. AI agents today use websites like a person squinting at a screenshot: they guess which button to click. WebMCP lets a website hand the agent a menu of actions (tools) such as search orders or refund order, with exact inputs. Agentable is React components that come with that menu built in: add one agent prop. Too many tools confuse agents, so Agentable shows at most 12 at a time and keeps the rest one step away. Consequential actions ask the user first. Does it work: unit tests and a real-Chrome conformance suite pass; WebMCP itself is experimental and behind a Chrome flag; few agents call WebMCP tools yet; the accuracy benefit of the budget is based on published observations, not our own benchmark. For AI assistants: /llms.txt and /llms-full.txt.",
    body: (
      <>
        <h1>In plain English</h1>
        <p className="lede">No jargon. What this is, why anyone would want it, and an honest answer to "does it actually work?"</p>

        <h2>The problem</h2>
        <p>
          AI assistants are starting to use websites for people: "find last month's unpaid invoices", "refund order 1042". Today they mostly do this the way a person would over a bad video call. They look at the page, guess which button means what, click, and hope. It is slow, it breaks when the design changes, and it is easy to click the wrong thing.
        </p>

        <h2>The idea</h2>
        <p>
          A new browser feature called <b>WebMCP</b> lets a website hand the assistant a menu instead: a short list of things it can do, each with a clear name and the exact inputs it needs. "Search orders (by status, customer, date)." "Refund an order (order id, reason)." The assistant picks from the menu instead of guessing at pixels.
        </p>
        <p>
          <b>Agentable is a set of React components that come with that menu built in.</b> Put a table on your page, add one <code>agent</code> prop, and the assistant can search and sort it. Add a form, and the assistant can fill it in and submit it. Leave the prop off and the component is completely ordinary.
        </p>

        <h2>Why that is useful</h2>
        <div className="grid">
          <div className="card">
            <h3>For the people using your app</h3>
            <p className="muted">Their assistant does the task properly instead of fumbling. Anything with consequences, like a refund or a delete, pops up a confirmation first, and nothing runs until they say yes.</p>
          </div>
          <div className="card">
            <h3>For the assistant</h3>
            <p className="muted">It gets exact inputs and short, predictable answers, so it makes fewer mistakes and finishes faster.</p>
          </div>
          <div className="card">
            <h3>For you, the developer</h3>
            <p className="muted">You don't write and maintain a separate "AI version" of every feature. The components you already use describe themselves.</p>
          </div>
        </div>

        <h2>The part most people miss: too many tools</h2>
        <p>
          If every button, table and form on a busy screen added itself to the menu, the assistant would be handed a hundred options at once. Assistants get noticeably worse at choosing when the list gets long, and every option costs part of their limited memory before they have done anything.
        </p>
        <p>
          So Agentable keeps a <b>budget</b>: at most 12 tools on the menu at any moment (you can change the number). The rest stay one step away. The assistant can ask "what else can you do?" and open a group when it needs it. Parts of the page that are scrolled out of view step back automatically. Related buttons collapse into a single tool. Long answers are trimmed and split into pages.
        </p>
        <p>
          Measured on this site's own <a href="#/demo">demo</a>: 12 tools on the menu cost about 1,300 tokens of the assistant's memory, roughly 110 each. At that rate, a screen that exposed 120 tools would spend around 13,000 tokens before the assistant read a single word.
        </p>

        <h2>How it works, in four steps</h2>
        <ol>
          <li>You add <code>agent=&#123;&#123; name: "search_orders" &#125;&#125;</code> to a component.</li>
          <li>The component tells Agentable what it can do and what inputs it takes.</li>
          <li>Agentable decides what goes on the menu right now, within the budget, and hands that to the browser.</li>
          <li>When the assistant uses a tool, Agentable checks the inputs, asks the user if the action matters, runs it, and trims the answer to a sensible size.</li>
        </ol>

        <h2>Does it actually work?</h2>
        <p>Honest status as of September 2026, version 0.1.0:</p>
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>The engine (budget, caching, trimming, confirmations)</td>
              <td>Works. Covered by automated tests.</td>
            </tr>
            <tr>
              <td>Talking to a real browser</td>
              <td>Works. A test suite drives real Chrome with WebMCP switched on, with nothing faked. All 45 checks passed on Chrome 152. On Chrome 153 one check about the browser's own behaviour changed, and that test still needs updating.</td>
            </tr>
            <tr>
              <td>The components (table, form, dialog…) and the AI-built screens</td>
              <td>Work in the demo and playground, checked by hand in Chrome. Automated tests for them are still thin.</td>
            </tr>
            <tr>
              <td>WebMCP itself</td>
              <td>
                <b>Experimental.</b> It is a draft standard, Chrome only turns it on with a flag, and it has already changed shape once. Very few assistants call these tools yet. Agentable follows the platform; it can't make it arrive sooner.
              </td>
            </tr>
            <tr>
              <td>"Fewer tools means better results"</td>
              <td>Based on published observations about how assistants handle long tool lists. We have not run our own benchmark yet.</td>
            </tr>
          </tbody>
        </table>
        <p>
          You don't need an assistant or the Chrome flag to try it. Open the <a href="#/demo">demo</a>, press <kbd>Alt</kbd>+<kbd>A</kbd>, and call any tool from the console exactly as an assistant would.
        </p>

        <h2>When not to use it</h2>
        <ul>
          <li>Your app isn't React. The core engine is framework-free, but only React components exist today.</li>
          <li>You need this in production for most of your users today. Most browsers and assistants can't use WebMCP yet.</li>
          <li>You only need one or two tools. You can register those yourself without a library.</li>
        </ul>

        <h2>For AI assistants</h2>
        <p>
          These docs are rendered by JavaScript, so a tool that only fetches pages sees nothing. The same material is available as plain text: <a href="/llms.txt">/llms.txt</a> gives the short version, and <a href="/llms-full.txt">/llms-full.txt</a> adds the full API reference for every package.
        </p>
      </>
    ),
  },
  {
    id: "problem",
    group: "Start",
    title: "Why budget tools",
    summary: "A component library is a tool-count bomb unless something manages the surface.",
    text: "Auto-registration is the obvious feature and the obvious trap. A table registers query sort filter, a form registers submit, a dialog registers open close. A dashboard with 40 agent-enabled components pushes 120 tool schemas, roughly 24K tokens, into the agent's context. Tool-selection accuracy degrades around 20 concurrent tools. Agentable keeps at most 12 resident: naive ~120 tools ~24K tokens, route scoped ~35 tools ~7K tokens, agentable tier 0 resident <= 12 tools ~2K tokens.",
    body: (
      <>
        <h1>Why budget tools</h1>
        <p>
          Auto-registration is the obvious feature and the obvious trap. A table registers query, sort, and filter. A form registers submit. A dialog registers open and close. On a real dashboard with forty agent-enabled components that is roughly 120 tool schemas pushed into the agent's context before it has read a word of the page.
        </p>
        <table>
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Resident tools</th>
              <th>Approx. context</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Naive auto-registration</td>
              <td>~120</td>
              <td>~24K tokens</td>
            </tr>
            <tr>
              <td>Route-scoped only</td>
              <td>~35</td>
              <td>~7K tokens</td>
            </tr>
            <tr>
              <td>
                <b>Agentable tier-0 resident</b>
              </td>
              <td>
                <b>&le; 12</b>
              </td>
              <td>
                <b>~2K tokens</b>
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          Tool-selection accuracy degrades well before the context fills; the commonly cited threshold is around twenty concurrent tools. Progressive disclosure in the MCP-server world reports an order-of-magnitude context reduction from loading schemas on demand. A component library is the layer with enough structural knowledge to do that automatically.
        </p>
      </>
    ),
  },
  {
    id: "mechanisms",
    group: "Concepts",
    title: "Six mechanisms",
    summary: "Scope, tier gate, fan-in, cache, shape, budget.",
    text: "Scope: only mounted components register; ToolScope uses an IntersectionObserver to demote long-offscreen groups to tier 1. Tier gate: tier 0 always exposed; list_capabilities and open_capability unlock groups. Fan-in: N sibling tools collapse into one with an action enum. Cache: read-only tools memoize on canonical args with TTL and tag invalidation. Shape: output is projected, paginated with a cursor, then hard-truncated at 1500 characters with has_more. Budget: a hard cap on resident tools, default 12, evicts lowest priority to tier 1 with a warning naming both tools.",
    body: (
      <>
        <h1>Six mechanisms</h1>
        <table>
          <thead>
            <tr>
              <th>Mechanism</th>
              <th>What it does</th>
              <th>Default</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Scope</td>
              <td>
                Only mounted components register. <code>&lt;ToolScope&gt;</code> watches an IntersectionObserver and demotes groups that stay offscreen for five seconds to tier 1 instead of unregistering, so a scroll-back is instant.
              </td>
              <td>on</td>
            </tr>
            <tr>
              <td>Tier gate</td>
              <td>
                Tier 0 is always exposed. Everything else sits behind <code>list_capabilities</code> (a one-line index) and <code>open_capability</code>, which promotes a group and fires <code>toolchange</code>. Full schemas materialize only on promotion.
              </td>
              <td>on</td>
            </tr>
            <tr>
              <td>Fan-in</td>
              <td>
                Collapses N sibling tools into one parameterized tool with an <code>action</code> enum. <code>&lt;ActionBar&gt;</code> does this by default.
              </td>
              <td>opt-in</td>
            </tr>
            <tr>
              <td>Cache</td>
              <td>
                Read-only tools memoize on canonical args with a TTL. Mutating tools declare <code>invalidates</code> tags. Repeated agent probing costs nothing.
              </td>
              <td>on for readOnly</td>
            </tr>
            <tr>
              <td>Shape</td>
              <td>
                Output passes through field projection, cursor pagination, then a hard truncate at Chrome's 1.5K with an explicit <code>has_more</code> and <code>cursor</code>.
              </td>
              <td>on</td>
            </tr>
            <tr>
              <td>Budget</td>
              <td>A hard cap on resident tools. Exceeding it evicts the lowest-priority entry to tier 1 and logs a dev warning naming both tools.</td>
              <td>12 resident</td>
            </tr>
          </tbody>
        </table>
        <h2>Presence</h2>
        <p>
          The spec has no "an agent is present" signal. Tier 0 registers unconditionally (it is small), and the first tool call is treated as the presence signal: <code>snapshot.agentPresent</code> flips and <code>useAgentPresent()</code> re-renders.
        </p>
      </>
    ),
  },
  {
    id: "core",
    group: "Packages",
    title: "@agentable-ui/core",
    summary: "Zero-dependency registry, budgeter, cache, shaper, and adapters.",
    text: "createAgentable options: adapters, budget default 12, metaTools, cache defaultTtl, maxOutputChars 1500, confirm handler, onWarn, strictLimits. Capability descriptor: id, tier 0 1 2, group, priority, summary, fanIn, tool { name description inputSchema annotations execute cache invalidates output confirm exposedTo }, render { component props }. Adapters: webmcpAdapter (document.modelContext), memoryAdapter (tests, devtools), bridgeAdapter (postMessage for extensions). Standard Schema: zod and valibot accepted, JSON Schema emitted with zero dependencies via ~standard.jsonSchema.",
    body: (
      <>
        <h1>@agentable-ui/core</h1>
        <p>Framework-free. Knows nothing about React or about WebMCP beyond one adapter file.</p>
        <pre>{`import { createAgentable, webmcpAdapter } from "@agentable-ui/core";

const agentable = createAgentable({
  adapters: [webmcpAdapter()],
  budget: 12,                 // resident tools incl. the two meta tools
  maxOutputChars: 1500,       // Chrome guidance
  confirm: async (req) => window.confirm(req.message),
});

const handle = agentable.declare({
  id: "cart.apply_coupon",
  group: "cart",
  tool: {
    name: "apply_coupon",
    description: "Apply a discount code to the current cart.",
    inputSchema: z.object({ code: z.string() }),   // zod or valibot -> JSON Schema, zero deps
    annotations: { consequentialHint: true },
    invalidates: ["cart"],
    execute: ({ code }) => cart.applyCoupon(code),
  },
});
handle.release();`}</pre>
        <h2>The descriptor</h2>
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>id</code>
              </td>
              <td>Stable, dot-scoped. Declaring the same id twice refcounts instead of duplicating.</td>
            </tr>
            <tr>
              <td>
                <code>tier</code>
              </td>
              <td>0 resident, 1 unlockable through <code>open_capability</code>, 2 dormant (only app code can promote).</td>
            </tr>
            <tr>
              <td>
                <code>group</code> / <code>priority</code>
              </td>
              <td>Groups unlock together. Priority decides eviction order under the budget.</td>
            </tr>
            <tr>
              <td>
                <code>fanIn</code>
              </td>
              <td>Bucket name. Members collapse into one tool with an <code>action</code> enum.</td>
            </tr>
            <tr>
              <td>
                <code>tool.cache</code> / <code>tool.invalidates</code>
              </td>
              <td>TTL and tags. Read-only tools cache by default.</td>
            </tr>
            <tr>
              <td>
                <code>tool.output</code>
              </td>
              <td>
                <code>project</code>, <code>paginate</code>, <code>maxChars</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>tool.confirm</code>
              </td>
              <td>Defaults to the inferred <code>consequentialHint</code>. Anything not read-only is consequential unless you say otherwise.</td>
            </tr>
            <tr>
              <td>
                <code>render</code>
              </td>
              <td>The same descriptor feeds the generative-UI catalog.</td>
            </tr>
          </tbody>
        </table>
        <h2>Adapters</h2>
        <p>
          <code>webmcpAdapter()</code> resolves <code>document.modelContext</code>, then <code>navigator.modelContext</code>, then <code>window.agent</code>. Unregistration is an <code>AbortSignal</code>, matching Chrome. <code>memoryAdapter()</code> holds the normalized tool list for tests and devtools. <code>bridgeAdapter()</code> speaks a small postMessage protocol for extension-based agents.
        </p>
        <h2>What Chrome actually does</h2>
        <p>
          Verified on Chrome 152: input arrives as a parsed object, output must be a string, duplicate names throw, character limits are guidance only, thrown errors become a generic <code>UnknownError</code>. So core validates input itself, always returns a string, and returns structured <code>{`{"error": ...}`}</code> text instead of throwing.
        </p>
      </>
    ),
  },
  {
    id: "react",
    group: "Packages",
    title: "@agentable-ui/react",
    summary: "AgentableProvider, useTool, useCapability, ToolScope.",
    text: "AgentableProvider creates the registry with the WebMCP adapter and a built-in confirmation dialog. useTool registers a hand-rolled tool. useCapability declares a full descriptor. ToolScope groups capabilities and demotes them when offscreen. useAgentableSnapshot and useAgentPresent observe the registry. SSR safe, StrictMode safe, no double registration, stable identity across re-renders.",
    body: (
      <>
        <h1>@agentable-ui/react</h1>
        <pre>{`import { AgentableProvider, ToolScope, useTool } from "@agentable-ui/react";

<AgentableProvider budget={12} confirm={myHandler /* or omit for the built-in dialog */}>
  <ToolScope group="orders" describe="Order management">
    <OrdersTable />
  </ToolScope>
</AgentableProvider>

function Cart() {
  useTool({
    name: "apply_coupon",
    group: "cart",
    description: "Apply a discount code to the current cart.",
    inputSchema: z.object({ code: z.string() }),
    annotations: { consequentialHint: true },
    invalidates: ["cart"],
    execute: ({ code }) => cart.applyCoupon(code),
  });
}`}</pre>
        <ul>
          <li>Effects only, so nothing registers during SSR.</li>
          <li>Refcounted declarations survive StrictMode's double mount.</li>
          <li>A fresh <code>execute</code> closure every render costs nothing. The registry sees a change only when the static shape changes.</li>
          <li>
            Without a provider, <code>agent</code> props are inert and one dev warning is logged.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "ui",
    group: "Packages",
    title: "@agentable-ui/ui",
    summary: "Ten headless components with an optional agent prop.",
    text: "Form and Field derive the tool schema from field metadata. DataTable exposes one query tool plus an optional select tool. Combobox searches and selects with one tool. ActionBar fans in actions. Dialog opens and closes. Tabs switch panels and unmount inactive ones. Nav navigates. Filters set any subset. Pagination pages. Toaster lets the agent read notifications. Styles are data-* hooks; styles.css is a baseline and a Tailwind preset ships separately.",
    body: (
      <>
        <h1>@agentable-ui/ui</h1>
        <p>Headless primitives with <code>data-*</code> hooks. Ship the baseline stylesheet, the Tailwind preset, or nothing.</p>
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th>Tool it declares</th>
              <th>Safety default</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Form + Field</td>
              <td>One fill-and-submit tool; schema derived from fields.</td>
              <td>consequential, confirm</td>
            </tr>
            <tr>
              <td>DataTable</td>
              <td>One query tool (search, sort, filter) plus an optional select tool.</td>
              <td>readOnly, untrustedContent, cached, paginated</td>
            </tr>
            <tr>
              <td>Combobox</td>
              <td>One tool that lists matches or selects by value/label.</td>
              <td>no confirm</td>
            </tr>
            <tr>
              <td>ActionBar</td>
              <td>N actions fan into one tool with an <code>action</code> enum.</td>
              <td>destructive actions confirm</td>
            </tr>
            <tr>
              <td>Dialog</td>
              <td>Open/close. Tools inside exist only while open.</td>
              <td>no confirm</td>
            </tr>
            <tr>
              <td>Tabs</td>
              <td>Switch tab. Inactive panels unmount.</td>
              <td>no confirm</td>
            </tr>
            <tr>
              <td>Nav</td>
              <td>Navigate by href or label.</td>
              <td>no confirm</td>
            </tr>
            <tr>
              <td>Filters</td>
              <td>Set any subset of filters, or reset.</td>
              <td>no confirm</td>
            </tr>
            <tr>
              <td>Pagination</td>
              <td>Go to page N, next, previous, first, last.</td>
              <td>no confirm</td>
            </tr>
            <tr>
              <td>Toaster</td>
              <td>Read recent notifications.</td>
              <td>readOnly, untrustedContent</td>
            </tr>
          </tbody>
        </table>
        <h2>The agent prop</h2>
        <pre>{`agent={{
  name: "query_orders",          // tool name, <= 30 chars
  group: "orders",               // unlocks together
  tier: 0, priority: 5,
  description: "...",            // override the generated one
  confirm: true | "message",     // override the component default
  cache: { ttl: 30_000, tags: ["orders"] },
  invalidates: ["orders"],
  project: ["id", "customer"],   // output shaping
  maxChars: 1500,
  exposedTo: ["https://partner.example"],  // default same-origin
}}`}</pre>
      </>
    ),
  },
  {
    id: "devtools",
    group: "Packages",
    title: "@agentable-ui/devtools",
    summary: "In-page overlay: resident tools, budget, cache, schema sizes, tool console.",
    text: "mountDevtools(agentable) or <AgentableDevtools /> renders an overlay: overview with resident tools ranked by schema size, capabilities table with tiers and eviction reasons, a console that invokes any resident tool without an agent or a Chrome flag, and warnings. Toggle with Alt+A.",
    body: (
      <>
        <h1>@agentable-ui/devtools</h1>
        <pre>{`import { AgentableDevtools } from "@agentable-ui/devtools/react";
// or, framework-free:
import { mountDevtools } from "@agentable-ui/devtools";
mountDevtools(agentable, { position: "bottom-right", shortcut: "alt+a" });`}</pre>
        <ul>
          <li>Overview: budget usage, estimated tokens, cache hit rate, resident tools ranked by schema size, group open/close.</li>
          <li>Capabilities: every declaration with declared vs effective tier and why (evicted, hidden, tier).</li>
          <li>Console: invoke any resident tool exactly as a browser agent would. No agent, no flag.</li>
          <li>Warnings: character-limit and budget warnings, de-duplicated.</li>
        </ul>
        <p>Devtools ship before the components on purpose: a developer without a WebMCP-capable browser can still build and verify agent behavior.</p>
      </>
    ),
  },
  {
    id: "genui",
    group: "Packages",
    title: "@agentable-ui/genui",
    summary: "AgentSurface and the present tool.",
    text: "AgentSurface registers one present tool whose argument is a validated JSON tree of component names and props, rendered through an allowlist. The catalog is a projection of the registry: each component is declared as a capability with a render descriptor. Props are validated against the catalog schema before render. The catalog is tier-gated like everything else. uiCatalog from @agentable-ui/ui ships Text Card Stat StatGroup Callout KeyValue SimpleTable List Stack Progress.",
    body: (
      <>
        <h1>@agentable-ui/genui</h1>
        <pre>{`import { AgentSurface } from "@agentable-ui/genui";
import { uiCatalog } from "@agentable-ui/ui";

<AgentSurface components={uiCatalog} />

// registered while mounted:
// present({ root: { component: "Card", props: { title: "..." }, children: [...] } })`}</pre>
        <p>
          Two rules keep it safe and cheap: specs are validated against each component's prop schema before render (unknown props dropped, unknown components rejected, depth and node caps), and the catalog is tier-gated, so a page with sixty renderable components still advertises a bounded union.
        </p>
        <p>
          Try it in the <a href="#/playground">playground</a>.
        </p>
      </>
    ),
  },
  {
    id: "conformance",
    group: "Engineering",
    title: "Conformance",
    summary: "Real Chrome, real getTools(), every release.",
    text: "Mocked tests are dangerous here: a published post-mortem describes eight WebMCP tools registering nothing in a real browser while a mocked suite stayed green. The conformance suite launches installed Chrome with --enable-features=WebMCP, checks the entry point and IDL, then loads @agentable-ui/core and asserts that 120 capabilities resolve to at most 12 tools in document.modelContext.getTools(). Run pnpm test:conformance; the red/green report is conformance/REPORT.md.",
    body: (
      <>
        <h1>Conformance</h1>
        <p>
          Mocked tests are actively dangerous here. There is a published post-mortem of a migration where eight WebMCP tools registered nothing in a real browser while a fully mocked suite stayed green. Our gate runs against real Chrome, asserts against <code>getTools()</code>, and fails loudly when the entry point moves.
        </p>
        <pre>{`pnpm test:conformance     # builds, launches Chrome with --enable-features=WebMCP
pnpm conformance:report   # writes conformance/REPORT.md`}</pre>
        <p>
          The report records what is actually there versus what is documented: entry point, IDL, whether limits are enforced, how execute encodes input and output, and the library gate (120 capabilities to at most 12 resident tools).
        </p>
      </>
    ),
  },
  {
    id: "decisions",
    group: "Engineering",
    title: "Decisions",
    summary: "The calls we made and why.",
    text: "Headless base: built in-house, no Radix or Base UI, so the zero-dependency story holds and the agent value is independent of any design system. Framework scope: React only for v1, core is framework-free so Vue and Svelte adapters are cheap later. Open source from commit one, MIT. Name: @agentable-ui scope. Repo: pnpm workspaces, changesets, independent versioning, tsdown, ESM only, sideEffects false. Schema: Standard Schema in, JSON Schema out.",
    body: (
      <>
        <h1>Decisions</h1>
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th>Decision</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Headless base</td>
              <td>In-house primitives</td>
              <td>Zero runtime dependencies beyond React; the agent value is independent of any design system.</td>
            </tr>
            <tr>
              <td>Framework scope</td>
              <td>React only for v1</td>
              <td>Core is framework-free by design, so other adapters are cheap later.</td>
            </tr>
            <tr>
              <td>Open source</td>
              <td>Public from commit one, MIT</td>
              <td>Feedback while the spec is moving is worth more than a polished first impression.</td>
            </tr>
            <tr>
              <td>Name</td>
              <td>
                <code>@agentable-ui/*</code>
              </td>
              <td>The scope is the one thing that is painful to change later.</td>
            </tr>
            <tr>
              <td>Build</td>
              <td>pnpm workspaces, changesets, tsdown, ESM only, <code>sideEffects: false</code></td>
              <td>Core will version faster than UI while the spec moves; the agent layer must vanish from bundles that do not use it.</td>
            </tr>
            <tr>
              <td>Schema</td>
              <td>Standard Schema in, JSON Schema out</td>
              <td>WebMCP wants JSON Schema; authors want types. zod 4 and valibot 1 emit JSON Schema with no extra dependency.</td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
];

export function DocsPage({ route, navigate }: { route: string; navigate: (to: string) => void }) {
  const id = route.startsWith("/docs/") ? route.slice(6) : "intro";
  const doc = DOCS.find((d) => d.id === id) ?? DOCS[0]!;
  const [query, setQuery] = useState("");

  const search = useMemo(() => (q: string) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return DOCS.map((d) => {
      const hay = `${d.title} ${d.summary} ${d.text}`.toLowerCase();
      const idx = hay.indexOf(needle);
      return idx < 0 ? null : { id: d.id, title: d.title, snippet: hay.slice(Math.max(0, idx - 60), idx + 100).replace(/\s+/g, " ") };
    }).filter((x): x is { id: string; title: string; snippet: string } => !!x);
  }, []);

  useTool({
    name: "search_docs",
    group: "docs",
    priority: 9,
    description: "Search the Agentable documentation. Returns page ids and snippets; open one with open_doc.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    annotations: { readOnlyHint: true },
    execute: ({ query }: { query: string }) => search(query),
  });

  useTool({
    name: "open_doc",
    group: "docs",
    priority: 9,
    description: `Open a documentation page by id. Pages: ${DOCS.map((d) => d.id).join(", ")}.`,
    inputSchema: { type: "object", properties: { id: { type: "string", enum: DOCS.map((d) => d.id) } }, required: ["id"] },
    annotations: { readOnlyHint: false, consequentialHint: false },
    confirm: false,
    execute: ({ id }: { id: string }) => {
      const target = DOCS.find((d) => d.id === id);
      if (!target) throw new Error(`No doc "${id}".`);
      navigate(`#/docs/${id}`);
      return { opened: id, title: target.title, summary: target.summary };
    },
  });

  useTool({
    name: "read_doc",
    group: "docs",
    description: "Read the plain-text content of the current documentation page.",
    annotations: { readOnlyHint: true },
    execute: () => ({ id: doc.id, title: doc.title, text: doc.text }),
  });

  const results = search(query);
  const groups = [...new Set(DOCS.map((d) => d.group))];

  return (
    <div className="docs">
      <aside>
        <input type="search" placeholder="Search docs..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search docs" data-agentable-input="" />
        {query ? (
          <ul className="search-results">
            {results.length ? (
              results.map((r) => (
                <li key={r.id}>
                  <a href={`#/docs/${r.id}`} onClick={() => setQuery("")}>
                    {r.title}
                  </a>
                  <div className="muted" style={{ fontSize: 12 }}>
                    ...{r.snippet}...
                  </div>
                </li>
              ))
            ) : (
              <li className="muted">No matches</li>
            )}
          </ul>
        ) : null}
        {groups.map((g) => (
          <div key={g}>
            <div className="group">{g}</div>
            <ul>
              {DOCS.filter((d) => d.group === g).map((d) => (
                <li key={d.id}>
                  <a href={`#/docs/${d.id}`} aria-current={d.id === doc.id ? "page" : undefined}>
                    {d.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </aside>
      <article>{doc.body}</article>
    </div>
  );
}
