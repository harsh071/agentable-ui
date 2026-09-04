/**
 * Core types for Agentable. Nothing in this file mentions React or WebMCP.
 */

/** A loose JSON Schema object. We do not model the full grammar. */
export type JSONSchema = Record<string, unknown>;

/**
 * Minimal structural view of the Standard Schema interface
 * (https://standardschema.dev) including the optional Standard JSON Schema
 * extension. zod 4 and valibot 1 both implement this, which lets core convert
 * author-facing schemas to JSON Schema with zero dependencies.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    validate(value: unknown):
      | StandardSchemaResult<Output>
      | Promise<StandardSchemaResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output };
    readonly jsonSchema?: {
      input(options: { target: string }): JSONSchema;
      output?(options: { target: string }): JSONSchema;
    };
  };
}

export type StandardSchemaResult<T> =
  | { value: T; issues?: undefined }
  | { issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> };

/** Either a JSON Schema object or a Standard Schema (zod, valibot, ...). */
export type SchemaInput<A = unknown> = JSONSchema | StandardSchemaV1<A>;

export type Tier = 0 | 1 | 2;

export interface ToolAnnotations {
  /** The tool only reads state. Enables caching by default. */
  readOnlyHint?: boolean;
  /** The tool has effects the user would want to know about. Enables confirm by default. */
  consequentialHint?: boolean;
  /** The output may contain user-generated or third-party content. */
  untrustedContentHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ConfirmRequest {
  capabilityId: string;
  toolName: string;
  title: string;
  message: string;
  args: unknown;
}

export interface ExecuteContext {
  capabilityId: string;
  toolName: string;
  /** Which adapter delivered the call ("webmcp", "memory", "bridge", ...). */
  adapter: string;
  signal?: AbortSignal;
  /** Ask the user to confirm something mid-execution. Resolves false when declined. */
  confirm(message: string): Promise<boolean>;
}

export interface CacheOptions<A = unknown> {
  /** Milliseconds. Defaults to the registry's `cache.defaultTtl`. */
  ttl?: number;
  /** Tags that mutating tools can invalidate. */
  tags?: string[];
  /** Custom key derivation. Defaults to canonical JSON of args. */
  key?: (args: A) => string;
}

export interface OutputOptions {
  /** Hard cap on output characters. Defaults to 1500 (Chrome guidance). */
  maxChars?: number;
  /** Keep only these fields on each returned object (dot paths allowed). */
  project?: string[];
  /** Paginate array results with an opaque cursor. */
  paginate?: boolean | { pageSize?: number };
}

export interface CapabilityTool<A = unknown, R = unknown> {
  /** Validated <= 30 chars, [a-zA-Z0-9_-] at declaration time. */
  name: string;
  title?: string;
  /** Validated <= 500 chars. */
  description: string;
  inputSchema?: SchemaInput<A>;
  annotations?: ToolAnnotations;
  execute: (args: A, ctx: ExecuteContext) => R | Promise<R>;
  /** Memoize results. Defaults to on for readOnly tools. `false` disables. */
  cache?: CacheOptions<A> | false;
  /** Cache tags dropped after a successful run. */
  invalidates?: string[];
  output?: OutputOptions;
  /**
   * Ask the user before running. `true` uses a generated message, a string is
   * the message, a function derives it from args. Defaults to
   * `annotations.consequentialHint`.
   */
  confirm?: boolean | string | ((args: A) => string);
  /** Secure origins allowed to call this tool. Defaults to same-origin only. */
  exposedTo?: string[];
}

export interface RenderDescriptor {
  /** Component name in the generative-UI catalog. */
  component: string;
  props: SchemaInput;
  description?: string;
}

export interface Capability<A = unknown, R = unknown> {
  /** Stable, dot-scoped: "orders.table.query". */
  id: string;
  /** 0 resident, 1 unlockable via open_capability, 2 dormant (app code only). */
  tier?: Tier;
  /** Capabilities in a group unlock together. */
  group?: string;
  /** Higher survives eviction longer. Default 0. */
  priority?: number;
  /** One-line summary used in the capability index. Defaults to tool.description. */
  summary?: string;
  /**
   * Fan-in bucket. All capabilities sharing a bucket collapse into one tool
   * named after the bucket with an `action` enum. The object form lets one
   * member supply the collapsed tool's description and title.
   */
  fanIn?: string | { bucket: string; description?: string; title?: string };
  tool?: CapabilityTool<A, R>;
  render?: RenderDescriptor;
}

/** What adapters see. Framework- and validator-free. */
export interface NormalizedTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: JSONSchema;
  annotations: ToolAnnotations;
  exposedTo?: string[];
  /** Adapter-facing execute. Accepts parsed args or a JSON string; always resolves to a string. */
  execute: (input: unknown, ctx?: { adapter?: string; signal?: AbortSignal }) => Promise<string>;
  meta: {
    capabilityIds: string[];
    group?: string;
    tier: Tier;
    /** Approximate characters the schema costs the agent. */
    schemaChars: number;
    /** Bumps whenever the tool's schema or description changes. */
    version: number;
    kind: "capability" | "fan-in" | "meta";
  };
}

