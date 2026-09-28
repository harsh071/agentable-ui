import { useMemo, useState } from "react";
import { ToolScope, useTool } from "@agentable-ui/react";
import { ActionBar, Combobox, DataTable, Dialog, Field, Filters, Form, Pagination, Tabs, applyFilters, toast, type Column, type FilterValues } from "@agentable-ui/ui";
import { customers, integrations, makeOrders, type Order } from "../data.js";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export function DemoPage() {
  const [orders, setOrders] = useState<Order[]>(() => makeOrders());
  const [filters, setFilters] = useState<FilterValues>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [customer, setCustomer] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => applyFilters(orders as unknown as Record<string, unknown>[], filters) as unknown as Order[], [orders, filters]);

  const columns: Column<Order>[] = [
    { key: "id", header: "Order", describe: "order id" },
    { key: "customer", header: "Customer" },
    { key: "email", header: "Email", agentHidden: true },
    { key: "total", header: "Total", align: "right", render: (o) => money(o.total), describe: "USD" },
    { key: "status", header: "Status", render: (o) => <span className="status-badge" data-status={o.status}>{o.status}</span> },
    { key: "region", header: "Region" },
    { key: "items", header: "Items", align: "right" },
    { key: "placedAt", header: "Placed", describe: "YYYY-MM-DD" },
  ];

  const update = (ids: string[], patch: Partial<Order>, verb: string) => {
    if (!ids.length) throw new Error("Select at least one order first.");
    setOrders((os) => os.map((o) => (ids.includes(o.id) ? { ...o, ...patch } : o)));
    toast({ title: `${verb} ${ids.length} order${ids.length === 1 ? "" : "s"}`, kind: "success" });
    return { updated: ids };
  };

  const stats = useMemo(() => {
    const revenue = orders.filter((o) => o.status === "paid" || o.status === "shipped").reduce((n, o) => n + o.total, 0);
    return { revenue, count: orders.length, pending: orders.filter((o) => o.status === "pending").length, refunded: orders.filter((o) => o.status === "refunded").length };
  }, [orders]);

  useTool({
    name: "get_dashboard_stats",
    group: "orders",
    description: "Totals for the orders dashboard: revenue, order count, pending and refunded counts.",
    annotations: { readOnlyHint: true },
    cache: { ttl: 10_000, tags: ["orders"] },
    execute: () => ({ ...stats, revenue: Math.round(stats.revenue * 100) / 100 }),
  });

  return (
    <div className="dash">
      <div className="dash-header">
        <div>
          <h1>Orders dashboard</h1>
          <p className="muted">
            A normal-looking dashboard where every component is also usable by an AI assistant. The page declares over a hundred tools, but only twelve or fewer are live at once (see the counter top right).
          </p>
          <ol className="try">
            <li>
              Press <kbd>Alt</kbd>+<kbd>A</kbd> to open the agent panel.
            </li>
            <li>
              Go to <b>Console</b>, pick <code>query_orders</code>, and send <code>{`{"query": "Ada"}`}</code>. The table filters itself.
            </li>
            <li>
              Try <code>run_order_action</code> with <code>{`{"action": "refund"}`}</code> after selecting a row: you'll be asked to allow it first.
            </li>
          </ol>
        </div>
        <div className="row">
          <Dialog
            open={invoiceOpen}
            onOpenChange={setInvoiceOpen}
            title="Create invoice"
            description="Invoices are sent to the customer's email on file."
            agent={{ name: "invoice_dialog", group: "billing" }}
            trigger={(open) => (
              <button type="button" data-agentable-button="primary" onClick={open}>
                New invoice
              </button>
            )}
          >
            <Form
              agent={{ name: "create_invoice", group: "billing", title: "Create invoice", invalidates: ["orders"] }}
              onSubmit={(values) => {
                toast({ title: "Invoice created", description: `${String(values.customer)} · ${money(Number(values.amountCents) / 100)}`, kind: "success" });
                setInvoiceOpen(false);
                return { invoiceId: `INV-${Math.floor(Math.random() * 9000 + 1000)}` };
              }}
              submitLabel="Create invoice"
            >
              <Field name="customer" label="Customer" required describe="Customer's legal name" />
              <Field name="amountCents" label="Amount (cents)" type="integer" min={1} required describe="Amount in cents" />
              <Field name="memo" label="Memo" type="textarea" describe="Optional note shown on the invoice" maxLength={200} />
              <Field name="sendNow" label="Send immediately" type="boolean" describe="Email the invoice on creation" />
            </Form>
          </Dialog>
        </div>
      </div>

      <ToolScope group="orders" describe="Order list: query, filter, select, and act on orders" className="section">
        <h2>Orders</h2>
        <p className="muted">One query tool for the whole table, one fan-in tool for eight actions, one tool for six filters.</p>
        <Filters
          value={filters}
          onChange={(v) => {
            setFilters(v);
            setPage(1);
          }}
          noun="orders"
          agent={{ name: "set_order_filters" }}
          filters={[
            { id: "status", label: "Status", type: "select", options: ["pending", "paid", "shipped", "refunded", "cancelled"].map((s) => ({ value: s })), describe: "order status" },
            { id: "region", label: "Region", type: "select", options: ["NA", "EU", "APAC", "LATAM"].map((s) => ({ value: s })) },
            { id: "customer", label: "Customer", type: "text", placeholder: "Name contains", describe: "substring of the customer name" },
            { id: "total", label: "Total", type: "range", min: 0, describe: "USD range {min,max}" },
            { id: "items", label: "Items", type: "range", min: 1, max: 6 },
            { id: "placedAt", label: "Placed on", type: "date" },
          ]}
        />
        <div style={{ height: 14 }} />
        <ActionBar
          agent={{ name: "run_order_action", title: "Order actions", description: "Act on the selected orders (select them with the table's select tool first)." }}
          actions={[
            { id: "mark_paid", label: "Mark paid", describe: "Set selected orders to paid", onAction: () => update(selected, { status: "paid" }, "Marked paid"), disabled: !selected.length },
            { id: "ship", label: "Ship", describe: "Set selected orders to shipped", onAction: () => update(selected, { status: "shipped" }, "Shipped"), disabled: !selected.length },
            { id: "refund", label: "Refund", describe: "Refund selected orders", destructive: true, onAction: () => update(selected, { status: "refunded" }, "Refunded"), disabled: !selected.length },
            { id: "cancel", label: "Cancel", describe: "Cancel selected orders", destructive: true, onAction: () => update(selected, { status: "cancelled" }, "Cancelled"), disabled: !selected.length },
            { id: "resend_receipt", label: "Resend receipt", describe: "Email receipts for selected orders", onAction: () => { toast({ title: `Receipts sent for ${selected.length} orders` }); return { sent: selected }; }, disabled: !selected.length },
            { id: "export_csv", label: "Export CSV", describe: "Download the filtered orders as CSV", onAction: () => { toast({ title: `Exported ${filtered.length} orders` }); return { rows: filtered.length }; } },
            { id: "clear_selection", label: "Clear selection", describe: "Deselect all orders", onAction: () => { setSelected([]); return { selected: [] }; }, disabled: !selected.length },
            { id: "reset_filters", label: "Reset filters", describe: "Remove all filters", onAction: () => { setFilters({}); return { filters: {} }; } },
          ]}
        />
        <div style={{ height: 14 }} />
        <DataTable
          columns={columns}
          rows={filtered}
          noun="orders"
          selectable
          selected={selected}
          onSelectionChange={setSelected}
          pageSize={12}
          agent={{ name: "query_orders", project: ["id", "customer", "total", "status", "region"], cache: { ttl: 30_000, tags: ["orders"] } }}
        />
      </ToolScope>

      <ToolScope group="customers" describe="Customer picker and account details" className="section">
        <h2>Customer</h2>
        <p className="muted">A combobox exposes one tool that both searches and selects.</p>
        <div className="row">
          <div style={{ width: 320 }}>
            <Combobox label="Account" options={customers} value={customer} onChange={setCustomer} noun="customer" agent={{ name: "choose_customer" }} placeholder="Search customers..." />
          </div>
          {customer ? <span className="muted">Selected: {customers.find((c) => c.value === customer)?.label}</span> : null}
        </div>
      </ToolScope>

      <ToolScope group="settings" describe="Workspace settings: profile, notifications, and integrations" className="section">
        <h2>Settings</h2>
        <p className="muted">Tabs unmount inactive panels, so only the visible tab's tools exist. The integrations tab declares sixty tier-1 tools that stay out of the way until opened.</p>
        <Tabs
          agent={{ name: "settings_tab" }}
          tabs={[
            {
              value: "profile",
              label: "Profile",
              content: (
                <Form agent={{ name: "update_profile", title: "Update profile" }} onSubmit={(v) => { toast({ title: "Profile saved", description: String(v.company ?? "") }); return { saved: true }; }} submitLabel="Save" defaultValues={{ company: "Acme Inc", timezone: "UTC", weeklyDigest: true }}>
                  <Field name="company" label="Company" required describe="Company display name" />
                  <Field name="timezone" label="Timezone" type="select" options={["UTC", "America/New_York", "Europe/Berlin", "Asia/Tokyo"].map((v) => ({ value: v }))} describe="IANA timezone" />
                  <Field name="weeklyDigest" label="Weekly digest email" type="boolean" />
                </Form>
              ),
            },
            {
              value: "notifications",
              label: "Notifications",
              content: (
                <Form agent={{ name: "update_notifications", title: "Update notifications" }} onSubmit={() => { toast({ title: "Notification settings saved" }); return { saved: true }; }} submitLabel="Save">
                  <Field name="orderPaid" label="Order paid" type="boolean" describe="Notify when an order is paid" />
                  <Field name="orderRefunded" label="Order refunded" type="boolean" />
                  <Field name="dailySummary" label="Daily summary" type="boolean" />
                  <Field name="channel" label="Channel" type="select" options={[{ value: "email" }, { value: "slack" }, { value: "sms" }]} describe="Where notifications go" />
                </Form>
              ),
            },
            {
              value: "integrations",
              label: "Integrations",
              describe: "20 integrations, 3 tools each",
              content: <Integrations />,
            },
          ]}
        />
      </ToolScope>

      <div className="tall-spacer">Scroll past this and watch the tool counter: sections that stay offscreen for five seconds step back (tier 1), and return instantly when you scroll up.</div>

      <ToolScope group="reports" describe="Reports archive with pagination" className="section">
        <h2>Reports</h2>
        <p className="muted">Pagination exposes a single page tool.</p>
        <ReportList page={page} onPageChange={setPage} />
      </ToolScope>
    </div>
  );
}

