import { defineConfig } from "tsdown";
import { cpSync, mkdirSync } from "node:fs";

export default defineConfig({
  entry: ["src/index.ts", "src/tailwind.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  platform: "browser",
  target: "es2022",
  external: ["react", "react-dom", "react/jsx-runtime", "@agentable-ui/core", "@agentable-ui/react"],
  hooks: {
    "build:done": () => {
      mkdirSync("dist", { recursive: true });
      cpSync("src/styles.css", "dist/styles.css");
    },
  },
});
