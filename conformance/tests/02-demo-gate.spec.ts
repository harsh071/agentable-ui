import { test, expect, type Page } from "@playwright/test";
import { record } from "../harness.js";

async function tools(page: Page) {
  return page.evaluate(async () => (await document.modelContext!.getTools()).map((t) => t.name).sort());
}
async function call(page: Page, name: string, input: unknown) {
  return page.evaluate(
    async ([name, input]) => {
      const t = (await document.modelContext!.getTools()).find((t) => t.name === name);
      if (!t) throw new Error(`tool ${name} not registered`);
      // Chrome 155 takes an object; Chrome 154 took a JSON string.
      try {
        return await document.modelContext!.executeTool(t, input as Record<string, unknown>);
      } catch {
        return document.modelContext!.executeTool(t, JSON.stringify(input) as never);
      }
    },
    [name, input] as const,
  );
}

test("phase 04 gate: an agent completes a three-step task on the demo through real WebMCP", async ({ page }) => {
  await page.goto("http://localhost:4173/#/demo");
  await page.waitForSelector("[data-agentable-table]");
  await page.waitForTimeout(300);

  const initial = await tools(page);
  record({ area: "demo", check: "resident tools on /demo", expected: "<= 12", actual: `${initial.length}: ${initial.join(", ")}`, ok: initial.length <= 12 });
  expect(initial.length).toBeLessThanOrEqual(12);
  expect(initial).toContain("query_orders");
  expect(initial).toContain("run_order_action");

  const declared = await page.evaluate(() => document.querySelectorAll("[data-agentable-scope]").length);
  expect(declared).toBeGreaterThan(0);

  // Step 1: query pending orders in EU, sorted by total.
  const q = JSON.parse(await call(page, "query_orders", { filter: { status: "pending", region: "EU" }, sort: { column: "total", dir: "desc" }, limit: 3 }));
  expect(q.items.length).toBeGreaterThan(0);
  expect(q.items[0]).toHaveProperty("id");
  expect(q.items[0]).not.toHaveProperty("email"); // projected + agentHidden
  const ids = q.items.map((r: { id: string }) => r.id);
  record({ area: "demo", check: "step 1: query_orders (filter+sort+project)", expected: "pending EU orders, no email column", actual: JSON.stringify(q).slice(0, 200), ok: true });

  // The visible table reflects the agent's query.
  await expect(page.locator("[data-agentable-chip]").first()).toContainText("status: pending");

  // Step 2: select them.
  const sel = JSON.parse(await call(page, "query_orders_select", { ids }));
  expect(sel.selected).toEqual(ids);
  await expect(page.locator("tr[data-selected]")).toHaveCount(ids.length);
  record({ area: "demo", check: "step 2: query_orders_select", expected: `${ids.length} rows selected in the UI`, actual: JSON.stringify(sel), ok: true });

  // Step 3: run a fan-in action; mark_paid is not destructive so it runs without confirm.
  const act = JSON.parse(await call(page, "run_order_action", { action: "mark_paid" }));
  expect(act.updated).toEqual(ids);
  await expect(page.locator("[data-agentable-toast]").first()).toContainText("Marked paid");
  record({ area: "demo", check: "step 3: run_order_action mark_paid (fan-in)", expected: "orders updated, toast shown", actual: JSON.stringify(act), ok: true });

  // Consequential action shows the confirmation dialog and honours a decline.
  const declinePromise = call(page, "run_order_action", { action: "refund" });
  await page.waitForSelector("[data-agentable-confirm][open]");
  await page.click("[data-agentable-confirm-deny]");
  const declined = JSON.parse(await declinePromise);
  expect(declined.declined).toBe(true);
  record({ area: "demo", check: "consequential action gated by confirm dialog", expected: "user decline returns declined:true", actual: JSON.stringify(declined), ok: declined.declined === true });

  // Progressive disclosure: the billing dialog was evicted by the budget; open it on demand.
  const index = await call(page, "list_capabilities", {});
  expect(index).toMatch(/billing \[1\]: invoice_dialog/);
  record({ area: "demo", check: "list_capabilities index", expected: "lists evicted/unloaded groups only", actual: index.replace(/\n/g, " | "), ok: /billing/.test(index) });
  await call(page, "open_capability", { group: "billing" });
  await page.waitForTimeout(50);
  const afterOpen = await tools(page);
  expect(afterOpen).toContain("invoice_dialog");
  expect(afterOpen.length).toBeLessThanOrEqual(12);

  // Open the dialog; the form inside mounts and its tool joins the open billing group.
  await call(page, "invoice_dialog", { open: true });
  await page.waitForSelector("[data-agentable-dialog][open]");
  await page.waitForTimeout(50);
  const withForm = await tools(page);
  expect(withForm).toContain("create_invoice");
  expect(withForm.length).toBeLessThanOrEqual(12);
  record({ area: "demo", check: "dialog tool mounts form tool", expected: "create_invoice appears after invoice_dialog{open:true}", actual: `${withForm.length}: ${withForm.join(", ")}`, ok: withForm.includes("create_invoice") && withForm.length <= 12 });

  // Fill and submit the form through the confirmation dialog.
  const submitPromise = call(page, "create_invoice", { customer: "Ada Lovelace", amountCents: 129900, memo: "Consulting" });
  await page.waitForSelector("[data-agentable-confirm][open]");
  await expect(page.locator("[data-agentable-confirm-args]")).toContainText("Ada Lovelace");
  await page.click("[data-agentable-confirm-allow]");
  const submitted = JSON.parse(await submitPromise);
  expect(submitted.invoiceId).toMatch(/^INV-/);
  await expect(page.locator("[data-agentable-toast]").filter({ hasText: "Invoice created" })).toBeVisible();
  record({ area: "demo", check: "form fill + submit via confirm dialog", expected: "invoiceId returned, toast shown, dialog closed", actual: JSON.stringify(submitted), ok: /^INV-/.test(submitted.invoiceId) });

  // A tier-0 combobox tool is already resident.
  const chosen = JSON.parse(await call(page, "choose_customer", { value: "Grace Hopper" }));
  expect(chosen.selected.label).toBe("Grace Hopper");
  record({ area: "demo", check: "combobox select by label", expected: "Grace Hopper selected", actual: JSON.stringify(chosen), ok: true });

  // Notifications tool is tier 1 in group "page"; open it and read what the user saw.
  await call(page, "open_capability", { group: "page" });
  await page.waitForTimeout(50);
  const notes = JSON.parse(await call(page, "read_notifications", { limit: 5 }));
  expect(notes.some((n: { title: string }) => n.title === "Invoice created")).toBe(true);
  record({ area: "demo", check: "read_notifications after actions", expected: "includes 'Invoice created'", actual: JSON.stringify(notes.map((n: { title: string }) => n.title)), ok: true });

  // Navigation tool reaches the docs and the docs search tool works.
  await call(page, "navigate", { to: "Docs" });
  await page.waitForSelector(".docs");
  await page.waitForTimeout(100);
  const docsTools = await tools(page);
  expect(docsTools).toContain("search_docs");
  const results = JSON.parse(await call(page, "search_docs", { query: "fan-in" }));
  expect(results.length).toBeGreaterThan(0);
  record({ area: "demo", check: "phase 05 gate: agent drives the docs site", expected: "navigate + search_docs return results", actual: JSON.stringify(results.map((r: { id: string }) => r.id)), ok: results.length > 0 });
});
