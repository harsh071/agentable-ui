import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createAgentable, webmcpAdapter, type AgentAdapter, type Agentable, type AgentableOptions, type ConfirmRequest } from "@agentable/core";
import { AgentableContext } from "./context.js";
import { ConfirmDialog } from "./ConfirmDialog.js";

export interface AgentableProviderProps extends Omit<AgentableOptions, "confirm" | "adapters"> {
  children?: ReactNode;
  /** Bring your own registry (tests, multiple roots). Options are ignored when set. */
  agentable?: Agentable;
  /** Transports. Defaults to the WebMCP adapter. */
  adapters?: AgentAdapter[];
  /**
   * Confirmation for consequential tools.
   * - omitted: the built-in dialog
   * - a function: your own handler
   * - false: no confirmation (a dev warning is logged)
   */
  confirm?: ((req: ConfirmRequest) => Promise<boolean>) | false;
  /** Custom confirmation UI. Receives the pending request and a decide callback. */
  renderConfirm?: (request: ConfirmRequest, decide: (ok: boolean) => void) => ReactNode;
}

interface Pending {
  request: ConfirmRequest;
  resolve: (ok: boolean) => void;
}

export function AgentableProvider({ children, agentable: provided, adapters, confirm, renderConfirm, ...options }: AgentableProviderProps) {
  const [queue, setQueue] = useState<Pending[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const ask = useCallback((request: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => setQueue((q) => [...q, { request, resolve }]));
  }, []);

  const optionsRef = useRef(options);
  const [agentable] = useState<Agentable>(() => {
    if (provided) return provided;
    const confirmHandler = confirm === false ? undefined : (confirm ?? ask);
    return createAgentable({
      ...optionsRef.current,
      adapters: adapters ?? [webmcpAdapter()],
      confirm: confirmHandler,
    });
  });

  useEffect(() => {
    if (provided) return;
    return () => agentable.dispose();
  }, [agentable, provided]);

  const current = queue[0];
  const decide = useCallback(
    (ok: boolean) => {
      const head = queueRef.current[0];
      if (!head) return;
      head.resolve(ok);
      setQueue((q) => q.slice(1));
    },
    [],
  );

  const dialog = useMemo(() => {
    if (!current) return null;
    if (renderConfirm) return renderConfirm(current.request, decide);
    return <ConfirmDialog request={current.request} onDecide={decide} />;
  }, [current, renderConfirm, decide]);

  return (
    <AgentableContext.Provider value={agentable}>
      {children}
      {dialog}
    </AgentableContext.Provider>
  );
}
