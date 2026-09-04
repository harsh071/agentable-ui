import { test, expect } from "@playwright/test";
import { blankPage, record, resetFindings } from "../harness.js";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => resetFindings());

test("entry point is document.modelContext (not navigator, not window.agent)", async ({ page, browser }) => {
  await blankPage(page);
  const r = await page.evaluate(() => ({
    document: "modelContext" in document,
    navigator: "modelContext" in navigator,
    windowAgent: "agent" in window,
    ctor: typeof (globalThis as Record<string, unknown>).ModelContext,
    isEventTarget: !!document.modelContext && document.modelContext instanceof EventTarget,
  }));
  record({ area: "platform", check: "browser", expected: "Chrome >= 149 with --enable-features=WebMCP", actual: browser.version(), ok: true });
  record({ area: "platform", check: "document.modelContext present", expected: "true", actual: String(r.document), ok: r.document });
  record({ area: "platform", check: "navigator.modelContext alias", expected: "false (moved July 2026)", actual: String(r.navigator), ok: !r.navigator });
  record({ area: "platform", check: "window.agent alias", expected: "false", actual: String(r.windowAgent), ok: !r.windowAgent });
  record({ area: "platform", check: "ModelContext is an EventTarget", expected: "true", actual: String(r.isEventTarget), ok: r.isEventTarget });
  expect(r.document).toBe(true);
});

test("IDL surface matches the spec draft", async ({ page }) => {
  await blankPage(page);
  const r = await page.evaluate(() => {
    const mc = document.modelContext!;
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(mc)).sort();
    return { proto, hasUnregister: "unregisterTool" in mc, hasProvideContext: "provideContext" in mc };
  });
  const expected = ["constructor", "executeTool", "getTools", "ontoolchange", "registerTool"];
  const ok = expected.every((m) => r.proto.includes(m));
  record({ area: "idl", check: "methods", expected: expected.join(", "), actual: r.proto.join(", "), ok });
  record({ area: "idl", check: "unregisterTool", expected: "absent (use AbortSignal)", actual: r.hasUnregister ? "present" : "absent", ok: !r.hasUnregister });
  expect(ok).toBe(true);
});

test("registerTool + AbortSignal lifecycle, duplicate names, toolchange", async ({ page }) => {
  await blankPage(page);
  const r = await page.evaluate(async () => {
    const mc = document.modelContext!;
    let changes = 0;
    mc.addEventListener("toolchange", () => changes++);
    const ret = await mc.registerTool({ name: "t1", description: "one", inputSchema: { type: "object", properties: {} }, execute: () => "x" });
    const ac = new AbortController();
    await mc.registerTool({ name: "t2", description: "two", inputSchema: { type: "object", properties: {} }, execute: () => "y" }, { signal: ac.signal });
    const before = (await mc.getTools()).map((t) => t.name).sort();
    ac.abort();
    await new Promise((r) => setTimeout(r, 20));
    const after = (await mc.getTools()).map((t) => t.name).sort();
    let dup = "";
    try {
      await mc.registerTool({ name: "t1", description: "dup", inputSchema: { type: "object", properties: {} }, execute: () => "z" });
    } catch (e) {
      dup = String(e);
    }
    let preAborted = "";
    try {
      await mc.registerTool({ name: "t3", description: "pre", inputSchema: { type: "object", properties: {} }, execute: () => "z" }, { signal: AbortSignal.abort() });
    } catch (e) {
      preAborted = String(e);
    }
    return { ret: String(ret), before, after, dup, preAborted, changes };
  });
  record({ area: "lifecycle", check: "registerTool return value", expected: "undefined", actual: r.ret, ok: r.ret === "undefined" });
  record({ area: "lifecycle", check: "AbortSignal unregisters", expected: "t1 only after abort", actual: `${r.before.join(",")} -> ${r.after.join(",")}`, ok: r.after.join(",") === "t1" });
  record({ area: "lifecycle", check: "duplicate name", expected: "InvalidStateError", actual: r.dup, ok: /InvalidStateError/.test(r.dup) });
  record({ area: "lifecycle", check: "pre-aborted signal", expected: "AbortError", actual: r.preAborted, ok: /AbortError/.test(r.preAborted) });
  record({ area: "lifecycle", check: "toolchange fires per register/unregister", expected: ">= 3", actual: String(r.changes), ok: r.changes >= 3 });
  expect(r.after).toEqual(["t1"]);
});

