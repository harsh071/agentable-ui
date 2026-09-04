import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  dts: true,
  clean: true,
  platform: "browser",
  target: "es2022",
  external: ["react", "react/jsx-runtime", "@agentable/core", "@agentable/react"],
});
