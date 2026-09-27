import { describe, expect, it, vi } from "vitest";
import { createAgentable, memoryAdapter, type Capability } from "../src/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

function cap(id: string, extra: Partial<Capability> = {}, tool: Partial<NonNullable<Capability["tool"]>> = {}): Capability {
  return {
    id,
    ...extra,
    tool: {
      name: id.replace(/\./g, "_"),
      description: `Tool ${id}.`,
      annotations: { readOnlyHint: true },
      execute: () => ({ ok: id }),
      ...tool,
    },
  };
}

describe("registry: tiers and budget", () => {
  it("resolves 120 declared capabilities to <= 12 resident tools", async () => {
    const warn = vi.fn();
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem], onWarn: warn });
    // 12 groups x 10 capabilities. Two groups are tier 0, the rest tier 1.
    for (let g = 0; g < 12; g++) {
      for (let i = 0; i < 10; i++) {
        ag.declare(cap(`g${g}.c${i}`, { group: `g${g}`, tier: g < 2 ? 0 : 1, priority: 10 - i }));
      }
    }
    await ag.flush();
    const snap = ag.snapshot();
    expect(snap.capabilities).toHaveLength(120);
    expect(snap.resident.length).toBeLessThanOrEqual(12);
    expect(mem.tools().length).toBeLessThanOrEqual(12);
    expect(mem.tools().map((t) => t.name)).toContain("list_capabilities");
    expect(mem.tools().map((t) => t.name)).toContain("open_capability");
    // 20 tier-0 candidates, room for 10: eviction warnings name both tools.
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]![0])).toMatch(/Budget \(12\) exceeded: ".*" demoted to tier 1 to keep ".*"/);
    expect(snap.estimatedTokens).toBeLessThan(2500);
  });

  it("keeps higher priority tools when evicting", async () => {
    const ag = createAgentable({ budget: 4, onWarn: () => {} });
    ag.declare(cap("a.low", { group: "a", priority: 1 }));
    ag.declare(cap("a.high", { group: "a", priority: 9 }));
    ag.declare(cap("a.mid", { group: "a", priority: 5 }));
    ag.declare(cap("b.x", { group: "b", tier: 1 }));
    await ag.flush();
    const names = ag.getResident().map((t) => t.name);
    // 4 - 2 meta = 2 app tools
    expect(names).toEqual(["a_high", "a_mid", "list_capabilities", "open_capability"]);
    const low = ag.snapshot().capabilities.find((c) => c.id === "a.low")!;
    expect(low.effectiveTier).toBe(1);
    expect(low.reason).toBe("evicted");
  });

  it("registers no meta tools when everything fits", async () => {
    const ag = createAgentable();
    ag.declare(cap("a"));
    ag.declare(cap("b"));
    await ag.flush();
    expect(ag.getResident().map((t) => t.name)).toEqual(["a", "b"]);
    expect(ag.snapshot().budget.metaTools).toBe(0);
  });

  it("promotes a group through open_capability and fires adapter changes", async () => {
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem] });
    ag.declare(cap("home.search"));
    ag.declare(cap("orders.query", { group: "orders", tier: 1 }));
    ag.declare(cap("orders.export", { group: "orders", tier: 1 }));
    ag.describeGroup("orders", "Order management");
    await ag.flush();
    const changes: string[][] = [];
    mem.onChange((tools) => changes.push(tools.map((t) => t.name)));

    const index = await mem.execute("list_capabilities", "{}");
    expect(index).toBe("orders (Order management) [2]: orders_query, orders_export");

    const out = await mem.execute("open_capability", JSON.stringify({ group: "orders" }));
    expect(out).toMatch(/^Loaded 2 tools for "orders": orders_query: Tool orders.query.; orders_export/);
    expect(mem.tools().map((t) => t.name).sort()).toEqual(["home_search", "list_capabilities", "open_capability", "orders_export", "orders_query"].sort());
    expect(changes.length).toBeGreaterThan(0);
    expect(ag.snapshot().agentPresent).toBe(true);

    // Now everything is loaded; the index says so.
    expect(await mem.execute("list_capabilities", "{}")).toBe("All capabilities are already loaded.");

    const bad = await mem.execute("open_capability", JSON.stringify({ group: "nope" }));
    expect(JSON.parse(bad).error).toMatch(/Unknown group "nope". Available: orders/);
  });

  it("does not list or open tier-2 (dormant) groups", async () => {
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem] });
    ag.declare(cap("a"));
    ag.declare(cap("secret.x", { group: "secret", tier: 2 }));
    ag.declare(cap("pub.x", { group: "pub", tier: 1 }));
    await ag.flush();
    expect(await mem.execute("list_capabilities")).toBe("pub [1]: pub_x");
    const out = await mem.execute("open_capability", { group: "secret" });
    expect(JSON.parse(out).error).toMatch(/not available/);
    // App code can still promote it.
    ag.promote("secret");
    await ag.flush();
    expect(mem.tools().map((t) => t.name)).toContain("secret_x");
  });

  it("LRU: opening a group past the budget unloads the least recently opened", async () => {
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem], budget: 4, onWarn: () => {} });
    ag.declare(cap("a.x", { group: "a", tier: 1 }));
    ag.declare(cap("b.x", { group: "b", tier: 1 }));
    ag.declare(cap("c.x", { group: "c", tier: 1 }));
    await ag.flush();
    ag.promote("a");
    await ag.flush();
    ag.promote("b");
    await ag.flush();
    expect(mem.tools().map((t) => t.name).sort()).toEqual(["a_x", "b_x", "list_capabilities", "open_capability"]);
    const out = await mem.execute("open_capability", { group: "c" });
    expect(out).toContain('Loaded 1 tool for "c"');
    expect(out).toContain("Unloaded: a_x");
    expect(mem.tools().map((t) => t.name).sort()).toEqual(["b_x", "c_x", "list_capabilities", "open_capability"]);
  });
});

