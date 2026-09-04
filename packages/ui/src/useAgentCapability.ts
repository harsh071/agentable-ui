import type { Capability, CapabilityTool, ExecuteContext, RenderDescriptor, SchemaInput } from "@agentable/core";
import { useCapability } from "@agentable/react";
import type { AgentProp } from "./types.js";

export interface ComponentToolSpec<A, R> {
  description: string;
  inputSchema?: SchemaInput<A>;
  annotations?: CapabilityTool["annotations"];
  execute: (args: A, ctx: ExecuteContext) => R | Promise<R>;
  /** Default confirm behavior when the agent prop does not say. */
  confirm?: boolean | string | ((args: A) => string);
  paginate?: boolean | { pageSize?: number };
  invalidates?: string[];
  fanIn?: string | { bucket: string; description?: string; title?: string };
  render?: RenderDescriptor;
  idSuffix?: string;
}

/** Turn an `agent` prop plus a component-provided tool spec into a declared capability. */
export function useAgentCapability<A, R>(component: string, agent: AgentProp | undefined, spec: ComponentToolSpec<A, R>): void {
  const cap: Capability<A, R> | null = agent
    ? {
        id: (agent.id ?? `${component}.${agent.name}`) + (spec.idSuffix ?? ""),
        group: agent.group,
        tier: agent.tier,
        priority: agent.priority,
        summary: agent.summary,
        fanIn: spec.fanIn,
        render: spec.render,
        tool: {
          name: agent.name + (spec.idSuffix ? spec.idSuffix.replace(/\./g, "_") : ""),
          title: agent.title,
          description: agent.description ?? spec.description,
          inputSchema: spec.inputSchema,
          annotations: spec.annotations,
          execute: spec.execute,
          confirm: agent.confirm ?? spec.confirm,
          cache: agent.cache,
          invalidates: agent.invalidates ?? spec.invalidates,
          output: {
            project: agent.project,
            maxChars: agent.maxChars,
            paginate: spec.paginate,
          },
          exposedTo: agent.exposedTo,
        },
      }
    : null;
  useCapability(cap);
}

/** Compact a list of labels into a description fragment that respects the 500-char guidance. */
export function listForDescription(items: string[], budget = 200): string {
  let out = "";
  for (let i = 0; i < items.length; i++) {
    const next = (out ? out + ", " : "") + items[i];
    if (next.length > budget) return `${out} (+${items.length - i} more)`;
    out = next;
  }
  return out;
}

export function cx(...parts: Array<string | false | null | undefined>): string | undefined {
  const s = parts.filter(Boolean).join(" ");
  return s || undefined;
}
