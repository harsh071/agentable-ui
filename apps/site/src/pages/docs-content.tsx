import type { ReactNode } from "react";

export interface Doc {
  id: string;
  group: string;
  title: string;
  summary: string;
  body: ReactNode;
}

export const DOCS: Doc[] = [
  {
    id: "intro",
    group: "Start here",
    title: "Overview",
    summary: "One UI library that both people and AI agents can use.",
    body: <>
      <h2>Build for people and agents</h2>
      <p>Agentable is a React component library with an optional agent layer. People use the table, form, or dialog on the page. Agents call tools declared by those same components.</p>
      <div className="doc-paths">
        <a href="#/docs/quickstart"><span>01 / BUILD</span><strong>Make your first tool</strong><p>Install the library and give a table an agent prop.</p><b>Start the quick start →</b></a>
        <a href="#/docs/genui"><span>02 / GENERATE</span><strong>Render model-generated UI</strong><p>Turn a streamed program into your own components.</p><b>Explore generative UI →</b></a>
      </div>
      <h2>Choose a package</h2>
      <table><thead><tr><th>You want to…</th><th>Use</th></tr></thead><tbody>
        <tr><td>Build tables, forms, and other controls</td><td><a href="#/docs/ui">@agentable-ui/ui</a></td></tr>
        <tr><td>Add tools to an existing React app</td><td><a href="#/docs/react">@agentable-ui/react</a></td></tr>
        <tr><td>Use the registry without React</td><td><a href="#/docs/core">@agentable-ui/core</a></td></tr>
        <tr><td>Inspect and call tools locally</td><td><a href="#/docs/devtools">@agentable-ui/devtools</a></td></tr>
        <tr><td>Parse programs written by a model</td><td><a href="#/docs/lang">@agentable-ui/lang</a></td></tr>
        <tr><td>Render programs or expose a present tool</td><td><a href="#/docs/genui">@agentable-ui/genui</a></td></tr>
      </tbody></table>
      <h2>What to expect</h2>
      <p>The default budget keeps at most twelve tools resident, including the discovery tools. Other capabilities can be loaded on demand. React provides a confirmation dialog for consequential agent calls.</p>
      <div className="doc-note"><strong>Start without a browser flag</strong><p>The components and devtools work without WebMCP. A browser agent needs a compatible WebMCP implementation. See <a href="#/docs/see-it-work">how to test it</a>.</p></div>
    </>,
  },
  {
    id: "quickstart",
    group: "Start here",
    title: "Quick start",
    summary: "Copy a working table, call its tool, and add your own.",
    body: (<>
      <p>Build a searchable table, expose it as a tool, and call it from devtools. This example runs in an existing React 18.2+ app; no model API key is needed.</p>
      <h2>1. Install the packages</h2>
      <pre>{`npm install @agentable-ui/ui @agentable-ui/react @agentable-ui/core
npm install -D @agentable-ui/devtools`}</pre>
      <p>Use your project's package manager. If you use a framework with server components, put this example in a client component.</p>
      <h2>2. Add a working table</h2>
      <p>Copy this into <code>App.tsx</code>. The provider owns the registry; the table declares a tool called <code>query_orders</code>.</p>
      <pre>{`import { AgentableProvider } from "@agentable-ui/react";
import { DataTable } from "@agentable-ui/ui";
import { AgentableDevtools } from "@agentable-ui/devtools/react";
import "@agentable-ui/ui/styles.css";

const orders = [
  { id: "ORD-1001", customer: "Ada Lovelace", total: 129 },
  { id: "ORD-1002", customer: "Grace Hopper", total: 249 },
];
const columns = [
  { key: "id", header: "Order" },
  { key: "customer", header: "Customer" },
  { key: "total", header: "Total" },
];

export default function App() {
  return (
    <AgentableProvider budget={12}>
      <DataTable
        rows={orders}
        columns={columns}
        noun="orders"
        agent={{ name: "query_orders", cache: false }}
      />
      <AgentableDevtools />
    </AgentableProvider>
  );
}`}</pre>
      <div className="doc-note"><strong>Why cache: false?</strong><p>This tool updates the table as well as returning rows. Disabling caching makes repeated calls run that update again. Enable caching for pure data reads, with tags to invalidate after changes.</p></div>
      <h2>3. Call your tool</h2>
      <ol><li>Run your app and open the <b>Agent</b> button, or press <kbd>Alt</kbd>+<kbd>A</kbd>.</li><li>Choose <b>Console</b>, then select <code>query_orders</code>.</li><li>Send the following input. The visible table should show only Ada's order.</li></ol>
      <pre>{`{"query": "Ada"}`}</pre>
      <p>To reset the table, call the same tool with <code>{`{}`}</code>. Devtools invokes the registry directly, so this works without a WebMCP browser.</p>
      <h2>4. Add your own tool</h2>
      <p>Use <code>useTool</code> inside any component under the provider. This example reads data, so it does not ask for confirmation.</p>
      <pre>{`import { useTool } from "@agentable-ui/react";

function OrderSummary() {
  useTool({
    name: "count_orders",
    description: "Return the number of orders.",
    annotations: { readOnlyHint: true },
    cache: false,
    execute: () => ({ count: orders.length }),
  });
  return <p>{orders.length} orders</p>;
}
// Render <OrderSummary /> inside <AgentableProvider>.`}</pre>
      <h2>Where to go next</h2>
      <ul><li><a href="#/docs/recipes">Recipes</a> for forms, actions, and customer pickers.</li><li><a href="#/docs/styling">Styling</a> for theme tokens and control variants.</li><li><a href="#/docs/see-it-work">Test with WebMCP</a> when you are ready for a browser agent.</li></ul>
    </>),
  },
  {
    id: "see-it-work",
    group: "Start here",
    title: "See it working",
    summary: "Three ways to check your tools: devtools, the header counter, real Chrome.",
    body: (
      <>
        <h1>See it working</h1>
        <p className="lede">Three ways, from easiest to most real.</p>

        <h2>1. The devtools panel (easiest)</h2>
        <p>
          Press <kbd>Alt</kbd>+<kbd>A</kbd> on any page, including this one. You'll see every tool that's live, how much of the assistant's memory they use, and a <b>Console</b> tab to call them by hand. No flag, no assistant needed.
        </p>

        <h2>2. The counter in the header</h2>
        <p>The top-right of this site shows:</p>
        <ul>
          <li>
            <b>6/12 tools</b>: how many tools are live right now, out of the maximum of 12.
          </li>
          <li>
            <b>~1000 tokens</b>: roughly how much of the assistant's memory those tools cost.
          </li>
          <li>
            <b>WebMCP on / not enabled</b>: whether your browser has the experimental WebMCP feature switched on. <b>"Not enabled" is normal</b> and nothing is broken. It only means a real assistant can't reach the tools from this browser yet.
          </li>
        </ul>
        <p>
          Move between Docs, Demo and Playground and watch the count change: each page registers only its own tools.
        </p>

        <h2>3. Real Chrome with WebMCP</h2>
        <ol>
          <li>Quit Chrome completely.</li>
          <li>
            Start it with the flag:
            <pre>{`# macOS
open -a "Google Chrome" --args --enable-features=WebMCP

# Windows
chrome.exe --enable-features=WebMCP

# Linux
google-chrome --enable-features=WebMCP`}</pre>
          </li>
          <li>
            Open your app. The pill should say <b>WebMCP on</b>.
          </li>
          <li>Any WebMCP-aware agent or extension can now list and call your tools.</li>
        </ol>
      </>
    ),
  },
  {
    id: "recipes",
    group: "Start here",
    title: "Recipes",
    summary: "Practical patterns for forms, actions, pickers, and tabs.",
    body: (
      <>
        <h1>Recipes</h1>
        <p className="lede">Adapt these snippets to your app, supplying imports, state, and application callbacks. Render controls inside your <code>&lt;AgentableProvider&gt;</code>.</p>

        <h2>Let the assistant fill in a form</h2>
        <p>Import the controls from <code>@agentable-ui/ui</code>. The form's fields become the tool's inputs. <code>describe</code> is the hint the assistant reads.</p>
        <pre>{`<Form agent={{ name: "create_invoice" }} onSubmit={(values) => api.createInvoice(values)}>
  <Field name="customer" label="Customer" required describe="Customer's legal name" />
  <Field name="amountCents" label="Amount (cents)" type="integer" min={1} describe="Amount in cents" />
  <Field name="sendNow" label="Send immediately" type="boolean" />
</Form>`}</pre>
        <p className="muted">Submitting asks the user first. Whatever you return from onSubmit goes back to the assistant.</p>

        <h2>Let it press buttons</h2>
        <p>A row of actions shares one tool, using one slot in the budget. The action id chooses which callback runs.</p>
        <pre>{`<ActionBar
  agent={{ name: "order_actions" }}
  actions={[
    { id: "ship", label: "Ship", onAction: ship },
    { id: "refund", label: "Refund", destructive: true, onAction: refund }, // asks first
  ]}
/>`}</pre>

        <h2>Let it pick from a list</h2>
        <pre>{`<Combobox
  label="Customer"
  options={[{ value: "c1", label: "Ada Lovelace" }]}
  value={customer}
  onChange={setCustomer}
  agent={{ name: "choose_customer" }}
/>`}</pre>

        <h2>Let it switch tabs</h2>
        <pre>{`<Tabs
  agent={{ name: "settings_tab" }}
  tabs={[
    { value: "profile", label: "Profile", content: <Profile /> },
    { value: "billing", label: "Billing", content: <Billing /> },
  ]}
/>`}</pre>
        <p className="muted">Only the open tab exists, so only its tools are live.</p>

        <h2>Control the "Allow?" prompt</h2>
        <pre>{`agent={{ name: "archive_order", confirm: "Archive this order?" }} // custom message
agent={{ name: "toggle_theme", confirm: false }}                  // never ask`}</pre>

        <h2>Hide data from the assistant</h2>
        <pre>{`{ key: "email", header: "Email", agentHidden: true } // column never sent
agent={{ name: "search_orders", project: ["id", "status"] }}  // only send these fields`}</pre>

        <h2>Load rarely-used tools only when needed</h2>
        <p>
          Put them in a group at <code>tier: 1</code>. The assistant sees a one-line summary and opens the group when it needs it.
        </p>
        <pre>{`agent={{ name: "export_report", group: "reports", tier: 1 }}`}</pre>

        <h2>Let the assistant build UI</h2>
        <p>
          <code>&lt;AgentSurface&gt;</code> gives the assistant a <code>present</code> tool to draw cards, stats and tables from your components. Try it in the <a href="#/playground">playground</a>, and see <a href="#/docs/genui">@agentable-ui/genui</a>.
        </p>
      </>
    ),
  },
  {
    id: "styling", group: "Start here", title: "Styling & themes",
    summary: "Start with the default theme, then make the components fit your app.",
    body: <>
      <h2>Import the stylesheet once</h2>
      <pre>{`import "@agentable-ui/ui/styles.css";`}</pre>
      <p>The stylesheet targets data attributes. You can override individual rules, use the Tailwind preset, or supply your own stylesheet.</p>
      <h2>Set your theme tokens</h2>
      <pre>{`:root {
  --ag-accent: #2563eb;
  --ag-accent-fg: #ffffff;
  --ag-radius: 10px;
  --ag-font: "Inter", system-ui, sans-serif;
}

/* Or scope tokens to one region of your app. */
.billing-panel {
  --ag-accent: #7c3aed;
}`}</pre>
      <table><thead><tr><th>Token</th><th>Controls</th></tr></thead><tbody>
        <tr><td>--ag-bg / --ag-panel</td><td>Surface backgrounds</td></tr>
        <tr><td>--ag-fg / --ag-muted</td><td>Main and secondary text</td></tr>
        <tr><td>--ag-line</td><td>Borders and dividers</td></tr>
        <tr><td>--ag-accent / --ag-accent-fg</td><td>Primary controls and their text</td></tr>
        <tr><td>--ag-success / --ag-warning / --ag-danger</td><td>Status colors</td></tr>
      </tbody></table>
      <h2>Light and dark mode</h2>
      <p>The default theme follows the system. Set <code>data-theme="light"</code> or <code>data-theme="dark"</code> on the root html element to override it.</p>
      <pre>{`document.documentElement.dataset.theme = "dark";`}</pre>
      <h2>Button variants and loading</h2>
      <pre>{`import { Button } from "@agentable-ui/ui";

<Button variant="primary" loading={saving} onClick={save}>
  Save changes
</Button>
<Button variant="ghost" size="sm" onClick={close}>Close</Button>`}</pre>
      <p>Variants: <code>default</code>, <code>primary</code>, <code>danger</code>, <code>ghost</code>. Sizes: <code>sm</code>, <code>md</code>, <code>lg</code>. Loading disables interaction and exposes <code>aria-busy</code>. Native button props and refs are supported. These additions are in the working branch; check your installed release.</p>
      <p><code>Button</code> is a presentational control; it does not accept an agent prop. Use <code>ActionBar</code> for callable actions. The generated UI catalog uses Button's <code>label</code> and <code>onPress</code> props.</p>
      <h2>Style a specific component</h2>
      <pre>{`.billing-panel [data-agentable-button="primary"] {
  border-radius: 999px;
}
[data-agentable-row][data-selected] {
  background: color-mix(in srgb, var(--ag-accent) 10%, transparent);
}`}</pre>
      <p>Keep visible keyboard focus and sufficient color contrast when overriding the baseline. For Tailwind, import <code>agentablePreset</code> from <code>@agentable-ui/ui/tailwind</code>; it provides matching color tokens and state variants.</p>
    </>,
  },
  {
    id: "faq",
    group: "Start here",
    title: "FAQ",
    summary: "WebMCP off, missing tools, budget warnings, words explained.",
    body: (
      <>
        <h1>FAQ &amp; troubleshooting</h1>

        <h2>The header says "WebMCP not enabled". Is it broken?</h2>
        <p>
          No. Your browser just doesn't have the experimental WebMCP feature switched on. Everything else works, and you can call tools from the devtools console. To switch it on, see <a href="#/docs/see-it-work">See it working</a>.
        </p>

        <h2>My tool doesn't show up</h2>
        <ol>
          <li>
            Is the component inside <code>&lt;AgentableProvider&gt;</code>? Outside it, <code>agent</code> props do nothing (you'll see one console warning).
          </li>
          <li>Is the component mounted? Inactive tab panels and closed dialog contents unmount. Scrolling offscreen does not unmount a component; ToolScope can demote its tools instead.</li>
          <li>
            Open devtools (<kbd>Alt</kbd>+<kbd>A</kbd>) → <b>Capabilities</b>. It shows every tool and, if it isn't live, why: tier 1, evicted by the budget, or scrolled offscreen.
          </li>
        </ol>

        <h2>Console says "Budget (12) exceeded"</h2>
        <p>More tools want to be live than the limit allows, so the least important one was moved one step away. The assistant can still reach it. To choose what stays:</p>
        <ul>
          <li>
            Give important tools a higher <code>priority</code>.
          </li>
          <li>
            Move rarely-used ones to <code>tier: 1</code>.
          </li>
          <li>
            Combine buttons with <code>&lt;ActionBar&gt;</code>.
          </li>
          <li>
            Or raise the limit: <code>&lt;AgentableProvider budget=&#123;20&#125;&gt;</code>.
          </li>
        </ul>

        <h2>A tool call hangs in my tests</h2>
        <p>
          Consequential tools wait for the user to click "Allow". For tools that only read data, use <code>annotations: &#123; readOnlyHint: true &#125;</code>, For mutation tests, pass <code>confirm=&#123;async () =&gt; true&#125;</code> to the provider.
        </p>

        <h2>Do I need Next.js / a specific framework?</h2>
        <p>
          Any React 18+ app works. The engine in <code>@agentable-ui/core</code> has no framework at all, but only React components exist so far.
        </p>

        <h2>Words used in these docs</h2>
        <table>
          <tbody>
            <tr>
              <td>
                <b>Agent / assistant</b>
              </td>
              <td>An AI that uses a website on someone's behalf.</td>
            </tr>
            <tr>
              <td>
                <b>Tool</b>
              </td>
              <td>One thing the assistant can do on your page, with a name and exact inputs. Like a function it can call.</td>
            </tr>
            <tr>
              <td>
                <b>WebMCP</b>
              </td>
              <td>The new browser feature that lets a page hand tools to an assistant.</td>
            </tr>
            <tr>
              <td>
                <b>Budget</b>
              </td>
              <td>The maximum number of live tools at once. 12 by default.</td>
            </tr>
            <tr>
              <td>
                <b>Resident</b>
              </td>
              <td>A tool that's live right now.</td>
            </tr>
            <tr>
              <td>
                <b>Tier</b>
              </td>
              <td>0 = eligible to stay live within the budget. 1 = loaded on request. 2 = only app code can promote it.</td>
            </tr>
            <tr>
              <td>
                <b>Group</b>
              </td>
              <td>Tools that open and close together, like "billing".</td>
            </tr>
            <tr>
              <td>
                <b>Fan-in</b>
              </td>
              <td>Many buttons combined into one tool with an "action" choice.</td>
            </tr>
            <tr>
              <td>
                <b>Consequential</b>
              </td>
              <td>A tool marked as consequential. Agent calls ask for confirmation unless you explicitly opt out.</td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "plain-english",
    group: "Start here",
    title: "How it works",
    summary: "What this is, why it helps, and what does and does not work today.",
    body: (<>
      <h2>One component, two ways to use it</h2>
      <p>A person searches a table by typing. An agent searches it by calling <code>query_orders</code> with structured input. Both paths use the same component and update the same page.</p>
      <pre>{`<DataTable
  rows={orders}
  columns={columns}
  agent={{ name: "query_orders", cache: false }}
/>`}</pre>
      <p>Leave off <code>agent</code> to use the table as an ordinary React component. Add <code>useTool</code> for actions outside the component library.</p>
      <h2>What happens during a call</h2>
      <ol><li>The component declares its name, input schema, and callback to the registry.</li><li>The registry selects the tools that fit within the current budget.</li><li>The browser exposes those tools to a compatible agent.</li><li>The registry validates a call, checks confirmation, executes the callback, and shapes the result.</li></ol>
      <p>React's provider supplies a confirmation dialog. Forms ask before agent submission; ActionBar asks for destructive actions. Non-destructive interface changes, such as switching a tab, run without a prompt.</p>
      <h2>Why only twelve tools?</h2>
      <p>Twelve is the default budget, not a browser limit. It keeps the advertised list bounded. Related actions can share a tool; other groups can be opened when needed. Token cost depends on your schemas and descriptions, and devtools shows an estimate.</p>
      <p>The project tests the budget and discovery behavior. It has not benchmarked whether this default improves model accuracy for your application.</p>
      <h2>Generating UI uses the same components</h2>
      <p>A model can also write an Agentable Lang program. <code>Renderer</code> draws it using an allowed component catalog. Your application handles model calls; the library parses, validates, and renders the response.</p>
      <h2>What works today</h2>
      <table><thead><tr><th>Area</th><th>What is checked</th></tr></thead><tbody>
        <tr><td>Registry and React</td><td>Unit tests cover registration, budgets, schemas, caching, and lifecycle behavior.</td></tr>
        <tr><td>Components and demo</td><td>Regression tests cover selection, keyboard tabs, filters, and Button. Browser tests cover the agent workflow, CSV export, and mobile layout.</td></tr>
        <tr><td>Browser integration</td><td>The checked-in conformance report records the tested Chrome version and results. Browser behavior can change.</td></tr>
        <tr><td>WebMCP</td><td>An experimental integration. Check the adapter status in devtools in the browser you intend to support.</td></tr>
      </tbody></table>
      <h2>Try it without an agent</h2>
      <p>Open the <a href="#/demo">demo</a> and use the devtools console. For a new app, follow the <a href="#/docs/quickstart">quick start</a>. For text-only access, use <a href="/llms-full.txt">the package reference</a>.</p>
    </>),
  },
  {
    id: "problem",
    group: "Learn",
    title: "Why a tool budget",
    summary: "A component library is a tool-count bomb unless something manages the surface.",
    body: (<>
      <h2>A tool list grows with your interface</h2>
      <p>A dashboard may contain tables, forms, dialogs, and many actions. Advertising every possible tool at once adds schema text to the agent's context, even when most tools are unrelated to its current task.</p>
      <p>Agentable keeps the resident list within a configurable budget. The default is twelve tools, including the two discovery tools. This is a library default, not a WebMCP limit or a measured accuracy threshold.</p>
      <h2>Three levels of availability</h2>
      <table><thead><tr><th>Tier</th><th>Meaning</th><th>Use it for</th></tr></thead><tbody>
        <tr><td>0 · preferred</td><td>Eligible to stay resident, subject to the budget.</td><td>Common actions on the current screen.</td></tr>
        <tr><td>1 · on demand</td><td>Indexed by list_capabilities; loaded through open_capability.</td><td>Reports, integrations, and less frequent tasks.</td></tr>
        <tr><td>2 · dormant</td><td>Only application code can promote it.</td><td>Capabilities that should remain unavailable to agents.</td></tr>
      </tbody></table>
      <h2>Choose what stays available</h2>
      <pre>{`// A frequently used query gets a higher priority.
agent={{ name: "query_orders", group: "orders", priority: 10 }}

// A less frequent capability starts one step away.
agent={{ name: "export_report", group: "reports", tier: 1 }}`}</pre>
      <p>A higher priority wins when tools compete for space. Opening a group makes its tools eligible for the same budget; it does not remove the cap. <code>ActionBar</code> combines several actions into one tool by default.</p>
      <h2>Measure your own surface</h2>
      <p>Use devtools to inspect resident tools, evictions, and estimated schema tokens. Compare real tasks in your app before choosing a different budget. See <a href="#/docs/mechanisms">the mechanisms</a> for the exact controls.</p>
    </>),
  },
  {
    id: "mechanisms",
    group: "Learn",
    title: "Six mechanisms",
    summary: "Scope, tier gate, fan-in, cache, shape, budget.",
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
                Tier 0 is eligible to be resident within the budget. Tier 1 sits behind <code>list_capabilities</code> (a one-line index) and <code>open_capability</code>, which promotes a group and fires <code>toolchange</code>. Full schemas materialize only on promotion.
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
                Read-only tools cache results for matching inputs with a TTL. Mutating tools declare <code>invalidates</code> tags. A cache hit reuses the previous result without executing the callback. Use cache: false for tools that must reapply visible UI state.
              </td>
              <td>on for readOnly</td>
            </tr>
            <tr>
              <td>Shape</td>
              <td>
                Output passes through field projection, cursor pagination, then a configurable character cap (1,500 by default). Paginated results include <code>has_more</code> and a <code>cursor</code> when more rows remain.
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
          The spec has no "an agent is present" signal. Tier-0 capabilities are declared before any agent call (subject to the budget), and the first tool call is treated as the presence signal: <code>snapshot.agentPresent</code> flips and <code>useAgentPresent()</code> re-renders.
        </p>
      </>
    ),
  },
  {
    id: "core",
    group: "Packages",
    title: "@agentable-ui/core",
    summary: "Zero-dependency registry, budgeter, cache, shaper, and adapters.",
    body: (
      <>
        <h1>@agentable-ui/core</h1>
        <p>Framework-free. Knows nothing about React or about WebMCP beyond one adapter file.</p>
        <pre>{`import { createAgentable, webmcpAdapter } from "@agentable-ui/core";
import { z } from "zod"; // npm install zod

const agentable = createAgentable({
  adapters: [webmcpAdapter()],
  budget: 12,                 // resident tools incl. the two meta tools
  maxOutputChars: 1500,       // library output cap
  confirm: async (req) => window.confirm(req.message),
});

const handle = agentable.declare({
  id: "cart.apply_coupon",
  group: "cart",
  tool: {
    name: "apply_coupon",
    description: "Apply a discount code to the current cart.",
    inputSchema: z.object({ code: z.string() }),   // optional validator; JSON Schema also works
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
              <td>0 preferred for residency within the budget, 1 unlockable through <code>open_capability</code>, 2 dormant (only app code can promote).</td>
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
          In the checked-in Chrome 155 conformance run: executeTool accepts an input object, callbacks receive parsed arguments, and output is returned as a string, duplicate names throw, character limits are guidance only, thrown errors become a generic <code>UnknownError</code>. So core validates input itself, always returns a string, and returns structured <code>{`{"error": ...}`}</code> text instead of throwing.
        </p>
      </>
    ),
  },
  {
    id: "react",
    group: "Packages",
    title: "@agentable-ui/react",
    summary: "AgentableProvider, useTool, useCapability, ToolScope.",
    body: (
      <>
        <h1>@agentable-ui/react</h1>
        <h2>Provider and custom tools</h2>
        <p>Wrap the feature once. In this pattern, supply your own cart callback and optional confirmation handler; install zod if you use its schema.</p>
        <pre>{`import { AgentableProvider, ToolScope, useTool } from "@agentable-ui/react";
import { z } from "zod"; // npm install zod

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
        <h2>Lifecycle and registration</h2>
        <ul>
          <li>Effects only, so nothing registers during SSR.</li>
          <li>Refcounted declarations survive StrictMode's double mount.</li>
          <li>Changing an <code>execute</code> callback alone does not re-register its tool. The registry sees a change only when the static shape changes.</li>
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
    summary: "Accessible controls, optional styling, and tools declared alongside your UI.",
    body: (
      <>
        <h1>@agentable-ui/ui</h1>
        <p>Use the default theme or style the controls through <code>data-agentable-*</code> hooks. The agent behavior works independently of your stylesheet.</p>
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
              <td>read-only query, paginated; use cache: false to reapply UI state</td>
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
        <h2>Start with a query</h2>
        <p>Provide your application's rows and column definitions. A query updates the visible table and returns projected records.</p>
        <pre>{`import { DataTable } from "@agentable-ui/ui";

<DataTable
  rows={orders}
  columns={columns}
  noun="orders"
  selectable
  selected={selected}
  onSelectionChange={setSelected}
  agent={{
    name: "query_orders",
    project: ["id", "customer", "total"],
    cache: false,
  }}
/>`}</pre>
        <p>Keep <code>selected</code> in state when actions need the selected row ids. Use stable record ids or <code>getRowId</code>. See the <a href="#/docs/quickstart">quick start</a> for a complete running example.</p>
        <h2>The agent prop</h2>
        <pre>{`agent={{
  name: "query_orders",          // tool name, <= 30 chars
  group: "orders",               // unlocks together
  tier: 0, priority: 5,
  description: "...",            // override the generated one
  confirm: "Allow this query?",  // optional override; usually omit for queries
  cache: false,                  // query also changes the visible table
  project: ["id", "customer"],   // output shaping
  maxChars: 1500,
  exposedTo: ["https://partner.example"],  // default same-origin
}}`}</pre>
        <h2>Choose a theme</h2>
        <p>Import <code>@agentable-ui/ui/styles.css</code> once. Change <code>--ag-*</code> tokens to match your app, or supply your own CSS. See <a href="#/docs/styling">Styling &amp; themes</a> for variants, sizes, dark mode, and loading states.</p>
      </>
    ),
  },
  {
    id: "devtools",
    group: "Packages",
    title: "@agentable-ui/devtools",
    summary: "In-page overlay: resident tools, budget, cache, schema sizes, tool console.",
    body: (
      <>
        <h1>@agentable-ui/devtools</h1>
        <h2>Install and mount</h2>
        <pre>{`npm install -D @agentable-ui/devtools`}</pre>
        <p>Mount the React panel under the same provider as your app. The standalone API takes an existing registry.</p>
        <pre>{`import { AgentableDevtools } from "@agentable-ui/devtools/react";
import { AgentableProvider } from "@agentable-ui/react";

<AgentableProvider>
  <YourApp />
  <AgentableDevtools />
</AgentableProvider>

// Or use the framework-free API with an existing registry:
import { mountDevtools } from "@agentable-ui/devtools";
mountDevtools(agentable, { position: "bottom-right", shortcut: "alt+a" });`}</pre>
        <h2>Choose a panel</h2>
        <ul>
          <li>Overview: budget usage, estimated tokens, cache hit rate, resident tools ranked by schema size, group open/close.</li>
          <li>Capabilities: every declaration with declared vs effective tier and why (evicted, hidden, tier).</li>
          <li>Console: invoke any resident tool exactly as a browser agent would. No agent, no flag.</li>
          <li>Warnings: character-limit and budget warnings, de-duplicated.</li>
        </ul>
        <p>Devtools calls the registry directly. A working Console call verifies your tool callback; the browser conformance suite separately checks the WebMCP adapter.</p>
      </>
    ),
  },
  {
    id: "lang",
    group: "Packages",
    title: "@agentable-ui/lang",
    summary: "The language a model writes UI in.",
    body: (
      <>
        <h1>@agentable-ui/lang</h1>
        <p>The language a model writes UI in. One node per line, rendered as each line arrives, a compact alternative to a JSON component tree.</p>
        <h2>Program format</h2>
        <pre>{`root = Stack([stats, note])
stats = StatGroup([rev, orders])
rev = Stat("Revenue", "$48.2k", "+6.1%", "up")
orders = Stat("Orders", 140, "+12", "up")
note = Callout("On track", "Ahead of target by 4%.", "success")`}</pre>
        <h2>Create a prompt and parser</h2>
        <pre>{`import { createLibrary } from "@agentable-ui/lang";
import { uiCatalog } from "@agentable-ui/ui";

const library = createLibrary(uiCatalog);
const system = library.prompt({ tools: [{ name: "refund_order" }] }); // send with the user's message to any model

const sp = library.stream();
sp.push(chunk);            // { root, errors, unresolved } after every chunk
sp.push("", true);         // done`}</pre>
        <h2>Bindings, actions, and errors</h2>
        <ul>
          <li>Arguments are positional in declared prop order or named. Children are a list of statement names anywhere in the arguments. Forward references work; the last definition of a name wins.</li>
          <li>
            <code>$data.x</code> reads app data, <code>$ui.x</code> is interface state; a path as an argument binds that prop. <code>when: $ui.selected</code> shows a node conditionally.
          </li>
          <li>
            Events are named arguments holding actions: <code>press: @Set($ui.selected, $event)</code>. Actions: <code>@Set @Merge @Push @Remove @Increment @Toggle @Tool @Say</code>.
          </li>
          <li>A bad line is dropped with a coded error and the rest renders. The host can send the errors back to the model.</li>
        </ul>
        <p>
          The program evaluates to the same tree <a href="#/docs/genui">@agentable-ui/genui</a> validates and renders, so <code>present({`{ program }`})</code> works for an in-page agent. Your application owns the model request and stream. This package handles the program format. See it stream in the <a href="#/playground">playground</a>.
        </p>
      </>
    ),
  },
  {
    id: "genui",
    group: "Packages",
    title: "@agentable-ui/genui",
    summary: "Renderer for streamed programs, AgentSurface and the present tool.",
    body: (
      <>
        <h1>@agentable-ui/genui</h1>
        <h2>Pick the rendering host</h2>
        <p>Use Renderer for a model stream your app owns. Use AgentSurface when an in-page agent should choose what to present. The latter needs an AgentableProvider.</p>
        <pre>{`import { Renderer, AgentSurface } from "@agentable-ui/genui";
import { uiCatalog } from "@agentable-ui/ui";

// A model streams a program; each line renders as it lands.
<Renderer components={uiCatalog} response={text} isStreaming={!done} data={data} tools={{ refund_order }} onMessage={send} onError={setErrors} />

// An in-page agent gets one tool over the same catalog:
<AgentSurface components={uiCatalog} />
// present({ program: 'root = Card("Hello")' })  or  present({ root: { component: "Card", props: { title: "Hello" } } })`}</pre>
        <h2>Streaming and tool calls</h2>
        <p>
          <code>Renderer</code> parses each complete line, validates the tree against the catalog with bad nodes pruned, and draws the rest. Interactions are disabled until the stream ends. Bindings to <code>$data</code> and <code>$ui</code>, <code>when</code>, and event actions work the same way for both components; <code>@Tool</code> calls go to the <code>tools</code> map you pass or, when an <code>AgentableProvider</code> is mounted, to registered tools with their confirmation and cache.
        </p>
        <div className="doc-note"><strong>Your app owns the model connection</strong><p>Pass the full accumulated response text to Renderer, not only the newest chunk. Tool callbacks supplied directly in its tools map use your app's policies; registry-backed calls retain registry confirmation.</p></div>
        <h2>Validate the catalog and response</h2>
        <p>
          The host validates component names, props, depth, and node count before rendering. AgentSurface also gates its catalog through the registry. Keep the catalog focused: sharing one present tool bounds tool count, but adding components still grows its schema.
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
    body: (
      <>
        <h1>Conformance</h1>
        <p>
          Unit tests check the library, while browser tests verify its connection to the real platform. The conformance suite launches installed Chrome, inspects <code>getTools()</code>, and exercises registered tools end to end.
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
              <td>Core has no React dependency, so another framework can use the same registry.</td>
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
              <td>pnpm workspaces, changesets, tsdown, ESM only; CSS is marked as a side effect</td>
              <td>Core will version faster than UI while the spec moves; packages stay independently versioned, and bundlers preserve imported styles.</td>
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
