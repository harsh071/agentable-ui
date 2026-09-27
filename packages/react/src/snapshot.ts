import { useCallback, useContext, useRef, useSyncExternalStore } from "react";
import type { Snapshot } from "@agentable-ui/core";
import { AgentableContext } from "./context.js";

const EMPTY: Snapshot = {
  resident: [],
  capabilities: [],
  groups: [],
  budget: { max: 0, used: 0, metaTools: 0 },
  cache: { hits: 0, misses: 0, size: 0 },
  adapters: [],
  warnings: [],
  estimatedTokens: 0,
  agentPresent: false,
};

/** Live registry snapshot. Re-renders on every registry change; use sparingly. */
export function useAgentableSnapshot(): Snapshot {
  const agentable = useContext(AgentableContext);
  const subscribe = useCallback(
    (cb: () => void) => (agentable ? agentable.subscribe(() => cb()) : () => {}),
    [agentable],
  );
  const get = useCallback(() => (agentable ? agentable.snapshot() : EMPTY), [agentable]);
  // Snapshots are fresh objects; cache the last one per notification to keep uSES stable.
  return useSyncExternalStore(subscribe, useStable(get), () => EMPTY);
}

function useStable<T>(get: () => T): () => T {
  const ref = useRef<{ key: string; value: T } | null>(null);
  return () => {
    const next = get();
    const key = JSON.stringify(next);
    if (!ref.current || key !== ref.current.key) ref.current = { key, value: next };
    return ref.current.value;
  };
}

/** True once the first agent tool call has arrived (the presence heuristic). */
export function useAgentPresent(): boolean {
  return useAgentableSnapshot().agentPresent;
}
