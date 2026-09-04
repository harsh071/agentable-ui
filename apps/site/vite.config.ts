import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const src = (pkg: string, entry = "index.ts") => fileURLToPath(new URL(`../../packages/${pkg}/src/${entry}`, import.meta.url));

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: { target: "es2022" },
  resolve: {
    // In dev, use package sources so edits hot-reload and a package rebuild never
    // pulls dist/ out from under the running server. Builds use the published dist.
    alias:
      command === "serve"
        ? [
            { find: "@agentable/core/adapters/webmcp", replacement: src("core", "adapters/webmcp.ts") },
            { find: "@agentable/core/adapters/memory", replacement: src("core", "adapters/memory.ts") },
            { find: "@agentable/core/adapters/bridge", replacement: src("core", "adapters/bridge.ts") },
            { find: "@agentable/core", replacement: src("core") },
            { find: "@agentable/react", replacement: src("react") },
            { find: "@agentable/devtools/react", replacement: src("devtools", "react.tsx") },
            { find: "@agentable/devtools", replacement: src("devtools") },
            { find: "@agentable/ui/styles.css", replacement: src("ui", "styles.css") },
            { find: "@agentable/ui", replacement: src("ui") },
            { find: "@agentable/genui", replacement: src("genui", "index.tsx") },
          ]
        : [],
  },
}));
