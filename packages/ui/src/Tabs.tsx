import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useAgentCapability } from "./useAgentCapability.js";
import type { AgentProp } from "./types.js";

export interface Tab {
  value: string;
  label: ReactNode;
  /** What the agent sees. Defaults to the label when it is a string. */
  describe?: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  agent?: AgentProp;
  className?: string;
  "aria-label"?: string;
}

/**
 * Tabs whose inactive panels unmount, so tools declared inside a panel exist
 * only while it is shown. One tool switches tabs.
 */
export function Tabs({ tabs, value: controlled, defaultValue, onValueChange, agent, className, "aria-label": ariaLabel }: TabsProps) {
  const [inner, setInner] = useState(defaultValue ?? tabs.find((t) => !t.disabled)?.value ?? "");
  const value = controlled ?? inner;
  const id = useId();
  const setValue = (v: string) => {
    if (controlled === undefined) setInner(v);
    onValueChange?.(v);
  };
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const values = tabs.map((t) => t.value);
  const summary = tabs.map((t) => `${t.value}${t.describe ?? (typeof t.label === "string" && t.label !== t.value) ? ` (${t.describe ?? t.label})` : ""}`).join(", ");

  useAgentCapability<{ tab: string }, unknown>(
    "tabs",
    agent,
    useMemo(
      () => ({
        description: `Switch tabs. Tools inside the active tab become available after switching. Tabs: ${summary}.`,
        inputSchema: { type: "object", properties: { tab: { type: "string", enum: values } }, required: ["tab"] },
        annotations: { readOnlyHint: false, consequentialHint: false },
        confirm: false,
        execute: (args) => {
          const t = tabsRef.current.find((x) => x.value === args.tab);
          if (!t) throw new Error(`Unknown tab "${args.tab}".`);
          if (t.disabled) throw new Error(`Tab "${args.tab}" is disabled.`);
          setValueRef.current(args.tab);
          return { tab: args.tab };
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [summary, values.join(",")],
    ),
  );

  const active = tabs.find((t) => t.value === value) ?? tabs.find((t) => !t.disabled);

  return (
    <div className={className} data-agentable-tabs="" data-agent={agent?.name}>
      <div role="tablist" aria-label={ariaLabel} data-agentable-tablist="">
        {tabs.map((t) => {
          const selected = t.value === active?.value;
          return (
            <button
              key={t.value}
              role="tab"
              type="button"
              id={`${id}-tab-${t.value}`}
              aria-selected={selected}
              aria-controls={`${id}-panel-${t.value}`}
              tabIndex={selected ? 0 : -1}
              disabled={t.disabled}
              onClick={() => setValue(t.value)}
              onKeyDown={(e) => {
                const enabled = tabs.filter((x) => !x.disabled);
                const i = enabled.findIndex((x) => x.value === t.value);
                let next: Tab | undefined;
                if (e.key === "ArrowRight") next = enabled[(i + 1) % enabled.length];
                if (e.key === "ArrowLeft") next = enabled[(i - 1 + enabled.length) % enabled.length];
                if (e.key === "Home") next = enabled[0];
                if (e.key === "End") next = enabled[enabled.length - 1];
                if (next) {
                  e.preventDefault();
                  setValue(next.value);
                  document.getElementById(`${id}-tab-${next.value}`)?.focus();
                }
              }}
              data-agentable-tab={t.value}
              data-state={selected ? "active" : "inactive"}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {active ? (
        <div role="tabpanel" id={`${id}-panel-${active.value}`} aria-labelledby={`${id}-tab-${active.value}`} data-agentable-tabpanel={active.value}>
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
