import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createLibrary, type LangError, type Library } from "@agentable-ui/lang";
import { useAgentable, useAgentableSnapshot } from "@agentable-ui/react";
import { renderSpec, type Catalog, type RenderContext } from "./index.js";
import { validateSpec, type SpecIssue, type UIAction, type UISpec } from "./spec.js";
import { createUiStore, interpolate, type StateAction } from "./state.js";

export interface RendererError {
  code: string;
  message: string;
  line?: number;
  path?: string;
}

export interface RendererProps {
  /** Components the program may use. The library (signatures, prompt) is derived from it. */
  components: Catalog;
  /** Pass a prebuilt library to share it with prompt generation. */
  library?: Library;
  /** The program text received so far. */
  response: string;
  /** True while tokens are still arriving: partial lines are held back and the UI is inert. */
  isStreaming?: boolean;
  /** App data the program may bind to as $data.*. */
  data?: Record<string, unknown>;
  /** Functions @Tool may call by name. Names not here fall back to the Agentable registry when a provider is mounted. */
  tools?: Record<string, (args: Record<string, unknown>) => unknown | Promise<unknown>>;
  /** Text sent by @Say. */
  onMessage?: (text: string, node: UISpec) => void;
  /** Structured parse and validation errors; `[]` once clean. Warnings are left out. */
  onError?: (errors: RendererError[]) => void;
  /** An action failed or was declined. */
  onActionError?: (message: string, node: UISpec) => void;
  /** $ui.* state to start from. */
  initialUi?: Record<string, unknown>;
  onUiChange?: (ui: Record<string, unknown>) => void;
  placeholder?: ReactNode;
  className?: string;
}

/**
 * Renders an Agentable Lang program as it streams. Each complete line is
 * parsed, the tree is validated against the catalog with bad nodes pruned,
 * and the rest draws immediately. Bindings, `when` and actions work exactly
 * as in <AgentSurface>; tool actions go to `tools` or the registry.
 */
export function Renderer({ components, library, response, isStreaming = false, data, tools, onMessage, onError, onActionError, initialUi, onUiChange, placeholder, className }: RendererProps) {
  const lib = useMemo(() => library ?? createLibrary(components), [library, components]);
  const [store] = useState(() => createUiStore(initialUi ?? {}));
  const ui = useSyncExternalStore(store.subscribe, store.get, store.get);
  const agentable = useAgentable();
  const snapshot = useAgentableSnapshot();
  const [spec, setSpec] = useState<UISpec | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dataRef = useRef(data ?? {});
  dataRef.current = data ?? {};
  const toolsRef = useRef(tools);
  toolsRef.current = tools;
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onActionErrorRef = useRef(onActionError);
  onActionErrorRef.current = onActionError;
  const onUiChangeRef = useRef(onUiChange);
  onUiChangeRef.current = onUiChange;

  useEffect(() => store.subscribe(() => onUiChangeRef.current?.(store.get())), [store]);

  // Registry tools an action may reach: tier 0 and 1, by tool name.
  const registryTools = useMemo(() => {
    const out = new Map<string, string>();
    for (const c of snapshot.capabilities) if (c.toolName && c.declaredTier <= 1 && !out.has(c.toolName)) out.set(c.toolName, c.id);
    return out;
  }, [snapshot.capabilities]);
  const registryRef = useRef(registryTools);
  registryRef.current = registryTools;
  const callable = useMemo(() => new Set([...Object.keys(tools ?? {}), ...registryTools.keys()]), [tools, registryTools]);

  const parsed = useMemo(() => lib.parse(isStreaming ? heldBack(response) : response), [lib, response, isStreaming]);

  useEffect(() => {
    let live = true;
    const allowed = new Set(Object.keys(components));
    const errors: RendererError[] = parsed.errors.filter((e) => e.severity === "error" && (e.code !== "no-root" || !isStreaming)).map(fromLang);
    if (!parsed.root) {
      setSpec(null);
      onErrorRef.current?.(errors);
      return;
    }
    void validateSpec(parsed.root as UISpec, components, allowed, { state: { data: dataRef.current, ui: store.get() }, tools: callable, prune: true, maxNodes: 200 }).then((r) => {
      if (!live) return;
      if (r.ok) {
        setSpec(r.spec);
        onErrorRef.current?.([...errors, ...r.issues.map(fromIssue)]);
      } else {
        setSpec(null);
        onErrorRef.current?.([...errors, ...r.issues.map(fromIssue)]);
      }
    });
    return () => {
      live = false;
    };
    // The catalog and callable set change rarely; the program is what streams.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, components, callable, isStreaming]);

  const fail = useCallback((message: string, node: UISpec) => {
    // When the host handles action errors, it owns how they look; don't repeat them inline.
    if (onActionErrorRef.current) onActionErrorRef.current(message, node);
    else setActionError(message);
  }, []);

  const emit = useCallback(
    (node: UISpec, event: string, value: unknown) => {
      const actions = node.on?.[event];
      if (!actions?.length) return;
      void (async () => {
        setActionError(null);
        for (const raw of actions) {
          const action = interpolate<UIAction>(raw, { value }, { data: dataRef.current, ui: store.get() });
          if (action.type === "message") {
            if (!onMessageRef.current) return fail("Nothing is listening for messages here.", node);
            onMessageRef.current(action.text, node);
            continue;
          }
          if (action.type !== "tool") {
            try {
              store.dispatch(action as StateAction);
            } catch (e) {
              return fail(e instanceof Error ? e.message : String(e), node);
            }
            continue;
          }
          let result: unknown;
          const fn = toolsRef.current?.[action.name];
          try {
            if (fn) result = await fn(action.args ?? {});
            else {
              const capId = registryRef.current.get(action.name);
              if (!agentable || !capId) return fail(`Tool "${action.name}" is not available.`, node);
              result = parseResult(await agentable.invokeCapability(capId, action.args ?? {}));
            }
          } catch (e) {
            return fail(e instanceof Error ? e.message : String(e), node);
          }
          if (result && typeof result === "object" && "error" in result) return fail(String((result as { error: unknown }).error), node);
          if (action.into) store.dispatch({ type: "set", path: action.into, value: result });
        }
      })();
    },
    [agentable, store, fail],
  );

  const ctx = useMemo<RenderContext>(() => ({ state: { data: data ?? {}, ui }, emit }), [data, ui, emit]);

  return (
    <div className={className} data-agentable-surface="" data-streaming={isStreaming ? "" : undefined} data-empty={spec ? undefined : ""}>
      {actionError ? (
        <p role="alert" data-agentable-surface-error="">
          {actionError}
        </p>
      ) : null}
      {spec ? (
        <div data-agentable-surface-body="" inert={isStreaming || undefined}>
          {renderSpec(spec, components, "0", ctx)}
        </div>
      ) : (
        (placeholder ?? null)
      )}
    </div>
  );
}

/** While streaming, the last unterminated line is not parsed. */
function heldBack(text: string): string {
  const nl = text.lastIndexOf("\n");
  return nl < 0 ? "" : text.slice(0, nl + 1);
}

const fromLang = (e: LangError): RendererError => ({ code: e.code, message: e.message, line: e.line });
const fromIssue = (i: SpecIssue): RendererError => ({ code: "invalid-node", message: i.message, path: i.path });

function parseResult(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
