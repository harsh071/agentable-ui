import type { JSONSchema } from "./types.js";

/** Chrome's published character guidance for WebMCP tools. */
export const LIMITS = {
  toolName: 30,
  toolDescription: 500,
  paramDescription: 150,
  toolOutput: 1500,
} as const;

export const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface LimitViolation {
  field: string;
  limit: number;
  actual: number;
  message: string;
}

export function checkLimits(tool: {
  name: string;
  description: string;
  inputSchema?: JSONSchema;
}): LimitViolation[] {
  const out: LimitViolation[] = [];
  if (tool.name.length > LIMITS.toolName) {
    out.push({
      field: "name",
      limit: LIMITS.toolName,
      actual: tool.name.length,
      message: `Tool name "${tool.name}" is ${tool.name.length} chars; Chrome guidance is <= ${LIMITS.toolName}.`,
    });
  }
  if (!TOOL_NAME_PATTERN.test(tool.name)) {
    out.push({
      field: "name",
      limit: 0,
      actual: 0,
      message: `Tool name "${tool.name}" must match ${TOOL_NAME_PATTERN}.`,
    });
  }
  if (tool.description.length > LIMITS.toolDescription) {
    out.push({
      field: "description",
      limit: LIMITS.toolDescription,
      actual: tool.description.length,
      message: `Tool "${tool.name}" description is ${tool.description.length} chars; Chrome guidance is <= ${LIMITS.toolDescription}.`,
    });
  }
  if (tool.inputSchema) {
    walkDescriptions(tool.inputSchema, "", (path, desc) => {
      if (desc.length > LIMITS.paramDescription) {
        out.push({
          field: `inputSchema${path}.description`,
          limit: LIMITS.paramDescription,
          actual: desc.length,
          message: `Tool "${tool.name}" parameter ${path || "(root)"} description is ${desc.length} chars; Chrome guidance is <= ${LIMITS.paramDescription}.`,
        });
      }
    });
  }
  return out;
}

function walkDescriptions(
  schema: unknown,
  path: string,
  visit: (path: string, description: string) => void,
  depth = 0,
): void {
  if (!schema || typeof schema !== "object" || depth > 12) return;
  const s = schema as Record<string, unknown>;
  if (typeof s.description === "string" && path) visit(path, s.description);
  const props = s.properties;
  if (props && typeof props === "object") {
    for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
      walkDescriptions(v, `${path}.${k}`, visit, depth + 1);
    }
  }
  if (s.items) walkDescriptions(s.items, `${path}[]`, visit, depth + 1);
  for (const key of ["anyOf", "oneOf", "allOf"]) {
    const arr = s[key];
    if (Array.isArray(arr)) arr.forEach((v, i) => walkDescriptions(v, `${path}<${key}${i}>`, visit, depth + 1));
  }
}

/** Approximate context cost of a tool: name + description + schema JSON. */
export function schemaChars(tool: { name: string; description: string; inputSchema?: JSONSchema; title?: string }): number {
  return (
    tool.name.length +
    tool.description.length +
    (tool.title?.length ?? 0) +
    (tool.inputSchema ? JSON.stringify(tool.inputSchema).length : 0)
  );
}

/** Rough tokens from characters. Good enough for budget displays. */
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}
