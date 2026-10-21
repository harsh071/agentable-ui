import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentable, useAgentableSnapshot, useTool } from "@agentable-ui/react";
import { AgentSurface, Renderer, type PresentArgs, type RendererError } from "@agentable-ui/genui";
import { createLibrary } from "@agentable-ui/lang";
import { estimateTokens } from "@agentable-ui/core";
import { uiCatalog } from "@agentable-ui/ui";
import { makeOrders, type Order } from "../data.js";

const library = createLibrary(uiCatalog);

/** Programs a model would stream. The same text is valid as `present({ program })`. */
const PROGRAMS: Array<{ label: string; ask: string; program: string }> = [
  {
    label: "Revenue summary",
    ask: "How did August go?",
    program: `root = Stack([stats, note])
stats = StatGroup([rev, orders, refunds])
rev = Stat("Revenue", "$48.2k", "+6.1%", "up")
orders = Stat("Orders", "140", "+12", "up")
refunds = Stat("Refunds", "9", "-2", "down")
note = Callout("On track", "Revenue is ahead of the monthly target by 4%.", "success")`,
  },
  {
    label: "Refund desk (interactive)",
    ask: "Let me refund a paid order.",
    program: `root = Stack([stats, orders, detail, done])
stats = StatGroup([paid, refunded])
paid = Stat("Paid orders", $data.summary.paid)
refunded = Stat("Refunded", $data.summary.refunded)
orders = RecordTable("Choose an order to refund", [{key: "id", label: "Order"}, {key: "customer", label: "Customer"}, {key: "total", label: "Total"}], $data.paid, select: @Set($ui.selected, $event))
detail = Card("Selected order", [who, reason, refund], when: $ui.selected)
who = Text($ui.selected.customer)
reason = TextInput("Reason", $ui.reason, change: @Set($ui.reason, $event))
refund = Button("Refund this order", "danger", press: [@Tool("refund_order", {id: $ui.selected.id, reason: $ui.reason}, $ui.last), @Remove($ui.selected)])
done = Callout(text: $ui.last.message, kind: "success", when: $ui.last)`,
  },
  {
    label: "Checklist with state",
    ask: "Make me a launch checklist.",
    program: `root = Card("Launch checklist", "Three things before the thread goes out", [a, b, c, actions, done])
a = Checkbox("Freeze the API", $ui.a, change: @Set($ui.a, $event))
b = Checkbox("Run the conformance suite", $ui.b, change: @Set($ui.b, $event))
c = Checkbox("Post the launch thread", $ui.c, change: [@Set($ui.c, $event), @Set($ui.posted, $event)])
actions = Stack([all, ask], "row")
all = Button("Mark all done", press: [@Set($ui.a, true), @Set($ui.b, true), @Set($ui.c, true), @Set($ui.posted, true)])
ask = Button("Ask what is next", "primary", press: @Say("The launch checklist is done. What is next?"))
done = Callout("Posted", "The launch thread is out. Watch replies for the next hour.", "success", when: $ui.posted)`,
  },
  {
    label: "With mistakes (dropped, rest renders)",
    ask: "Show a chart.",
    program: `root = Stack([title, chart, fallback])
title = Text("Signups by week", "heading")
chart = Chart([12, 19, 23, 31])
fallback = SimpleTable("No chart component yet; a table instead.", ["Week", "Signups"], [["W1", 12], ["W2", 19], ["W3", 23], ["W4", 31]])`,
  },
];