export interface AgentAdapter {
  readonly id: string;
  available(): boolean;
  /** Registers a tool and returns an unregister function. */
  register(tool: NormalizedTool): Promise<() => void> | (() => void);
  /** Optional: notify when the underlying platform's tool list changes. */
  onToolChange?(cb: () => void): () => void;
}

export interface CapabilityHandle {
  readonly id: string;
  /** Replace the declaration. Same id, new descriptor. */
  update(next: Capability): void;
  /** Decrement the refcount. The capability leaves when it hits zero. */
  release(): void;
}

export interface CapabilityState {
  id: string;
  group?: string;
  declaredTier: Tier;
  effectiveTier: Tier;
  priority: number;
  refCount: number;
  toolName?: string;
  fanIn?: string;
  hasRender: boolean;
  /** Why it is not resident, if it is not. */
  reason?: "tier" | "hidden" | "evicted" | "no-tool";
}

export interface Snapshot {
  resident: Array<{
    name: string;
    kind: NormalizedTool["meta"]["kind"];
    group?: string;
    schemaChars: number;
    capabilityIds: string[];
  }>;
  capabilities: CapabilityState[];
  groups: Array<{ name: string; size: number; open: boolean; hidden: boolean }>;
  budget: { max: number; used: number; metaTools: number };
  cache: { hits: number; misses: number; size: number };
  adapters: Array<{ id: string; available: boolean }>;
  warnings: string[];
  /** Rough token estimate for everything resident (chars / 4). */
  estimatedTokens: number;
  /** Set after the first tool call arrives. The spec has no presence signal; this is the heuristic. */
  agentPresent: boolean;
}

export type Listener = (snapshot: Snapshot) => void;

export interface AgentableOptions {
  adapters?: AgentAdapter[];
  /** Max resident tools, including the two meta tools. Default 12. */
  budget?: number;
  /** Register list_capabilities / open_capability when something is unlockable. Default true. */
  metaTools?: boolean;
  cache?: { defaultTtl?: number; maxEntries?: number };
  /** Default output cap in characters. Default 1500. */
  maxOutputChars?: number;
  /**
   * User confirmation for consequential tools. When absent, consequential
   * tools run unconfirmed and a single dev warning is emitted.
   */
  confirm?: (req: ConfirmRequest) => Promise<boolean>;
  /** Dev warnings. Defaults to console.warn, once per distinct message. */
  onWarn?: (message: string) => void;
  /** Throw instead of warn on Chrome character limits. Default false. */
  strictLimits?: boolean;
  /** Namespace prefix for meta tools, e.g. "app" -> "app_list_capabilities". */
  metaPrefix?: string;
}
