import type { JSONSchema, SchemaInput, StandardSchemaV1 } from "./types.js";

export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return (
    !!value &&
    typeof value === "object" &&
    "~standard" in (value as Record<string, unknown>) &&
    typeof (value as StandardSchemaV1)["~standard"].validate === "function"
  );
}

type Converter = (schema: StandardSchemaV1) => JSONSchema;
let fallbackConverter: Converter | undefined;

/**
 * Register a converter for Standard Schemas that do not implement Standard
 * JSON Schema (`~standard.jsonSchema`). zod 4 and valibot 1 do, so most
 * setups never need this.
 */
export function setSchemaConverter(fn: Converter | undefined): void {
  fallbackConverter = fn;
}

const EMPTY_OBJECT_SCHEMA: JSONSchema = { type: "object", properties: {} };

/** Convert any accepted schema input to a compact JSON Schema object. */
export function toJsonSchema(schema: SchemaInput | undefined): JSONSchema {
  if (!schema) return { ...EMPTY_OBJECT_SCHEMA, properties: {} };
  if (isStandardSchema(schema)) {
    const std = schema["~standard"];
    let out: JSONSchema | undefined;
    if (std.jsonSchema?.input) {
      out = std.jsonSchema.input({ target: "draft-2020-12" });
    } else if (fallbackConverter) {
      out = fallbackConverter(schema);
    } else {
      throw new Error(
        `Schema from vendor "${std.vendor}" does not implement Standard JSON Schema. ` +
          `Call setSchemaConverter() with a converter for it.`,
      );
    }
    return compact(out);
  }
  return compact(schema);
}

/** Drop keys that cost characters and carry nothing for an agent. */
export function compact(schema: JSONSchema): JSONSchema {
  const out: JSONSchema = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "$schema" || k === "$id" || k === "$comment") continue;
    out[k] = v;
  }
  return out;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Validate agent-supplied args. Standard Schemas validate themselves (and may
 * coerce). Plain JSON Schemas get a small structural validator covering the
 * subset that matters for tool inputs.
 */
export async function validateInput<A>(
  schema: SchemaInput<A> | undefined,
  value: unknown,
): Promise<ValidationResult<A>> {
  if (!schema) return { ok: true, value: (value ?? {}) as A };
  if (isStandardSchema(schema)) {
    const result = await schema["~standard"].validate(value ?? {});
    if (result.issues) {
      return {
        ok: false,
        issues: result.issues.map((i) => ({
          path: (i.path ?? [])
            .map((p) => (typeof p === "object" && p !== null && "key" in p ? String(p.key) : String(p)))
            .join("."),
          message: i.message,
        })),
      };
    }
    return { ok: true, value: result.value as A };
  }
  const issues: ValidationIssue[] = [];
  validateJson(schema, value ?? {}, "", issues, 0);
  return issues.length ? { ok: false, issues } : { ok: true, value: value as A };
}

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function typeMatches(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  if (expected === "number" && actual === "integer") return true;
  return false;
}

function validateJson(schema: JSONSchema, value: unknown, path: string, issues: ValidationIssue[], depth: number): void {
  if (depth > 16) return;
  const at = path || "(root)";
  if (schema.const !== undefined && JSON.stringify(schema.const) !== JSON.stringify(value)) {
    issues.push({ path: at, message: `must equal ${JSON.stringify(schema.const)}` });
    return;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
    issues.push({ path: at, message: `must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}` });
    return;
  }
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
  const actual = typeOf(value);
  if (types.length && !types.some((t) => typeMatches(t, actual))) {
    issues.push({ path: at, message: `expected ${types.join(" | ")}, got ${actual}` });
    return;
  }
  if (Array.isArray(schema.anyOf) || Array.isArray(schema.oneOf)) {
    const branches = (schema.anyOf ?? schema.oneOf) as JSONSchema[];
    const ok = branches.some((b) => {
      const sub: ValidationIssue[] = [];
      validateJson(b, value, path, sub, depth + 1);
      return sub.length === 0;
    });
    if (!ok) issues.push({ path: at, message: `did not match any allowed shape` });
  }
  if (Array.isArray(schema.allOf)) {
    for (const b of schema.allOf as JSONSchema[]) validateJson(b, value, path, issues, depth + 1);
  }
  if (actual === "object") {
    const obj = value as Record<string, unknown>;
    const props = (schema.properties ?? {}) as Record<string, JSONSchema>;
    for (const req of (schema.required as string[] | undefined) ?? []) {
      if (obj[req] === undefined) issues.push({ path: path ? `${path}.${req}` : req, message: "is required" });
    }
    for (const [k, v] of Object.entries(obj)) {
      const sub = props[k];
      if (sub) validateJson(sub, v, path ? `${path}.${k}` : k, issues, depth + 1);
      else if (schema.additionalProperties === false) issues.push({ path: path ? `${path}.${k}` : k, message: "is not an allowed property" });
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        validateJson(schema.additionalProperties as JSONSchema, v, path ? `${path}.${k}` : k, issues, depth + 1);
      }
    }
  } else if (actual === "array") {
    const arr = value as unknown[];
    if (typeof schema.minItems === "number" && arr.length < schema.minItems) issues.push({ path: at, message: `needs at least ${schema.minItems} items` });
    if (typeof schema.maxItems === "number" && arr.length > schema.maxItems) issues.push({ path: at, message: `allows at most ${schema.maxItems} items` });
    if (schema.items && typeof schema.items === "object") {
      arr.forEach((item, i) => validateJson(schema.items as JSONSchema, item, `${path}[${i}]`, issues, depth + 1));
    }
  } else if (actual === "string") {
    const s = value as string;
    if (typeof schema.minLength === "number" && s.length < schema.minLength) issues.push({ path: at, message: `must be at least ${schema.minLength} chars` });
    if (typeof schema.maxLength === "number" && s.length > schema.maxLength) issues.push({ path: at, message: `must be at most ${schema.maxLength} chars` });
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(s)) issues.push({ path: at, message: `must match ${schema.pattern}` });
  } else if (actual === "number" || actual === "integer") {
    const n = value as number;
    if (typeof schema.minimum === "number" && n < schema.minimum) issues.push({ path: at, message: `must be >= ${schema.minimum}` });
    if (typeof schema.maximum === "number" && n > schema.maximum) issues.push({ path: at, message: `must be <= ${schema.maximum}` });
    if (typeof schema.exclusiveMinimum === "number" && n <= schema.exclusiveMinimum) issues.push({ path: at, message: `must be > ${schema.exclusiveMinimum}` });
    if (typeof schema.exclusiveMaximum === "number" && n >= schema.exclusiveMaximum) issues.push({ path: at, message: `must be < ${schema.exclusiveMaximum}` });
  }
}

/** Deterministic JSON with sorted keys. Used for cache keys. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = sortKeys(v);
    }
    return out;
  }
  return value;
}

/** Parse adapter input, which may already be an object or may be a JSON string. */
export function parseInput(input: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (input === undefined || input === null || input === "") return { ok: true, value: {} };
  if (typeof input === "string") {
    try {
      return { ok: true, value: JSON.parse(input) };
    } catch {
      return { ok: false, error: "Input must be a JSON object." };
    }
  }
  return { ok: true, value: input };
}
