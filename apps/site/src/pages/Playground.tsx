import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentable, useAgentableSnapshot, useTool } from "@agentable-ui/react";
import { AgentSurface, Renderer, type PresentArgs, type RendererError } from "@agentable-ui/genui";
import { createLibrary } from "@agentable-ui/lang";
import { estimateTokens } from "@agentable-ui/core";
import { uiCatalog, toast } from "@agentable-ui/ui";
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

export function PlaygroundPage() {
  const agentable = useAgentable();
  const snapshot = useAgentableSnapshot();
  const [log, setLog] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>(() => makeOrders(40));

  const data = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid").slice(0, 6);
    return {
      paid,
      summary: { paid: orders.filter((o) => o.status === "paid").length, refunded: orders.filter((o) => o.status === "refunded").length },
    };
  }, [orders]);

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

  const present = async (sample: (typeof SAMPLES)[number]) => {
    if (!agentable) return;
    const { label, ...args } = sample;
    const out = await agentable.invoke("present", args, { adapter: "playground" });
    setLog((l) => [`present(${label}) -> ${out}`, ...l].slice(0, 8));
    if (out.includes('"error"')) toast({ title: "present rejected the spec", description: rejection(out), kind: "warning", source: "agent" });
  };

  const presentTool = snapshot.resident.find((t) => t.name === "present");

  return (
    <div className="dash">
      <div className="dash-header">
        <div>
          <h1>Playground</h1>
          <p className="lede">
            A model answers in a small language instead of prose. Each line becomes one of your components, on screen before the next line arrives.
          </p>
        </div>
      </div>

      <StreamSection data={data} />

      <section className="section">
        <h2>The same language, as a tool</h2>
        <p className="muted">
          An agent running in the page gets one <code>present</code> tool over the same catalog. It can send a program or a JSON tree; either is validated before anything renders. Simulate a call:
        </p>
        <div className="chips">
          {SAMPLES.map((s) => (
            <button key={s.label} type="button" className="chip" onClick={() => void present(s)}>
              {s.label}
            </button>
          ))}
        </div>
        <AgentSurface components={uiCatalog} data={data} placeholder={<span>Nothing presented yet. Pick a sample above.</span>} />
        <details className="under">
          <summary>
            Under the hood: what the agent sees{presentTool ? ` (${presentTool.schemaChars} characters, ~${Math.ceil(presentTool.schemaChars / 4)} tokens)` : ""}
          </summary>
          <p className="muted">Component signatures live in the tool description; the input schema is a small recursive node type plus a program string.</p>
          <pre>{JSON.stringify(agentable?.getResident().find((t) => t.name === "present")?.inputSchema ?? {}, null, 2)}</pre>
          <h3>Catalog entries in the registry</h3>
          <pre>{JSON.stringify(agentable?.catalog().map((c) => ({ id: c.id, component: c.render.component, tier: c.tier })) ?? [], null, 2)}</pre>
        </details>
        <details className="under">
          <summary>Call log{log.length ? ` (${log.length})` : ""}</summary>
          {log.length ? <pre className="log">{log.join("\n")}</pre> : <p className="muted">No calls yet.</p>}
        </details>
      </section>
    </div>
  );
}

