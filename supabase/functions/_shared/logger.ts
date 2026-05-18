/**
 * Structured logging utility for BURS Edge Functions.
 *
 * Provides consistent JSON-formatted log output that integrates
 * with Supabase Edge Function log viewers.
 *
 * Usage:
 *   import { logger } from "../_shared/logger.ts";
 *   const log = logger("my_function");
 *   log.info("Processing request", { userId: "..." });
 *   log.error("Failed", { error: err.message });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  fn: string;
  msg: string;
  ts: string;
  request_id?: string;
  data?: Record<string, unknown>;
}

function emit(entry: LogEntry) {
  const line = JSON.stringify(entry);
  switch (entry.level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      console.debug(line);
      break;
    default:
      console.log(line);
  }
}

/**
 * Build a structured logger bound to a function name.
 *
 * `requestId` (optional) is folded into every emitted log line as
 * `request_id`. Pair with `_shared/request-id.ts#getOrCreateRequestId(req)`
 * at the entrypoint of each `Deno.serve` handler so every log line emitted
 * during one request — plus any downstream edge function the handler POSTs
 * to via `x-request-id` — shares the same correlation id. Trace one
 * request end-to-end with:
 *   supabase functions logs --search 'request_id=<uuid>'
 *
 * Backward-compatible: existing callers passing only `functionName` keep
 * their current shape; `request_id` is omitted from log lines when unset.
 */
export function logger(functionName: string, requestId?: string) {
  const log = (level: LogLevel, msg: string, data?: Record<string, unknown>) => {
    emit({
      level,
      fn: functionName,
      msg,
      ts: new Date().toISOString(),
      ...(requestId ? { request_id: requestId } : {}),
      ...(data ? { data } : {}),
    });
  };

  return {
    debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),

    /** Log an error object safely (extracts message, avoids circular refs) */
    exception: (msg: string, err: unknown, extra?: Record<string, unknown>) => {
      const errorData: Record<string, unknown> = {
        ...(extra || {}),
        error: err instanceof Error ? err.message : String(err),
        ...(err instanceof Error && err.stack ? { stack: err.stack.split("\n").slice(0, 4).join("\n") } : {}),
      };
      log("error", msg, errorData);
    },

    /** Time an async operation and log its duration */
    timed: async <T>(msg: string, fn: () => Promise<T>, data?: Record<string, unknown>): Promise<T> => {
      const start = performance.now();
      try {
        const result = await fn();
        log("info", msg, { ...data, durationMs: Math.round(performance.now() - start) });
        return result;
      } catch (err) {
        log("error", `${msg} (failed)`, {
          ...data,
          durationMs: Math.round(performance.now() - start),
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
  };
}
