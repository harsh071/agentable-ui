import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ToolScope, useTool } from "@agentable-ui/react";
import {
  ActionBar, Badge, Button, Callout, Card, Chart, Checkbox, Checklist, Combobox, DataTable, Dialog, Divider, Field, Filters, Form, Grid,
  Image, ItemList, KeyValue, LinkCard, List, Pagination, Progress, RecordTable, Select, SimpleTable, Stack, Stat, StatGroup, Tabs, Text,
  TextInput, Timeline, applyFilters, toast, uiCatalog, type ChecklistItem, type Column, type FilterValues,
} from "@agentable-ui/ui";
import { CodeBlock } from "./Docs.js";
import { customers, makeOrders, type Order } from "../data.js";

interface Entry {
  id: string;
  group: "Agent-callable" | "Layout" | "Display" | "Collections" | "Inputs";
  summary: string;
  /** What the component gives an agent. */
  agent: string;
  code: string;
  demo: () => ReactNode;
  /** Hand-written props for components outside the generative catalog. */
  props?: Array<[name: string, type: string, note?: string]>;
}

const GROUPS: Entry["group"][] = ["Agent-callable", "Layout", "Display", "Collections", "Inputs"];
const CATALOG_NOTE = "In the generative catalog: an agent can render it through AgentSurface or Agentable Lang.";

const orders = makeOrders(24);
const orderColumns: Column<Order>[] = [
  { key: "id", header: "Order" },
  { key: "customer", header: "Customer" },
  { key: "total", header: "Total", align: "right", render: (o) => `$${o.total.toFixed(2)}`, describe: "USD" },
  { key: "status", header: "Status" },
];

