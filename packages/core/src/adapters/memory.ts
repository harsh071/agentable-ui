import type { AgentAdapter, NormalizedTool } from "../types.js";

export interface MemoryAdapter extends AgentAdapter {
  /** Tools currently registered, in registration order. */
  tools(): NormalizedTool[];
  /** Execute like a browser agent would: input may be a JSON string or object; output is a string. */
  execute(name: string, input?: unknown): Promise<string>;
  onChange(cb: (tools: NormalizedTool[]) => void): () => void;
}

/**
 * In-memory adapter used by devtools, tests, and any consumer that wants the
 * normalized tool list without a browser. Mirrors the WebMCP contract:
 * duplicate names are rejected, execute returns a string.
 */
export function memoryAdapter(id = "memory"): MemoryAdapter {
  const map = new Map<string, NormalizedTool>();
  const listeners = new Set<(tools: NormalizedTool[]) => void>();
  const emit = () => {
    const tools = [...map.values()];
    for (const l of listeners) l(tools);
  };
  return {
    id,
    available: () => true,
    register(tool) {
      if (map.has(tool.name)) throw new Error(`Duplicate tool name "${tool.name}"`);
      map.set(tool.name, tool);
      emit();
      return () => {
        if (map.get(tool.name) === tool) {
          map.delete(tool.name);
          emit();
        }
      };
    },
    tools: () => [...map.values()],
    async execute(name, input) {
      const tool = map.get(name);
      if (!tool) throw new Error(`Tool "${name}" is not registered.`);
      return tool.execute(input, { adapter: id });
    },
    onChange(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    onToolChange(cb) {
      const wrapped = () => cb();
      listeners.add(wrapped);
      return () => {
        listeners.delete(wrapped);
      };
    },
  };
}
