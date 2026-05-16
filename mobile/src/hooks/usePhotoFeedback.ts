// usePhotoFeedback — M18 photo-feedback hook (orchestrator).
//
// Two-step flow preserved verbatim from the pre-split implementation:
// (1) resize + upload the user's mirror selfie to the `garments` bucket;
// (2) call `outfit_photo_feedback` with `{ outfit_id, selfie_path }` and
// surface the structured row back to the screen.
//
// Splits introduced in Phase 2:
//   • `lib/feedbackNormalizer.ts` — `adaptFeedback`, `deriveSummary`,
//     `isLikelySelfieDetectorMessage` (pure, React-free).
//   • `useFeedbackFetch.ts` — edge function call + error classification.
//   • `useFeedbackCleanup.ts` — selfie-blob removal + resized-temp delete.

import { useCallback, useEffect, useRef, useState } from 'react';
import { File as FsFile } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import {
  adaptFeedback,
  type PhotoFeedback,
} from '../lib/feedbackNormalizer';
import { useFeedbackCleanup } from './useFeedbackCleanup';
import { useFeedbackFetch } from './useFeedbackFetch';

export type { PhotoFeedback } from '../lib/feedbackNormalizer';

const BUCKET = 'garments';
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.85;

export interface UsePhotoFeedbackResult {
  feedback: PhotoFeedback | null;
  isUploading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  submitFeedback: (params: { outfitId: string; selfieUri: string }) => Promise<void>;
  reset: () => void;
}

async function resizeSelfie(uri: string): Promise<ImageManipulator.ImageResult> {
  return ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    },
  );
}

export function usePhotoFeedback(): UsePhotoFeedbackResult {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const cleanup = useFeedbackCleanup();
  const { fetchFeedback } = useFeedbackFetch();
  const [feedback, setFeedback] = useState<PhotoFeedback | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const submitFeedback = useCallback(
    async ({ outfitId, selfieUri }: { outfitId: string; selfieUri: string }) => {
      if (!user || !session?.access_token) {
        setError('Not authenticated');
        return;
      }
      const trimmedOutfitId = outfitId?.trim();
      if (!trimmedOutfitId) {
        setError('Missing outfit_id');
        return;
      }
      if (!selfieUri || selfieUri.length === 0) {
        setError('Missing selfie');
        return;
      }

      abortRef.current?.abort();
      const trackedPath = cleanup.getTrackedSelfiePath();
      if (trackedPath) {
        cleanup.sweepSelfie(trackedPath);
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setFeedback(null);
      setError(null);
      setIsUploading(true);
      setIsAnalyzing(false);

      const timestamp = Date.now();
      const selfiePath = `${user.id}/selfie_${timestamp}.jpg`;
      let resizedTempUri: string | null = null;
      let uploaded = false;
      try {
        try {
          const resized = await resizeSelfie(selfieUri);
          resizedTempUri = resized.uri;
          if (controller.signal.aborted) return;
          const bytes = await new FsFile(resized.uri).bytes();
          if (controller.signal.aborted) return;

          const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(
            selfiePath,
            bytes,
            { contentType: 'image/jpeg', upsert: false },
          );
          if (uploadErr) {
            if (controller.signal.aborted) return;
            setError(uploadErr.message ?? 'Upload failed');
            Sentry.withScope((s) => {
              s.setTag('mutation', 'usePhotoFeedback.upload');
              Sentry.captureException(uploadErr);
            });
            return;
          }
          uploaded = true;
          cleanup.trackSelfiePath(selfiePath);
        } catch (uploadEx) {
          if (controller.signal.aborted) return;
          const message =
            uploadEx instanceof Error ? uploadEx.message : 'Upload failed';
          setError(message);
          Sentry.withScope((s) => {
            s.setTag('mutation', 'usePhotoFeedback.upload');
            Sentry.captureException(uploadEx);
          });
          return;
        }
      } finally {
        setIsUploading(false);
        if (controller.signal.aborted && uploaded) {
          cleanup.sweepSelfie(selfiePath);
        }
        if (controller.signal.aborted) {
          cleanup.sweepTemp(resizedTempUri);
        }
      }

      if (controller.signal.aborted) {
        cleanup.sweepTemp(resizedTempUri);
        return;
      }
      setIsAnalyzing(true);
      let analyzeSucceeded = false;
      try {
        const result = await fetchFeedback({
          outfitId: trimmedOutfitId,
          selfiePath,
          signal: controller.signal,
        });
        if (controller.signal.aborted || result.kind === 'aborted') return;
        if (result.kind === 'paywall') {
          setError(SUBSCRIPTION_SENTINEL);
          return;
        }
        if (result.kind === 'error') {
          if (result.message !== SUBSCRIPTION_SENTINEL) {
            Sentry.withScope((s) => {
              s.setTag('mutation', 'usePhotoFeedback.analyze');
              Sentry.captureException(new Error(result.message));
            });
          }
          setError(result.message);
          return;
        }
        setFeedback(adaptFeedback(result.row));
        analyzeSucceeded = true;
        queryClient.invalidateQueries({
          queryKey: ['outfit_feedback', user.id, trimmedOutfitId],
        });
        queryClient.invalidateQueries({ queryKey: ['outfit_feedback'] });
      } finally {
        setIsAnalyzing(false);
        cleanup.sweepTemp(resizedTempUri);
        if (analyzeSucceeded) {
          cleanup.sweepSelfie(selfiePath);
        } else if (controller.signal.aborted && uploaded) {
          cleanup.sweepSelfie(selfiePath);
        }
      }
    },
    [user, session?.access_token, queryClient, cleanup, fetchFeedback],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    cleanup.sweepTracked();
    setFeedback(null);
    setIsUploading(false);
    setIsAnalyzing(false);
    setError(null);
  }, [cleanup]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      cleanup.sweepTracked();
    };
  }, [cleanup]);

  return {
    feedback,
    isUploading,
    isAnalyzing,
    error,
    submitFeedback,
    reset,
  };
}
