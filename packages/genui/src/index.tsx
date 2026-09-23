import { Component, createElement, useCallback, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { toJsonSchema, type Capability, type JSONSchema, type SchemaInput, type Tier } from "@agentable/core";
import { useAgentable, useAgentableSnapshot, useCapability } from "@agentable/react";
import { applyOps, isVisible, resolveProps, validateSpec, type SurfaceOp, type UIAction, type UISpec } from "./spec.js";
import { createUiStore, getPath, interpolate, type StateAction, type SurfaceState } from "./state.js";

export { applyOps, isVisible, resolveProps, validateSpec, type SpecIssue, type SurfaceOp, type ToolAction, type UIAction, type UISpec, type ValidateOptions } from "./spec.js";
export { createUiStore, getPath, interpolate, parsePath, type StateAction, type SurfaceState, type UiStore } from "./state.js";

export interface CatalogComponent<P = Record<string, unknown>> {
  component: ComponentType<P>;
  description: string;
  props: SchemaInput;
  childrenProp?: string;
  /**
   * Events the component can fire: event name -> callback prop. The callback's
   * first argument becomes `{{value}}` in the node's actions, e.g.
   * `{ change: "onChange" }` for an input that calls `onChange(nextValue)`.
   */
  events?: Record<string, string>;
  /** Tier-gate the catalog entry. Tier 1 entries appear in `present` only after their group is opened. */
  tier?: Tier;
  group?: string;
}

export type Catalog = Record<string, CatalogComponent<never>>;

export interface PresentArgs {
  /** The tree to render. Replaces the current one and resets ui state. null clears the surface. */
  root?: UISpec | null;
  /** Patch the current tree (applied after `root` when both are given). */
  ops?: SurfaceOp[];
  /** ui.* state to start from when sending `root`. */
  ui?: Record<string, unknown>;
  /** Optional title shown above the rendered tree. */
  title?: string;
}

const ACTION_TYPES = ["set", "merge", "push", "remove", "increment", "toggle", "tool"];

/** Build the `present` input schema for the currently allowed components. */
export function catalogSchema(catalog: Catalog, allowed: Iterable<string>): JSONSchema {
  const names = [...allowed];
  const action: JSONSchema = {
    type: "object",
    properties: {
      type: { type: "string", enum: ACTION_TYPES },
      path: { type: "string", description: "ui.* path to write." },
      value: {},
      by: { type: "number" },
      name: { type: "string", description: "tool: the tool to call." },
      args: { type: "object", description: "tool: arguments. {{value}} is the event value; {{ui.x}} and {{data.x}} read state." },
      into: { type: "string", description: "tool: ui.* path that receives the result." },
    },
    required: ["type"],
  };
  const node: JSONSchema = {
    type: "object",
    properties: {
      component: { type: "string", enum: names },
      id: { type: "string", description: "Stable id; needed to patch this node with ops." },
      props: { type: "object", description: "Props for the component; see the tool description." },
      bind: { type: "object", additionalProperties: { type: "string" }, description: 'Prop -> state path, e.g. {"value":"data.revenue"}. data.* is app data, ui.* is surface state.' },
      on: { type: "object", additionalProperties: { type: "array", items: { $ref: "#/$defs/action" } }, description: "Event -> actions, run in order." },
      when: { type: "string", description: 'Render only while this path is truthy ("!ui.x" for falsy).' },
      children: { type: "array", items: { $ref: "#/$defs/node" } },
    },
    required: ["component"],
  };
  const op: JSONSchema = {
    type: "object",
    properties: {
      op: { type: "string", enum: ["add", "update", "remove", "set"] },
      parent: { type: "string", description: 'add: parent node id ("root" for the root).' },
      index: { type: "number" },
      node: { $ref: "#/$defs/node" },
      id: { type: "string", description: "remove: node id." },
      path: { type: "string", description: "set: ui.* path." },
      value: {},
    },
    required: ["op"],
  };
  return {
    type: "object",
    $defs: { node, action, op },
    properties: {
      root: { anyOf: [{ $ref: "#/$defs/node" }, { type: "null" }], description: "Tree to render; replaces the current one. null clears." },
      ops: { type: "array", items: { $ref: "#/$defs/op" }, description: "Edit the current tree in place instead of resending it." },
      ui: { type: "object", description: "Initial ui.* state for a new root." },
      title: { type: "string" },
    },
  };
}

function propSummary(schema: JSONSchema): string {
  const props = (schema.properties ?? {}) as Record<string, JSONSchema>;
  const required = new Set((schema.required as string[]) ?? []);
  return Object.entries(props)
    .map(([k, v]) => {
      let t = Array.isArray(v.type) ? v.type.join("|") : String(v.type ?? "any");
      if (Array.isArray(v.enum)) t = v.enum.map(String).join("|");
      if (t === "array") t = `${(v.items as JSONSchema | undefined)?.type ?? "any"}[]`;
      return `${k}${required.has(k) ? "" : "?"}:${t}`;
    })
    .join(",");
}

/** How a rendered node reaches live state and fires its events. Omit for a static render. */
export interface RenderContext {
  state: SurfaceState;
  emit: (node: UISpec, event: string, value: unknown) => void;
}

export function renderSpec(spec: UISpec, catalog: Catalog, key = "0", ctx?: RenderContext): ReactNode {
  const entry = catalog[spec.component];
  if (!entry) return null;
  if (ctx && !isVisible(spec, ctx.state)) return null;
  const props: Record<string, unknown> = { ...(ctx ? resolveProps(spec, ctx.state) : (spec.props ?? {})), key };
  if (ctx && spec.on) {
    for (const [event, prop] of Object.entries(entry.events ?? {})) {
      if (spec.on[event]) props[prop] = (value: unknown) => ctx.emit(spec, event, value);
    }
  }
  if (entry.childrenProp && spec.children?.length) {
    props[entry.childrenProp] = spec.children.map((c, i) => renderSpec(c, catalog, `${key}.${c.id ?? i}`, ctx));
  }
  return createElement(entry.component as ComponentType<Record<string, unknown>>, props);
}

export interface AgentSurfaceProps {
  components: Catalog;
  /** Tool name. Default "present". */
  name?: string;
  id?: string;
  group?: string;
  tier?: Tier;
  priority?: number;
  maxDepth?: number;
  maxNodes?: number;
  placeholder?: ReactNode;
  onPresent?: (spec: UISpec | null, title?: string) => void;
  className?: string;
  /** Show a "clear" affordance. Default true. */
  clearable?: boolean;
  /** App data the agent may bind to as data.*. Read-only to generated UI; re-renders when it changes. */
  data?: Record<string, unknown>;
  /**
   * Tools that `tool` actions may call. Default: every tool an agent can reach
   * on this page (tier 0 and 1). `false` disables tool actions.
   */
  tools?: string[] | false;
  /**
   * Name of the read-only tool that returns surface state and the shape of
   * `data`. Defaults to `<name>_state` when `data` is given; `false` omits it.
   */
  stateTool?: string | false;
  /** Called when an action in the generated UI fails or is declined. */
  onActionError?: (message: string, node: UISpec) => void;
}

/**
 * Renders whatever the agent last called `present` with. Every catalog
 * component is declared as a capability with a `render` descriptor, so the
 * catalog is a projection of the same registry that holds the tools.
 *
 * Nodes can bind props to app data (data.*) or surface state (ui.*), and wire
 * events to actions that write ui.* or call registered tools. A button in the
 * generated UI and an agent reach a tool through the same registry path, so
 * confirmation, caching and invalidation apply to both.
 */
export function AgentSurface({
  components,
  name = "present",
  id,
  group,
  tier,
  priority,
  maxDepth = 6,
  maxNodes = 60,
  placeholder,
  onPresent,
  className,
  clearable = true,
  data,
  tools,
  stateTool,
  onActionError,
}: AgentSurfaceProps) {
  const [state, setState] = useState<{ spec: UISpec | null; title?: string; at: number }>({ spec: null, at: 0 });
  const [error, setError] = useState<string | null>(null);
  const [store] = useState(() => createUiStore());
  const ui = useSyncExternalStore(store.subscribe, store.get, store.get);
  const agentable = useAgentable();
  const snapshot = useAgentableSnapshot();
  const onPresentRef = useRef(onPresent);
  onPresentRef.current = onPresent;
  const onActionErrorRef = useRef(onActionError);
  onActionErrorRef.current = onActionError;
  const catalogRef = useRef(components);
  catalogRef.current = components;
  const specRef = useRef(state.spec);
  specRef.current = state.spec;
  const dataRef = useRef<Record<string, unknown>>(data ?? {});
  dataRef.current = data ?? {};

  const baseId = id ?? `genui.${name}`;
  const readName = stateTool === undefined ? (data ? `${name}_state` : false) : stateTool;

  const openGroups = useMemo(() => new Set(snapshot.groups.filter((g) => g.open).map((g) => g.name)), [snapshot.groups]);
  const allowed = useMemo(() => {
    const out = new Set<string>();
    for (const [n, e] of Object.entries(components)) {
      const t = e.tier ?? 0;
      if (t === 0 || (e.group && openGroups.has(e.group))) out.add(n);
    }
    return out;
  }, [components, openGroups]);
  const allowedKey = [...allowed].join(",");
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;

  // Tool name -> capability id for everything generated UI may call.
  const callable = useMemo(() => {
    const out = new Map<string, string>();
    if (tools === false) return out;
    const only = tools ? new Set(tools) : null;
    for (const c of snapshot.capabilities) {
      if (!c.toolName || c.declaredTier > 1 || c.id.startsWith(`${baseId}.`) || c.id === baseId) continue;
      if (only && !only.has(c.toolName)) continue;
      if (!out.has(c.toolName)) out.set(c.toolName, c.id);
    }
    return out;
  }, [snapshot.capabilities, tools, baseId]);
  const callableRef = useRef(callable);
  callableRef.current = callable;

  // Catalog entries as capabilities with render descriptors (no tool).
  const entryCaps = useMemo<Capability[]>(
    () =>
      Object.entries(components).map(([n, e]) => ({
        id: `${baseId}.catalog.${n}`,
        group: e.group ?? group,
        tier: e.tier ?? 0,
        render: { component: n, props: e.props, description: e.description },
      })),
    [components, baseId, group],
  );

  const description = useMemo(() => {
    const lines = [...allowed].map((n) => {
      const e = components[n]!;
      let schema: JSONSchema;
      try {
        schema = toJsonSchema(e.props);
      } catch {
        schema = {};
      }
      const events = Object.keys(e.events ?? {});
      return `${n}{${propSummary(schema)}}${e.childrenProp ? "+children" : ""}${events.length ? ` on:${events.join("|")}` : ""}`;
    });
    let text = "Render UI with this app's components: a tree of {component, props, children}. Nodes can bind props to state, run actions on events, and be patched by id via ops.";
    if (readName) text += ` Call ${readName} for bindable data.`;
    text += ` Components: ${lines.join(" ")}`;
    if (text.length > 500) text = text.slice(0, 497) + "...";
    return text;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedKey, components, readName]);

  const inputSchema = useMemo(() => catalogSchema(components, allowed), [components, allowed]);

  const clear = useCallback(() => {
    store.replace({});
    setError(null);
    setState({ spec: null, at: Date.now() });
  }, [store]);

  const execute = useCallback(
    async (args: PresentArgs) => {
      if (args.root === null) {
        clear();
        onPresentRef.current?.(null);
        return { cleared: true };
      }
      if (args.root === undefined && !args.ops?.length) return { error: "Send root to render a tree, ops to patch it, or root: null to clear." };
      let tree = args.root ?? specRef.current;
      if (!tree) return { error: "Nothing is presented yet; send root first." };
      const draft = createUiStore(args.root ? (args.ui ?? {}) : store.get());
      try {
        if (args.ops?.length) {
          const patched = applyOps(tree, args.ops);
          tree = patched.root;
          if (patched.state.length) draft.dispatch(patched.state);
        }
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
      const result = await validateSpec(tree, catalogRef.current, allowedRef.current, {
        maxDepth,
        maxNodes,
        state: { data: dataRef.current, ui: draft.get() },
        tools: new Set(callableRef.current.keys()),
      });
      if (!result.ok) return { error: "Invalid UI spec.", issues: result.issues };
      const title = args.title ?? (args.root ? undefined : state.title);
      store.replace(draft.get());
      setError(null);
      setState({ spec: result.spec, title, at: args.root ? Date.now() : state.at });
      onPresentRef.current?.(result.spec, title);
      return { rendered: true, nodes: result.nodes };
    },
    [maxDepth, maxNodes, store, clear, state.title, state.at],
  );

  useCapability<PresentArgs, unknown>({
    id: baseId,
    group,
    tier,
    priority,
    tool: {
      name,
      title: "Present UI",
      description,
      inputSchema,
      annotations: { readOnlyHint: false, consequentialHint: false },
      confirm: false,
      execute,
    },
  });

  useCapability<{ path?: string }, unknown>(
    readName
      ? {
          id: `${baseId}.state`,
          group,
          tier,
          priority,
          tool: {
            name: readName,
            title: "Read surface state",
            description: `Read what ${name} can bind to. Without a path: the shape of data.*, current ui.* state and the presented tree. With a path (e.g. "data.orders"): that value.`,
            inputSchema: { type: "object", properties: { path: { type: "string", description: "data.* or ui.* path." } } },
            annotations: { readOnlyHint: true },
            cache: false,
            execute: ({ path }) => {
              const s: SurfaceState = { data: dataRef.current, ui: store.get() };
              if (path) return getPath(s, path) ?? null;
              return { data: shapeOf(s.data), ui: s.ui, tree: specRef.current };
            },
          },
        }
      : null,
  );

  const fail = useCallback((message: string, node: UISpec) => {
    setError(message);
    onActionErrorRef.current?.(message, node);
  }, []);

  const emit = useCallback(
    (node: UISpec, event: string, value: unknown) => {
      const actions = node.on?.[event];
      if (!actions?.length) return;
      void (async () => {
        setError(null);
        for (const raw of actions) {
          // Resolve each action against state as it is now, so later actions see earlier writes.
          const action = interpolate<UIAction>(raw, { value }, { data: dataRef.current, ui: store.get() });
          if (action.type !== "tool") {
            try {
              store.dispatch(action as StateAction);
            } catch (e) {
              return fail(e instanceof Error ? e.message : String(e), node);
            }
            continue;
          }
          const capId = callableRef.current.get(action.name);
          if (!agentable || !capId) return fail(`Tool "${action.name}" is not available.`, node);
          const out = await agentable.invokeCapability(capId, action.args ?? {});
          const result = parseResult(out);
          if (result && typeof result === "object" && "error" in result) return fail(String((result as { error: unknown }).error), node);
          if (action.into) store.dispatch({ type: "set", path: action.into, value: result });
        }
      })();
    },
    [agentable, store, fail],
  );

  const ctx = useMemo<RenderContext>(() => ({ state: { data: data ?? {}, ui }, emit }), [data, ui, emit]);

  return (
    <div className={className} data-agentable-surface="" data-empty={state.spec ? undefined : ""}>
      {entryCaps.map((c) => (
        <DeclareRender key={c.id} cap={c} />
      ))}
      {state.spec ? (
        <>
          {state.title || clearable ? (
            <div data-agentable-surface-header="">
              {state.title ? <h3>{state.title}</h3> : <span />}
              {clearable ? (
                <button type="button" onClick={clear} data-agentable-button="" aria-label="Clear agent output">
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p role="alert" data-agentable-surface-error="">
              {error}
            </p>
          ) : null}
          <SurfaceBoundary key={state.at}>
            <div data-agentable-surface-body="">{renderSpec(state.spec, components, "0", ctx)}</div>
          </SurfaceBoundary>
        </>
      ) : (
        (placeholder ?? null)
      )}
    </div>
  );
}

function DeclareRender({ cap }: { cap: Capability }) {
  useCapability(cap);
  return null;
}

/** Bound values change after validation; a component that throws on them must not take the page down. */
class SurfaceBoundary extends Component<{ children: ReactNode }, { failed: string | null }> {
  override state = { failed: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { failed: e instanceof Error ? e.message : String(e) };
  }
  override render() {
    if (this.state.failed)
      return (
        <p role="alert" data-agentable-surface-error="">
          This view failed to render: {this.state.failed}
        </p>
      );
    return this.props.children;
  }
}

function parseResult(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** A compact description of data for the agent: keys, array lengths, a sample item's fields. */
function shapeOf(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" && !Array.isArray(first) ? { array: value.length, item: Object.keys(first) } : { array: value.length };
  }
  if (value && typeof value === "object") {
    if (depth >= 2) return Object.keys(value);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shapeOf(v, depth + 1)]));
  }
  return typeof value;
}
