#!/usr/bin/env node
/**
 * Entrypoint for CI (and local dev) to boot the smoke-test mock HTTP server
 * as a standalone process. Reads the port from `MOCK_SERVER_PORT` (default
 * 54330) and binds to 0.0.0.0 so the edge-runtime Docker container can reach
 * it via `host.docker.internal` (Docker Desktop) or the bridge gateway IP
 * (Linux CI). The process stays alive until SIGINT/SIGTERM; CI should run it
 * via a `nohup ... &` pattern or a dedicated actions/start-server step.
 *
 * Not imported by the harness — the mock server runs in its own Node process,
 * independent of Vitest, because edge functions invoked under `supabase
 * functions serve` need the mock up BEFORE they start (the env file pointing
 * at GEMINI_URL_OVERRIDE is read at function boot).
 */
import { MockServer } from "./mock-server";
import { geminiRoutes } from "./gemini";
import { stripeRoutes } from "./stripe";

const port = Number(process.env.MOCK_SERVER_PORT ?? "54330");

async function main(): Promise<void> {
  const server = new MockServer();
  server.registerMany(geminiRoutes);
  server.registerMany(stripeRoutes);

  await server.start(port);
  console.log(`[mock-server] listening on 0.0.0.0:${port}`);

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`[mock-server] received ${signal}, shutting down`);
    await server.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[mock-server] fatal", err);
  process.exit(1);
});