const SAMPLES: Array<{ label: string } & PresentArgs> = [
  {
    label: "Revenue summary",
    title: "August at a glance",
    root: {
      component: "Stack",
      children: [
        {
          component: "StatGroup",
          children: [
            { component: "Stat", props: { label: "Revenue", value: "$48.2k", delta: "+6.1%", trend: "up" } },
            { component: "Stat", props: { label: "Orders", value: "140", delta: "+12", trend: "up" } },
            { component: "Stat", props: { label: "Refunds", value: "9", delta: "-2", trend: "down" } },
          ],
        },
        { component: "Callout", props: { kind: "success", title: "On track", text: "Revenue is ahead of the monthly target by 4%." } },
      ],
    },
  },
  {
    label: "Order detail",
    root: {
      component: "Card",
      props: { title: "ORD-1042", subtitle: "Placed 2026-08-14" },
      children: [
        { component: "KeyValue", props: { items: [{ key: "Customer", value: "Grace Hopper" }, { key: "Status", value: "Shipped" }, { key: "Total", value: "$412.90" }] } },
        { component: "Progress", props: { label: "Fulfilment", value: 3, max: 4 } },
      ],
    },
  },
  {
    label: "Refund desk (interactive)",
    title: "Paid orders",
    ui: {},
    root: {
      component: "Stack",
      id: "root",
      children: [
        {
          component: "StatGroup",
          children: [
            { component: "Stat", props: { label: "Paid orders" }, bind: { value: "data.summary.paid" } },
            { component: "Stat", props: { label: "Refunded" }, bind: { value: "data.summary.refunded" } },
          ],
        },
        {
          component: "RecordTable",
          id: "orders",
          props: { caption: "Choose an order to refund", columns: [{ key: "id", label: "Order" }, { key: "customer", label: "Customer" }, { key: "total", label: "Total" }] },
          bind: { rows: "data.paid" },
          on: { select: [{ type: "set", path: "ui.selected", value: "{{value}}" }] },
        },
        {
          component: "Card",
          id: "detail",
          props: { title: "Selected order" },
          when: "ui.selected",
          children: [
            { component: "Text", bind: { text: "ui.selected.customer" }, props: { text: "" } },
            { component: "TextInput", props: { label: "Reason" }, bind: { value: "ui.reason" }, on: { change: [{ type: "set", path: "ui.reason", value: "{{value}}" }] } },
            {
              component: "Button",
              props: { label: "Refund this order", variant: "danger" },
              on: { press: [{ type: "tool", name: "refund_order", args: { id: "{{ui.selected.id}}", reason: "{{ui.reason}}" }, into: "ui.last" }, { type: "remove", path: "ui.selected" }] },
            },
          ],
        },
        { component: "Callout", props: { kind: "success", text: "" }, bind: { text: "ui.last.message" }, when: "ui.last" },
      ],
    },
  },
  {
    label: "A program (half the tokens)",
    title: "August at a glance",
    program: PROGRAMS[0]!.program,
  },
  {
    label: "Patch: add a note",
    ops: [{ op: "add", parent: "root", index: 0, node: { component: "Callout", id: "note", props: { kind: "info", text: "Refunds over $500 need a manager." } } }],
  },
  {
    label: "Invalid (write to data)",
    root: { component: "Button", props: { label: "Zero revenue" }, on: { press: [{ type: "set", path: "data.summary.paid", value: 0 }] } },
  },
  {
    label: "Invalid (unknown component)",
    root: { component: "Chart", props: { series: [1, 2, 3] } },
  },
  {
    label: "Invalid (bad props)",
    root: { component: "Stat", props: { label: "Missing value" } },
  },
];

type Mode = "program" | "tool";
const EXAMPLE_NOTES = ["A compact report with stats and a callout.", "Select an order, add a reason, and issue a refund.", "Local state, checkboxes, and assistant messages.", "See how invalid components are reported and skipped."];
const TOOL_NOTES = ["Render a complete component tree.", "A card with order details and progress.", "Data bindings and a real, confirmed tool action.", "Send a program through the present tool.", "Add a note to the current preview. Run a tree first.", "Read-only app data is protected.", "Components outside the catalog are rejected.", "Required component props are validated."];
function sampleSource(index: number) {
  const { label: _label, ...args } = SAMPLES[index]!;
  return JSON.stringify(args, null, 2);
}

