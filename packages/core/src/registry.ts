import { applyBudget, type BudgetCandidate } from "./budgeter.js";
import { ToolCache } from "./cache.js";
import { LIMITS, checkLimits, estimateTokens, schemaChars } from "./limits.js";
import { canonicalize, parseInput, toJsonSchema, validateInput } from "./schema.js";
import { CURSOR_PARAM, decodeCursor, hardTruncate, shape } from "./shaper.js";
import type {
  AgentAdapter,
  AgentableOptions,
  Capability,
  CapabilityHandle,
  CapabilityState,
  CapabilityTool,
  ConfirmRequest,
  ExecuteContext,
  JSONSchema,
  Listener,
  NormalizedTool,
  RenderDescriptor,
  SchemaInput,
  Snapshot,
  Tier,
  ToolAnnotations,
} from "./types.js";

export interface DeclareOptions {
  /** Visibility scope (from <ToolScope>). Hidden scopes demote to tier 1. */
  scope?: string;
}

interface Rec {
  id: string;
  cap: Capability;
  refCount: number;
  order: number;
  scope?: string;
}

interface Unit {
  key: string;
  kind: "capability" | "fan-in";
  recs: Rec[];
  name: string;
  group?: string;
  declaredTier: Tier;
  priority: number;
  order: number;
}

interface Registered {
  version: number;
  unregister: () => void;
}

interface GroupSummary {
  name: string;
  description?: string;
  units: Unit[];
  open: boolean;
  dormant: boolean;
}

const DEFAULT_BUDGET = 12;

export class Agentable {
  private recs = new Map<string, Rec>();
  private openGroups = new Map<string, number>();
  private hiddenScopes = new Set<string>();
  private groupDescriptions = new Map<string, string>();
  private evictedUnits = new Set<string>();
  private adapters: AgentAdapter[] = [];
  private registered = new Map<string, Map<string, Registered>>();
  private listeners = new Set<Listener>();
  private cache: ToolCache;
  private warnings: string[] = [];
  private warned = new Set<string>();
  private materialized = new Map<string, { tool: NormalizedTool; fingerprint: string }>();
  private resident: NormalizedTool[] = [];
  private scheduled = false;
  private syncing: Promise<void> = Promise.resolve();
  private order = 0;
  private version = 0;
  private disposed = false;
  private agentPresent = false;
  private confirmWarned = false;
  private metaDefs?: NormalizedTool[];
  private clock = () => Date.now();

  readonly budget: number;
  private readonly metaTools: boolean;
  private readonly metaPrefix: string;
  private readonly maxOutputChars: number;
  private readonly confirmHandler?: (req: ConfirmRequest) => Promise<boolean>;
  private readonly onWarn: (message: string) => void;
  private readonly strictLimits: boolean;

  constructor(options: AgentableOptions = {}) {
    this.budget = options.budget ?? DEFAULT_BUDGET;
    this.metaTools = options.metaTools ?? true;
    this.metaPrefix = options.metaPrefix ? `${options.metaPrefix}_` : "";
    this.maxOutputChars = options.maxOutputChars ?? LIMITS.toolOutput;
    this.confirmHandler = options.confirm;
    this.strictLimits = options.strictLimits ?? false;
    this.onWarn =
      options.onWarn ??
      ((m) => {
        if (typeof console !== "undefined") console.warn(`[agentable] ${m}`);
      });
    this.cache = new ToolCache(options.cache?.defaultTtl ?? 30_000, options.cache?.maxEntries ?? 500);
    for (const a of options.adapters ?? []) this.addAdapter(a);
  }

  // ---------------------------------------------------------------------------
  // Declarations

