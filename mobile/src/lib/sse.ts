// React Native does not ship a native EventSource, so we drive Server-Sent
// Events manually over fetch + ReadableStream. This helper keeps the byte
// reader, decoder, line buffering and SSE parsing in one place so each AI
// hook (useStyleChat, useMoodOutfit) just provides callbacks for the parsed
// events.
//
// M9: routes through `callEdgeFunction({ stream: true })` so SSE consumers
// inherit pre-flight session refresh + circuit-break + paywall classification
// for free. The byte-stream parsing below is unchanged — only the request
// dispatch was lifted into the shared client.
//
// Behaviour:
//   • Splits the byte stream into newline-terminated lines, holding any
//     partial trailing fragment in the buffer until the next chunk arrives.
//   • Surfaces every `data: <payload>` line via onData. The caller decides
//     whether the payload is plain text or JSON.
//   • Treats `data: [DONE]` as a graceful close — fires onDone, returns.
//   • Maps a 402 / `subscription_required` body to the sentinel error
//     `subscription_required` so consumers can branch to a paywall without
//     parsing HTTP details.
//   • Honours an AbortController signal — aborts on signal raise quietly
//     (no onError call). Lets screens cancel in-flight streams on unmount
//     without firing terminal callbacks against torn-down components.

import {
  callEdgeFunction,
  EdgeFunctionSubscriptionLockedError,
} from './edgeFunctionClient';

export interface SSECallbacks {
  onData: (chunk: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function fetchSSE(
  fnName: string,
  body: unknown,
  callbacks: SSECallbacks,
  signal?: AbortSignal,
): Promise<void> {
  try {
    // SSE retries don't make sense mid-conversation — a partial stream that
    // gets re-issued duplicates the LLM call. Caller-controlled retry only.
    const response = await callEdgeFunction(fnName, {
      body,
      signal,
      stream: true,
      retries: 0,
    });

    if (!response.body) {
      callbacks.onError(new Error('No response body'));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // RN's fetch ReadableStream supports getReader() in Hermes/JSC via the
    // polyfill bundled with Expo. lib.dom typings line up with the RN
    // runtime here so no cast is needed.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // Spec-correct CRLF + LF split — Deno's `streamBursAI` writes `\n\n`
      // today, but a CRLF-emitting proxy in front of the function would
      // otherwise strand `\r` into the line and break the [DONE] compare.
      const lines = buffer.split(/\r?\n/);
      // Last element is the partial trailing line (or empty string after
      // a terminator). Hold it for the next chunk so we don't truncate a
      // JSON payload mid-keystroke.
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        // SSE comments start with `:` — server uses `: keepalive\n\n` to
        // hold the stream open. Skip silently.
        if (line.startsWith(':')) continue;
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          callbacks.onDone();
          return;
        }
        if (data) callbacks.onData(data);
      }
    }

    // Drain any final unterminated `data: …` line. Today's edge functions
    // always emit a trailing newline + `[DONE]`, but a connection cut
    // mid-flush could otherwise silently lose the last payload.
    const tail = buffer.trim();
    if (tail.startsWith('data: ')) {
      const data = tail.slice(6).trim();
      if (data === '[DONE]') {
        callbacks.onDone();
        return;
      }
      if (data) callbacks.onData(data);
    }

    callbacks.onDone();
  } catch (err) {
    if (signal?.aborted) return;
    if (err instanceof EdgeFunctionSubscriptionLockedError) {
      callbacks.onError(new Error('subscription_required'));
      return;
    }
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
