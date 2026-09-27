import { useMemo, useState } from "react";
import { useAgentable, useAgentableSnapshot, useTool } from "@agentable-ui/react";
import { AgentSurface, type PresentArgs } from "@agentable-ui/genui";
import { uiCatalog, toast } from "@agentable-ui/ui";
import { makeOrders, type Order } from "../data.js";

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
          <p className="muted">
            <code>&lt;AgentSurface&gt;</code> registers a <code>present</code> tool. Its schema is generated from the catalog below and every spec is validated before it renders. Nodes can bind to app data, keep their own <code>ui.*</code> state, and call registered tools, which confirm exactly as they would for an agent.
          </p>
        </div>
      </div>

      <section className="section">
        <h2>Agent surface</h2>
        <p className="muted">Simulate an agent calling <code>present</code>, or use the devtools console to hand-write a spec.</p>
        <div className="samples">
          {SAMPLES.map((s) => (
            <button key={s.label} type="button" data-agentable-button="" onClick={() => void present(s)}>
              {s.label}
            </button>
          ))}
        </div>
        <AgentSurface components={uiCatalog} data={data} placeholder={<span>Nothing presented yet. Click a sample above.</span>} />
      </section>

      <section className="section">
        <h2>What the agent sees</h2>
        <p className="muted">
          The <code>present</code> tool costs {presentTool ? `${presentTool.schemaChars} characters (~${Math.ceil(presentTool.schemaChars / 4)} tokens)` : "nothing until mounted"}. Component prop signatures live in the description; the input schema is a small recursive node type.
        </p>
        <pre>{JSON.stringify(agentable?.getResident().find((t) => t.name === "present")?.inputSchema ?? {}, null, 2)}</pre>
        <h3>Catalog entries in the registry</h3>
        <pre>{JSON.stringify(agentable?.catalog().map((c) => ({ id: c.id, component: c.render.component, tier: c.tier })) ?? [], null, 2)}</pre>
      </section>

      <section className="section">
        <h2>Call log</h2>
        {log.length ? <pre className="log">{log.join("\n")}</pre> : <p className="muted">No calls yet.</p>}
      </section>
    </div>
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
