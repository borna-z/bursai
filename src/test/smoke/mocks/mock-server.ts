import { createServer, IncomingMessage, ServerResponse, Server } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// A minimal HTTP mock server built on Node's stdlib. No external deps.
//
// Scope (P0d-ii): scaffolding only. The 3 existing smoke tests (signup,
// plan-week, garment-add) don't call Gemini or Stripe, so nothing in the
// P0d-ii test run actually hits this server. It exists so P0d-iii can drop
// in 7 new tests and their fixture JSON without re-architecting the infra.
//
// Design choice: a single server instance handles every outbound API (Gemini,
// Stripe, anything else we later add) keyed on URL prefix. Runs in the Node
// process that Vitest launches, so edge functions executing under
// `supabase start` reach it via http://host.docker.internal:<port> — that
// URL wiring is P0d-iii scope, along with the env-var injection into the
// local Supabase functions runtime.
//
// Fixture resolution: routes register a fixture filename relative to the
// `fixtures/` directory, resolved at request time. Missing fixture → 500
// with a loud error, so a test never silently passes against stale data.

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface MockRoute {
  // HTTP method the mock responds to.
  method: HttpMethod;
  // Regex matched against the full request path (req.url). The first matching
  // route wins, in registration order.
  pathPattern: RegExp;
  // Either a fixture filename (resolved against `fixtures/`) or a synchronous
  // function that builds the response body. Fixtures are preferred — they
  // keep responses inspectable and diff-able in PRs.
  response:
    | { type: "fixture"; filename: string; status?: number; contentType?: string }
    | {
        type: "dynamic";
        handler: (req: IncomingMessage, body: string) => {
          status: number;
          body: string;
          contentType?: string;
        };
      };
}

export interface MockServerOptions {
  // Directory containing fixture JSON files. Defaults to the fixtures/ dir
  // next to this file.
  fixturesDir?: string;
}

const DEFAULT_FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
);

export class MockServer {
  private server: Server | null = null;
  private routes: MockRoute[] = [];
  private readonly fixturesDir: string;

  constructor(options: MockServerOptions = {}) {
    this.fixturesDir = options.fixturesDir ?? DEFAULT_FIXTURES_DIR;
  }

  register(route: MockRoute): void {
    this.routes.push(route);
  }

  registerMany(routes: MockRoute[]): void {
    this.routes.push(...routes);
  }

  async start(port: number, host = "0.0.0.0"): Promise<void> {
    if (this.server) {
      throw new Error("[mock-server] already started");
    }
    this.server = createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        console.error("[mock-server] unhandled error", err);
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "text/plain" });
          res.end(`mock-server error: ${(err as Error).message}`);
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      // Binding to 0.0.0.0 by default — necessary so the edge-runtime Docker
      // container can reach the mock via host.docker.internal / bridge
      // gateway IP. Override to 127.0.0.1 in unit contexts if needed.
      this.server!.listen(port, host, () => {
        this.server!.removeListener("error", reject);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => {
      this.server!.close((err) => (err ? reject(err) : resolve()));
    });
    this.server = null;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await readBody(req);
    const route = this.routes.find(
      (r) => r.method === req.method && r.pathPattern.test(req.url ?? ""),
    );
    // Minimal hit log so CI troubleshooting can see whether a test reached
    // the mock at all. Prefix with `[mock-server hit]` to distinguish from
    // other log lines. Stream flushed per-request so the log is not lost if
    // the process crashes mid-test.
    const matchLabel = route ? "route matched" : "NO ROUTE";
    console.log(
      `[mock-server hit] ${req.method} ${req.url} → ${matchLabel}${
        body.length > 0 ? ` (body=${body.length}b)` : ""
      }`,
    );
    if (!route) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end(`mock-server: no route for ${req.method} ${req.url}`);
      return;
    }

    if (route.response.type === "fixture") {
      const { filename, status = 200, contentType = "application/json" } =
        route.response;
      const payload = await readFile(join(this.fixturesDir, filename), "utf8");
      res.writeHead(status, { "content-type": contentType });
      res.end(payload);
      return;
    }

    const { status, body: responseBody, contentType = "application/json" } =
      route.response.handler(req, body);
    res.writeHead(status, { "content-type": contentType });
    res.end(responseBody);
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}