  declare(cap: Capability, opts: DeclareOptions = {}): CapabilityHandle {
    if (!cap.id) throw new Error("Capability needs an id.");
    let rec = this.recs.get(cap.id);
    if (rec) {
      rec.refCount++;
      if (rec.cap !== cap) {
        this.validate(cap);
        rec.cap = cap;
      }
      if (opts.scope) rec.scope = opts.scope;
    } else {
      this.validate(cap);
      rec = { id: cap.id, cap, refCount: 1, order: this.order++, scope: opts.scope };
      this.recs.set(cap.id, rec);
    }
    this.schedule();
    const id = cap.id;
    let released = false;
    return {
      id,
      update: (next) => {
        if (released) return;
        this.update(id, next);
      },
      release: () => {
        if (released) return;
        released = true;
        this.release(id);
      },
    };
  }

  private update(id: string, next: Capability): void {
    const rec = this.recs.get(id);
    if (!rec) return;
    if (next.id !== id) throw new Error(`Cannot change capability id (${id} -> ${next.id}).`);
    if (rec.cap === next) return;
    this.validate(next);
    rec.cap = next;
    this.schedule();
  }

  private release(id: string): void {
    const rec = this.recs.get(id);
    if (!rec) return;
    rec.refCount--;
    if (rec.refCount <= 0) {
      this.recs.delete(id);
      if (rec.cap.tool) this.cache.invalidateTool(rec.cap.tool.name);
    }
    this.schedule();
  }

  has(id: string): boolean {
    return this.recs.has(id);
  }