describe("registry: scope, refcount, updates", () => {
  it("dedupes by id with refcounting", async () => {
    const ag = createAgentable();
    const c = cap("a");
    const h1 = ag.declare(c);
    const h2 = ag.declare(c);
    await ag.flush();
    expect(ag.getResident()).toHaveLength(1);
    h1.release();
    await ag.flush();
    expect(ag.getResident()).toHaveLength(1);
    h2.release();
    await ag.flush();
    expect(ag.getResident()).toHaveLength(0);
    h2.release(); // idempotent
    expect(ag.has("a")).toBe(false);
  });

  it("hidden scopes demote to tier 1 and come back on show", async () => {
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem] });
    ag.declare(cap("a"));
    ag.declare(cap("orders.q", { group: "orders" }), { scope: "s1" });
    await ag.flush();
    expect(mem.tools()).toHaveLength(2);
    ag.hideScope("s1");
    await ag.flush();
    expect(mem.tools().map((t) => t.name).sort()).toEqual(["a", "list_capabilities", "open_capability"]);
    expect(ag.snapshot().capabilities.find((c) => c.id === "orders.q")!.reason).toBe("hidden");
    expect(await mem.execute("list_capabilities")).toBe("orders [1]: orders_q");
    ag.showScope("s1");
    await ag.flush();
    expect(mem.tools().map((t) => t.name)).toEqual(["a", "orders_q"]);
  });

  it("re-registers when a tool's schema changes and keeps identity otherwise", async () => {
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem] });
    const h = ag.declare(cap("a"));
    await ag.flush();
    const v1 = mem.tools()[0]!.meta.version;
    h.update(cap("a"));
    await ag.flush();
    expect(mem.tools()[0]!.meta.version).toBe(v1);
    h.update(cap("a", {}, { description: "Changed." }));
    await ag.flush();
    expect(mem.tools()[0]!.meta.version).not.toBe(v1);
    expect(mem.tools()[0]!.description).toBe("Changed.");
  });

  it("warns on duplicate tool names across capabilities and registers the first", async () => {
    const warn = vi.fn();
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem], onWarn: warn });
    ag.declare(cap("x", {}, { name: "same" }));
    ag.declare(cap("y", {}, { name: "same" }));
    await ag.flush();
    expect(mem.tools()).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Duplicate tool name "same"/));
  });

  it("warns on Chrome character limits at declaration", () => {
    const warn = vi.fn();
    const ag = createAgentable({ onWarn: warn });
    ag.declare(cap("x", {}, { name: "a".repeat(31), description: "d".repeat(501) }));
    expect(warn).toHaveBeenCalledTimes(2);
    expect(() => createAgentable({ strictLimits: true }).declare(cap("y", {}, { name: "bad name!" }))).toThrow(/must match/);
  });
});

describe("registry: fan-in", () => {
  it("collapses siblings into one tool with an action enum", async () => {
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem] });
    const ran: string[] = [];
    for (const a of ["archive", "refund", "resend"]) {
      ag.declare({
        id: `orders.action.${a}`,
        group: "orders",
        fanIn: { bucket: "run_order_action", description: "Run an action on the selected order." },
        tool: { name: a, description: `${a[0]!.toUpperCase()}${a.slice(1)} the selected order.`, execute: () => { ran.push(a); return `${a} done`; }, confirm: false },
      });
    }
    await ag.flush();
    const tools = mem.tools();
    expect(tools).toHaveLength(1);
    const t = tools[0]!;
    expect(t.name).toBe("run_order_action");
    expect(t.description).toBe("Run an action on the selected order. Actions: archive: Archive the selected order.; refund: Refund the selected order.; resend: Resend the selected order.");
    expect((t.inputSchema.properties as Record<string, { enum: string[] }>).action!.enum).toEqual(["archive", "refund", "resend"]);
    expect(t.annotations.consequentialHint).toBe(true);
    expect(await mem.execute("run_order_action", { action: "refund" })).toBe("refund done");
    expect(ran).toEqual(["refund"]);
    expect(JSON.parse(await mem.execute("run_order_action", { action: "nope" })).error).toMatch(/Unknown action "nope"/);
  });
});

