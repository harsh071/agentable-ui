import { useContext, useEffect, useMemo, useRef } from "react";
import type { Capability, CapabilityTool, ExecuteContext } from "@agentable-ui/core";
import { AgentableContext, GroupContext, ScopeContext } from "./context.js";
import { fingerprint } from "./fingerprint.js";

let warnedNoProvider = false;

/**
 * Declare a capability for as long as the component is mounted.
 *
 * - Pass `null`/`undefined` to switch the agent layer off for this component.
 * - The registry only sees a new declaration when the static shape changes;
 *   a fresh `execute` closure on every render costs nothing.
 * - Safe under StrictMode (refcounted) and SSR (effects only).
 */
export function useCapability<A = unknown, R = unknown>(cap: Capability<A, R> | null | undefined): void {
  const agentable = useContext(AgentableContext);
  const scope = useContext(ScopeContext);
  const inheritedGroup = useContext(GroupContext);

  const latest = useRef(cap);
  latest.current = cap;

  const effectiveGroup = cap?.group ?? inheritedGroup;
  const key = fingerprint(cap ? ({ ...(cap as Capability), group: effectiveGroup } as Capability) : null);

  const stable = useMemo<Capability | null>(() => {
    const current = latest.current;
    if (!current) return null;
    const out: Capability = { ...(current as Capability), group: effectiveGroup };
    if (current.tool) {
      const tool: CapabilityTool = {
        ...(current.tool as CapabilityTool),
        execute: (args: unknown, ctx: ExecuteContext) => {
          const t = latest.current?.tool;
          if (!t) throw new Error("Capability is no longer mounted.");
          return t.execute(args as A, ctx);
        },
      };
      if (typeof current.tool.confirm === "function") {
        tool.confirm = (args: unknown) => {
          const c = latest.current?.tool?.confirm;
          return typeof c === "function" ? c(args as A) : "Allow this action?";
        };
      }
      if (current.tool.cache && typeof current.tool.cache === "object" && current.tool.cache.key) {
        const fn = current.tool.cache.key;
        tool.cache = { ...current.tool.cache, key: (a: unknown) => fn(a as A) };
      }
      out.tool = tool;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!stable) return;
    if (!agentable) {
      if (!warnedNoProvider && typeof console !== "undefined") {
        warnedNoProvider = true;
        console.warn(`[agentable] Capability "${stable.id}" declared outside <AgentableProvider>; the agent layer is off.`);
      }
      return;
    }
    const handle = agentable.declare(stable, scope ? { scope } : {});
    return () => handle.release();
  }, [agentable, stable, scope]);
}
