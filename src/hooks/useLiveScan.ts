import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { hapticMedium, hapticSuccess } from '@/lib/haptics';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';

export interface ScanResult {
  analysis: GarmentAnalysis;
  thumbnailUrl: string;
  blob: Blob;
}

/**
 * Compress a video frame captured from canvas to a max-dimension JPEG.
 */
function compressFrame(canvas: HTMLCanvasElement, video: HTMLVideoElement, maxDim = 480, quality = 0.5): Promise<{ blob: Blob; base64: string }> {
  return new Promise((resolve, reject) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(maxDim / Math.max(vw, vh), 1);
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to capture frame'));
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({ blob, base64: reader.result as string });
        };
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

export function useLiveScan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [scanCount, setScanCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const savingRef = useRef<Promise<void>[]>([]);

  // Ensure canvas exists
  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    return canvasRef.current;
  }, []);

  /**
   * Capture the current video frame, compress, and send to AI for analysis.
   */
  const capture = useCallback(async (videoEl: HTMLVideoElement) => {
    if (!user || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    setLastResult(null);

    try {
      const canvas = getCanvas();
      const { blob, base64 } = await compressFrame(canvas, videoEl);
      const thumbnailUrl = URL.createObjectURL(blob);

      // Send base64 directly to AI (no storage upload yet)
      const { data, error: fnError } = await invokeEdgeFunction<GarmentAnalysis & { error?: string }>('analyze_garment', {
        body: { base64Image: base64 },
      });

      if (fnError || data?.error) {
        setError(fnError?.message || data?.error || 'Analysis failed');
        URL.revokeObjectURL(thumbnailUrl);
        return;
      }

      setLastResult({
        analysis: data as GarmentAnalysis,
        thumbnailUrl,
        blob,
      });

      hapticMedium();
    } catch (err) {
      console.error('Capture error:', err);
      setError('Could not capture image');
    } finally {
      setIsProcessing(false);
    }
  }, [user, isProcessing, getCanvas]);

  /**
   * Accept the last scanned result: upload image + save garment in background.
   */
  const accept = useCallback(() => {
    if (!lastResult || !user) return;
    const result = lastResult;
    setLastResult(null);
    setScanCount((c) => c + 1);

    hapticSuccess();

    // Background save
    const savePromise = (async () => {
      try {
        const garmentId = crypto.randomUUID();
        const ext = 'jpg';
        const storagePath = `${user.id}/${garmentId}.${ext}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('garments')
          .upload(storagePath, result.blob, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          return;
        }

        // Save garment record
        const { error: insertError } = await supabase.from('garments').insert({
          id: garmentId,
          user_id: user.id,
          image_path: storagePath,
          title: result.analysis.title,
          category: result.analysis.category,
          subcategory: result.analysis.subcategory || null,
          color_primary: result.analysis.color_primary,
          color_secondary: result.analysis.color_secondary || null,
          pattern: result.analysis.pattern || null,
          material: result.analysis.material || null,
          fit: result.analysis.fit || null,
          season_tags: result.analysis.season_tags || [],
          formality: result.analysis.formality || 3,
          ai_analyzed_at: new Date().toISOString(),
          ai_provider: result.analysis.ai_provider || 'lovable_ai',
          ai_raw: result.analysis.ai_raw as any || null,
          imported_via: 'live_scan',
        });

        if (insertError) {
          console.error('Insert error:', insertError);
        }
      } catch (err) {
        console.error('Background save error:', err);
      } finally {
        URL.revokeObjectURL(result.thumbnailUrl);
      }
    })();

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
    // Wait for all background saves to complete
    await Promise.allSettled(savingRef.current);
    savingRef.current = [];

    // Batch invalidate garments cache
    queryClient.invalidateQueries({ queryKey: ['garments'] });
    queryClient.invalidateQueries({ queryKey: ['garment-count'] });
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
  }, [queryClient]);

  return {
    scanCount,
    isProcessing,
    lastResult,
    error,
    capture,
    accept,
    retake,
    finish,
  };
}
