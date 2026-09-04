/** Ambient WebMCP types for the conformance suite, mirroring the spec draft. */
interface ModelContextTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: Record<string, boolean>;
  execute: (args: never, ctx?: unknown) => unknown;
}
interface RegisteredTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: string | object;
  annotations?: Record<string, boolean>;
  origin?: string;
}
interface ModelContext extends EventTarget {
  registerTool(tool: ModelContextTool, options?: { signal?: AbortSignal; exposedTo?: string[] }): Promise<void>;
  getTools(options?: object): Promise<RegisteredTool[]>;
  executeTool(tool: RegisteredTool, input: string): Promise<string>;
  ontoolchange: ((e: Event) => void) | null;
}
interface Document {
  modelContext?: ModelContext;
}
