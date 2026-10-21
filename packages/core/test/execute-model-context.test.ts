import { describe, expect, it } from "vitest";
import { createAgentable, executeModelContextTool, type ModelContextLike } from "../src/index.js";

function fakeContext(accepts: "object" | "string"): ModelContextLike {
  const tools = [{ name: "echo" }];
  const target = new EventTarget() as ModelContextLike;
  return Object.assign(target, {
    registerTool: () => {},
    getTools: async () => tools,
    executeTool: async (_tool: unknown, input: unknown) => {
      if (accepts === "object" && typeof input !== "object") throw new TypeError("invalid input object: value is not an object");
      if (accepts === "string" && typeof input !== "string") throw new Error("Failed to parse input arguments");
      const args = typeof input === "string" ? JSON.parse(input) : input;
      return JSON.stringify({ got: args });
    },
  });
}

describe("executeModelContextTool", () => {
  it.each(["object", "string"] as const)("works when the browser takes %s input", async (accepts) => {
    await expect(executeModelContextTool(fakeContext(accepts), "echo", { text: "hi" })).resolves.toBe('{"got":{"text":"hi"}}');
  });

  it("reports an unknown tool by name", async () => {
    await expect(executeModelContextTool(fakeContext("object"), "nope")).rejects.toThrow(/No registered tool named "nope"/);
  });
});

describe("group descriptions", () => {
  it("appear in the snapshot", async () => {
    const agentable = createAgentable({ confirm: false, adapters: [] });
    agentable.declare({ id: "list.add", group: "packing-a1b2c3", tool: { name: "packing_add", description: "Add", execute: () => ({ ok: true }) } });
    agentable.describeGroup("packing-a1b2c3", "Packing list");
    await new Promise((r) => setTimeout(r, 20));
    expect(agentable.snapshot().groups.find((g) => g.name === "packing-a1b2c3")?.description).toBe("Packing list");
    agentable.dispose();
  });
});
