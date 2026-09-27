import type { AgentAdapter, NormalizedTool } from "../types.js";

/**
 * postMessage bridge for extension-based agents (MCP-B style content scripts).
 *
 * Protocol (all messages carry `{ channel }`):
 *   page -> extension : { type: "agentable:tools",  tools: ToolDescriptor[] }
 *   extension -> page : { type: "agentable:list" }
 *   extension -> page : { type: "agentable:execute", id, name, input }
 *   page -> extension : { type: "agentable:result",  id, ok, output }
 */
export interface BridgeMessage {
  channel: string;
  type: "agentable:tools" | "agentable:list" | "agentable:execute" | "agentable:result";
  id?: string;
  name?: string;
  input?: unknown;
  ok?: boolean;
  output?: string;
  tools?: Array<Pick<NormalizedTool, "name" | "title" | "description" | "inputSchema" | "annotations">>;
}

export interface BridgeAdapterOptions {
  channel?: string;
  /** Where to post. Defaults to window. */
  target?: { postMessage(msg: unknown, targetOrigin: string): void };
  /** Where to listen. Defaults to window. */
  source?: { addEventListener(type: "message", cb: (e: Event) => void): void; removeEventListener(type: "message", cb: (e: Event) => void): void };
  /** Only accept messages from this origin. Defaults to the page's own origin. "*" accepts any origin. */
  allowedOrigin?: string;
  /**
   * Only accept messages whose `event.source` is this window (content scripts
   * post from the page's own window). Defaults to true when listening on window,
   * which rejects same-origin iframes and popups.
   */
  sameWindowOnly?: boolean;
}

export function bridgeAdapter(options: BridgeAdapterOptions = {}): AgentAdapter {
  const channel = options.channel ?? "agentable";
  const hasWindow = typeof window !== "undefined";
  const target = options.target ?? (hasWindow ? window : undefined);
  const source = options.source ?? (hasWindow ? window : undefined);
  const origin = options.allowedOrigin ?? (hasWindow ? window.location.origin : "*");
  const sameWindowOnly = options.sameWindowOnly ?? (!options.source && hasWindow);
  const tools = new Map<string, NormalizedTool>();
  const listeners = new Set<() => void>();
  let listening = false;

  const announce = () => {
    target?.postMessage(
      {
        channel,
        type: "agentable:tools",
        tools: [...tools.values()].map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: t.annotations,
        })),
      } satisfies BridgeMessage,
      origin === "*" ? "*" : origin,
    );
    for (const l of listeners) l();
  };

  const onMessage = async (ev: Event) => {
    const e = ev as MessageEvent;
    const msg = e.data as BridgeMessage | undefined;
    if (!msg || msg.channel !== channel) return;
    if (origin !== "*" && e.origin !== origin) return;
    if (sameWindowOnly && e.source !== window) return;
    if (msg.type === "agentable:list") announce();
    if (msg.type === "agentable:execute" && msg.name) {
      const tool = tools.get(msg.name);
      let ok = true;
      let output: string;
      if (!tool) {
        ok = false;
        output = JSON.stringify({ error: `Tool "${msg.name}" is not registered.` });
      } else {
        try {
          output = await tool.execute(msg.input, { adapter: "bridge" });
          ok = !output.startsWith('{"error"');
        } catch (err) {
          ok = false;
          output = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
        }
      }
      target?.postMessage({ channel, type: "agentable:result", id: msg.id, ok, output } satisfies BridgeMessage, origin === "*" ? "*" : origin);
    }
  };

  const ensureListening = () => {
    if (listening || !source) return;
    listening = true;
    source.addEventListener("message", onMessage);
  };

  return {
    id: "bridge",
    available: () => !!target,
    register(tool) {
      ensureListening();
      tools.set(tool.name, tool);
      announce();
      return () => {
        if (tools.get(tool.name) === tool) {
          tools.delete(tool.name);
          announce();
        }
      };
    },
    onToolChange(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
