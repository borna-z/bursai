import { useState, useCallback, useRef } from 'react';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { hapticMedium, hapticSuccess } from '@/lib/haptics';
import { compressImage } from '@/lib/imageCompression';
import { compressCenterCrop } from '@/lib/compressFrame';
import { saveGarmentInBackground } from '@/lib/backgroundGarmentSave';
import { removeBackground, removeBackgroundFromDataUrl } from '@/lib/removeBackground';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';

export interface ScanResult {
  analysis: GarmentAnalysis;
  thumbnailUrl: string;
  blob: Blob;
  confidence?: number;
}

export function useLiveScan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [scanCount, setScanCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const savingRef = useRef<Promise<void>[]>([]);

  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    return canvasRef.current;
  }, []);

  /**
   * Capture the current video frame with center-crop, compress, remove background, and send to AI.
   */
  const capture = useCallback(async (videoEl: HTMLVideoElement) => {
    if (!user || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    setLastResult(null);

    try {
      const canvas = getCanvas();
      const { blob: rawBlob, base64: rawBase64 } = await compressCenterCrop(canvas, videoEl);

      // Remove background
      setIsRemovingBackground(true);
      const { blob, base64 } = await removeBackgroundFromDataUrl(rawBase64);
      setIsRemovingBackground(false);

      const thumbnailUrl = URL.createObjectURL(blob);

      const { data, error: fnError } = await invokeEdgeFunction<GarmentAnalysis & { error?: string; confidence?: number }>('analyze_garment', {
        body: { base64Image: base64, mode: 'fast' },
      });

      if (fnError || data?.error) {
        setError(fnError?.message || data?.error || 'Analysis failed');
        URL.revokeObjectURL(thumbnailUrl);
        return;
      }

      const confidence = typeof data?.confidence === 'number' ? data.confidence : undefined;
      setLastResult({ analysis: data as GarmentAnalysis, thumbnailUrl, blob, confidence });
      hapticMedium();
    } catch (err) {
      console.error('Capture error:', err);
      setError('Could not capture image');
      setIsRemovingBackground(false);
    } finally {
      setIsProcessing(false);
    }
  }, [user, isProcessing, getCanvas]);

  /**
   * Capture from a File (used by Median file-input fallback).
   */
  const captureFromFile = useCallback(async (file: File) => {
    if (!user || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    setLastResult(null);

    try {
      const { file: compressed, previewUrl } = await compressImage(file, { maxDimension: 480, quality: 0.5 });
      const rawBlob = compressed as Blob;

      // Remove background
      setIsRemovingBackground(true);
      const processedBlob = await removeBackground(rawBlob);
      setIsRemovingBackground(false);

      // Revoke old preview, create new one from processed blob
      URL.revokeObjectURL(previewUrl);
      const thumbnailUrl = URL.createObjectURL(processedBlob);

      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(processedBlob);
      });

      const { data, error: fnError } = await invokeEdgeFunction<GarmentAnalysis & { error?: string; confidence?: number }>('analyze_garment', {
        body: { base64Image: base64, mode: 'fast' },
      });

      if (fnError || data?.error) {
        setError(fnError?.message || data?.error || 'Analysis failed');
        URL.revokeObjectURL(thumbnailUrl);
        return;
      }

      const confidence = typeof data?.confidence === 'number' ? data.confidence : undefined;
      setLastResult({ analysis: data as GarmentAnalysis, thumbnailUrl, blob: processedBlob, confidence });
      hapticMedium();
    } catch (err) {
      console.error('File capture error:', err);
      setError('Could not process image');
      setIsRemovingBackground(false);
    } finally {
      setIsProcessing(false);
    }
  }, [user, isProcessing]);

  /**
   * Accept the last scanned result: upload image + save garment + trigger Stage 2 enrichment in background.
   */
  const accept = useCallback(() => {
    if (!lastResult || !user) return;
    const result = lastResult;
    setLastResult(null);
    setScanCount((c) => c + 1);
    hapticSuccess();

    const savePromise = saveGarmentInBackground(result, user.id);
    savingRef.current.push(savePromise);
  }, [lastResult, user]);

  /**
   * Retake: discard the last result.
   */
  const retake = useCallback(() => {
    if (lastResult) {
      URL.revokeObjectURL(lastResult.thumbnailUrl);
    }
    setLastResult(null);
    setError(null);
  }, [lastResult]);

  /**
   * Done: wait for background saves and invalidate cache.
   */
  const finish = useCallback(async () => {
    await Promise.allSettled(savingRef.current);
    savingRef.current = [];

    queryClient.invalidateQueries({ queryKey: ['garments'] });
    queryClient.invalidateQueries({ queryKey: ['garment-count'] });
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
  }, [queryClient]);

  return {
    scanCount,
    isProcessing,
    isRemovingBackground,
    lastResult,
    error,
    capture,
    captureFromFile,
    accept,
    retake,
    finish,
  };
}