const ENTRIES: Entry[] = [
  // Agent-callable: these register tools when given an `agent` prop.
  {
    id: "DataTable", group: "Agent-callable",
    summary: "Searchable, sortable, paged table with optional row selection.",
    agent: "One tool to search, sort and page rows; with `selectable`, the agent can select rows too.",
    props: [["columns", "Column<Row>[]"], ["rows", "Row[]"], ["selectable", "boolean"], ["pageSize", "number"], ["noun", "string", "Used in the tool description"], ["agent", "AgentProp"]],
    code: `<DataTable
  columns={columns}
  rows={orders}
  noun="orders"
  pageSize={5}
  agent={{ name: "query_orders" }}
/>`,
    demo: () => <DataTable columns={orderColumns} rows={orders} noun="orders" pageSize={5} agent={{ name: "gallery_query_orders" }} />,
  },
  {
    id: "Form", group: "Agent-callable",
    summary: "A form whose fields become the tool's input schema.",
    agent: "One tool that fills and submits the form. Field types, `required` and `describe` become the schema.",
    props: [["onSubmit", "(values, meta) => unknown", "meta.fromAgent tells you who submitted"], ["defaultValues", "FormValues"], ["submitLabel", "string"], ["agent", "AgentProp"]],
    code: `<Form agent={{ name: "invite_user" }} onSubmit={(v) => invite(v)} submitLabel="Send invite">
  <Field name="email" label="Email" type="email" required />
  <Field name="role" label="Role" type="select" options={[{ value: "admin" }, { value: "member" }]} />
</Form>`,
    demo: () => (
      <Form agent={{ name: "gallery_invite_user", title: "Invite user" }} submitLabel="Send invite" onSubmit={(v) => { toast({ title: "Invite sent", description: String(v.email), kind: "success" }); return { sent: true }; }}>
        <Field name="email" label="Email" type="email" required describe="Work email of the person to invite" />
        <Field name="role" label="Role" type="select" options={[{ value: "admin" }, { value: "member" }, { value: "viewer" }]} />
      </Form>
    ),
  },
  {
    id: "Combobox", group: "Agent-callable",
    summary: "Searchable single-select picker.",
    agent: "One tool that picks an option by value or by matching its label.",
    props: [["options", "ComboboxOption[]"], ["value", "string | null"], ["onChange", "(value, option) => void"], ["noun", "string"], ["agent", "AgentProp"]],
    code: `<Combobox label="Customer" options={customers} value={value} onChange={setValue} noun="customer" agent={{ name: "choose_customer" }} />`,
    demo: () => <ComboboxDemo />,
  },
  {
    id: "Filters", group: "Agent-callable",
    summary: "Select, text, boolean, range and date filters in one bar.",
    agent: "One tool that sets any filter. Pair with `applyFilters(rows, values)`.",
    props: [["filters", "FilterDef[]"], ["value", "FilterValues"], ["onChange", "(values) => void"], ["noun", "string"], ["agent", "AgentProp"]],
    code: `<Filters
  noun="orders"
  value={filters}
  onChange={setFilters}
  agent={{ name: "set_order_filters" }}
  filters={[
    { id: "status", label: "Status", type: "select", options: [{ value: "paid" }, { value: "pending" }] },
    { id: "total", label: "Total", type: "range", min: 0 },
  ]}
/>`,
    demo: () => <FiltersDemo />,
  },
  {
    id: "ActionBar", group: "Agent-callable",
    summary: "A row of buttons. Destructive actions ask before running.",
    agent: "One tool with an `action` enum (fan-in), or one tool per action with `fanIn: false`.",
    props: [["actions", "Action[]"], ["agent", "AgentProp & { fanIn?: boolean }"]],
    code: `<ActionBar
  agent={{ name: "run_action" }}
  actions={[
    { id: "archive", label: "Archive", onAction: archive },
    { id: "delete", label: "Delete", destructive: true, onAction: remove },
  ]}
/>`,
    demo: () => (
      <ActionBar
        agent={{ name: "gallery_run_action" }}
        actions={[
          { id: "archive", label: "Archive", onAction: () => toast({ title: "Archived" }) },
          { id: "duplicate", label: "Duplicate", onAction: () => toast({ title: "Duplicated" }) },
          { id: "delete", label: "Delete", destructive: true, variant: "danger", onAction: () => toast({ title: "Deleted", kind: "error" }) },
        ]}
      />
    ),
  },
  {
    id: "Dialog", group: "Agent-callable",
    summary: "A modal. Tools declared inside only exist while it is open.",
    agent: "One tool to open or close it, so the agent can reach the tools inside.",
    props: [["title", "ReactNode"], ["open / defaultOpen", "boolean"], ["onOpenChange", "(open) => void"], ["trigger", "(open) => ReactNode"], ["agent", "AgentProp"]],
    code: `<Dialog
  title="Rename project"
  agent={{ name: "rename_dialog" }}
  trigger={(open) => <Button onClick={open}>Rename</Button>}
>
  <Form agent={{ name: "rename_project" }} onSubmit={rename}>
    <Field name="name" label="Name" required />
  </Form>
</Dialog>`,
    demo: () => <DialogDemo />,
  },
  {
    id: "Tabs", group: "Agent-callable",
    summary: "Tabs whose hidden panels unmount, taking their tools with them.",
    agent: "One tool to switch tabs. Only the active panel's tools are live.",
    props: [["tabs", "Tab[]"], ["value / defaultValue", "string"], ["onValueChange", "(value) => void"], ["agent", "AgentProp"]],
    code: `<Tabs
  agent={{ name: "settings_tab" }}
  tabs={[
    { value: "general", label: "General", content: <General /> },
    { value: "billing", label: "Billing", content: <Billing /> },
  ]}
/>`,
    demo: () => (
      <Tabs
        aria-label="Example tabs"
        agent={{ name: "gallery_tab" }}
        tabs={[
          { value: "overview", label: "Overview", content: <Text text="Tools inside this panel register while it is open." /> },
          { value: "activity", label: "Activity", content: <List items={["Invoice INV-1042 paid", "Ada joined the workspace"]} /> },
          { value: "settings", label: "Settings", content: <CheckboxDemo /> },
        ]}
      />
    ),
  },
  {
    id: "Pagination", group: "Agent-callable",
    summary: "Numbered page buttons with previous and next.",
    agent: "One tool to go to a page number.",
    props: [["page", "number", "1-based"], ["pageCount", "number"], ["onPageChange", "(page) => void"], ["noun", "string"], ["agent", "AgentProp"]],
    code: `<Pagination page={page} pageCount={12} onPageChange={setPage} noun="reports" agent={{ name: "go_to_page" }} />`,
    demo: () => <PaginationDemo />,
  },
  {
    id: "Nav", group: "Agent-callable",
    summary: "Navigation links. The site header uses it.",
    agent: "One tool to navigate. Items with `agentHidden` are left out.",
    props: [["items", "NavItem[]"], ["current", "string"], ["onNavigate", "(href, item) => void"], ["orientation", '"horizontal" | "vertical"'], ["agent", "AgentProp"]],
    code: `<Nav items={[{ href: "#/", label: "Home" }, { href: "#/docs", label: "Docs" }]} current={route} agent={{ name: "navigate" }} />`,
    demo: () => <Text variant="muted" text="See the header at the top of this page: it is a Nav with agent={{ name: 'navigate' }}." />,
  },
  {
    id: "Toaster", group: "Agent-callable",
    summary: "Toast notifications. Call `toast()` from anywhere.",
    agent: "One read tool so the agent can see recent notifications.",
    props: [["position", "string"], ["agent", "AgentProp"]],
    code: `<Toaster agent={{ name: "read_notifications" }} />

toast({ title: "Saved", kind: "success" });`,
    demo: () => (
      <Stack direction="row">
        <Button label="Info" onPress={() => toast({ title: "Heads up", description: "Something changed." })} />
        <Button label="Success" variant="primary" onPress={() => toast({ title: "Saved", kind: "success" })} />
        <Button label="Error" variant="danger" onPress={() => toast({ title: "Could not save", kind: "error" })} />
      </Stack>
    ),
  },

  // Layout
  { id: "Card", group: "Layout", summary: "A titled container.", agent: CATALOG_NOTE, code: `<Card title="Plan" subtitle="Renews Nov 1">…</Card>`, demo: () => <Card title="Pro plan" subtitle="Renews Nov 1"><Text text="5 seats · $60/month" /></Card> },
  { id: "Stack", group: "Layout", summary: "Children in a row or column.", agent: CATALOG_NOTE, code: `<Stack direction="row">…</Stack>`, demo: () => <Stack direction="row"><Badge text="One" /><Badge text="Two" /><Badge text="Three" /></Stack> },
  { id: "Grid", group: "Layout", summary: "2-4 equal columns that stack on narrow screens.", agent: CATALOG_NOTE, code: `<Grid columns={3}>…</Grid>`, demo: () => <Grid columns={3}><Card title="North" /><Card title="South" /><Card title="West" /></Grid> },
  { id: "Divider", group: "Layout", summary: "A rule between sections.", agent: CATALOG_NOTE, code: `<Divider />`, demo: () => <><Text text="Above" /><Divider /><Text text="Below" /></> },

  // Display
  { id: "Text", group: "Display", summary: "Body, muted, heading or code text.", agent: CATALOG_NOTE, code: `<Text variant="heading" text="August summary" />`, demo: () => <><Text variant="heading" text="August summary" /><Text text="Revenue grew in every region." /><Text variant="muted" text="Updated 2 minutes ago" /><Text variant="code" text="npm i @agentable-ui/ui" /></> },
  { id: "Stat", group: "Display", summary: "One metric with an optional delta and trend.", agent: CATALOG_NOTE, code: `<Stat label="Revenue" value="$48.2k" delta="+12%" trend="up" />`, demo: () => <Stat label="Revenue" value="$48.2k" delta="+12%" trend="up" /> },
  { id: "StatGroup", group: "Display", summary: "Several Stats in a row.", agent: CATALOG_NOTE, code: `<StatGroup>\n  <Stat label="Orders" value={312} />\n  <Stat label="Refunds" value={4} trend="down" delta="-2" />\n</StatGroup>`, demo: () => <StatGroup><Stat label="Orders" value={312} delta="+18" trend="up" /><Stat label="Refunds" value={4} delta="-2" trend="down" /><Stat label="Avg. order" value="$154" trend="flat" delta="0%" /></StatGroup> },
  { id: "Callout", group: "Display", summary: "An info, success, warning or error note.", agent: CATALOG_NOTE, code: `<Callout kind="warning" title="Card expiring" text="Update it before Nov 1." />`, demo: () => <><Callout kind="info" text="Exports run nightly." /><Callout kind="success" title="Paid" text="Invoice INV-1042 was paid." /><Callout kind="warning" title="Card expiring" text="Update it before Nov 1." /><Callout kind="error" title="Sync failed" text="Shopify returned 503." /></> },
  { id: "Badge", group: "Display", summary: "A small status label.", agent: CATALOG_NOTE, code: `<Badge text="Paid" kind="success" />`, demo: () => <Stack direction="row">{(["neutral", "info", "success", "warning", "danger", "accent"] as const).map((k) => <Badge key={k} text={k} kind={k} />)}</Stack> },
  { id: "Progress", group: "Display", summary: "A progress bar.", agent: CATALOG_NOTE, code: `<Progress label="Onboarding" value={3} max={5} />`, demo: () => <Progress label="Onboarding" value={3} max={5} /> },
  { id: "KeyValue", group: "Display", summary: "Key/value pairs.", agent: CATALOG_NOTE, code: `<KeyValue items={[{ key: "Plan", value: "Pro" }]} />`, demo: () => <KeyValue items={[{ key: "Plan", value: "Pro" }, { key: "Seats", value: 5 }, { key: "Renews", value: "Nov 1, 2026" }]} /> },
  { id: "Chart", group: "Display", summary: "Bar, line or area chart over a category axis.", agent: CATALOG_NOTE, code: `<Chart kind="bar" x="month" series={["revenue"]} data={rows} />`, demo: () => <ChartDemo /> },
  { id: "Image", group: "Display", summary: "An https image with a caption.", agent: CATALOG_NOTE, code: `<Image src="https://…" alt="…" caption="…" />`, demo: () => <Image src="https://picsum.photos/seed/agentable/640/280" alt="Sample landscape photo" caption="Images must be https." /> },
  { id: "LinkCard", group: "Display", summary: "A link shown as a card.", agent: CATALOG_NOTE, code: `<LinkCard href="https://…" title="…" description="…" />`, demo: () => <LinkCard href="https://rui.interfacesforhuman.com" title="RUI" description="Checks what a generated interface does, in a real browser." /> },

  // Collections
  { id: "List", group: "Collections", summary: "Bulleted or numbered list.", agent: CATALOG_NOTE, code: `<List ordered items={["Connect Stripe", "Import orders"]} />`, demo: () => <List ordered items={["Connect Stripe", "Import orders", "Invite your team"]} /> },
  { id: "SimpleTable", group: "Collections", summary: "A small static table.", agent: CATALOG_NOTE, code: `<SimpleTable columns={["Region", "Orders"]} rows={[["NA", 120]]} />`, demo: () => <SimpleTable caption="Orders by region" columns={["Region", "Orders", "Revenue"]} rows={[["NA", 120, "$18.2k"], ["EU", 88, "$13.1k"], ["APAC", 64, "$9.7k"]]} /> },
  { id: "RecordTable", group: "Collections", summary: "A table of records with row select.", agent: CATALOG_NOTE, code: `<RecordTable columns={[{ key: "id", label: "Order" }]} rows={orders} onSelect={open} />`, demo: () => <RecordTable columns={[{ key: "id", label: "Order" }, { key: "customer", label: "Customer" }, { key: "status", label: "Status" }]} rows={orders.slice(0, 4) as unknown as Record<string, unknown>[]} onSelect={(r) => toast({ title: `Selected ${String(r.id)}` })} /> },
  { id: "Checklist", group: "Collections", summary: "Checkable items with toggle and remove.", agent: CATALOG_NOTE, code: `<Checklist title="Launch" items={items} onToggle={toggle} onRemove={remove} />`, demo: () => <ChecklistDemo /> },
  { id: "ItemList", group: "Collections", summary: "Rows with title, subtitle, meta and badge.", agent: CATALOG_NOTE, code: `<ItemList items={[{ id: 1, title: "Ada Lovelace", subtitle: "ada@example.com", badge: "Admin" }]} onSelect={open} />`, demo: () => <ItemList items={customers.slice(0, 4).map((c, i) => ({ id: c.value, title: c.label, subtitle: c.description, badge: i === 0 ? "Admin" : undefined, meta: `${3 + i} orders` }))} onSelect={(item) => toast({ title: `Selected ${item.title}` })} /> },
  { id: "Timeline", group: "Collections", summary: "Time-ordered steps or events.", agent: CATALOG_NOTE, code: `<Timeline items={[{ time: "09:00", title: "Order placed", done: true }]} />`, demo: () => <Timeline items={[{ time: "Oct 18", title: "Order placed", done: true }, { time: "Oct 19", title: "Payment captured", detail: "Visa •••• 4242", done: true }, { time: "Oct 21", title: "Shipped" }, { time: "Oct 24", title: "Delivered" }]} /> },

  // Inputs
  { id: "Button", group: "Inputs", summary: "A button. The label says what happens.", agent: CATALOG_NOTE, code: `<Button label="Save" variant="primary" onPress={save} />`, demo: () => <Stack direction="row"><Button label="Default" /><Button label="Primary" variant="primary" /><Button label="Danger" variant="danger" /><Button label="Ghost" variant="ghost" /><Button label="Loading" loading /></Stack> },
  { id: "TextInput", group: "Inputs", summary: "A labelled text, number, email or date input.", agent: CATALOG_NOTE, code: `<TextInput label="Company" value={v} onChange={setV} />`, demo: () => <TextInputDemo /> },
  { id: "Select", group: "Inputs", summary: "A labelled dropdown.", agent: CATALOG_NOTE, code: `<Select label="Region" options={["NA", "EU"]} value={v} onChange={setV} />`, demo: () => <SelectDemo /> },
  { id: "Checkbox", group: "Inputs", summary: "A labelled checkbox.", agent: CATALOG_NOTE, code: `<Checkbox label="Send receipt" checked={v} onChange={setV} />`, demo: () => <CheckboxDemo /> },
];