  private validate(cap: Capability): void {
    if (!cap.tool) return;
    const violations = checkLimits({
      name: cap.tool.name,
      description: cap.tool.description,
      inputSchema: safeSchema(cap.tool.inputSchema),
    });
    for (const v of violations) {
      if (this.strictLimits) throw new Error(v.message);
      this.warn(v.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Groups, scopes, tiers

  describeGroup(group: string, description: string): void {
    this.groupDescriptions.set(group, description);
    this.schedule();
  }

  /** Make a group resident (agent- or app-initiated). Returns the tool names now loaded for it. */
  promote(group: string): string[] {
    this.openGroups.set(group, this.clock());
    for (const key of [...this.evictedUnits]) {
      const u = this.unitsByKey().get(key);
      if (u?.group === group) this.evictedUnits.delete(key);
    }
    this.schedule();
    return this.resolve()
      .filter((t) => t.meta.group === group)
      .map((t) => t.name);
  }

  /** Return a group to its declared tier. */
  demote(group: string): void {
    this.openGroups.delete(group);
    this.schedule();
  }

  isOpen(group: string): boolean {
    return this.openGroups.has(group);
  }

  /** Scope visibility, driven by <ToolScope>'s IntersectionObserver. */
  hideScope(scope: string): void {
    this.hiddenScopes.add(scope);
    this.schedule();
  }

  showScope(scope: string): void {
    this.hiddenScopes.delete(scope);
    this.schedule();
  }

  // ---------------------------------------------------------------------------
  // Adapters

  addAdapter(adapter: AgentAdapter): () => void {
    if (this.adapters.some((a) => a.id === adapter.id)) {
      this.warn(`Adapter "${adapter.id}" added twice; ignoring the second.`);
      return () => {};
    }
    this.adapters.push(adapter);
    this.registered.set(adapter.id, new Map());
    this.schedule();
    return () => this.removeAdapter(adapter.id);
  }

  removeAdapter(id: string): void {
    const idx = this.adapters.findIndex((a) => a.id === id);
    if (idx < 0) return;
    this.adapters.splice(idx, 1);
    const map = this.registered.get(id);
    if (map) for (const r of map.values()) safeCall(r.unregister);
    this.registered.delete(id);
    this.notify();
  }

  getAdapters(): readonly AgentAdapter[] {
    return this.adapters;
  }

  // ---------------------------------------------------------------------------
  // Resolution

  private unitsByKey(): Map<string, Unit> {
    const units = new Map<string, Unit>();
    for (const rec of this.recs.values()) {
      const cap = rec.cap;
      if (!cap.tool) continue;
      const bucket = fanInBucket(cap);
      if (bucket) {
        const key = `fan-in:${bucket}`;
        let u = units.get(key);
        if (!u) {
          u = {
            key,
            kind: "fan-in",
            recs: [],
            name: bucket,
            group: cap.group,
            declaredTier: cap.tier ?? 0,
            priority: cap.priority ?? 0,
            order: rec.order,
          };
          units.set(key, u);
        }
        u.recs.push(rec);
        u.declaredTier = Math.min(u.declaredTier, cap.tier ?? 0) as Tier;
        u.priority = Math.max(u.priority, cap.priority ?? 0);
        u.order = Math.min(u.order, rec.order);
        if (u.group !== cap.group) this.warn(`Fan-in "${bucket}" mixes groups "${u.group}" and "${cap.group}".`);
      } else {
        units.set(rec.id, {
          key: rec.id,
          kind: "capability",
          recs: [rec],
          name: cap.tool.name,
          group: cap.group,
          declaredTier: cap.tier ?? 0,
          priority: cap.priority ?? 0,
          order: rec.order,
        });
      }
    }
    return units;
  }

  private isHidden(u: Unit): boolean {
    return u.recs.every((r) => r.scope !== undefined && this.hiddenScopes.has(r.scope));
  }

  private isEligible(u: Unit): boolean {
    if (u.group && this.openGroups.has(u.group)) return true;
    if (u.declaredTier !== 0) return false;
    return !this.isHidden(u);
  }

  /** Compute the resident tool set. Pure apart from eviction bookkeeping and warnings. */
  resolve(): NormalizedTool[] {
    const units = [...this.unitsByKey().values()].sort((a, b) => a.order - b.order);
    const eligible = units.filter((u) => this.isEligible(u));
    const listable = units.filter((u) => !this.isEligible(u) && u.declaredTier <= 1);

    // Meta tools cost two slots. They appear when something is unlockable and
    // stay once a group has been opened, so an agent's tool list stops churning.
    let metaCount = this.metaTools && (listable.length > 0 || this.openGroups.size > 0) ? 2 : 0;
    let decision = applyBudget(eligible.map((u) => this.candidate(u)), this.budget - metaCount);
    if (decision.evicted.length && metaCount === 0 && this.metaTools) {
      metaCount = 2;
      decision = applyBudget(eligible.map((u) => this.candidate(u)), this.budget - metaCount);
    }

    const before = new Set(this.evictedUnits);
    this.evictedUnits = new Set(decision.evicted);
    const keepSet = new Set(decision.keep);
    for (const key of decision.evicted) {
      if (before.has(key)) continue;
      const u = units.find((x) => x.key === key)!;
      const weakestKept = [...eligible]
        .filter((x) => keepSet.has(x.key))
        .sort((a, b) => a.priority - b.priority)[0];
      this.warn(
        `Budget (${this.budget}) exceeded: "${u.name}" demoted to tier 1` +
          (weakestKept ? ` to keep "${weakestKept.name}".` : ".") +
          ` Raise priority, lower the tier, or use fanIn.`,
      );
    }

    const resident: NormalizedTool[] = [];
    const names = new Set<string>();
    for (const u of eligible) {
      if (!keepSet.has(u.key)) continue;
      if (names.has(u.name)) {
        this.warn(`Duplicate tool name "${u.name}" (capability ${u.recs.map((r) => r.id).join(", ")}); only the first registers.`);
        continue;
      }
      names.add(u.name);
      resident.push(this.materialize(u));
    }
    if (metaCount) {
      for (const t of this.metaToolDefs()) {
        if (!names.has(t.name)) resident.push(t);
      }
    }
    this.resident = resident;
    return resident;
  }

  private candidate(u: Unit): BudgetCandidate {
    return {
      key: u.key,
      priority: u.priority,
      declaredTier: u.declaredTier,
      openedAt: u.group ? (this.openGroups.get(u.group) ?? 0) : 0,
      order: u.order,
    };
  }

  private materialize(u: Unit): NormalizedTool {
    const fingerprint =
      u.recs.map((r) => `${r.id}:${r.cap.tool ? fingerprintTool(r.cap.tool) : ""}`).join("|") + `#${u.declaredTier}`;
    const existing = this.materialized.get(u.key);
    if (existing && existing.fingerprint === fingerprint) return existing.tool;
    const tool = u.kind === "fan-in" ? this.buildFanIn(u) : this.buildTool(u.recs[0]!);
    tool.meta.version = ++this.version;
    this.materialized.set(u.key, { tool, fingerprint });
    return tool;
  }

  private buildTool(rec: Rec): NormalizedTool {
    const cap = rec.cap;
    const t = cap.tool!;
    const annotations = inferAnnotations(t);
    let inputSchema: JSONSchema;
    try {
      inputSchema = toJsonSchema(t.inputSchema);
    } catch (e) {
      this.warn(`${(e as Error).message} (capability ${cap.id})`);
      inputSchema = { type: "object", properties: {} };
    }
    if (t.output?.paginate) inputSchema = withCursor(inputSchema);
    const tool: NormalizedTool = {
      name: t.name,
      description: t.description,
      inputSchema,
      annotations,
      execute: (input, ctx) => this.runCapability(rec, input, ctx),
      meta: {
        capabilityIds: [cap.id],
        group: cap.group,
        tier: 0,
        schemaChars: schemaChars({ name: t.name, title: t.title, description: t.description, inputSchema }),
        version: 0,
        kind: "capability",
      },
    };
    if (t.title) tool.title = t.title;
    if (t.exposedTo) tool.exposedTo = t.exposedTo;
    return tool;
  }

  private buildFanIn(u: Unit): NormalizedTool {
    const members = u.recs.filter((r) => r.cap.tool);
    const actions = members.map((r) => actionName(r));
    let description = "";
    let title: string | undefined;
    let anyInput = false;
    for (const r of members) {
      const f = r.cap.fanIn;
      if (typeof f === "object") {
        if (!description && f.description) description = f.description;
        if (!title && f.title) title = f.title;
      }
      const schema = safeSchema(r.cap.tool!.inputSchema);
      if (schema && Object.keys((schema.properties as object) ?? {}).length) anyInput = true;
    }
    const lines = members.map((r) => `${actionName(r)}: ${summaryOf(r.cap)}`);
    let full = `${description || "Run one action."} Actions: ${lines.join("; ")}`;
    if (full.length > LIMITS.toolDescription) {
      this.warn(`Fan-in "${u.name}" description is ${full.length} chars; truncating to ${LIMITS.toolDescription}.`);
      full = hardTruncate(full, LIMITS.toolDescription);
    }
    const properties: Record<string, JSONSchema> = {
      action: { type: "string", enum: actions, description: "Which action to run." },
    };
    if (anyInput) properties.input = { type: "object", description: "Arguments for the chosen action." };
    const inputSchema: JSONSchema = { type: "object", properties, required: ["action"] };
    const annotations: ToolAnnotations = {
      readOnlyHint: members.every((r) => inferAnnotations(r.cap.tool!).readOnlyHint === true),
      consequentialHint: members.some((r) => inferAnnotations(r.cap.tool!).consequentialHint === true),
      untrustedContentHint: members.some((r) => inferAnnotations(r.cap.tool!).untrustedContentHint === true),
    };
    const exposedTo = members.find((r) => r.cap.tool!.exposedTo)?.cap.tool!.exposedTo;
    const tool: NormalizedTool = {
      name: u.name,
      description: full,
      inputSchema,
      annotations,
      execute: async (input, ctx) => {
        const parsed = parseInput(input);
        if (!parsed.ok) return errorText(parsed.error);
        const obj = (parsed.value ?? {}) as Record<string, unknown>;
        const rec = members.find((r) => actionName(r) === obj.action);
        if (!rec) return errorText(`Unknown action "${String(obj.action)}". Allowed: ${actions.join(", ")}.`);
        return this.runCapability(rec, obj.input ?? {}, ctx, u.name);
      },
      meta: {
        capabilityIds: members.map((r) => r.id),
        group: u.group,
        tier: 0,
        schemaChars: schemaChars({ name: u.name, title, description: full, inputSchema }),
        version: 0,
        kind: "fan-in",
      },
    };
    if (title) tool.title = title;
    if (exposedTo) tool.exposedTo = exposedTo;
    return tool;
  }

  private metaToolDefs(): NormalizedTool[] {
    if (this.metaDefs) return this.metaDefs;
    const listName = `${this.metaPrefix}list_capabilities`;
    const openName = `${this.metaPrefix}open_capability`;
    const list: NormalizedTool = {
      name: listName,
      title: "List capabilities",
      description: `List capability groups on this page whose tools are not loaded yet. Call ${openName} with a group name to load them.`,
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        this.markPresent();
        return hardTruncate(this.index(), this.maxOutputChars);
      },
      meta: { capabilityIds: [], tier: 0, schemaChars: 0, version: 1, kind: "meta" },
    };
    const open: NormalizedTool = {
      name: openName,
      title: "Open capability group",
      description:
        "Load the tools for one capability group. They are available once this returns; re-read the tool list. Loading a group may unload the least recently used one.",
      inputSchema: {
        type: "object",
        properties: { group: { type: "string", description: `Group name from ${listName}.` } },
        required: ["group"],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        this.markPresent();
        const parsed = parseInput(input);
        if (!parsed.ok) return errorText(parsed.error);
        const group = String((parsed.value as { group?: unknown })?.group ?? "");
        const groups = this.groupSummaries();
        const target = groups.find((g) => g.name === group);
        if (!target) {
          const available = groups.filter((g) => !g.dormant).map((g) => g.name);
          return errorText(`Unknown group "${group}". Available: ${available.join(", ") || "(none)"}.`);
        }
        if (target.dormant) return errorText(`Group "${group}" is not available to agents on this page.`);
        const before = new Set(this.resident.map((t) => t.name));
        const names = this.promote(group);
        await this.flush();
        const loaded = this.resident.filter((t) => t.meta.group === group);
        const unloaded = [...before].filter((n) => !this.resident.some((t) => t.name === n));
        const lines = loaded.map((t) => `${t.name}: ${firstLine(t.description)}`);
        let text = `Loaded ${loaded.length} tool${loaded.length === 1 ? "" : "s"} for "${group}": ${lines.join("; ")}`;
        if (names.length > loaded.length) text += ` (${names.length - loaded.length} did not fit the budget)`;
        if (unloaded.length) text += `. Unloaded: ${unloaded.join(", ")}`;
        return hardTruncate(text, this.maxOutputChars);
      },
      meta: { capabilityIds: [], tier: 0, schemaChars: 0, version: 1, kind: "meta" },
    };
    for (const t of [list, open]) t.meta.schemaChars = schemaChars(t);
    this.metaDefs = [list, open];
    return this.metaDefs;
  }

  private groupSummaries(): GroupSummary[] {
    const units = [...this.unitsByKey().values()];
    const byGroup = new Map<string, Unit[]>();
    for (const u of units) {
      const g = u.group ?? "other";
      let arr = byGroup.get(g);
      if (!arr) byGroup.set(g, (arr = []));
      arr.push(u);
    }
    return [...byGroup.entries()]
      .map(([name, us]) => ({
        name,
        description: this.groupDescriptions.get(name),
        units: us,
        open: this.openGroups.has(name),
        dormant: us.every((u) => u.declaredTier === 2),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** One line per group of capabilities that are not currently resident. */
  index(): string {
    const lines: string[] = [];
    const residentNames = new Set(this.resident.map((t) => t.name));
    for (const g of this.groupSummaries()) {
      if (g.dormant) continue;
      const pending = g.units.filter((u) => !residentNames.has(u.name) && u.declaredTier <= 1);
      if (!pending.length) continue;
      const desc = g.description ? ` (${g.description})` : "";
      lines.push(`${g.name}${desc} [${pending.length}]: ${pending.map((u) => u.name).join(", ")}`);
    }
    return lines.length ? lines.join("\n") : "All capabilities are already loaded.";
  }

  // ---------------------------------------------------------------------------
  // Execution

  /** Execute a resident tool by name. Used by the memory adapter and devtools. */
  async invoke(toolName: string, input: unknown, ctx: { adapter?: string; signal?: AbortSignal } = {}): Promise<string> {
    const tool = this.resident.find((t) => t.name === toolName);
    if (!tool) return errorText(`Tool "${toolName}" is not loaded. Call list_capabilities to see what can be opened.`);
    return tool.execute(input, ctx);
  }

  private markPresent(): void {
    if (!this.agentPresent) {
      this.agentPresent = true;
      this.notify();
    }
  }

  private async runCapability(
    rec: Rec,
    input: unknown,
    ctx: { adapter?: string; signal?: AbortSignal } | undefined,
    viaTool?: string,
  ): Promise<string> {
    this.markPresent();
    const cap = rec.cap;
    const t = cap.tool!;
    const toolName = viaTool ?? t.name;
    const parsed = parseInput(input);
    if (!parsed.ok) return errorText(parsed.error);
    let raw = (parsed.value ?? {}) as Record<string, unknown>;
    if (typeof raw !== "object" || Array.isArray(raw)) return errorText("Input must be a JSON object.");

    let offset = 0;
    if (t.output?.paginate && CURSOR_PARAM in raw) {
      offset = decodeCursor(raw[CURSOR_PARAM]);
      const { [CURSOR_PARAM]: _cursor, ...rest } = raw;
      raw = rest;
    }

    const validated = await validateInput(t.inputSchema, raw);
    if (!validated.ok) return errorText("Invalid input.", { issues: validated.issues });
    const args = validated.value;

    const annotations = inferAnnotations(t);
    const execCtx: ExecuteContext = {
      capabilityId: cap.id,
      toolName,
      adapter: ctx?.adapter ?? "unknown",
      signal: ctx?.signal,
      confirm: (message) => this.confirm({ capabilityId: cap.id, toolName, title: t.title ?? t.name, message, args }),
    };

    const needsConfirm = t.confirm === undefined ? annotations.consequentialHint === true : t.confirm !== false;
    if (needsConfirm) {
      const message =
        typeof t.confirm === "string"
          ? t.confirm
          : typeof t.confirm === "function"
            ? t.confirm(args as never)
            : `Allow the agent to run "${t.title ?? t.name}"?`;
      const ok = await this.confirm({ capabilityId: cap.id, toolName, title: t.title ?? t.name, message, args });
      if (!ok) return errorText("The user declined this action.", { declined: true });
    }

    const cacheOpts = t.cache === false ? undefined : (t.cache ?? (annotations.readOnlyHint ? {} : undefined));
    const cacheKey = cacheOpts ? `${t.name}:${cacheOpts.key ? cacheOpts.key(args as never) : canonicalize(args)}` : undefined;

    let result: unknown;
    let fromCache = false;
    if (cacheKey) {
      const hit = this.cache.get(cacheKey);
      if (hit.hit) {
        result = hit.value;
        fromCache = true;
      }
    }
    if (!fromCache) {
      try {
        result = await t.execute(args as never, execCtx);
      } catch (e) {
        this.notify();
        return errorText(e instanceof Error ? e.message : String(e));
      }
      if (cacheKey && cacheOpts) this.cache.set(cacheKey, result, { ttl: cacheOpts.ttl, tags: cacheOpts.tags });
      if (t.invalidates?.length) this.cache.invalidate(t.invalidates);
    }
    this.notify();

    const shaped = shape(result, { ...t.output, maxChars: t.output?.maxChars ?? this.maxOutputChars }, offset);
    return shaped.text;
  }

  private async confirm(req: ConfirmRequest): Promise<boolean> {
    if (this.confirmHandler) return this.confirmHandler(req);
    if (!this.confirmWarned) {
      this.confirmWarned = true;
      this.warn(
        `No confirm handler configured; consequential tool "${req.toolName}" ran without user confirmation. ` +
          `Pass \`confirm\` to createAgentable() or mount <AgentableProvider>.`,
      );
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Sync

  private schedule(): void {
    if (this.scheduled || this.disposed) return;
    this.scheduled = true;
    queueMicrotask(() => {
      if (!this.scheduled) return;
      this.scheduled = false;
      if (this.disposed) return;
      this.resolve();
      this.syncing = this.syncing.then(() => this.sync()).catch(() => {});
      this.notify();
    });
  }

  /** Resolve immediately and wait for adapters to finish registering. */
  async flush(): Promise<void> {
    this.scheduled = false;
    this.resolve();
    this.syncing = this.syncing.then(() => this.sync()).catch(() => {});
    await this.syncing;
    this.notify();
  }

  private async sync(): Promise<void> {
    const desired = new Map(this.resident.map((t) => [t.name, t] as const));
    for (const adapter of this.adapters) {
      if (!adapter.available()) continue;
      const map = this.registered.get(adapter.id)!;
      for (const [name, reg] of [...map.entries()]) {
        const want = desired.get(name);
        if (!want || want.meta.version !== reg.version) {
          safeCall(reg.unregister);
          map.delete(name);
        }
      }
      for (const [name, tool] of desired) {
        if (map.has(name)) continue;
        try {
          const unregister = await adapter.register(tool);
          const stillWanted =
            this.adapters.includes(adapter) && this.resident.find((t) => t.name === name)?.meta.version === tool.meta.version;
          if (!stillWanted) {
            safeCall(unregister);
            continue;
          }
          map.set(name, { version: tool.meta.version, unregister });
        } catch (e) {
          this.warn(`Adapter "${adapter.id}" failed to register "${name}": ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Observation

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    if (!this.listeners.size) return;
    const snap = this.snapshot();
    for (const l of this.listeners) safeCall(() => l(snap));
  }

  getResident(): readonly NormalizedTool[] {
    return this.resident;
  }

  /** Capabilities that carry a render descriptor (for generative UI). */
  catalog(): Array<{ id: string; group?: string; tier: Tier; render: RenderDescriptor }> {
    const out: Array<{ id: string; group?: string; tier: Tier; render: RenderDescriptor }> = [];
    for (const rec of this.recs.values()) {
      if (rec.cap.render) out.push({ id: rec.id, group: rec.cap.group, tier: rec.cap.tier ?? 0, render: rec.cap.render });
    }
    return out;
  }

  get isAgentPresent(): boolean {
    return this.agentPresent;
  }

  snapshot(): Snapshot {
    const units = this.unitsByKey();
    const residentNames = new Set(this.resident.map((t) => t.name));
    const capabilities: CapabilityState[] = [];
    for (const rec of this.recs.values()) {
      const cap = rec.cap;
      const bucket = fanInBucket(cap);
      const unit = bucket ? units.get(`fan-in:${bucket}`) : units.get(rec.id);
      const declaredTier = cap.tier ?? 0;
      let effectiveTier: Tier = declaredTier;
      let reason: CapabilityState["reason"] | undefined;
      if (!cap.tool) reason = "no-tool";
      else if (unit && residentNames.has(unit.name)) effectiveTier = 0;
      else if (unit && this.evictedUnits.has(unit.key)) {
        effectiveTier = 1;
        reason = "evicted";
      } else if (unit && declaredTier === 0 && this.isHidden(unit)) {
        effectiveTier = 1;
        reason = "hidden";
      } else reason = "tier";
      capabilities.push({
        id: rec.id,
        group: cap.group,
        declaredTier,
        effectiveTier,
        priority: cap.priority ?? 0,
        refCount: rec.refCount,
        toolName: cap.tool?.name,
        fanIn: bucket,
        hasRender: !!cap.render,
        reason,
      });
    }
    const metaTools = this.resident.filter((t) => t.meta.kind === "meta").length;
    const chars = this.resident.reduce((n, t) => n + t.meta.schemaChars, 0);
    return {
      resident: this.resident.map((t) => ({
        name: t.name,
        kind: t.meta.kind,
        group: t.meta.group,
        schemaChars: t.meta.schemaChars,
        capabilityIds: t.meta.capabilityIds,
      })),
      capabilities,
      groups: this.groupSummaries().map((g) => ({
        name: g.name,
        size: g.units.length,
        open: g.open,
        hidden: g.units.every((u) => this.isHidden(u)),
      })),
      budget: { max: this.budget, used: this.resident.length, metaTools },
      cache: this.cache.stats(),
      adapters: this.adapters.map((a) => ({ id: a.id, available: a.available() })),
      warnings: [...this.warnings],
      estimatedTokens: estimateTokens(chars),
      agentPresent: this.agentPresent,
    };
  }

  private warn(message: string): void {
    if (this.warned.has(message)) return;
    this.warned.add(message);
    this.warnings.push(message);
    if (this.warnings.length > 100) this.warnings.shift();
    safeCall(() => this.onWarn(message));
  }

  clearCache(): void {
    this.cache.clear();
    this.notify();
  }

  dispose(): void {
    this.disposed = true;
    for (const [, map] of this.registered) for (const r of map.values()) safeCall(r.unregister);
    this.registered.clear();
    this.adapters = [];
    this.recs.clear();
    this.listeners.clear();
    this.cache.clear();
  }
}

export function createAgentable(options?: AgentableOptions): Agentable {
  return new Agentable(options);
}

// -----------------------------------------------------------------------------
// helpers

function fanInBucket(cap: Capability): string | undefined {
  if (!cap.fanIn) return undefined;
  return typeof cap.fanIn === "string" ? cap.fanIn : cap.fanIn.bucket;
}

function actionName(rec: Rec): string {
  return rec.cap.tool!.name;
}

function summaryOf(cap: Capability): string {
  return cap.summary ?? firstLine(cap.tool?.description ?? "");
}

function firstLine(text: string): string {
  const s = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return s.length > 90 ? s.slice(0, 87) + "..." : s;
}

export function inferAnnotations(t: CapabilityTool): ToolAnnotations {
  const a = t.annotations ?? {};
  const readOnly = a.readOnlyHint ?? false;
  const consequential = a.consequentialHint ?? !readOnly;
  return { ...a, readOnlyHint: readOnly, consequentialHint: consequential };
}

function withCursor(schema: JSONSchema): JSONSchema {
  if (schema.type !== "object" && schema.properties === undefined) return schema;
  const props = { ...((schema.properties as Record<string, unknown>) ?? {}) };
  if (!(CURSOR_PARAM in props)) props[CURSOR_PARAM] = { type: "string", description: "Cursor from a previous page to continue." };
  return { ...schema, type: "object", properties: props };
}

function safeSchema(schema: SchemaInput | undefined): JSONSchema | undefined {
  try {
    return schema ? toJsonSchema(schema) : undefined;
  } catch {
    return undefined;
  }
}

function fingerprintTool(t: CapabilityTool): string {
  let schema = "";
  try {
    schema = JSON.stringify(toJsonSchema(t.inputSchema));
  } catch {
    schema = "?";
  }
  return [
    t.name,
    t.title ?? "",
    t.description,
    schema,
    JSON.stringify(t.annotations ?? {}),
    JSON.stringify(t.exposedTo ?? null),
    t.output?.paginate ? "p" : "",
  ].join(" ");
}

export function errorText(message: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ error: message, ...extra });
}

function safeCall(fn: () => void): void {
  try {
    fn();
  } catch {
    // ignore
  }
}
