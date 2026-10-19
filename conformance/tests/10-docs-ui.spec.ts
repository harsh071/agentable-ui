import { expect, test } from "@playwright/test";

const origin = "http://localhost:4173";

test("all documentation pages render and search indexes the actual examples", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/#/docs/intro`);
  const pages = await page.locator('#docs-navigation a').evaluateAll((links) => links.map((link) => link.getAttribute("href")!));
  expect(pages.length).toBeGreaterThan(15);
  const known = new Set(pages);
  for (const href of pages) {
    await page.goto(`${origin}/${href}`);
    await expect(page.locator(".doc-header h1")).toBeVisible();
    await expect(page.locator(".doc-content")).not.toBeEmpty();
    const links = await page.locator('.docs-article a[href^="#/docs/"]').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")!.split("?")[0]!));
    for (const link of links) expect(known.has(link), `Broken docs link: ${link}`).toBe(true);
    const sectionIds = await page.locator(".doc-content h2, .doc-content h3").evaluateAll((headings) => headings.map((heading) => heading.id));
    expect(sectionIds.every(Boolean)).toBe(true);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
  }
  await page.getByRole("searchbox", { name: "Search docs" }).fill("aria-busy");
  await expect(page.locator(".search-results")).toContainText("Styling & themes");
  await page.locator(".search-results").getByRole("link", { name: /Styling & themes/ }).click();
  await expect(page.locator(".doc-header h1")).toHaveText("Styling & themes");
  await page.getByRole("searchbox", { name: "Search docs" }).fill("no-result-for-this-query");
  await expect(page.getByRole("status").filter({ hasText: "0 results" })).toBeVisible();
  await page.goto(`${origin}/#/`);
  await expect(page.locator(".home")).toBeVisible();
  expect(errors).toEqual([]);
});

test("code can be copied and section links work on direct loads", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/#/docs/quickstart`);
  await page.getByRole("button", { name: "Copy code" }).first().click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("npm install @agentable-ui/ui");
  const outlineLink = page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "3. Call your tool" });
  await outlineLink.click();
  await expect(page).toHaveURL(/section=3-call-your-tool/);
  await page.reload();
  const heading = page.locator('[id="3-call-your-tool"]');
  await expect(heading).toBeInViewport();
  await expect(page).toHaveTitle("Quick start · Agentable Docs");
  await page.goto(`${origin}/#/docs/quickstart`);
  await page.screenshot({ path: "/tmp/agentable-docs-desktop.png" });
});

test("mobile navigation and long reference content fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/#/docs/quickstart`);
  await expect(page.getByRole("navigation", { name: "Documentation pages" })).toBeHidden();
  await page.getByRole("button", { name: /Browse docs/ }).click();
  await page.getByRole("navigation", { name: "Documentation pages" }).getByRole("link", { name: "ui", exact: true }).click();
  await expect(page.locator(".doc-header h1")).toHaveText("@agentable-ui/ui");
  await expect(page.getByRole("navigation", { name: "Documentation pages" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "/tmp/agentable-docs-mobile.png", fullPage: true });
});
