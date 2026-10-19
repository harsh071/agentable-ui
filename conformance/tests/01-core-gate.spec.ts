import { test, expect } from "@playwright/test";
import { blankPage, record, CORE_DIST } from "../harness.js";

declare global {
  interface Window {
    agentableCore: typeof import("@agentable-ui/core");
  }
}

test("phase 01 gate: 120 declared capabilities resolve to <= 12 tools in getTools()", async ({ page }) => {
  await blankPage(page);
  // Serve the built core package from the fake origin so the page can import it as ES modules.
  const fs = await import("node:fs");
  const path = await import("node:path");
  const distDir = path.dirname(CORE_DIST);
  await page.route("https://agentable.test/core/**", (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/core\//, "");
    const file = path.join(distDir, rel);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(file, "utf8") });
  });
  await page.addScriptTag({ type: "module", content: `import * as core from "https://agentable.test/core/index.js"; window.agentableCore = core;` });
  await page.waitForFunction(() => !!window.agentableCore, undefined, { timeout: 5000 });

  const r = await page.evaluate(async () => {
    const { createAgentable, webmcpAdapter } = window.agentableCore;
    const warnings: string[] = [];
    const ag = createAgentable({ adapters: [webmcpAdapter()], onWarn: (m) => warnings.push(m), confirm: async () => true });
    let changes = 0;
    document.modelContext!.addEventListener("toolchange", () => changes++);
    for (let g = 0; g < 12; g++) {
      for (let i = 0; i < 10; i++) {
        ag.declare({
          id: `g${g}.c${i}`,
          group: `g${g}`,
          tier: g < 2 ? 0 : 1,
          priority: 10 - i,
          tool: {
            name: `g${g}_c${i}`,
            description: `Tool ${i} of group ${g}.`,
            inputSchema: { type: "object", properties: { q: { type: "string" } } },
            annotations: { readOnlyHint: true },
            execute: (a: unknown) => ({ group: g, i, q: (a as { q?: string }).q ?? null }),
          },
        });
      }
    }
    await ag.flush();
    const mc = document.modelContext!;
    const tools = await mc.getTools();
    const names = tools.map((t) => t.name).sort();
    const list = tools.find((t) => t.name === "list_capabilities")!;
    const index = await mc.executeTool(list, {});
    const open = tools.find((t) => t.name === "open_capability")!;
    const opened = await mc.executeTool(open, { group: "g7" });
    await new Promise((r) => setTimeout(r, 30));
    const after = (await mc.getTools()).map((t) => t.name).sort();
    const g7 = (await mc.getTools()).find((t) => t.name === "g7_c0")!;
    const executed = await mc.executeTool(g7, { q: "hello" });
    const cached = await mc.executeTool(g7, { q: "hello" });
    const invalid = await mc.executeTool(g7, { q: 5 });
    return { declared: ag.snapshot().capabilities.length, count: tools.length, names, index, opened, afterCount: after.length, after, executed, cached, invalid, changes, warnings: warnings.length, tokens: ag.snapshot().estimatedTokens };
  });

  record({ area: "core", check: "capabilities declared", expected: "120", actual: String(r.declared), ok: r.declared === 120 });
  record({ area: "core", check: "resident tools in getTools()", expected: "<= 12", actual: `${r.count}: ${r.names.join(", ")}`, ok: r.count <= 12 });
  record({ area: "core", check: "estimated context", expected: "< 2500 tokens", actual: `~${r.tokens} tokens`, ok: r.tokens < 2500 });
  record({ area: "core", check: "list_capabilities via executeTool", expected: "index of unloaded groups", actual: r.index.slice(0, 160), ok: /g7 \[10\]/.test(r.index) });
  record({ area: "core", check: "open_capability promotes a group", expected: "g7 tools loaded, count still <= 12", actual: `${r.afterCount}: ${r.after.join(", ")}`, ok: r.afterCount <= 12 && r.after.includes("g7_c0") });
  record({ area: "core", check: "toolchange fired on promotion", expected: "> 0", actual: String(r.changes), ok: r.changes > 0 });
  record({ area: "core", check: "execute through Chrome", expected: '{"group":7,"i":0,"q":"hello"}', actual: r.executed, ok: r.executed === '{"group":7,"i":0,"q":"hello"}' });
  record({ area: "core", check: "library validates input", expected: '{"error":"Invalid input." ...}', actual: r.invalid, ok: /Invalid input/.test(r.invalid) });
  record({ area: "core", check: "budget warnings emitted for evictions", expected: "> 0", actual: String(r.warnings), ok: r.warnings > 0 });

  expect(r.declared).toBe(120);
  expect(r.count).toBeLessThanOrEqual(12);
  expect(r.afterCount).toBeLessThanOrEqual(12);
  expect(r.after).toContain("g7_c0");
  expect(r.executed).toBe('{"group":7,"i":0,"q":"hello"}');
  expect(r.cached).toBe(r.executed);
});
