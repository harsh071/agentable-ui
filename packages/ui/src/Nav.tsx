import { useMemo, useRef, type ReactNode } from "react";
import { listForDescription, useAgentCapability } from "./useAgentCapability.js";
import type { AgentProp } from "./types.js";

export interface NavItem {
  href: string;
  label: string;
  /** What the agent sees. Defaults to the label. */
  describe?: string;
  icon?: ReactNode;
  /** Exclude from the agent. */
  agentHidden?: boolean;
  external?: boolean;
}

export interface NavProps {
  items: NavItem[];
  /** Current href, for aria-current. */
  current?: string;
  /** Called for in-app navigation. Defaults to location.assign. */
  onNavigate?: (href: string, item: NavItem) => void;
  agent?: AgentProp;
  className?: string;
  "aria-label"?: string;
  orientation?: "horizontal" | "vertical";
}

/** Site navigation. One tool: go to a destination by href or label. */
export function Nav({ items, current, onNavigate, agent, className, "aria-label": ariaLabel = "Main", orientation = "horizontal" }: NavProps) {
  const latest = useRef({ items, onNavigate });
  latest.current = { items, onNavigate };

  const go = (item: NavItem, e?: React.MouseEvent) => {
    if (item.external) return;
    if (latest.current.onNavigate) {
      e?.preventDefault();
      latest.current.onNavigate(item.href, item);
    }
  };

  const visible = items.filter((i) => !i.agentHidden);
  const summary = listForDescription(visible.map((i) => `${i.label}${i.describe ? ` (${i.describe})` : ""} -> ${i.href}`), 320);

  useAgentCapability<{ to: string }, unknown>(
    "nav",
    agent,
    useMemo(
      () => ({
        description: `Navigate within this site. Pass a destination href or label. Destinations: ${summary}.`,
        inputSchema: { type: "object", properties: { to: { type: "string", description: "href or label" } }, required: ["to"] },
        annotations: { readOnlyHint: false, consequentialHint: false },
        confirm: false,
        execute: (args) => {
          const q = String(args.to ?? "").trim().toLowerCase();
          const item = latest.current.items.filter((i) => !i.agentHidden).find((i) => i.href.toLowerCase() === q || i.label.toLowerCase() === q) ?? latest.current.items.find((i) => !i.agentHidden && (i.href.toLowerCase().includes(q) || i.label.toLowerCase().includes(q)));
          if (!item) throw new Error(`No destination matches "${args.to}".`);
          if (latest.current.onNavigate) latest.current.onNavigate(item.href, item);
          else if (typeof location !== "undefined") location.assign(item.href);
          return { navigated: item.href, label: item.label };
        },
      }),
      [summary],
    ),
  );

  return (
    <nav aria-label={ariaLabel} className={className} data-agentable-nav="" data-orientation={orientation} data-agent={agent?.name}>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={current === item.href ? "page" : undefined}
              onClick={(e) => go(item, e)}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noreferrer" : undefined}
              data-agentable-navlink=""
            >
              {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
