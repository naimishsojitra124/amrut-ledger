import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * The source uses the `@/*` path alias from tsconfig. Vitest resolves imports
 * itself and does not read those mappings, so any test touching a module that
 * imports through the alias failed to load until this was added.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