function ReportList({ page, onPageChange }: { page: number; onPageChange: (p: number) => void }) {
  const pageCount = 9;
  const reports = Array.from({ length: 5 }, (_, i) => `Report ${(page - 1) * 5 + i + 1}: weekly revenue by region`);
  return (
    <div>
      <ul>
        {reports.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <Pagination page={page} pageCount={pageCount} onPageChange={onPageChange} noun="reports" agent={{ name: "reports_page" }} />
    </div>
  );
}

function Integrations() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  return (
    <div className="integrations">
      {integrations.map((name) => (
        <IntegrationCard key={name} name={name} enabled={!!enabled[name]} onToggle={(v) => setEnabled((e) => ({ ...e, [name]: v }))} />
      ))}
    </div>
  );
}

function IntegrationCard({ name, enabled, onToggle }: { name: string; enabled: boolean; onToggle: (v: boolean) => void }) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const group = `integration_${slug}`;
  useTool({ name: `${slug}_status`.slice(0, 30), group, tier: 1, description: `Whether the ${name} integration is enabled.`, annotations: { readOnlyHint: true }, execute: () => ({ name, enabled }) });
  useTool({ name: `${slug}_enable`.slice(0, 30), group, tier: 1, description: `Enable the ${name} integration.`, annotations: { consequentialHint: true }, execute: () => { onToggle(true); toast({ title: `${name} enabled`, source: "agent" }); return { enabled: true }; } });
  useTool({ name: `${slug}_disable`.slice(0, 30), group, tier: 1, description: `Disable the ${name} integration.`, annotations: { consequentialHint: true }, execute: () => { onToggle(false); toast({ title: `${name} disabled`, source: "agent" }); return { enabled: false }; } });
  return (
    <div className="integration">
      <span>
        {name}
        <br />
        <small>{enabled ? "Connected" : "Not connected"}</small>
      </span>
      <button type="button" data-agentable-button={enabled ? "" : "primary"} onClick={() => onToggle(!enabled)}>
        {enabled ? "Disable" : "Enable"}
      </button>
    </div>
  );
}