export function PlaygroundPage() {
  const agentable = useAgentable();
  const snapshot = useAgentableSnapshot();
  const [mode, setMode] = useState<Mode>("program");
  const [pick, setPick] = useState(0);
  const [source, setSource] = useState(PROGRAMS[0]!.program);
  const [response, setResponse] = useState(PROGRAMS[0]!.program);
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [errors, setErrors] = useState<RendererError[]>([]);
  const [notice, setNotice] = useState("");
  const [toolError, setToolError] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>(() => makeOrders(40));
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const copyTimer = useRef<number | null>(null);
  const lineNumbers = useRef<HTMLDivElement | null>(null);
  const data = useMemo(() => ({
    paid: orders.filter((o) => o.status === "paid").slice(0, 6),
    summary: { paid: orders.filter((o) => o.status === "paid").length, refunded: orders.filter((o) => o.status === "refunded").length },
  }), [orders]);

  useTool<{ id: string; reason?: string }, { id: string; message: string }>({
    name: "refund_order",
    title: "Refund order",
    description: "Refund a paid order in full.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, reason: { type: "string" } }, required: ["id"] },
    confirm: (a) => `Refund ${a.id} in full?`,
    execute: ({ id, reason }) => {
      const order = orders.find((o) => o.id === id);
      if (!order || order.status !== "paid") throw new Error(`${id} is not a paid order.`);
      setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: "refunded" } : o)));
      return { id, message: `Refunded ${id} ($${order.total.toFixed(2)})${reason ? `: ${reason}` : ""}.` };
    },
  });

  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setStreaming(false);
  };
  useEffect(() => () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
  }, []);

  const select = (nextMode: Mode, index: number) => {
    stop();
    setMode(nextMode);
    setPick(index);
    setSource(nextMode === "program" ? PROGRAMS[index]!.program : sampleSource(index));
    setNotice("");
    setToolError("");
    setCopied(false);
    if (nextMode === "program") {
      setResponse(PROGRAMS[index]!.program);
      setErrors([]);
      setRevision((n) => n + 1);
    }
  };

  const run = async (asStream = false) => {
    stop();
    setNotice("");
    setToolError("");
    if (mode === "tool") {
      if (!agentable || busy) return;
      setBusy(true);
      try {
        const args: unknown = JSON.parse(source);
        if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Enter a JSON object containing root, program, or ops.");
        const out = await agentable.invoke("present", args, { adapter: "playground" });
        setLog((items) => [out, ...items].slice(0, 8));
        const result = JSON.parse(out) as { error?: string };
        if (result.error) setToolError(rejection(out));
        else setNotice("Tool call completed.");
      } catch (error) {
        setToolError(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
      }
      return;
    }
    setRevision((n) => n + 1);
    setErrors([]);
    if (!asStream) { setResponse(source); return; }
    setResponse("");
    setStreaming(true);
    const started = performance.now();
    timer.current = window.setInterval(() => {
      const at = Math.min(source.length, Math.floor((performance.now() - started) * .26));
      setResponse(source.slice(0, at));
      if (at >= source.length) stop();
    }, 40);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch { setNotice("Clipboard unavailable. Select and copy the source in the editor."); }
  };
  const parsed = useMemo(() => library.parse(source), [source]);
  const json = parsed.root ? JSON.stringify({ root: parsed.root }) : "";
  const tokens = estimateTokens(source.length);
  const jsonTokens = estimateTokens(json.length);
  const saving = jsonTokens ? Math.round((1 - tokens / jsonTokens) * 100) : 0;
  const examples = mode === "program" ? PROGRAMS : SAMPLES;
  const dirty = mode === "program" && response !== source && !streaming;
  const presentTool = snapshot.resident.find((t) => t.name === "present");

  return (
    <div className="playground">
      <header className="pg-heading">
        <div><div className="pg-eyebrow">AGENTABLE / DEVELOP</div><h1>Playground<span>.</span></h1><p>Small programs. Real interfaces. Try an example, then make it yours.</p></div>
        <a className="pg-docs" href="#/docs/genui">Read the guide <span aria-hidden="true">↗</span></a>
      </header>
      <div className="pg-workspace">
        <aside className="pg-sidebar" aria-label="Playground examples">
          <div className="pg-sidebar-title">EXAMPLES <span>{String(examples.length).padStart(2, "0")}</span></div>
          <div className="pg-mode" role="group" aria-label="Input format">
            <button type="button" aria-pressed={mode === "program"} disabled={busy} onClick={() => select("program", 0)}>Lang</button>
            <button type="button" aria-pressed={mode === "tool"} disabled={busy} onClick={() => select("tool", 0)}>Tool / JSON</button>
          </div>
          <div className="pg-examples">{examples.map((example, i) => (
            <button type="button" key={example.label} disabled={busy} aria-pressed={pick === i} onClick={() => select(mode, i)}>
              <span className="pg-example-number">{String(i + 1).padStart(2, "0")}</span><span><strong>{example.label.replace(" (interactive)", "").replace(" (dropped, rest renders)", "")}</strong><small>{(mode === "program" ? EXAMPLE_NOTES : TOOL_NOTES)[i]}</small></span><span className="pg-example-arrow" aria-hidden="true">↗</span>
            </button>
          ))}</div>
          <div className="pg-sidebar-note"><span aria-hidden="true">⌘</span><strong>Your components. Agent-generated.</strong><p>Every preview uses the same validated component catalog as your app.</p><a href="#/docs/ui">Explore the catalog →</a></div>
        </aside>
        <div className="pg-main">
          <div className="pg-toolbar"><div><span className="pg-file-icon" aria-hidden="true">{mode === "program" ? "⌁" : "{}"}</span><strong>{mode === "program" ? "interface.lang" : "present.json"}</strong><span className="pg-format">{mode === "program" ? "Agentable Lang" : "Tool arguments"}</span></div><div className="pg-actions"><button type="button" disabled={busy} onClick={() => select(mode, pick)}>Reset</button><button type="button" onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button></div></div>
          <div className="pg-panes">
            <section className="pg-source" aria-label="Source editor">
              <div className="pg-pane-label"><span>SOURCE</span><span>Editable</span></div>
              <div className="pg-editor"><div className="pg-line-numbers" ref={lineNumbers} aria-hidden="true">{source.split("\n").map((_, i) => <span key={i}>{i + 1}</span>)}</div><textarea aria-label={mode === "program" ? "Program source" : "Tool JSON source"} onScroll={(event) => { if (lineNumbers.current) lineNumbers.current.scrollTop = event.currentTarget.scrollTop; }} spellCheck={false} autoCapitalize="off" autoCorrect="off" value={source} disabled={streaming || busy} onChange={(event) => { setSource(event.target.value); setCopied(false); }} /></div>
              <div className="pg-editor-footer"><span>~{tokens} tokens · {source.length} characters</span><span>{source.split("\n").length} lines</span></div>
            </section>
            <section className="pg-preview" aria-label="Rendered preview">
              <div className="pg-pane-label"><span>LIVE PREVIEW</span><span className="pg-preview-status" data-streaming={streaming || undefined}><i />{streaming ? "Streaming" : dirty ? "Unapplied changes" : "Ready"}</span></div>
              <div className="pg-preview-body">
                {mode === "program" && <><div className="pg-prompt"><span>YOU</span><p>{PROGRAMS[pick]!.ask}</p></div><Renderer key={revision} components={uiCatalog} library={library} response={response} isStreaming={streaming} data={data} onError={setErrors} onMessage={(text) => setNotice(`Sent to assistant: “${text}”`)} placeholder={<div className="pg-empty">{streaming ? "Waiting for the first complete component…" : "Run a program to see your interface here."}</div>} /></>}
                <div hidden={mode !== "tool"}><AgentSurface components={uiCatalog} data={data} clearable={false} onActionError={setToolError} placeholder={<div className="pg-empty"><span aria-hidden="true">↗</span><strong>Your next interface starts here.</strong><p>Run the source to call the present tool.</p></div>} /></div>
                {notice && <p className="pg-notice" role="status">{notice}</p>}
              </div>
              <div className="pg-preview-footer"><span>{Object.keys(uiCatalog).length} catalog components</span><span>React · validated</span></div>
            </section>
          </div>
          <div className="pg-runbar"><p>{streaming ? "Rendering complete lines as they arrive…" : mode === "tool" ? "Validated before it reaches the preview." : "Edit the source, then run or simulate a stream."}</p><div>{streaming ? <button className="pg-button" type="button" onClick={() => { stop(); setResponse((text) => text.slice(0, text.lastIndexOf("\n") + 1)); setNotice("Stream stopped. Run the program to render the full source."); }}>Stop stream</button> : <>{mode === "program" && <button className="pg-button" type="button" disabled={!source.trim()} onClick={() => void run(true)}>Stream</button>}<button className="pg-button pg-button-primary" type="button" disabled={busy || !source.trim() || (mode === "tool" && !presentTool)} onClick={() => void run()}><span aria-hidden="true">▶</span> {busy ? "Running…" : mode === "tool" ? "Run tool" : "Run program"}</button></>}</div></div>
        </div>
      </div>
      <div className="pg-bottom">
        <div className="pg-diagnostics" role="status">{toolError || (mode === "program" && errors.length) ? <><span className="pg-issue-dot" />{toolError || `${errors.length} ${errors.length === 1 ? "issue" : "issues"} in output`}</> : <><span className="pg-clean-dot" />{streaming ? "Receiving program" : "Sandbox ready"}</>}</div>
        {mode === "program" && saving > 0 && !parsed.errors.some((error) => error.severity === "error") && <span className="pg-token-note">~{saving}% fewer tokens than the equivalent JSON</span>}
      </div>
      {mode === "program" && errors.length > 0 && <ul className="pg-errors">{errors.map((error, i) => <li key={i}>{error.line ? `Line ${error.line}: ` : error.path ? `${error.path}: ` : ""}{error.message.replace(/^Line \d+: /, "")}</li>)}</ul>}
      <details className="pg-inspector"><summary>Inspect {mode === "program" ? "the system prompt" : `tool calls (${log.length})`}<span>Developer details</span></summary><pre>{mode === "program" ? library.prompt({ tools: [{ name: "refund_order", description: "Refund a paid order in full." }] }) : log.length ? log.join("\n\n") : "No calls yet. Run an example to inspect the result."}</pre></details>
    </div>
  );
}

function rejection(out: string): string {
  try {
    const result = JSON.parse(out) as { error?: string; issues?: Array<{ path: string; message: string }> };
    const issue = result.issues?.[0];
    return issue ? `${issue.path}: ${issue.message}` : (result.error ?? out);
  } catch { return out; }
}
