import type { AgentAdapter, NormalizedTool } from "../types.js";

/**
 * Subset of the WebMCP ModelContext surface we touch. Verified against
 * Chrome 154 and 155 (see conformance/REPORT.md; executeTool's input encoding changed between them). Everything else in the library goes
 * through AgentAdapter, so when this moves again only this file changes.
 */
export interface ModelContextLike extends EventTarget {
  registerTool(tool: ModelContextToolLike, options?: { signal?: AbortSignal; exposedTo?: string[] }): Promise<void> | void;
  getTools?(options?: object): Promise<RegisteredToolLike[]>;
  executeTool?(tool: RegisteredToolLike, input: string): Promise<string>;
}

export interface ModelContextToolLike {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: object;
  execute: (args: unknown, ctx?: unknown) => unknown;
}

export interface RegisteredToolLike {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: string | object;
  annotations?: Record<string, unknown>;
  origin?: string;
}

/**
 * Call a registered tool through the browser's ModelContext, the way an external agent would.
 * Chrome 155 takes an object input and rejects JSON strings; Chrome 154 took a JSON string and
 * failed to parse objects. Try the object form first, then fall back to the string form.
 * Resolves to the tool's string output.
 */
export async function executeModelContextTool(mc: ModelContextLike, tool: string | RegisteredToolLike, args: Record<string, unknown> = {}): Promise<string> {
  if (typeof mc.executeTool !== "function") throw new Error("This browser's ModelContext has no executeTool().");
  let target: RegisteredToolLike | undefined = typeof tool === "string" ? undefined : tool;
  if (!target) {
    const tools = (await mc.getTools?.()) ?? [];
    target = tools.find((t) => t.name === tool);
    if (!target) throw new Error(`No registered tool named "${String(tool)}".`);
  }
  try {
    return await mc.executeTool(target, args as unknown as string);
  } catch (objectError) {
    try {
      return await mc.executeTool(target, JSON.stringify(args));
    } catch {
      throw objectError;
    }
  }
}

/** Entry points in order of preference. Older names are kept for the trial period. */
export function findModelContext(root: typeof globalThis = globalThis): ModelContextLike | undefined {
  const g = root as unknown as {
    document?: { modelContext?: ModelContextLike };
    navigator?: { modelContext?: ModelContextLike };
    agent?: ModelContextLike;
  };
  const candidate = g.document?.modelContext ?? g.navigator?.modelContext ?? g.agent;
  return candidate && typeof candidate.registerTool === "function" ? candidate : undefined;
}

export interface WebMcpAdapterOptions {
  /** Override the entry point (tests, polyfills). */
  modelContext?: ModelContextLike;
  /** Report duplicate-name and other platform rejections. */
  onError?: (toolName: string, error: unknown) => void;
}

export function webmcpAdapter(options: WebMcpAdapterOptions = {}): AgentAdapter {
  const resolve = () => options.modelContext ?? findModelContext();
  return {
    id: "webmcp",
    available: () => resolve() !== undefined,
    async register(tool: NormalizedTool) {
      const mc = resolve();
      if (!mc) return () => {};
      const controller = new AbortController();
      // Chrome rejects a pending executeTool() when its tool is unregistered
      // mid-flight, so unregistration waits for in-flight executions to settle.
      let inFlight = 0;
      let abortWhenIdle = false;
      const settle = () => {
        inFlight--;
        // Let the browser deliver the result before the registration goes away.
        if (abortWhenIdle && inFlight === 0) setTimeout(() => controller.abort(), 0);
      };
      const def: ModelContextToolLike = {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        // Chrome passes parsed args; the contract returns a string.
        execute: (args) => {
          inFlight++;
          return tool.execute(args, { adapter: "webmcp", signal: controller.signal }).then(
            (v) => {
              settle();
              return v;
            },
            (e) => {
              settle();
              throw e;
            },
          );
        },
      };
      if (tool.title) def.title = tool.title;
      const opts: { signal: AbortSignal; exposedTo?: string[] } = { signal: controller.signal };
      if (tool.exposedTo) opts.exposedTo = tool.exposedTo;
      try {
        await mc.registerTool(def, opts);
      } catch (e) {
        options.onError?.(tool.name, e);
        throw e;
      }
      return () => {
        if (inFlight > 0) abortWhenIdle = true;
        else controller.abort();
      };
    },
    onToolChange(cb) {
      const mc = resolve();
      if (!mc || typeof mc.addEventListener !== "function") return () => {};
      mc.addEventListener("toolchange", cb);
      return () => mc.removeEventListener("toolchange", cb);
    },
  };
}
