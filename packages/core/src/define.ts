import type { Capability } from "./types.js";

/** Identity helper that gives authors inference on `execute` args and result. */
export function defineCapability<A, R>(cap: Capability<A, R>): Capability<A, R> {
  return cap;
}
