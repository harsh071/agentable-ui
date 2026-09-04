import { toJsonSchema, type Capability } from "@agentable/core";

/** Static shape of a capability: everything except the execute closure. */
export function fingerprint(cap: Capability | null | undefined): string {
  if (!cap) return "";
  const t = cap.tool;
  let schema = "";
  if (t?.inputSchema) {
    try {
      schema = JSON.stringify(toJsonSchema(t.inputSchema));
    } catch {
      schema = "?";
    }
  }
  let props = "";
  if (cap.render?.props) {
    try {
      props = JSON.stringify(toJsonSchema(cap.render.props));
    } catch {
      props = "?";
    }
  }
  return JSON.stringify([
    cap.id,
    cap.tier ?? 0,
    cap.group ?? "",
    cap.priority ?? 0,
    cap.summary ?? "",
    cap.fanIn ?? "",
    t?.name ?? "",
    t?.title ?? "",
    t?.description ?? "",
    schema,
    t?.annotations ?? null,
    t?.cache === false ? false : t?.cache ? { ttl: t.cache.ttl, tags: t.cache.tags } : null,
    t?.invalidates ?? null,
    t?.output ?? null,
    typeof t?.confirm === "function" ? "fn" : (t?.confirm ?? null),
    t?.exposedTo ?? null,
    cap.render ? [cap.render.component, cap.render.description ?? "", props] : null,
  ]);
}
