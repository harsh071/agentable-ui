import { expect, test } from "@playwright/test";

test("demo supports search, real CSV export, and keyboard settings navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:4173/#/demo");
  await expect(page.getByText("Collected revenue")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search orders" }).fill("Ada");
  const rows = page.locator("[data-agentable-table] tbody tr");
  expect(await rows.count()).toBeGreaterThan(0);
  for (const row of await rows.all()) await expect(row).toContainText("Ada Lovelace");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("orders.csv");
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream!) csv += chunk.toString();
  expect(csv).toContain("Ada Lovelace");
  expect(csv).not.toContain("Grace Hopper");
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Search orders" })).toHaveValue("");
  await page.getByRole("tab", { name: "Profile", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Notifications", exact: true })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText("Daily summary");
  expect(errors).toEqual([]);
});

test("demo fits mobile viewport without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:4173/#/demo");
  await expect(page.getByRole("heading", { name: "Orders dashboard" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "/tmp/agentable-demo-mobile.png", fullPage: true });
});
