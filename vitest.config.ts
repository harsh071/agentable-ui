import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "core", root: "packages/core", environment: "node", include: ["test/**/*.test.ts"] } },
      { test: { name: "react", root: "packages/react", environment: "happy-dom", include: ["test/**/*.test.ts?(x)"] } },
      { test: { name: "devtools", root: "packages/devtools", environment: "happy-dom", include: ["test/**/*.test.ts?(x)"] } },
      { test: { name: "ui", root: "packages/ui", environment: "happy-dom", include: ["test/**/*.test.ts?(x)"] } },
      { test: { name: "genui", root: "packages/genui", environment: "happy-dom", include: ["test/**/*.test.ts?(x)"] } },
      { test: { name: "lang", root: "packages/lang", environment: "node", include: ["test/**/*.test.ts"] } },
    ],
  },
});