function ComboboxDemo() {
  const [value, setValue] = useState<string | null>(null);
  return <Combobox label="Customer" options={customers} value={value} onChange={setValue} noun="customer" placeholder="Search customers..." agent={{ name: "gallery_choose_customer" }} />;
}

function FiltersDemo() {
  const [filters, setFilters] = useState<FilterValues>({});
  const count = applyFilters(orders, filters).length;
  return (
    <>
      <Filters
        noun="orders"
        value={filters}
        onChange={setFilters}
        agent={{ name: "gallery_set_filters" }}
        filters={[
          { id: "status", label: "Status", type: "select", options: ["pending", "paid", "shipped", "refunded", "cancelled"].map((value) => ({ value })) },
          { id: "customer", label: "Customer", type: "text", placeholder: "Name contains" },
          { id: "total", label: "Total", type: "range", min: 0 },
        ]}
      />
      <Text variant="muted" text={`${count} of ${orders.length} orders match.`} />
    </>
  );
}

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen} title="Rename project" description="Shown to everyone in the workspace." agent={{ name: "gallery_rename_dialog" }} trigger={(o) => <Button label="Rename project" onPress={o} />}>
      <Form agent={{ name: "gallery_rename_project" }} defaultValues={{ name: "Orders" }} submitLabel="Rename" onSubmit={(v) => { toast({ title: `Renamed to ${String(v.name)}`, kind: "success" }); setOpen(false); return { renamed: true }; }}>
        <Field name="name" label="Name" required />
      </Form>
    </Dialog>
  );
}