test("executeTool encoding: JSON-string input, string output, no validation, no truncation", async ({ page }) => {
  await blankPage(page);
  const r = await page.evaluate(async () => {
    const mc = document.modelContext!;
    let seen: unknown;
    await mc.registerTool({ name: "echo", description: "echo", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }, execute: (a: unknown) => { seen = a; return { got: a }; } });
    await mc.registerTool({ name: "big", description: "big", inputSchema: { type: "object", properties: {} }, execute: () => "y".repeat(5000) });
    await mc.registerTool({ name: "thrower", description: "t", inputSchema: { type: "object", properties: {} }, execute: () => { throw new Error("boom"); } });
    const tools = await mc.getTools();
    const get = (n: string) => tools.find((t) => t.name === n)!;
    const out: Record<string, unknown> = {};
    out.schemaType = typeof get("echo").inputSchema;
    try { out.objectInput = await mc.executeTool(get("echo"), { text: "hi" } as never); } catch (e) { out.objectInput = String(e); }
    out.stringInput = await mc.executeTool(get("echo"), JSON.stringify({ text: "hi" }));
    out.seenType = typeof seen;
    out.wrongShape = await mc.executeTool(get("echo"), JSON.stringify({ nope: 1 }));
    out.bigLen = (await mc.executeTool(get("big"), "{}")).length;
    try { out.thrown = await mc.executeTool(get("thrower"), "{}"); } catch (e) { out.thrown = String(e); }
    return out as { schemaType: string; objectInput: string; stringInput: string; seenType: string; wrongShape: string; bigLen: number; thrown: string };
  });
  record({ area: "execute", check: "getTools().inputSchema type", expected: "string (serialized JSON)", actual: r.schemaType, ok: r.schemaType === "string" });
  record({ area: "execute", check: "object input", expected: "rejected (must be JSON string)", actual: r.objectInput, ok: /Failed to parse/.test(r.objectInput) });
  record({ area: "execute", check: "JSON-string input reaches execute as", expected: "object", actual: r.seenType, ok: r.seenType === "object" });
  record({ area: "execute", check: "output", expected: "string, objects JSON-serialized", actual: r.stringInput, ok: r.stringInput === '{"got":{"text":"hi"}}' });
  record({ area: "execute", check: "schema validation by browser", expected: "none (library must validate)", actual: `wrong-shape input passed through: ${r.wrongShape}`, ok: true });
  record({ area: "execute", check: "1500-char output limit enforced", expected: "no (guidance only; library truncates)", actual: `${r.bigLen} chars returned`, ok: r.bigLen === 5000 });
  record({ area: "execute", check: "thrown error surfaces as", expected: "generic UnknownError (library returns structured error text instead)", actual: r.thrown, ok: /UnknownError/.test(r.thrown) });
  expect(r.seenType).toBe("object");
});

test("limits and annotations: what Chrome enforces vs reflects", async ({ page }) => {
  await blankPage(page);
  const r = await page.evaluate(async () => {
    const mc = document.modelContext!;
    const out: Record<string, unknown> = {};
    try { await mc.registerTool({ name: "x".repeat(31), description: "long name", inputSchema: { type: "object", properties: {} }, execute: () => "x" }); out.longName = "accepted"; } catch (e) { out.longName = String(e); }
    try { await mc.registerTool({ name: "longdesc", description: "d".repeat(501), inputSchema: { type: "object", properties: {} }, execute: () => "x" }); out.longDesc = "accepted"; } catch (e) { out.longDesc = String(e); }
    await mc.registerTool({ name: "ann", description: "a", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true, consequentialHint: true, untrustedContentHint: true, destructiveHint: true }, execute: () => "x" });
    out.annotations = JSON.stringify((await mc.getTools()).find((t) => t.name === "ann")!.annotations);
    try { await mc.registerTool({ name: "exp1", description: "a", inputSchema: { type: "object", properties: {} }, execute: () => "x" }, { exposedTo: ["https://partner.example"] }); out.exposedOrigin = "accepted"; } catch (e) { out.exposedOrigin = String(e); }
    try { await mc.registerTool({ name: "exp2", description: "a", inputSchema: { type: "object", properties: {} }, execute: () => "x" }, { exposedTo: ["*"] }); out.exposedStar = "accepted"; } catch (e) { out.exposedStar = String(e); }
    return out as { longName: string; longDesc: string; annotations: string; exposedOrigin: string; exposedStar: string };
  });
  record({ area: "limits", check: "31-char name", expected: "guidance only", actual: r.longName, ok: true });
  record({ area: "limits", check: "501-char description", expected: "guidance only", actual: r.longDesc, ok: true });
  record({ area: "annotations", check: "reflected by getTools()", expected: "readOnlyHint, untrustedContentHint (consequentialHint dropped)", actual: r.annotations, ok: /readOnlyHint/.test(r.annotations) });
  record({ area: "exposedTo", check: "secure origin list", expected: "accepted", actual: r.exposedOrigin, ok: r.exposedOrigin === "accepted" });
  record({ area: "exposedTo", check: "wildcard", expected: "SecurityError", actual: r.exposedStar, ok: /SecurityError/.test(r.exposedStar) });
});

test("unregistering a tool while its execute is pending rejects the pending call", async ({ page }) => {
  await blankPage(page);
  const r = await page.evaluate(async () => {
    const mc = document.modelContext!;
    const ac = new AbortController();
    let release!: () => void;
    await mc.registerTool({ name: "slow", description: "slow", inputSchema: { type: "object", properties: {} }, execute: () => new Promise<string>((res) => { release = () => res("done"); }) }, { signal: ac.signal });
    const tool = (await mc.getTools()).find((t) => t.name === "slow")!;
    const pending = mc.executeTool(tool, "{}").then((v) => `resolved:${v}`, (e) => `rejected:${String(e)}`);
    await new Promise((r) => setTimeout(r, 20));
    ac.abort();
    await new Promise((r) => setTimeout(r, 20));
    release();
    return pending;
  });
  record({ area: "lifecycle", check: "abort during pending execute", expected: "pending call rejects (adapter defers abort until idle)", actual: r, ok: /rejected/.test(r) });
  expect(r).toMatch(/rejected/);
});
