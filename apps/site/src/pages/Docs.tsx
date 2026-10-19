import { useMemo, useState, type ReactNode } from "react";
import { useTool } from "@agentable-ui/react";
import { Home } from "./Home.js";

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
    group: "Start here",
    title: "Overview",
    summary: "One UI library that both people and AI agents can use.",
    text: "Agentable is a set of React components that work both ways: a person sees a table they can sort, an AI agent sees a tool it can call. Same component, one extra prop. It works in two directions. One, agents use your UI: add an agent prop to a table, form or button and an assistant can use it in the page the person is looking at; anything risky asks the person first. Two, agents build UI from your components: a model writes a short program (name = Component(args), one line each) and your components render it as it streams, so generated screens look like your product. Three things to know: it is opt-in (no agent prop means a normal component), it asks first before consequential actions, and it keeps the agent's tool list short (12 at most by default). Part of Interfaces for Humans: Agentable gives the components, Agentable Studio generates apps from them, RUI checks what a generated screen really does. Next: quick start.",
    body: <Home />,
  },
  {
    id: "quickstart",
    group: "Start here",
    title: "Quick start",
    summary: "Install, wrap your app, add one prop, test it. Five minutes.",
    text: "Quick start. Step 1 install: npm install @agentable-ui/ui @agentable-ui/react @agentable-ui/core and npm install -D @agentable-ui/devtools. Step 2 wrap your app in AgentableProvider and import @agentable-ui/ui/styles.css. Step 3 add an agent prop to a component, for example DataTable agent name search_orders. Step 4 add AgentableDevtools, run your app, press Alt+A, open the Console tab and call search_orders. Step 5 optional: add your own tool with useTool.",
    body: (
      <>
        <h1>Quick start</h1>
        <p className="lede">Five steps. You don't need an AI assistant or any browser flags to follow along.</p>

        <h2>1. Install</h2>
        <pre>{`npm install @agentable-ui/ui @agentable-ui/react @agentable-ui/core
npm install -D @agentable-ui/devtools`}</pre>
        <p className="muted">Works with pnpm and yarn too. You need React 18 or newer.</p>

        <h2>2. Wrap your app</h2>
        <p>
          Put <code>&lt;AgentableProvider&gt;</code> around your app, once, near the top. It's the thing that talks to the browser.
        </p>
        <pre>{`import { AgentableProvider } from "@agentable-ui/react";
import "@agentable-ui/ui/styles.css";

export function App() {
  return (
    <AgentableProvider>
      <YourPages />
    </AgentableProvider>
  );
}`}</pre>

        <h2>3. Add one prop</h2>
        <p>
          Use an Agentable component and give it an <code>agent</code> prop with a name. The name is what the assistant will call.
        </p>
        <pre>{`import { DataTable } from "@agentable-ui/ui";

const columns = [
  { key: "id", header: "Order" },
  { key: "customer", header: "Customer" },
  { key: "status", header: "Status" },
];

<DataTable
  columns={columns}
  rows={orders}
  agent={{ name: "search_orders" }}
/>`}</pre>
        <p>That's it. The table now has a <code>search_orders</code> tool that can search, sort and filter it.</p>

        <h2>4. See what the assistant sees</h2>
        <p>Add the devtools panel, then run your app.</p>
        <pre>{`import { AgentableDevtools } from "@agentable-ui/devtools/react";

<AgentableProvider>
  <YourPages />
  <AgentableDevtools />
</AgentableProvider>`}</pre>
        <ol>
          <li>
            Press <kbd>Alt</kbd>+<kbd>A</kbd> (or click the <b>Agent</b> button in the corner).
          </li>
          <li>
            <b>Overview</b> lists every tool the assistant can see right now.
          </li>
          <li>
            <b>Console</b> lets you call a tool yourself, exactly like an assistant would. Try <code>search_orders</code> with <code>{`{"query": "Ada"}`}</code> and watch the table change.
          </li>
        </ol>

        <h2>5. (Optional) Add your own tool</h2>
        <p>
          For anything that isn't a component, use <code>useTool</code> in any component inside the provider.
        </p>
        <pre>{`import { useTool } from "@agentable-ui/react";
import { Home } from "./Home.js";

function Cart() {
  useTool({
    name: "apply_coupon",
    description: "Apply a discount code to the cart.",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string" } },
      required: ["code"],
    },
    execute: ({ code }) => cart.applyCoupon(code),
  });
  // ...render your cart as usual
}`}</pre>
        <p>
          Because this tool changes something, the user is asked to allow it before it runs. For tools that only read data, add <code>annotations: &#123; readOnlyHint: true &#125;</code> and they run without asking.
        </p>

        <h2>Next</h2>
        <ul>
          <li>
            <a href="#/docs/see-it-work">See it working</a> with a real browser agent.
          </li>
          <li>
            <a href="#/docs/recipes">Recipes</a>: forms, buttons, tabs, confirmations.
          </li>
          <li>
            <a href="#/demo">The demo</a> is a full dashboard built this way. Open it and press <kbd>Alt</kbd>+<kbd>A</kbd>.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "see-it-work",
    group: "Start here",
    title: "See it working",
    summary: "Three ways to check your tools: devtools, the header counter, real Chrome.",
    text: "See it working. Option 1 devtools: press Alt+A, Overview lists tools, Console calls them, no flag needed. Option 2 the header on this site shows resident tools out of the budget, estimated tokens, and WebMCP on or off. WebMCP off just means your browser does not have the experimental feature turned on; everything else still works. Option 3 real Chrome: quit Chrome and start it with --enable-features=WebMCP, for example on macOS open -a Google Chrome --args --enable-features=WebMCP. Then the pill says WebMCP on and any WebMCP agent or extension can call the tools.",
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
    summary: "Copy-paste snippets for the common cases.",
    text: "Recipes. Let the assistant fill a form: Form with agent prop and Field children; the schema comes from the fields. Let it press buttons: ActionBar with actions, destructive actions ask first. Let it switch tabs: Tabs agent. Let it pick from a list: Combobox. Ask before running: confirm true or a message. Never ask: confirm false. Hide a column from the assistant: agentHidden. Group tools so they load only when needed: tier 1 and group. Show notifications to the assistant: Toaster agent.",
    body: (
      <>
        <h1>Recipes</h1>
        <p className="lede">Copy, paste, rename. Every snippet goes inside your <code>&lt;AgentableProvider&gt;</code>.</p>

        <h2>Let the assistant fill in a form</h2>
        <p>The form's fields become the tool's inputs. <code>describe</code> is the hint the assistant reads.</p>
        <pre>{`<Form agent={{ name: "create_invoice" }} onSubmit={(values) => api.createInvoice(values)}>
  <Field name="customer" required describe="Customer's legal name" />
  <Field name="amountCents" type="integer" min={1} describe="Amount in cents" />
  <Field name="sendNow" type="boolean" />
</Form>`}</pre>
        <p className="muted">Submitting asks the user first. Whatever you return from onSubmit goes back to the assistant.</p>

        <h2>Let it press buttons</h2>
        <p>A whole row of buttons becomes one tool, so it doesn't eat into the 12-tool limit.</p>
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
    id: "faq",
    group: "Start here",
    title: "FAQ",
    summary: "WebMCP off, missing tools, budget warnings, words explained.",
    text: "FAQ. The header says WebMCP not enabled: normal, your browser lacks the flag, devtools still work. My tool doesn't show up: is the component inside AgentableProvider, is it mounted, is it tier 1 or evicted by the budget; check devtools Capabilities tab. Console warning Budget (12) exceeded: more tier-0 tools than the limit; raise priority, set tier 1, use ActionBar fan-in, or raise budget. Tool call hangs in tests: consequential tools wait for confirmation; mark readOnlyHint or pass confirm. Do I need Next.js: no, any React. Glossary: agent or assistant, tool, WebMCP, budget, resident, tier, group, fan-in, consequential.",
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
          <li>Is the component on screen? Tools only exist while their component is mounted. A closed dialog or an inactive tab has no tools.</li>
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
          Tools that change things wait for the user to click "Allow". In tests, mark read-only tools with <code>annotations: &#123; readOnlyHint: true &#125;</code>, or pass <code>confirm=&#123;async () =&gt; true&#125;</code> to the provider.
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
              <td>0 = always live. 1 = one step away, opened on request. 2 = only your code can turn it on.</td>
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
              <td>A tool that changes something. The user is asked before it runs.</td>
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
    group: "Learn",
    title: "Why a tool budget",
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
    group: "Learn",
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
    id: "lang",
    group: "Packages",
    title: "@agentable-ui/lang",
    summary: "The language a model writes UI in.",
    text: "Agentable Lang is a compact streaming language for model-generated UI: one node per line, name = Component(args), positional or named arguments, children as a list of names, $data and $ui bindings, when: conditions, and @Actions on events. createLibrary(catalog) gives signatures, a system prompt via prompt(), parse(), a streaming parser via stream(), and serialize(). Programs are about 40% smaller than the same tree as JSON and evaluate to the tree genui renders, so present accepts them too.",
    body: (
      <>
        <h1>@agentable-ui/lang</h1>
        <p>The language a model writes UI in. One node per line, rendered as each line arrives, about 40% smaller than the same tree as JSON.</p>
        <pre>{`root = Stack([stats, note])
stats = StatGroup([rev, orders])
rev = Stat("Revenue", "$48.2k", "+6.1%", "up")
orders = Stat("Orders", 140, "+12", "up")
note = Callout("On track", "Ahead of target by 4%.", "success")`}</pre>
        <pre>{`import { createLibrary } from "@agentable-ui/lang";
import { uiCatalog } from "@agentable-ui/ui";

const library = createLibrary(uiCatalog);
const system = library.prompt({ tools: [{ name: "refund_order" }] }); // send with the user's message to any model

const sp = library.stream();
sp.push(chunk);            // { root, errors, unresolved } after every chunk
sp.push("", true);         // done`}</pre>
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
          The program evaluates to the same tree <a href="#/docs/genui">@agentable-ui/genui</a> validates and renders, so <code>present({`{ program }`})</code> works for an in-page agent. No model calls live in this package; Agentable Studio generates, RUI verifies. See it stream in the <a href="#/playground">playground</a>.
        </p>
      </>
    ),
  },
  {
    id: "genui",
    group: "Packages",
    title: "@agentable-ui/genui",
    summary: "Renderer for streamed programs, AgentSurface and the present tool.",
    text: "Renderer draws an Agentable Lang program as it streams: each complete line is parsed, validated against the catalog with bad nodes pruned, and rendered; the UI is inert until the stream ends. Bindings, when and actions work as in AgentSurface; @Tool actions go to a tools map or the Agentable registry. AgentSurface registers one present tool that accepts a program or a JSON tree, validated through an allowlist. The catalog is a projection of the registry and tier-gated. uiCatalog from @agentable-ui/ui ships Text Card Stat StatGroup Callout KeyValue SimpleTable List Stack Progress Button TextInput Select Checkbox RecordTable.",
    body: (
      <>
        <h1>@agentable-ui/genui</h1>
        <pre>{`import { Renderer, AgentSurface } from "@agentable-ui/genui";
import { uiCatalog } from "@agentable-ui/ui";

// A model streams a program; each line renders as it lands.
<Renderer components={uiCatalog} response={text} isStreaming={!done} data={data} tools={{ refund_order }} onMessage={send} onError={setErrors} />

// An in-page agent gets one tool over the same catalog:
<AgentSurface components={uiCatalog} />
// present({ program: 'root = Card("Hello")' })  or  present({ root: { component: "Card", props: { title: "Hello" } } })`}</pre>
        <p>
          <code>Renderer</code> parses each complete line, validates the tree against the catalog with bad nodes pruned, and draws the rest. Interactions are disabled until the stream ends. Bindings to <code>$data</code> and <code>$ui</code>, <code>when</code>, and event actions work the same way for both components; <code>@Tool</code> calls go to the <code>tools</code> map you pass or, when an <code>AgentableProvider</code> is mounted, to registered tools with their confirmation and cache.
        </p>
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
  const [menuOpen, setMenuOpen] = useState(false);

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

  if (doc.id === "intro") return doc.body;

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
        <button type="button" className="docs-menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
          {menuOpen ? "Hide pages" : `Pages · ${doc.title}`}
        </button>
        {groups.map((g) => (
          <div key={g} className="docs-group" data-open={menuOpen ? "" : undefined}>
            <div className="group">{g}</div>
            <ul>
              {DOCS.filter((d) => d.group === g).map((d) => (
                <li key={d.id}>
                  <a href={`#/docs/${d.id}`} aria-current={d.id === doc.id ? "page" : undefined} onClick={() => setMenuOpen(false)}>
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