function PaginationDemo() {
  const [page, setPage] = useState(3);
  return <Pagination page={page} pageCount={12} onPageChange={setPage} noun="reports" agent={{ name: "gallery_go_to_page" }} />;
}

function ChartDemo() {
  const [kind, setKind] = useState<"bar" | "line" | "area">("bar");
  const data = [
    { month: "May", revenue: 32, refunds: 3 }, { month: "Jun", revenue: 38, refunds: 4 }, { month: "Jul", revenue: 35, refunds: 2 },
    { month: "Aug", revenue: 44, refunds: 5 }, { month: "Sep", revenue: 48, refunds: 3 }, { month: "Oct", revenue: 52, refunds: 4 },
  ];
  return (
    <>
      <Select label="Kind" options={["bar", "line", "area"]} value={kind} onChange={(v) => setKind(v as typeof kind)} />
      <Chart kind={kind} title="Revenue and refunds ($k)" x="month" series={["revenue", "refunds"]} data={data} />
    </>
  );
}

function ChecklistDemo() {
  const [items, setItems] = useState<ChecklistItem[]>([
    { id: 1, text: "Connect Stripe", done: true },
    { id: 2, text: "Import last month's orders", done: false, note: "CSV or API" },
    { id: 3, text: "Invite your team", done: false },
  ]);
  return (
    <Checklist
      title="Launch checklist"
      items={items}
      onToggle={(item) => setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)))}
      onRemove={(item) => setItems((xs) => xs.filter((x) => x.id !== item.id))}
      empty="All done."
    />
  );
}

