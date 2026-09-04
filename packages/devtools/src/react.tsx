import { useEffect } from "react";
import { useAgentable } from "@agentable/react";
import { mountDevtools, type DevtoolsOptions } from "./index.js";

/** Mounts the devtools overlay for the nearest <AgentableProvider>. Renders nothing itself. */
export function AgentableDevtools(props: DevtoolsOptions) {
  const agentable = useAgentable();
  const { position, open, shortcut, container } = props;
  useEffect(() => {
    if (!agentable) return;
    const handle = mountDevtools(agentable, { position, open, shortcut, container });
    return () => handle.unmount();
  }, [agentable, position, open, shortcut, container]);
  return null;
}
