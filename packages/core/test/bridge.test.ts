import { describe, expect, it, vi } from "vitest";
import { bridgeAdapter } from "../src/adapters/bridge.js";
import type { NormalizedTool } from "../src/types.js";

type Listener = (e: Event) => void;

function harness(options: Parameters<typeof bridgeAdapter>[0] = {}) {
  let listener: Listener | undefined;
  const posted: unknown[] = [];
  const adapter = bridgeAdapter({
    allowedOrigin: "https://app.example",
    ...options,
    target: { postMessage: (m) => posted.push(m) },
    source: { addEventListener: (_t, cb) => (listener = cb), removeEventListener: () => {} },
  });
  const execute = vi.fn(async () => '"ok"');
  adapter.register({ name: "do_it", description: "", inputSchema: { type: "object" }, execute } as unknown as NormalizedTool);
  const send = (origin: string, data: unknown) => listener!({ origin, data } as unknown as Event);
  const results = () => posted.filter((m) => (m as { type: string }).type === "agentable:result");
  return { send, execute, results };
}

const exec = { channel: "agentable", type: "agentable:execute", id: "1", name: "do_it", input: {} };

describe("bridgeAdapter", () => {
  it("executes messages from the allowed origin", async () => {
    const h = harness();
    await h.send("https://app.example", exec);
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.results()).toHaveLength(1);
  });

  it.each(["https://evil.example", "", "null"])("ignores messages from origin %j", async (origin) => {
    const h = harness();
    await h.send(origin, exec);
    expect(h.execute).not.toHaveBeenCalled();
    expect(h.results()).toHaveLength(0);
  });

  it("replies with an error when the tool throws", async () => {
    const h = harness();
    h.execute.mockRejectedValueOnce(new Error("boom"));
    await h.send("https://app.example", exec);
    expect(h.results()[0]).toMatchObject({ ok: false, output: JSON.stringify({ error: "boom" }) });
  });
});