function TextInputDemo() {
  const [v, setV] = useState<string | number>("Acme Inc");
  return <TextInput label="Company" value={v} onChange={setV} placeholder="Company name" />;
}

function SelectDemo() {
  const [v, setV] = useState("EU");
  return <Select label="Region" options={["NA", "EU", "APAC", "LATAM"]} value={v} onChange={setV} />;
}

function CheckboxDemo() {
  const [v, setV] = useState(true);
  return <Checkbox label="Send receipt by email" checked={v} onChange={setV} />;
}

interface SchemaProp { type?: string | string[]; enum?: unknown[]; description?: string }
type CatalogShape = Record<string, { props: { properties?: Record<string, SchemaProp>; required?: string[] }; childrenProp?: string; events?: Record<string, string> }>;

/** Props for catalog components come straight from the catalog's JSON schema, so this table can't drift. */
function catalogProps(id: string): Array<[string, string, string?]> | null {
  const entry = (uiCatalog as unknown as CatalogShape)[id];
  if (!entry) return null;
  const required = new Set(entry.props.required ?? []);
  const rows: Array<[string, string, string?]> = Object.entries(entry.props.properties ?? {}).map(([name, p]) => {
    const type = p.enum ? p.enum.map((v) => JSON.stringify(v)).join(" | ") : Array.isArray(p.type) ? p.type.join(" | ") : (p.type ?? "any");
    return [required.has(name) ? name : `${name}?`, type, p.description];
  });
  if (entry.childrenProp) rows.push([`${entry.childrenProp}?`, "ReactNode"]);
  for (const [event, handler] of Object.entries(entry.events ?? {})) rows.push([`${handler}?`, "function", `"${event}" event`]);
  return rows;
}

