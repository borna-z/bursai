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
    if (!videoEl.videoWidth || !videoEl.videoHeight) {
      setError('Camera not ready, try again');
      return;
    }
    setIsProcessing(true);
    setError(null);
    setLastResult(null);

    // Phase 1: compress
    const canvas = getCanvas();
    if (!canvas) {
      setError('Could not capture image');
      setIsProcessing(false);
      return;
    }

    let rawBlob: Blob;
    let rawBase64: string;
    try {
      const result = await compressCenterCrop(canvas, videoEl);
      rawBlob = result.blob;
      rawBase64 = result.base64;
    } catch (err) {
      console.error('[LiveScan] compress failed:', err);
      setError('Could not capture image');
      setIsProcessing(false);
      return;
    }

    // Phase 2: background removal — always succeeds, degrades to original
    setIsProcessing(false);
    setIsRemovingBackground(true);
    let blob = rawBlob;
    let base64 = rawBase64;
    try {
      const result = await removeBackgroundFromDataUrl(rawBase64);
      blob = result.blob;
      base64 = result.base64;
    } catch (err) {
      console.warn('[LiveScan] background removal failed, using original:', err);
    }
    setIsRemovingBackground(false);
    setIsProcessing(true);

    // Phase 3: AI analysis
    try {
      const thumbnailUrl = URL.createObjectURL(blob);

      const { data, error: fnError } = await invokeEdgeFunction<GarmentAnalysis & { error?: string; confidence?: number }>('analyze_garment', {
        body: { base64Image: base64, mode: 'fast' },
      });

      if (fnError || data?.error) {
        setError(fnError?.message || data?.error || 'Analysis failed');
        URL.revokeObjectURL(thumbnailUrl);
        setIsProcessing(false);
        return;
      }

      const confidence = typeof data?.confidence === 'number' ? data.confidence : undefined;
      setLastResult({ analysis: data as GarmentAnalysis, thumbnailUrl, blob, confidence });
      hapticMedium();
    } catch (err) {
      console.error('[LiveScan] analysis failed:', err);
      setError('Analysis failed — please try again');
    } finally {
      setIsProcessing(false);
      setIsRemovingBackground(false);
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

    // Phase 1: compress
    let rawBlob: Blob;
    let previewUrl: string;
    try {
      const result = await compressImage(file, { maxDimension: 480, quality: 0.5 });
      rawBlob = result.file as Blob;
      previewUrl = result.previewUrl;
    } catch (err) {
      console.error('[LiveScan] compress failed:', err);
      setError('Could not process image');
      setIsProcessing(false);
      return;
    }

    // Phase 2: background removal — always succeeds, degrades to original
    setIsProcessing(false);
    setIsRemovingBackground(true);
    let processedBlob = rawBlob;
    try {
      processedBlob = await removeBackground(rawBlob);
    } catch (err) {
      console.warn('[LiveScan] background removal failed, using original:', err);
    }
    setIsRemovingBackground(false);
    setIsProcessing(true);

    // Phase 3: AI analysis
    try {
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
        setIsProcessing(false);
        return;
      }

      const confidence = typeof data?.confidence === 'number' ? data.confidence : undefined;
      setLastResult({ analysis: data as GarmentAnalysis, thumbnailUrl, blob: processedBlob, confidence });
      hapticMedium();
    } catch (err) {
      console.error('[LiveScan] analysis failed:', err);
      setError('Analysis failed — please try again');
    } finally {
      setIsProcessing(false);
      setIsRemovingBackground(false);
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
