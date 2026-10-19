import { useMemo, useState } from "react";
import { ToolScope, useTool } from "@agentable-ui/react";
import { ActionBar, Button, Stat, StatGroup, Combobox, DataTable, Dialog, Field, Filters, Form, Pagination, Tabs, applyQuery, applyFilters, toast, type Column, type TableQuery, type FilterValues } from "@agentable-ui/ui";
import { customers, integrations, makeOrders, type Order } from "../data.js";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export function DemoPage() {
  const [orders, setOrders] = useState<Order[]>(() => makeOrders());
  const [filters, setFilters] = useState<FilterValues>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [customer, setCustomer] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState<TableQuery>({});

  const filtered = useMemo(() => applyFilters(orders, filters), [orders, filters]);

  const columns: Column<Order>[] = [
    { key: "id", header: "Order", describe: "order id" },
    { key: "customer", header: "Customer", render: (o) => <div className="customer-cell"><span className="customer-avatar" aria-hidden="true">{o.customer.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span>{o.customer}<small>{o.email}</small></span></div> },
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
    execute: () => ({ ...stats, revenue: Math.round(stats.revenue * 100) / 100 }),
  });

  return (
    <div className="dash">
      <div className="dash-header">
        <div>
          <span className="demo-eyebrow">WORKSPACE / OVERVIEW</span>
          <h1>Orders dashboard</h1>
          <p className="muted">Your orders, customers, and operations. One workspace for people and agents.</p>
        </div>
        <div className="row">
          <Dialog
            open={invoiceOpen}
            onOpenChange={setInvoiceOpen}
            title="Create invoice"
            description="Invoices are sent to the customer's email on file."
            agent={{ name: "invoice_dialog", group: "billing" }}
            trigger={(open) => (
              <Button variant="primary" onClick={open}><span aria-hidden="true">＋</span> New invoice</Button>
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

      <StatGroup>
        <Stat label="Collected revenue" value={money(stats.revenue)} delta="Paid & shipped orders" />
        <Stat label="Total orders" value={stats.count} delta="Across all regions" />
        <Stat label="Awaiting payment" value={stats.pending} delta="Pending orders" />
        <Stat label="Refunded" value={stats.refunded} delta="Refunded orders" />
      </StatGroup>

      <details className="demo-guide">
        <summary><span className="demo-live-dot" /> This dashboard is agent-ready <span>Try it yourself ↗</span></summary>
        <ol className="try">
          <li>Press <kbd>Alt</kbd>+<kbd>A</kbd> to open the agent panel.</li>
          <li>In <b>Console</b>, call <code>query_orders</code> with <code>{`{"query":"Ada"}`}</code>. The table updates.</li>
          <li>Select a row, then call <code>run_order_action</code> with <code>{`{"action":"refund"}`}</code> to preview confirmation.</li>
        </ol>
        <p className="muted">The registry keeps at most twelve tools live. Inspect the panel to see the full capability index.</p>
      </details>

      <ToolScope group="orders" describe="Order list: query, filter, select, and act on orders" className="section">
        <h2>Orders</h2>
        <p className="muted">Track orders, narrow your results, and take action on a selection.</p>
        <Filters
          value={filters}
          onChange={setFilters}
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
        <ActionBar
          agent={{ name: "run_order_action", invalidates: ["orders"], title: "Order actions", description: "Act on the selected orders (select them with the table's select tool first)." }}
          actions={[
            { id: "mark_paid", label: "Mark paid", describe: "Set selected orders to paid", onAction: () => update(selected, { status: "paid" }, "Marked paid"), disabled: !selected.length },
            { id: "ship", label: "Ship", describe: "Set selected orders to shipped", onAction: () => update(selected, { status: "shipped" }, "Shipped"), disabled: !selected.length },
            { id: "refund", label: "Refund", describe: "Refund selected orders", destructive: true, onAction: () => update(selected, { status: "refunded" }, "Refunded"), disabled: !selected.length },
            { id: "cancel", label: "Cancel", describe: "Cancel selected orders", destructive: true, onAction: () => update(selected, { status: "cancelled" }, "Cancelled"), disabled: !selected.length },
            { id: "resend_receipt", label: "Resend receipt", describe: "Email receipts for selected orders", onAction: () => { toast({ title: `Receipts sent for ${selected.length} orders` }); return { sent: selected }; }, disabled: !selected.length },
            { id: "export_csv", label: "Export CSV", describe: "Download the filtered orders as CSV", onAction: () => {
              // Export the same search, sort, and filters shown in the table.
              const visible = applyQuery(filtered, columns, query, (column, row) => column.value ? column.value(row) : row[column.key as keyof Order]);
              downloadOrders(visible);
              toast({ title: `Exported ${visible.length} orders`, kind: "success" });
              return { rows: visible.length };
            } },
            { id: "clear_selection", label: "Clear selection", describe: "Deselect all orders", onAction: () => { setSelected([]); return { selected: [] }; }, disabled: !selected.length },
            { id: "reset_filters", label: "Reset filters", describe: "Remove all filters", onAction: () => { setFilters({}); setQuery({}); return { filters: {} }; } },
          ]}
        />
        <DataTable
          columns={columns}
          query={query}
          onQueryChange={setQuery}
          emptyMessage="No orders match your search. Try clearing your filters."
          rows={filtered}
          noun="orders"
          selectable
          selected={selected}
          onSelectionChange={setSelected}
          pageSize={12}
          agent={{ name: "query_orders", project: ["id", "customer", "total", "status", "region"] }}
        />
      </ToolScope>

      <ToolScope group="customers" describe="Customer picker and account details" className="section">
        <h2>Customer</h2>
        <p className="muted">Find a customer account to view their details.</p>
        <div className="row">
          <div className="customer-picker">
            <Combobox label="Account" options={customers} value={customer} onChange={setCustomer} noun="customer" agent={{ name: "choose_customer" }} placeholder="Search customers..." />
          </div>
          {customer ? <span className="muted">Selected: {customers.find((c) => c.value === customer)?.label}</span> : null}
        </div>
      </ToolScope>

      <ToolScope group="settings" describe="Workspace settings: profile, notifications, and integrations" className="section">
        <h2>Settings</h2>
        <p className="muted">Manage your workspace profile, notifications, and connected tools.</p>
        <Tabs
          aria-label="Workspace settings"
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

      <ToolScope group="reports" describe="Reports archive with pagination" className="section">
        <h2>Reports</h2>
        <p className="muted">Browse weekly revenue reports across your regions.</p>
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

function downloadOrders(orders: Order[]) {
  const keys: (keyof Order)[] = ["id", "customer", "email", "total", "status", "region", "items", "placedAt"];
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    // Keep spreadsheet applications from interpreting customer data as formulas.
    const safe = /^[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const csv = [keys.join(","), ...orders.map((order) => keys.map((key) => escape(order[key])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "orders.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
