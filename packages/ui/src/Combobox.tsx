import { useEffect, useId, useMemo, useRef, useState } from "react";
import { listForDescription, useAgentCapability } from "./useAgentCapability.js";
import type { AgentProp } from "./types.js";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null, option: ComboboxOption | null) => void;
  agent?: AgentProp;
  label?: string;
  placeholder?: string;
  /** What is being chosen ("customer"). Used in the tool description. */
  noun?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
}

/**
 * A searchable single-select. One tool: pass `value` to pick an option
 * (by value or label), or `query` alone to see matching options.
 */
export function Combobox({ options, value: controlled, defaultValue = null, onChange, agent, label, placeholder = "Search...", noun = "option", disabled, className, clearable = true }: ComboboxProps) {
  const [inner, setInner] = useState<string | null>(defaultValue);
  const value = controlled === undefined ? inner : controlled;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [agentActive, setAgentActive] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ options, value });
  latest.current = { options, value };

  const selectedOption = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => match(options, text), [options, text]);

  const commit = (opt: ComboboxOption | null) => {
    if (controlled === undefined) setInner(opt?.value ?? null);
    onChange?.(opt?.value ?? null, opt);
    setOpen(false);
    setText("");
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => setActive(0), [text]);

  const optionSummary = listForDescription(options.slice(0, 40).map((o) => o.label), 180);

  useAgentCapability<{ value?: string; query?: string }, unknown>(
    "combobox",
    agent,
    useMemo(
      () => ({
        description: `Choose the ${noun}. Pass value (an option's value or label) to select it, or query alone to list matching options. Options: ${optionSummary}.`,
        inputSchema: {
          type: "object",
          properties: {
            value: { type: "string", description: "Option value or label to select. Empty string clears." },
            query: { type: "string", description: "Search text to list candidates." },
          },
        },
        annotations: { readOnlyHint: false, consequentialHint: false },
        confirm: false,
        execute: (args) => {
          const { options } = latest.current;
          if (args.value !== undefined) {
            if (args.value === "") {
              commit(null);
              return { selected: null };
            }
            const opt = resolveOption(options, args.value);
            if (!opt) {
              const candidates = match(options, args.value).slice(0, 10);
              return { error: `No ${noun} matches "${args.value}".`, candidates: candidates.map(brief) };
            }
            if (opt.disabled) return { error: `"${opt.label}" is disabled.` };
            commit(opt);
            setAgentActive(true);
            setTimeout(() => setAgentActive(false), 1200);
            return { selected: brief(opt) };
          }
          const list = match(options, args.query ?? "").slice(0, 25);
          return { options: list.map(brief), total: options.length, selected: latest.current.value };
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [noun, optionSummary],
    ),
  );

  const listboxId = `${id}-listbox`;
  const inputValue = open ? text : (selectedOption?.label ?? "");

  return (
    <div ref={rootRef} className={className} data-agentable-combobox="" data-agent={agent?.name} data-open={open ? "" : undefined} data-agent-active={agentActive ? "" : undefined}>
      {label ? (
        <label htmlFor={`${id}-input`} data-agentable-label="">
          {label}
        </label>
      ) : null}
      <div data-agentable-combobox-control="">
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${id}-opt-${filtered[active]!.value}` : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={inputValue}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(filtered.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              const opt = filtered[active];
              if (opt && !opt.disabled) commit(opt);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          data-agentable-input=""
        />
        {clearable && value ? (
          <button type="button" aria-label="Clear" onClick={() => commit(null)} data-agentable-combobox-clear="">
            &times;
          </button>
        ) : null}
      </div>
      {open ? (
        <ul id={listboxId} role="listbox" data-agentable-listbox="">
          {filtered.length === 0 ? (
            <li data-agentable-empty="">No matches</li>
          ) : (
            filtered.slice(0, 50).map((o, i) => (
              <li
                key={o.value}
                id={`${id}-opt-${o.value}`}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                data-active={i === active ? "" : undefined}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!o.disabled) commit(o);
                }}
              >
                <span>{o.label}</span>
                {o.description ? <small>{o.description}</small> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function brief(o: ComboboxOption) {
  return o.description ? { value: o.value, label: o.label, description: o.description } : { value: o.value, label: o.label };
}

export function match(options: ComboboxOption[], text: string): ComboboxOption[] {
  const q = text.trim().toLowerCase();
  if (!q) return options;
  const scored = options
    .map((o) => {
      const label = o.label.toLowerCase();
      const value = o.value.toLowerCase();
      let score = 0;
      if (label === q || value === q) score = 4;
      else if (label.startsWith(q)) score = 3;
      else if (label.includes(q) || value.includes(q)) score = 2;
      else if (o.description?.toLowerCase().includes(q)) score = 1;
      return { o, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.o);
}

export function resolveOption(options: ComboboxOption[], text: string): ComboboxOption | undefined {
  const q = text.trim().toLowerCase();
  return (
    options.find((o) => o.value.toLowerCase() === q) ??
    options.find((o) => o.label.toLowerCase() === q) ??
    (() => {
      const m = match(options, text);
      return m.length === 1 ? m[0] : undefined;
    })()
  );
}
