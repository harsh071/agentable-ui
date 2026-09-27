import type { CacheOptions, Tier } from "@agentable-ui/core";

/**
 * The one prop that switches a component's agent layer on. Omit it and the
 * component is ordinary.
 */
export interface AgentProp {
  /** Tool name (<= 30 chars, [a-zA-Z0-9_-]). */
  name: string;
  /** Capability id. Defaults to `<component>.<name>`. */
  id?: string;
  /** Overrides the generated tool description (<= 500 chars). */
  description?: string;
  title?: string;
  group?: string;
  tier?: Tier;
  priority?: number;
  summary?: string;
  /** Ask the user before running. Components pick a safe default. */
  confirm?: boolean | string;
  /** Cache read results. Components enable it for read-only tools. */
  cache?: CacheOptions | false;
  /** Cache tags to drop after a successful mutation. */
  invalidates?: string[];
  /** Fields to keep in output (dot paths). */
  project?: string[];
  /** Output cap in characters. Default 1500. */
  maxChars?: number;
  /** Secure origins allowed to call this tool. Default same-origin. */
  exposedTo?: string[];
}

export type DataAttrs = Record<`data-${string}`, string | undefined>;
