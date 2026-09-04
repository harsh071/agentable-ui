import { useMemo, useRef, useState, type ReactNode } from "react";
import type { Capability } from "@agentable/core";
import { useCapability } from "@agentable/react";
import type { AgentProp } from "./types.js";

export interface Action {
  id: string;
  label: string;
  /** What the agent sees. Defaults to the label. */
  describe?: string;
  icon?: ReactNode;
  onAction: () => unknown | Promise<unknown>;
  disabled?: boolean;
  /** Confirm before running and mark as consequential. */
  destructive?: boolean;
  /** Ask the user first. Defaults to `destructive`. */
  confirm?: boolean | string;
  variant?: "primary" | "default" | "danger";
  /** Exclude from the agent. */
  agentHidden?: boolean;
}

export interface ActionBarProps {
  actions: Action[];
  agent?: AgentProp & {
    /** Collapse all actions into one tool with an `action` enum. Default true. */
    fanIn?: boolean;
  };
  className?: string;
  "aria-label"?: string;
}

/**
 * A row of buttons. With fan-in (the default) twelve actions become one tool
 * schema; without it each action registers its own tool.
 */
export function ActionBar({ actions, agent, className, "aria-label": ariaLabel = "Actions" }: ActionBarProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [agentRan, setAgentRan] = useState<string | null>(null);
  const latest = useRef(actions);
  latest.current = actions;

  const fanIn = agent ? (agent.fanIn ?? true) : false;
  const caps = useMemo<Capability[]>(() => {
    if (!agent) return [];
    return actions
      .filter((a) => !a.agentHidden)
      .map((a) => ({
        id: `${agent.id ?? `actionbar.${agent.name}`}.${a.id}`,
        group: agent.group,
        tier: agent.tier,
        priority: agent.priority,
        summary: a.describe ?? a.label,
        fanIn: fanIn ? { bucket: agent.name, description: agent.description ?? "Run one of the available actions.", title: agent.title } : undefined,
        tool: {
          name: fanIn ? a.id : `${agent.name}_${a.id}`.slice(0, 30),
          description: a.describe ?? a.label,
          annotations: { readOnlyHint: false, consequentialHint: !!a.destructive },
          confirm: agent.confirm ?? a.confirm ?? !!a.destructive,
          invalidates: agent.invalidates,
          exposedTo: agent.exposedTo,
          execute: async () => {
            const current = latest.current.find((x) => x.id === a.id);
            if (!current) throw new Error(`Action "${a.id}" is gone.`);
            if (current.disabled) throw new Error(`Action "${current.label}" is disabled right now.`);
            setAgentRan(a.id);
            setTimeout(() => setAgentRan(null), 1200);
            const result = await run(current);
            return result === undefined ? { ran: a.id } : result;
          },
        },
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.name, agent?.id, agent?.group, agent?.tier, agent?.priority, agent?.description, agent?.title, agent?.confirm, fanIn, actions.map((a) => `${a.id}|${a.label}|${a.describe ?? ""}|${a.destructive ? 1 : 0}|${a.agentHidden ? 1 : 0}`).join(";")]);

  async function run(a: Action) {
    setBusy(a.id);
    try {
      return await a.onAction();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div role="toolbar" aria-label={ariaLabel} className={className} data-agentable-actionbar="" data-agent={agent?.name}>
      {caps.map((c) => (
        <Declare key={c.id} cap={c} />
      ))}
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={a.disabled || busy === a.id}
          onClick={() => void run(a)}
          data-agentable-button={a.variant ?? (a.destructive ? "danger" : "")}
          data-action={a.id}
          data-busy={busy === a.id ? "" : undefined}
          data-agent-active={agentRan === a.id ? "" : undefined}
        >
          {a.icon ? <span aria-hidden="true">{a.icon}</span> : null}
          {a.label}
        </button>
      ))}
    </div>
  );
}

function Declare({ cap }: { cap: Capability }) {
  useCapability(cap);
  return null;
}
