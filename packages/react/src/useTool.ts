import type { CapabilityTool, Tier } from "@agentable/core";
import { useCapability } from "./useCapability.js";

export interface UseToolOptions<A, R> extends CapabilityTool<A, R> {
  /** Capability id. Defaults to `tool.<name>`. */
  id?: string;
  tier?: Tier;
  group?: string;
  priority?: number;
  summary?: string;
  fanIn?: string | { bucket: string; description?: string; title?: string };
  /** Set false to disable without unmounting. */
  enabled?: boolean;
}

/** Register a hand-rolled tool with the same registry the components use. */
export function useTool<A = Record<string, unknown>, R = unknown>(tool: UseToolOptions<A, R>): void {
  const { id, tier, group, priority, summary, fanIn, enabled = true, ...rest } = tool;
  useCapability<A, R>(
    enabled
      ? {
          id: id ?? `tool.${tool.name}`,
          tier,
          group,
          priority,
          summary,
          fanIn,
          tool: rest,
        }
      : null,
  );
}
