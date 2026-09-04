import { createElement, useCallback, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { toJsonSchema, validateInput, type Capability, type JSONSchema, type SchemaInput, type Tier } from "@agentable/core";
import { useAgentableSnapshot, useCapability } from "@agentable/react";

export interface CatalogComponent<P = Record<string, unknown>> {
  component: ComponentType<P>;
  description: string;
  props: SchemaInput;
  childrenProp?: string;
  /** Tier-gate the catalog entry. Tier 1 entries appear in `present` only after their group is opened. */
  tier?: Tier;
  group?: string;
}

export type Catalog = Record<string, CatalogComponent<never>>;

export interface UISpec {
  component: string;
  props?: Record<string, unknown>;
  children?: UISpec[];
}

export interface PresentArgs {
  /** The tree to render. null clears the surface. */
  root: UISpec | null;
  /** Optional title shown above the rendered tree. */
  title?: string;
}

export interface SpecIssue {
  path: string;
  message: string;
}

export interface ValidateOptions {
  maxDepth?: number;
  maxNodes?: number;
}

/** Validate a spec against the catalog. Unknown props are dropped; unknown components fail. */
export async function validateSpec(spec: UISpec, catalog: Catalog, allowed: Set<string>, opts: ValidateOptions = {}): Promise<{ ok: true; spec: UISpec; nodes: number } | { ok: false; issues: SpecIssue[] }> {
  const maxDepth = opts.maxDepth ?? 6;
  const maxNodes = opts.maxNodes ?? 60;
  const issues: SpecIssue[] = [];
  let nodes = 0;

  async function walk(node: UISpec, path: string, depth: number): Promise<UISpec | null> {
    nodes++;
    if (nodes > maxNodes) {
      issues.push({ path, message: `More than ${maxNodes} nodes.` });
      return null;
    }
    if (depth > maxDepth) {
      issues.push({ path, message: `Deeper than ${maxDepth} levels.` });
      return null;
    }
    if (!node || typeof node !== "object" || typeof node.component !== "string") {
      issues.push({ path, message: "Each node needs a component name." });
      return null;
    }
    const entry = catalog[node.component];
    if (!entry || !allowed.has(node.component)) {
      issues.push({ path, message: `Unknown component "${node.component}". Allowed: ${[...allowed].join(", ")}.` });
      return null;
    }
    const raw = node.props && typeof node.props === "object" ? node.props : {};
    const schema = toJsonSchema(entry.props);
    const known = new Set(Object.keys((schema.properties as object) ?? {}));
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) if (known.has(k)) cleaned[k] = v;
    const result = await validateInput(entry.props, cleaned);
    if (!result.ok) {
      for (const i of result.issues) issues.push({ path: `${path}.props${i.path ? "." + i.path : ""}`, message: i.message });
      return null;
    }
    const out: UISpec = { component: node.component, props: result.value as Record<string, unknown> };
    if (Array.isArray(node.children) && node.children.length) {
      if (!entry.childrenProp) {
        issues.push({ path: `${path}.children`, message: `"${node.component}" does not accept children.` });
      } else {
        const kids: UISpec[] = [];
        for (let i = 0; i < node.children.length; i++) {
          const kid = await walk(node.children[i]!, `${path}.children[${i}]`, depth + 1);
          if (kid) kids.push(kid);
        }
        out.children = kids;
      }
    }
    return out;
  }

  const cleaned = await walk(spec, "root", 1);
  if (issues.length || !cleaned) return { ok: false, issues };
  return { ok: true, spec: cleaned, nodes };
}

/** Build the `present` input schema for the currently allowed components. */
export function catalogSchema(catalog: Catalog, allowed: Iterable<string>): JSONSchema {
  const names = [...allowed];
  const node: JSONSchema = {
    type: "object",
    properties: {
      component: { type: "string", enum: names },
      props: { type: "object", description: "Props for the component; see the tool description." },
      children: { type: "array", items: { $ref: "#/$defs/node" } },
    },
    required: ["component"],
  };
  return {
    type: "object",
    $defs: { node },
    properties: {
      root: { anyOf: [{ $ref: "#/$defs/node" }, { type: "null" }], description: "Component tree to render, or null to clear." },
      title: { type: "string" },
    },
    required: ["root"],
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

export function renderSpec(spec: UISpec, catalog: Catalog, key = "0"): ReactNode {
  const entry = catalog[spec.component];
  if (!entry) return null;
  const props: Record<string, unknown> = { ...(spec.props ?? {}), key };
  if (entry.childrenProp && spec.children?.length) {
    props[entry.childrenProp] = spec.children.map((c, i) => renderSpec(c, catalog, `${key}.${i}`));
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
}

/**
 * Renders whatever the agent last called `present` with. Every catalog
 * component is declared as a capability with a `render` descriptor, so the
 * catalog is a projection of the same registry that holds the tools.
 */
export function AgentSurface({ components, name = "present", id, group, tier, priority, maxDepth = 6, maxNodes = 60, placeholder, onPresent, className, clearable = true }: AgentSurfaceProps) {
  const [state, setState] = useState<{ spec: UISpec | null; title?: string; at: number }>({ spec: null, at: 0 });
  const snapshot = useAgentableSnapshot();
  const onPresentRef = useRef(onPresent);
  onPresentRef.current = onPresent;
  const catalogRef = useRef(components);
  catalogRef.current = components;

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

  // Catalog entries as capabilities with render descriptors (no tool).
  const entryCaps = useMemo<Capability[]>(
    () =>
      Object.entries(components).map(([n, e]) => ({
        id: `${id ?? `genui.${name}`}.catalog.${n}`,
        group: e.group ?? group,
        tier: e.tier ?? 0,
        render: { component: n, props: e.props, description: e.description },
      })),
    [components, id, name, group],
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
      return `${n}{${propSummary(schema)}}${e.childrenProp ? "+children" : ""}`;
    });
    let text = `Render a UI response using this app's components. Pass a tree of {component, props, children}. Components: ${lines.join(" ")}`;
    if (text.length > 500) text = text.slice(0, 497) + "...";
    return text;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedKey, components]);

  const inputSchema = useMemo(() => catalogSchema(components, allowed), [components, allowed]);

  const execute = useCallback(
    async (args: PresentArgs) => {
      if (args.root === null || args.root === undefined) {
        setState({ spec: null, at: Date.now() });
        onPresentRef.current?.(null);
        return { cleared: true };
      }
      const result = await validateSpec(args.root, catalogRef.current, allowedRef.current, { maxDepth, maxNodes });
      if (!result.ok) return { error: "Invalid UI spec.", issues: result.issues };
      setState({ spec: result.spec, title: args.title, at: Date.now() });
      onPresentRef.current?.(result.spec, args.title);
      return { rendered: true, nodes: result.nodes };
    },
    [maxDepth, maxNodes],
  );

  useCapability<PresentArgs, unknown>({
    id: id ?? `genui.${name}`,
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
                <button type="button" onClick={() => setState({ spec: null, at: Date.now() })} data-agentable-button="" aria-label="Clear agent output">
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}
          <div data-agentable-surface-body="" key={state.at}>
            {renderSpec(state.spec, components)}
          </div>
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
