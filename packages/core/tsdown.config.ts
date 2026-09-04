import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/adapters/webmcp.ts", "src/adapters/memory.ts", "src/adapters/bridge.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  platform: "neutral",
  target: "es2022",
});