/** A model streams a program; the Renderer draws each line as it lands. */
function StreamSection({ data }: { data: Record<string, unknown> }) {
  const [pick, setPick] = useState(0);
  const [shown, setShown] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [started, setStarted] = useState(false);
  const [errors, setErrors] = useState<RendererError[]>([]);
  const [said, setSaid] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const program = PROGRAMS[pick]!.program;

  const stream = (i: number) => {
    if (timer.current) window.clearInterval(timer.current);
    setPick(i);
    setSaid(null);
    setShown("");
    setStarted(true);
    setStreaming(true);
    const text = PROGRAMS[i]!.program;
    const started = performance.now();
    const charsPerSecond = 260; // about what a fast model streams, so the demo is honest about pace
    timer.current = window.setInterval(() => {
      const at = Math.min(text.length, Math.floor(((performance.now() - started) / 1000) * charsPerSecond));
      setShown(text.slice(0, at));
      if (at >= text.length) {
        if (timer.current) window.clearInterval(timer.current);
        timer.current = null;
        setStreaming(false);
      }
    }, 40);
  };
  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  const parsed = useMemo(() => library.parse(program), [program]);
  const json = useMemo(() => (parsed.root ? JSON.stringify({ root: parsed.root }) : ""), [parsed]);
  const programTokens = estimateTokens(program.length);
  const jsonTokens = estimateTokens(json.length);
  const saving = jsonTokens ? Math.round((1 - programTokens / jsonTokens) * 100) : 0;
  const response = started ? shown : program;
  const lines = response.split("\n").filter((l) => l.trim()).length;

  return (
    <section className="section">
      <h2>Watch an answer become an interface</h2>
      <p className="muted">
        Pick a question. The model's reply streams on the right as Agentable Lang; <code>&lt;Renderer&gt;</code> draws each complete line on the left, drops what is wrong, and wires buttons to real tools.
      </p>
      <div className="chips" role="group" aria-label="Example asks">
        {PROGRAMS.map((p, i) => (
          <button key={p.label} type="button" className="chip" aria-pressed={pick === i && started} onClick={() => stream(i)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="stream-grid">
        <div className="thread">
          <div className="turn-user">{PROGRAMS[pick]!.ask}</div>
          <div className="turn-assistant">
            <div className="turn-status" data-live={streaming ? "" : undefined}>
              <i />
              {streaming ? (
                <span>
                  Streaming · <b>{lines}</b> {lines === 1 ? "line" : "lines"} rendered so far
                </span>
              ) : started ? (
                <span>
                  Done · <b>{lines}</b> lines · interactive
                </span>
              ) : (
                <span>Press an example to stream it</span>
              )}
            </div>
            <Renderer
              components={uiCatalog}
              library={library}
              response={response}
              isStreaming={streaming}
              data={data}
              onError={setErrors}
              onMessage={(text) => setSaid(text)}
              placeholder={<span className="muted">Nothing yet.</span>}
            />
            {said ? (
              <p className="turn-said" role="status">
                Sent to the assistant: “{said}”
              </p>
            ) : null}
            {errors.length ? (
              <ul className="stream-errors">
                {errors.map((e, i) => (
                  <li key={i}>
                    {e.line ? `line ${e.line}: ` : e.path ? `${e.path}: ` : ""}
                    {e.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <div>
          <div className="program-panel">
            <header>
              <b>model output · Agentable Lang</b>
              <span>{response.length} chars</span>
            </header>
            <pre data-streaming={streaming ? "" : undefined}>{response}</pre>
          </div>
          <div className="stats-row">
            <span className="stat-pill">
              program <b>~{programTokens}</b> tokens
            </span>
            <span className="stat-pill">
              same tree as JSON <b>~{jsonTokens}</b>
            </span>
            {saving > 0 ? (
              <span className="stat-pill" data-good="">
                <b>{saving}%</b> fewer
              </span>
            ) : null}
          </div>
          <details className="under">
            <summary>The system prompt a model gets for this catalog (~{estimateTokens(library.prompt().length)} tokens)</summary>
            <pre className="log">{library.prompt({ tools: [{ name: "refund_order", description: "Refund a paid order in full." }] })}</pre>
          </details>
        </div>
      </div>
    </section>
  );
}

/** The first validation issue in plain words, e.g. "root.props.value: is required". */
function rejection(out: string): string {
  try {
    const r = JSON.parse(out) as { error?: string; issues?: Array<{ path: string; message: string }> };
    const issue = r.issues?.[0];
    const text = issue ? `${issue.path}: ${issue.message}` : (r.error ?? out);
    return text.length > 160 ? `${text.slice(0, 157)}...` : text;
  } catch {
    return out.slice(0, 160);
  }
}
