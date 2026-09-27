import { createContext, useContext } from "react";
import type { Agentable } from "@agentable-ui/core";

export const AgentableContext = createContext<Agentable | null>(null);
export const ScopeContext = createContext<string | undefined>(undefined);
export const GroupContext = createContext<string | undefined>(undefined);

/** The registry from the nearest provider, or null when the agent layer is switched off. */
export function useAgentable(): Agentable | null {
  return useContext(AgentableContext);
}

export function useAgentGroup(): string | undefined {
  return useContext(GroupContext);
}
