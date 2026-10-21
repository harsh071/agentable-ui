import { Children, cloneElement, isValidElement, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTool } from "@agentable-ui/react";
import { Home } from "./Home.js";
import { DOCS } from "./docs-content.js";

function plainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return plainText(node.props.children);
  return "";
}

function highlightCode(code: string): ReactNode[] {
  const tokens = /\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:import|from|export|default|function|const|return|async|await|true|false|null|undefined)\b|\b\d+(?:_\d+)*(?:\.\d+)?\b/g;
  const parts: ReactNode[] = [];
  let end = 0;
  for (const match of code.matchAll(tokens)) {
    const index = match.index;
    if (index > end) parts.push(code.slice(end, index));
    const value = match[0];
    const kind = value.startsWith("//") ? "comment" : /^["']/.test(value) ? "string" : /^\d/.test(value) ? "number" : "keyword";
    parts.push(<span key={index} className={`doc-token-${kind}`}>{value}</span>);
    end = index + value.length;
  }
  if (end < code.length) parts.push(code.slice(end));
  return parts;
}

export function CodeBlock({ code }: { code: string }) {
  const [copyState, setCopyState] = useState("Copy");
  useEffect(() => {
    if (copyState === "Copy") return;
    const timer = setTimeout(() => setCopyState("Copy"), 2000);
    return () => clearTimeout(timer);
  }, [copyState]);
  const language = /^(npm |pnpm |# macOS)/.test(code) ? "Terminal" : code.startsWith("root =") ? "Agentable Lang" : /^\s*\{\s*"/.test(code) ? "JSON" : /^(?:\:root|\.billing-panel|\[data-)/.test(code) ? "CSS" : "React / TypeScript";
  return <div className="doc-code">
    <div className="doc-code-bar"><span>{language}</span><button type="button" aria-label="Copy code" onClick={async () => {
      try { await navigator.clipboard.writeText(code); setCopyState("Copied"); }
      catch { setCopyState("Select to copy"); }
    }}>{copyState}</button><span className="sr-only" role="status">{copyState === "Copy" ? "" : copyState}</span></div>
    <pre tabIndex={0} aria-label={`${language} example`}><code>{highlightCode(code)}</code></pre>
  </div>;
}

function prepareContent(body: ReactNode) {
  const outline: { id: string; title: string; level: number }[] = [];
  const seen = new Map<string, number>();
  const visit = (nodes: ReactNode): ReactNode => Children.map(nodes, (node) => {
    if (!isValidElement<{ children?: ReactNode; id?: string }>(node)) return node;
    if (node.type === "h1") return null;
    if (node.type === "pre") return <CodeBlock code={plainText(node.props.children)} />;
    if (node.type === "h2" || node.type === "h3") {
      const title = plainText(node.props.children);
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      const id = count ? `${slug}-${count}` : slug;
      outline.push({ id, title, level: node.type === "h2" ? 2 : 3 });
      return cloneElement(node, { id });
    }
    if (node.type === "table") return <div className="doc-table" tabIndex={0} role="region" aria-label="Reference table">{node}</div>;
    return node.props.children ? cloneElement(node, {}, visit(node.props.children)) : node;
  });
  const content = visit(body);
  return { content, outline };
}

const PAGES = DOCS.map((doc) => ({ ...doc, searchable: `${doc.title} ${doc.summary} ${plainText(doc.body)}` }));

export function DocsPage({ route, navigate }: { route: string; navigate: (to: string) => void }) {
  const [path, parameters = ""] = route.split("?");
  const id = path!.startsWith("/docs/") ? path!.slice(6) : "intro";
  const doc = PAGES.find((d) => d.id === id) ?? PAGES[0]!;
  const section = new URLSearchParams(parameters).get("section");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const { content, outline } = useMemo(() => prepareContent(doc.body), [doc.body]);
  const index = PAGES.indexOf(doc);
  const previous = PAGES[index - 1];
  const next = PAGES[index + 1];
  const isHome = route === "/";

  useEffect(() => { setQuery(""); setMenuOpen(false); }, [doc.id]);
  useEffect(() => {
    if (isHome) return;
    const frame = requestAnimationFrame(() => {
      document.title = `${doc.title} · Agentable Docs`;
      if (section) document.getElementById(section)?.scrollIntoView({ block: "start" });
      else document.getElementById("doc-title")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [doc.id, section, isHome]);

  const search = (q: string) => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return PAGES.flatMap((d) => {
      const text = d.searchable.toLowerCase();
      if (!words.every((word) => text.includes(word))) return [];
      const start = Math.max(0, text.indexOf(words[0]!) - 40);
      return [{ id: d.id, title: d.title, group: d.group, snippet: d.searchable.slice(start, start + 160).replace(/\s+/g, " ") }];
    });
  };

  useTool({ name: "search_docs", group: "docs", priority: 9,
    description: "Search documentation by words. Returns page ids, titles, and snippets; open one with open_doc.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    annotations: { readOnlyHint: true }, execute: ({ query }: { query: string }) => search(query),
  });
  useTool({ name: "open_doc", group: "docs", priority: 9,
    description: `Open a documentation page. Pages: ${PAGES.map((d) => d.id).join(", ")}.`,
    inputSchema: { type: "object", properties: { id: { type: "string", enum: PAGES.map((d) => d.id) } }, required: ["id"] },
    annotations: { readOnlyHint: false, consequentialHint: false }, confirm: false,
    execute: ({ id }: { id: string }) => {
      const target = PAGES.find((d) => d.id === id);
      if (!target) throw new Error(`No doc "${id}".`);
      navigate(`#/docs/${id}`);
      return { opened: id, title: target.title, summary: target.summary };
    },
  });
  useTool({ name: "read_doc", group: "docs", cache: false,
    description: "Read the current documentation page as plain text, including its examples.",
    annotations: { readOnlyHint: true }, execute: () => ({ id: doc.id, title: doc.title, text: plainText(doc.body) }),
  });

  if (isHome) return <Home />;
  const results = search(query);
  const groups = [...new Set(PAGES.map((d) => d.group))];
  const sectionHref = (heading: string) => `#/docs/${doc.id}?section=${encodeURIComponent(heading)}`;
  return <div className="docs">
    <aside className="docs-sidebar" aria-label="Documentation sidebar">
      <a className="docs-wordmark" href="#/docs/intro"><span aria-hidden="true">▧</span> Documentation</a>
      <label className="sr-only" htmlFor="docs-search">Search docs</label>
      <input id="docs-search" type="search" placeholder="Search documentation…" value={query} onChange={(e) => setQuery(e.target.value)} data-agentable-input="" />
      {query.trim() ? <div className="docs-search-panel">
        <p role="status">{results.length} {results.length === 1 ? "result" : "results"}</p>
        <ul className="search-results">{results.length ? results.map((result) => <li key={result.id}>
          <a href={`#/docs/${result.id}`} onClick={() => setQuery("")}><small>{result.group}</small><strong>{result.title}</strong><span>{result.snippet}…</span></a>
        </li>) : <li>No matches. Try “table”, “confirm”, or “stream”.</li>}</ul>
      </div> : null}
      <button type="button" className="docs-menu" aria-expanded={menuOpen} aria-controls="docs-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? "Close navigation −" : `Browse docs · ${doc.title} +`}</button>
      <nav id="docs-navigation" aria-label="Documentation pages" data-open={menuOpen ? "" : undefined}>
        {groups.map((group) => <div key={group} className="docs-group" data-open={menuOpen ? "" : undefined}>
          <div className="group">{group}</div><ul>{PAGES.filter((d) => d.group === group).map((d) => <li key={d.id}><a href={`#/docs/${d.id}`} aria-current={d.id === doc.id ? "page" : undefined} onClick={() => setMenuOpen(false)}>{d.title.replace("@agentable-ui/", "")}</a></li>)}</ul>
        </div>)}
      </nav>
      <div className="docs-sidebar-footer"><a href="/llms-full.txt">Plain-text reference ↗</a><a href="#/demo">Explore the demo ↗</a></div>
    </aside>
    <article className="docs-article">
      <header className="doc-header"><div className="doc-breadcrumb">Docs <span>/</span> {doc.group}</div><h1 id="doc-title" tabIndex={-1}>{doc.title}</h1><p>{doc.summary}</p></header>
      {outline.length ? <details className="docs-mobile-outline"><summary>On this page</summary><ul>{outline.map((heading) => <li key={heading.id}><a href={sectionHref(heading.id)}>{heading.title}</a></li>)}</ul></details> : null}
      <div className="doc-content" key={doc.id}>{content}</div>
      <footer className="doc-pagination">{previous ? <a href={`#/docs/${previous.id}`}><small>← Previous</small><strong>{previous.title}</strong></a> : <span />}{next ? <a href={`#/docs/${next.id}`}><small>Next →</small><strong>{next.title}</strong></a> : <a href="#/demo"><small>Put it into practice →</small><strong>Explore the demo</strong></a>}</footer>
      <p className="doc-help">Need a working example? <a href="#/demo">Open the demo</a> or <a href="#/docs/faq">check troubleshooting</a>.</p>
    </article>
    <nav className="docs-outline" aria-label="On this page"><span>On this page</span>{outline.map((heading) => <a key={heading.id} href={sectionHref(heading.id)} data-level={heading.level} aria-current={section === heading.id ? "location" : undefined}>{heading.title}</a>)}<div className="docs-outline-links"><a href="https://github.com/harsh071/agentable-ui">View source ↗</a><a href="/llms.txt">Docs for AI assistants ↗</a></div></nav>
  </div>;
}