export function ComponentsPage({ route, navigate }: { route: string; navigate: (to: string) => void }) {
  const target = route.split("/")[2];
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ENTRIES.filter((e) => `${e.id} ${e.summary} ${e.group}`.toLowerCase().includes(q)) : ENTRIES;
  }, [query]);

  useEffect(() => {
    if (!target) return;
    const frame = requestAnimationFrame(() => document.getElementById(`cmp-${target}`)?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [target]);

  useTool({
    name: "show_component", group: "components", priority: 9,
    description: `Scroll the components gallery to one component. Components: ${ENTRIES.map((e) => e.id).join(", ")}.`,
    inputSchema: { type: "object", properties: { id: { type: "string", enum: ENTRIES.map((e) => e.id) } }, required: ["id"] },
    annotations: { readOnlyHint: false, consequentialHint: false }, confirm: false,
    execute: ({ id }: { id: string }) => {
      const e = ENTRIES.find((x) => x.id === id);
      if (!e) throw new Error(`No component "${id}".`);
      setQuery("");
      navigate(`#/components/${id}`);
      return { shown: id, summary: e.summary, agent: e.agent };
    },
  });

  return (
    <div className="cmp">
      <aside className="cmp-side" aria-label="Components">
        <input className="cmp-search" type="search" placeholder="Filter components" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter components" />
        {GROUPS.map((g) => {
          const items = shown.filter((e) => e.group === g);
          if (!items.length) return null;
          return (
            <nav key={g} aria-label={g}>
              <div className="cmp-group">{g}</div>
              <ul>{items.map((e) => <li key={e.id}><a href={`#/components/${e.id}`} aria-current={target === e.id ? "location" : undefined}>{e.id}</a></li>)}</ul>
            </nav>
          );
        })}
      </aside>
      <div className="cmp-main">
        <header className="cmp-header">
          <span className="demo-eyebrow">AGENTABLE / COMPONENTS</span>
          <h1>Components</h1>
          <p className="muted">
            Every component in <code>@agentable-ui/ui</code>, live. The agent-callable ones register a tool when you pass an <code>agent</code> prop: open devtools (<kbd>Alt</kbd>+<kbd>A</kbd>) to call them. The rest are in the generative catalog that agents render from.
          </p>
        </header>
        {GROUPS.map((g) => {
          const items = shown.filter((e) => e.group === g);
          if (!items.length) return null;
          return (
            <ToolScope key={g} group={`gallery-${g.toLowerCase().replace(/\W+/g, "-")}`} describe={`Components gallery: ${g}`}>
              <h2 className="cmp-group-title">{g}</h2>
              {items.map((e) => <ComponentSection key={e.id} entry={e} />)}
            </ToolScope>
          );
        })}
        {!shown.length ? <p className="muted">No components match “{query}”.</p> : null}
      </div>
    </div>
  );
}

function ComponentSection({ entry }: { entry: Entry }) {
  const props = entry.props ?? catalogProps(entry.id) ?? [];
  return (
    <section className="cmp-item" id={`cmp-${entry.id}`} aria-labelledby={`cmp-${entry.id}-title`}>
      <div className="cmp-item-head">
        <h3 id={`cmp-${entry.id}-title`}><a href={`#/components/${entry.id}`}>{entry.id}</a></h3>
        <p>{entry.summary}</p>
      </div>
      <div className="cmp-preview">{entry.demo()}</div>
      <p className="cmp-agent"><span>Agent</span>{entry.agent}</p>
      <CodeBlock code={`import { ${entry.id} } from "@agentable-ui/ui";\n\n${entry.code}`} />
      {props.length ? (
        <details className="cmp-props">
          <summary>Props</summary>
          <div className="doc-table" tabIndex={0} role="region" aria-label={`${entry.id} props`}>
            <table>
              <thead><tr><th>Prop</th><th>Type</th><th>Notes</th></tr></thead>
              <tbody>{props.map(([name, type, note]) => <tr key={name}><td><code>{name}</code></td><td><code>{type}</code></td><td>{note ?? ""}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}
