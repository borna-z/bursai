// useStyleChatStreaming — SSE mechanics only.
//
// Wraps `fetchSSE` + `handleStreamChunk` + the rAF-coalesced bubble
// flush so the orchestrator (useStyleChat) sees a single
// `streamTurn(args)` entry point and a small callback surface. No UI
// state lives here — every behavioural side-effect flows through the
// callback arguments.

import { useCallback } from 'react';

import { Sentry } from '../lib/sentry';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import type {
  StyleChatActiveLookInput,
  StyleChatResponseEnvelope,
} from '../lib/styleChatContract';
import {
  ROUTE_BY_MODE,
  finalizeEnvelopeForMode,
  type StyleChatMode,
} from './useStyleChat.helpers';
import {
  buildRequestBody,
  fetchSSE,
  handleStreamChunk,
  makeAccumulator,
  type StreamMessagePayload,
} from './useStyleChat.stream';

export interface StreamTurnArgs {
  mode: StyleChatMode;
  messagesPayload: StreamMessagePayload[];
  anchoredGarmentId: string | null;
  activeLookPayload: StyleChatActiveLookInput | undefined;
  lockedSlots?: string[];
  wardrobeGarmentIds: string[];
  controller: AbortController;
  callbacks: {
    onBubbleSeed: (next: {
      content: string;
      stylistMeta: StyleChatResponseEnvelope | null;
    }) => void;
    onSuggestionChips: (chips: string[]) => void;
    onComplete: (result: {
      finalContent: string;
      finalMeta: StyleChatResponseEnvelope | null;
    }) => void;
    onError: (err: Error) => void;
    onChunkScheduled: (snapshot: {
      content: string;
      stylistMeta: StyleChatResponseEnvelope | null;
    }) => void;
  };
}

export function useStyleChatStreaming(): {
  streamTurn: (args: StreamTurnArgs) => Promise<void>;
} {
  const streamTurn = useCallback(async (args: StreamTurnArgs): Promise<void> => {
    const {
      mode,
      messagesPayload,
      anchoredGarmentId,
      activeLookPayload,
      lockedSlots,
      wardrobeGarmentIds,
      controller,
      callbacks,
    } = args;

    const acc = makeAccumulator();
    const turnFunctionName = ROUTE_BY_MODE[mode];
    const requestBody = buildRequestBody({
      mode,
      messagesPayload,
      anchoredGarmentId,
      activeLookPayload,
      lockedSlots,
      wardrobeGarmentIds,
    });

    let pendingFlush = false;
    const scheduleBubbleFlush = () => {
      if (pendingFlush) return;
      pendingFlush = true;
      requestAnimationFrame(() => {
        pendingFlush = false;
        if (controller.signal.aborted) return;
        callbacks.onChunkScheduled({
          content: acc.deltaAccumulated,
          stylistMeta:
            acc.envelopeMeta && acc.shoppingResults && acc.shoppingResults.length > 0
              ? { ...acc.envelopeMeta, shopping_results: acc.shoppingResults }
              : acc.envelopeMeta,
        });
      });
    };

    await fetchSSE(
      turnFunctionName,
      requestBody,
      {
        onData: (raw) => {
          handleStreamChunk(raw, acc, {
            onAssistantBubbleUpdate: (next) => {
              if (controller.signal.aborted) return;
              callbacks.onBubbleSeed(next);
            },
            onSuggestionChips: callbacks.onSuggestionChips,
            scheduleBubbleFlush,
          });
        },
        onDone: () => {
          if (controller.signal.aborted) return;
          const finalContent = acc.receivedDeltas ? acc.deltaAccumulated : acc.envelopeFallback;
          const finalMeta = finalizeEnvelopeForMode(
            mode,
            acc.envelopeMeta,
            finalContent || acc.envelopeFallback,
            acc.shoppingResults,
          );
          callbacks.onComplete({
            finalContent: finalContent || acc.envelopeFallback,
            finalMeta,
          });
        },
        onError: (err) => {
          if (controller.signal.aborted) return;
          const isPaywall = err.message === SUBSCRIPTION_SENTINEL;
          if (!isPaywall) {
            Sentry.withScope((s) => {
              s.setTag('mutation', 'useStyleChat');
              s.setTag('chatTurnMode', mode);
              s.setTag('errorName', err.name || 'Error');
              if (err.message) s.setExtra('errorMessage', err.message);
              Sentry.captureException(err);
            });
          }
          callbacks.onError(err);
        },
      },
      controller.signal,
    );
  }, []);

  return { streamTurn };
}
