/**
 * The front page. One idea, said plainly: the same components work for a person
 * and for an AI agent. Everything deeper lives in the docs behind "Read the docs".
 */
export function Home() {
  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="home-pill">
            <i /> Open source · React · MIT
          </p>
          <h1 className="home-title">
            One UI library.
            <br />
            For people <span>and</span> AI.
          </h1>
          <p className="home-lede">
            Agentable is a set of React components that work both ways. A person sees a table they can sort. An AI agent sees a tool it can call. Same component. One extra prop.
          </p>
          <div className="row">
            <a className="home-btn light" href="#/docs/quickstart">
              Get started <span aria-hidden="true">→</span>
            </a>
            <a className="home-btn ghost" href="#/demo">
              See it live
            </a>
          </div>
        </div>

        <figure className="home-twin" aria-label="The same component, as a person sees it and as an agent sees it">
          <div className="home-twin__side">
            <span className="home-cap">A person sees</span>
            <div className="mini-table">
              <div className="mini-table__head">
                <b>Orders</b>
                <span>Status ▾</span>
              </div>
              <div className="mini-row">
                <span>#4012</span>
                <span className="mini-pill">Shipped</span>
                <span>$84.00</span>
              </div>
              <div className="mini-row">
                <span>#4011</span>
                <span className="mini-pill warn">Unpaid</span>
                <span>$129.50</span>
              </div>
              <div className="mini-row">
                <span>#4010</span>
                <span className="mini-pill">Shipped</span>
                <span>$42.10</span>
              </div>
            </div>
          </div>
          <div className="home-twin__eq" aria-hidden="true">
            =
          </div>
          <div className="home-twin__side">
            <span className="home-cap">An agent sees</span>
            <pre className="mini-tool">{`search_orders({
  status: "unpaid",
  region: "EU"
})`}</pre>
            <p className="home-twin__note">
              Typed inputs, a plain description, and a result it can read. No guessing which button to press.
            </p>
          </div>
        </figure>
      </section>

      <section className="home-section">
        <header className="home-head">
          <h2>The page has to work for the person and for the AI helping them.</h2>
          <p>Today it is built for one, and the other makes do. The agent reads a screenshot and guesses. Agentable gives both the same honest interface.</p>
        </header>

        <div className="home-ways">
          <article className="home-way">
            <span className="home-cap">1 · Agents use your UI</span>
            <h3>Add one prop to a component you already have.</h3>
            <p>The assistant can search the table, fill the form or press the button, in the page the person is looking at. Anything risky asks the person first.</p>
            <pre>{`<DataTable rows={orders}
  agent={{ name: "search_orders" }} />`}</pre>
            <a href="#/docs/quickstart">Quick start →</a>
          </article>
          <article className="home-way">
            <span className="home-cap">2 · Agents build UI from your components</span>
            <h3>Models answer with a screen instead of a paragraph.</h3>
            <p>The model writes a few short lines. Your components draw them as they stream in. Only components from your catalog ever appear, so the result looks like your product.</p>
            <pre>{`root = Stack([stats, note])
stats = Stat("Revenue", "$48.2k", "+6%", "up")
note = Callout("On track", "Ahead by 4%.", "success")`}</pre>
            <a href="#/playground">Watch it stream →</a>
          </article>
        </div>
      </section>

      <section className="home-section">
        <header className="home-head">
          <h2>Three things to know.</h2>
        </header>
        <div className="home-facts">
          <div>
            <b>It is opt-in.</b>
            <p>
              No <code>agent</code> prop means a normal component. Nothing changes for anyone until you ask it to.
            </p>
          </div>
          <div>
            <b>It asks first.</b>
            <p>Submitting a form or refunding an order shows the person an "Allow?" before it happens.</p>
          </div>
          <div>
            <b>It keeps the list short.</b>
            <p>Assistants get worse with too many tools, so at most 12 are in view at once. The rest are one step away.</p>
          </div>
        </div>
      </section>

      <section className="home-section home-start">
        <div>
          <h2>Start in two minutes.</h2>
          <p>Install, wrap your app once, add a prop. Press Alt+A to see exactly what an agent sees. No AI account or browser flag needed to try it.</p>
          <a className="home-btn" href="#/docs/quickstart">
            Read the docs <span aria-hidden="true">→</span>
          </a>
        </div>
        <pre>{`npm install @agentable-ui/ui @agentable-ui/react

import { AgentableProvider } from "@agentable-ui/react";
import { DataTable } from "@agentable-ui/ui";
import "@agentable-ui/ui/styles.css";

<AgentableProvider>
  <DataTable rows={orders} columns={columns}
    agent={{ name: "search_orders" }} />
</AgentableProvider>`}</pre>
      </section>

      <section className="home-family">
        <span className="home-cap">Part of Interfaces for Humans</span>
        <ol>
          <li>
            <b>Agentable</b> gives you the components.
          </li>
          <li>
            <a href="https://studio.interfacesforhuman.com">Studio</a> generates apps from them.
          </li>
          <li>
            <a href="https://rui.interfacesforhuman.com">RUI</a> checks what a generated screen really does.
          </li>
        </ol>
      </section>
    </div>
  );
}
