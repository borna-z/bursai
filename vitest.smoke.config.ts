import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/smoke/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globalSetup: ["./src/test/smoke/globalSetup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
