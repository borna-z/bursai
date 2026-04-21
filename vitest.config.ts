import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "supabase/functions/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "src/test/smoke/**"],
    env: {
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
    },
    // P15 (2026-04-21): stabilize the full-suite run by switching from the
    // default `threads` pool (one thread per CPU, shared memory) to `forks`
    // (process isolation) with a hard cap at 2 parallel forks. Pair with a
    // 15000ms per-test timeout (default is 5000ms).
    //
    // Why: pre-P15 the full run was flaky on Windows — different subset of
    // 5-20 tests timed out on each invocation, while every affected file
    // passed cleanly in isolation (9/9 assertions in ~7s). Root cause is
    // vitest's default thread pool hammering the filesystem during parallel
    // module resolution + jsdom bootstrap; worst-case per-file env setup
    // exceeded the 5s per-test budget, clipping component-render tests
    // that actually take 1-3s. Forking gives each worker its own V8
    // isolate + FS cache; capping to 2 trades wall-clock (expected ~1.5x
    // slower end-to-end) for determinism. Bumping the timeout to 15s
    // provides headroom for the slowest legitimate tests + any residual
    // contention.
    //
    // Longer-term cleanup (separate test-infra PR): audit which tests
    // genuinely take >3s and split them into a dedicated slow-suite, OR
    // move back to threads once the filesystem hotspots are identified.
    // Tracked in Findings Log.
    testTimeout: 15000,
    pool: "forks",
    // Vitest 4 moved `poolOptions` to top-level — see migration guide at
    // https://vitest.dev/guide/migration#pool-rework. `maxWorkers: 2` caps
    // parallel forks to 2 regardless of CPU count.
    maxWorkers: 2,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 30,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
