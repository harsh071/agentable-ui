import { useState } from "react";
import { useAgentable, useAgentableSnapshot } from "@agentable/react";
import { AgentSurface, type UISpec } from "@agentable/genui";
import { uiCatalog, toast } from "@agentable/ui";

const SAMPLES: Array<{ label: string; title?: string; root: UISpec }> = [
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

  const present = async (sample: (typeof SAMPLES)[number]) => {
    if (!agentable) return;
    const out = await agentable.invoke("present", { root: sample.root, title: sample.title }, { adapter: "playground" });
    setLog((l) => [`present(${sample.label}) -> ${out}`, ...l].slice(0, 8));
    if (out.includes('"error"')) toast({ title: "present rejected the spec", description: out.slice(0, 160), kind: "warning", source: "agent" });
  };

  const presentTool = snapshot.resident.find((t) => t.name === "present");

  return (
    <div className="dash">
      <div className="dash-header">
        <div>
          <h1>Playground</h1>
          <p className="muted">
            <code>&lt;AgentSurface&gt;</code> registers one <code>present</code> tool. Its schema is generated from the catalog below and every spec is validated before it renders.
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
        <AgentSurface components={uiCatalog} placeholder={<span>Nothing presented yet. Click a sample above.</span>} />
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
        {log.length ? <pre>{log.join("\n")}</pre> : <p className="muted">No calls yet.</p>}
      </section>
    </div>
  );
}
