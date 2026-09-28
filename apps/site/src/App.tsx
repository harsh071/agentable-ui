import { useEffect } from "react";
import { AgentableProvider, useAgentableSnapshot } from "@agentable-ui/react";
import { Nav, Toaster } from "@agentable-ui/ui";
import { AgentableDevtools } from "@agentable-ui/devtools/react";
import { useRoute } from "./router.js";
import { DocsPage } from "./pages/Docs.js";
import { DemoPage } from "./pages/Demo.js";
import { PlaygroundPage } from "./pages/Playground.js";

const NAV = [
  { href: "#/", label: "Docs", describe: "Documentation, getting started, package reference" },
  { href: "#/demo", label: "Demo", describe: "Orders dashboard built with @agentable-ui/ui" },
  { href: "#/playground", label: "Playground", describe: "Generative UI surface and tool console" },
  { href: "https://github.com/harsh071/agentable-ui", label: "GitHub", external: true, agentHidden: true },
];

export function App() {
  return (
    <AgentableProvider budget={12}>
      <Shell />
      <Toaster agent={{ name: "read_notifications", group: "page", tier: 1 }} position="bottom-left" />
      <AgentableDevtools position="bottom-right" />
    </AgentableProvider>
  );
}

function Shell() {
  const [route, navigate] = useRoute();
  useEffect(() => {
    document.title = route.startsWith("/demo") ? "Demo · Agentable" : route.startsWith("/playground") ? "Playground · Agentable" : "Agentable";
  }, [route]);

  const current = route.startsWith("/demo") ? "#/demo" : route.startsWith("/playground") ? "#/playground" : "#/";

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#/">
          <i /> Agentable
        </a>
        <Nav items={NAV} current={current} onNavigate={(href) => navigate(href)} agent={{ name: "navigate", priority: 10 }} />
        <span className="spacer" />
        <Status />
      </header>
      <main className="page">
        {route.startsWith("/demo") ? <DemoPage /> : route.startsWith("/playground") ? <PlaygroundPage /> : <DocsPage route={route} navigate={navigate} />}
      </main>
      <footer className="foot">
        MIT licensed. Every part of this site is agent-callable: open devtools (<kbd>Alt</kbd>+<kbd>A</kbd>) to see what an agent sees, or run Chrome with <code>--enable-features=WebMCP</code>.
      </footer>
    </div>
  );
}

function Status() {
  const s = useAgentableSnapshot();
  const webmcp = s.adapters.find((a) => a.id === "webmcp");
  return (
    <div className="status" title="Resident tools / budget · estimated context">
      <span className="count">
        <b>{s.budget.used}</b>/{s.budget.max} tools · ~<b>{s.estimatedTokens}</b> tokens
      </span>
      {webmcp?.available ? (
        <span className="pill on">WebMCP on</span>
      ) : (
        <a className="pill off" href="#/docs/see-it-work" title="Your browser doesn't have the experimental WebMCP flag on. Everything still works in devtools (Alt+A).">
          WebMCP not enabled
        </a>
      )}
      {s.agentPresent ? <span className="pill on">agent active</span> : null}
    </div>
  );
}
