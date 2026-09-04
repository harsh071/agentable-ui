import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useAgentCapability } from "./useAgentCapability.js";
import type { AgentProp } from "./types.js";

export type ToastKind = "info" | "success" | "warning" | "error";

export interface ToastInput {
  title: string;
  description?: string;
  kind?: ToastKind;
  /** ms before auto-dismiss. 0 keeps it until closed. Default 5000 (errors 8000). */
  duration?: number;
  /** Who raised it. Agent-initiated results are marked so the user can tell. */
  source?: "user" | "agent" | "system";
}

export interface ToastRecord extends Required<Omit<ToastInput, "description">> {
  id: number;
  description?: string;
  at: number;
}

interface Store {
  toasts: ToastRecord[];
  history: ToastRecord[];
}

const listeners = new Set<() => void>();
let state: Store = { toasts: [], history: [] };
let nextId = 1;
const MAX_HISTORY = 50;

function emit() {
  for (const l of listeners) l();
}

/** Show a toast from anywhere. Returns the id. */
export function toast(input: ToastInput): number {
  const id = nextId++;
  const record: ToastRecord = {
    id,
    title: input.title,
    description: input.description,
    kind: input.kind ?? "info",
    duration: input.duration ?? (input.kind === "error" ? 8000 : 5000),
    source: input.source ?? "user",
    at: Date.now(),
  };
  state = { toasts: [...state.toasts, record], history: [record, ...state.history].slice(0, MAX_HISTORY) };
  emit();
  if (record.duration > 0) setTimeout(() => dismiss(id), record.duration);
  return id;
}

export function dismiss(id: number): void {
  if (!state.toasts.some((t) => t.id === id)) return;
  state = { ...state, toasts: state.toasts.filter((t) => t.id !== id) };
  emit();
}

export function clearToasts(): void {
  state = { ...state, toasts: [] };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useToasts(): Store {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export interface ToasterProps {
  agent?: AgentProp;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
  className?: string;
  /** Render a toast yourself. */
  render?: (t: ToastRecord, close: () => void) => ReactNode;
}

/**
 * Renders toasts. Its tool lets an agent read recent notifications, which is
 * how it learns the outcome of actions the page reported to the user.
 */
export function Toaster({ agent, position = "bottom-right", className, render }: ToasterProps) {
  const { toasts, history } = useToasts();

  useAgentCapability<{ limit?: number }, unknown>(
    "toaster",
    agent,
    useMemo(
      () => ({
        description: "Read recent notifications shown to the user (errors, confirmations, results of actions). Newest first.",
        inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50, description: "Default 10." } } },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: (args) => history.slice(0, args.limit ?? 10).map((t) => ({ kind: t.kind, title: t.title, ...(t.description ? { description: t.description } : {}), source: t.source, ago: `${Math.round((Date.now() - t.at) / 1000)}s` })),
      }),
      [history],
    ),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.toasts.length) dismiss(state.toasts[state.toasts.length - 1]!.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div role="region" aria-label="Notifications" aria-live="polite" className={className} data-agentable-toaster="" data-position={position} data-agent={agent?.name}>
      {toasts.map((t) =>
        render ? (
          <div key={t.id}>{render(t, () => dismiss(t.id))}</div>
        ) : (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} data-agentable-toast="" data-kind={t.kind} data-source={t.source}>
            <div data-agentable-toast-body="">
              <strong>{t.title}</strong>
              {t.description ? <p>{t.description}</p> : null}
              {t.source === "agent" ? <small data-agentable-toast-source="">via agent</small> : null}
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} data-agentable-toast-close="">
              &times;
            </button>
          </div>
        ),
      )}
    </div>
  );
}
