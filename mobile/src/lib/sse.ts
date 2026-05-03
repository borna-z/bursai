// React Native does not ship a native EventSource, so we drive Server-Sent
// Events manually over fetch + ReadableStream. This helper keeps the byte
// reader, decoder, line buffering and SSE parsing in one place so each AI
// hook (useStyleChat, useMoodOutfit) just provides callbacks for the parsed
// events.
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

export interface SSECallbacks {
  onData: (chunk: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function fetchSSE(
  url: string,
  body: unknown,
  accessToken: string,
  callbacks: SSECallbacks,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      const errorMsg = errorBody.error ?? `HTTP ${response.status}`;

      if (response.status === 402 || errorMsg === 'subscription_required') {
        callbacks.onError(new Error('subscription_required'));
        return;
      }

      callbacks.onError(new Error(errorMsg));
      return;
    }

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
      const lines = buffer.split('\n');
      // Last element is the partial trailing line (or empty string after
      // a `\n`). Hold it for the next chunk so we don't truncate a JSON
      // payload mid-keystroke.
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

    callbacks.onDone();
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export function getEdgeFunctionUrl(supabaseUrl: string, fnName: string): string {
  return `${supabaseUrl}/functions/v1/${fnName}`;
}