describe("registry: execution pipeline", () => {
  it("accepts JSON strings and objects, validates, and returns strings", async () => {
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem] });
    ag.declare(cap("echo", {}, {
      inputSchema: { type: "object", properties: { text: { type: "string" }, n: { type: "integer", minimum: 1 } }, required: ["text"] },
      execute: (args: unknown) => args,
    }));
    await ag.flush();
    expect(await mem.execute("echo", '{"text":"hi"}')).toBe('{"text":"hi"}');
    expect(await mem.execute("echo", { text: "hi", n: 2 })).toBe('{"text":"hi","n":2}');
    const bad = JSON.parse(await mem.execute("echo", { n: 0 }));
    expect(bad.error).toBe("Invalid input.");
    expect(bad.issues).toEqual([
      { path: "text", message: "is required" },
      { path: "n", message: "must be >= 1" },
    ]);
    expect(JSON.parse(await mem.execute("echo", "{not json")).error).toMatch(/JSON/);
  });

  it("validates with a Standard Schema and passes coerced values through", async () => {
    const schema = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: (v: unknown) => {
          const o = v as { code?: unknown };
          return typeof o.code === "string" ? { value: { code: o.code.toUpperCase() } } : { issues: [{ message: "code required", path: ["code"] }] };
        },
        jsonSchema: { input: () => ({ $schema: "x", type: "object", properties: { code: { type: "string" } }, required: ["code"] }) },
      },
    };
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem] });
    ag.declare(cap("coupon", {}, { inputSchema: schema, execute: (a: unknown) => a }));
    await ag.flush();
    expect(mem.tools()[0]!.inputSchema).toEqual({ type: "object", properties: { code: { type: "string" } }, required: ["code"] });
    expect(await mem.execute("coupon", { code: "abc" })).toBe('{"code":"ABC"}');
    expect(JSON.parse(await mem.execute("coupon", {})).issues).toEqual([{ path: "code", message: "code required" }]);
  });

  it("returns structured errors instead of throwing", async () => {
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem] });
    ag.declare(cap("boom", {}, { execute: () => { throw new Error("kaboom"); } }));
    await ag.flush();
    expect(await mem.execute("boom")).toBe('{"error":"kaboom"}');
  });

  it("caches read-only tools and invalidates by tag after mutations", async () => {
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem] });
    let reads = 0;
    ag.declare(cap("orders.list", {}, { cache: { tags: ["orders"] }, execute: () => ({ n: ++reads }) }));
    ag.declare(cap("orders.add", {}, { annotations: { readOnlyHint: false }, confirm: false, invalidates: ["orders"], execute: () => "added" }));
    await ag.flush();
    expect(await mem.execute("orders_list", { q: "a" })).toBe('{"n":1}');
    expect(await mem.execute("orders_list", { q: "a" })).toBe('{"n":1}');
    expect(await mem.execute("orders_list", { q: "b" })).toBe('{"n":2}');
    expect(ag.snapshot().cache).toEqual({ hits: 1, misses: 2, size: 2 });
    await mem.execute("orders_add", {});
    expect(await mem.execute("orders_list", { q: "a" })).toBe('{"n":3}');
  });

  it("gates consequential tools behind confirm and infers the hint", async () => {
    const confirm = vi.fn(async (req: { toolName: string }) => req.toolName !== "delete_it");
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem], confirm });
    ag.declare(cap("save_it", {}, { annotations: {}, execute: () => "saved" }));
    ag.declare(cap("delete_it", {}, { annotations: {}, execute: () => "deleted", confirm: (a: { id?: string }) => `Delete ${a.id}?` }));
    ag.declare(cap("read_it", {}, { execute: () => "read" }));
    await ag.flush();
    expect(mem.tools().find((t) => t.name === "save_it")!.annotations).toEqual({ readOnlyHint: false, consequentialHint: true });
    expect(await mem.execute("save_it")).toBe("saved");
    expect(JSON.parse(await mem.execute("delete_it", { id: "9" }))).toEqual({ error: "The user declined this action.", declined: true });
    expect(confirm).toHaveBeenLastCalledWith(expect.objectContaining({ toolName: "delete_it", message: "Delete 9?", args: { id: "9" } }));
    expect(await mem.execute("read_it")).toBe("read");
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("declines consequential tools and warns once when there is no confirm handler", async () => {
    const warn = vi.fn();
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem], onWarn: warn });
    const execute = vi.fn(() => "saved");
    ag.declare(cap("save_it", {}, { annotations: {}, execute }));
    await ag.flush();
    expect(await mem.execute("save_it")).toMatch(/declined/);
    expect(await mem.execute("save_it")).toMatch(/declined/);
    expect(execute).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/No confirm handler/);
  });

  it("runs consequential tools unconfirmed only when confirm is explicitly false", async () => {
    const warn = vi.fn();
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem], confirm: false, onWarn: warn });
    ag.declare(cap("save_it", {}, { annotations: {}, execute: () => "saved" }));
    await ag.flush();
    expect(await mem.execute("save_it")).toBe("saved");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/Confirmation is disabled/);
  });

  it("projects, paginates with a cursor, and adds cursor to the schema", async () => {
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem] });
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Row ${i}`, secret: "x".repeat(40), nested: { a: i, b: 2 } }));
    ag.declare(cap("rows", {}, {
      inputSchema: { type: "object", properties: { q: { type: "string" } } },
      output: { project: ["id", "name", "nested.a"], paginate: { pageSize: 20 }, maxChars: 400 },
      execute: () => rows,
    }));
    await ag.flush();
    const schema = mem.tools()[0]!.inputSchema.properties as Record<string, unknown>;
    expect(schema.cursor).toBeDefined();
    const page1 = JSON.parse(await mem.execute("rows", { q: "" }));
    expect(page1.items[0]).toEqual({ id: 0, name: "Row 0", nested: { a: 0 } });
    expect(page1.has_more).toBe(true);
    expect(page1.total).toBe(50);
    expect(JSON.stringify(page1).length).toBeLessThanOrEqual(400);
    const page2 = JSON.parse(await mem.execute("rows", { q: "", cursor: page1.cursor }));
    expect(page2.items[0].id).toBe(page1.items.length);
    // pagination re-uses the cache: one execution served both pages
    expect(ag.snapshot().cache.hits).toBe(1);
  });

  it("hard-truncates oversized scalar output with a marker", async () => {
    const mem = memoryAdapter();
    const ag = createAgentable({ adapters: [mem], maxOutputChars: 100 });
    ag.declare(cap("big", {}, { execute: () => "y".repeat(500) }));
    await ag.flush();
    const out = await mem.execute("big");
    expect(out.length).toBe(100);
    expect(out.endsWith("[truncated]")).toBe(true);
  });

  it("invoke() by name works without an adapter", async () => {
    const ag = createAgentable();
    ag.declare(cap("a"));
    await ag.flush();
    expect(await ag.invoke("a", {})).toBe('{"ok":"a"}');
    expect(JSON.parse(await ag.invoke("zzz", {})).error).toMatch(/not loaded/);
  });
});

describe("registry: adapters and observation", () => {
  it("syncs adapters added later and unregisters on removal", async () => {
    const ag = createAgentable();
    ag.declare(cap("a"));
    await ag.flush();
    const mem = memoryAdapter();
    const remove = ag.addAdapter(mem);
    await ag.flush();
    expect(mem.tools().map((t) => t.name)).toEqual(["a"]);
    remove();
    expect(mem.tools()).toHaveLength(0);
  });

  it("notifies subscribers with snapshots", async () => {
    const ag = createAgentable();
    const seen: number[] = [];
    const unsub = ag.subscribe((s) => seen.push(s.resident.length));
    ag.declare(cap("a"));
    await ag.flush();
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(1);
    unsub();
  });

  it("exposes the render catalog", () => {
    const ag = createAgentable();
    ag.declare({ id: "card", render: { component: "Card", props: { type: "object", properties: { title: { type: "string" } } } } });
    expect(ag.catalog()).toEqual([{ id: "card", group: undefined, tier: 0, render: { component: "Card", props: { type: "object", properties: { title: { type: "string" } } } } }]);
  });

  it("coalesces many declarations into one sync", async () => {
    const mem = memoryAdapter();
    const registered: string[] = [];
    const spy = { ...mem, register: (t: Parameters<typeof mem.register>[0]) => { registered.push(t.name); return mem.register(t); } };
    const ag = createAgentable({ adapters: [spy] });
    for (let i = 0; i < 5; i++) ag.declare(cap(`c${i}`));
    await tick();
    await ag.flush();
    expect(registered).toEqual(["c0", "c1", "c2", "c3", "c4"]);
  });
});
