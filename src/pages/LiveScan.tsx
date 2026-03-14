import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, RotateCcw, Camera, Zap, ZapOff, ImagePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLiveScan } from '@/hooks/useLiveScan';
import { useAutoDetect, type FramingHint } from '@/hooks/useAutoDetect';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { isMedianApp } from '@/lib/median';

/* ─── Accepted overlay — fast checkmark fade ─── */
function AcceptedOverlay({ onDone, label }: { onDone: () => void; label: string }) {
  useEffect(() => { const t = setTimeout(onDone, 400); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center gap-3"
      >
        <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center">
          <Check className="w-10 h-10 text-accent" strokeWidth={3} />
        </div>
        <p className="text-foreground text-sm font-medium">{label}</p>
      </motion.div>
    </motion.div>
  );
}

/* ─── Auto-progress ring around shutter ─── */
function AutoProgressRing({ progress }: { progress: number }) {
  const circumference = 2 * Math.PI * 30;
  const offset = circumference * (1 - progress);
  return (
    <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r="30" fill="none" stroke="hsl(var(--accent) / 0.2)" strokeWidth="3" />
      <circle cx="36" cy="36" r="30" fill="none" stroke="hsl(var(--accent))" strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 80ms ease-out' }} />
    </svg>
  );
}

/* ─── Scan overlay — radial pulse ─── */
function ScanOverlay({ label }: { label: string }) {
  useEffect(() => {
    if (!navigator.vibrate) return;
    const id = setInterval(() => { navigator.vibrate([6, 80, 6]); }, 400);
    return () => { clearInterval(id); navigator.vibrate(0); };
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center">
      <div className="w-48 h-48 rounded-full border border-accent/30 animate-ping" />
      <div className="absolute">
        <span className="text-foreground text-sm font-medium bg-background/60 px-4 py-2 rounded-full backdrop-blur-sm animate-pulse">
          {label}
        </span>
      </div>
    </div>
  );
}

/* ─── Circular reticle ─── */
function Reticle({ stable }: { stable: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className={cn(
        'w-[200px] h-[200px] rounded-full border-2 transition-all duration-300',
        stable
          ? 'border-accent/60 shadow-[0_0_30px_hsl(var(--accent)/0.15)]'
          : 'border-foreground/20'
      )} />
    </div>
  );
}

/* ─── Framing guidance pill ─── */
function ScanGuidance({ hint, autoMode }: { hint: FramingHint; autoMode: boolean }) {
  const { t } = useLanguage();
  if (!hint) return null;

  const labels: Record<string, string> = {
    more_light: t('scan.more_light'),
    too_close: t('scan.move_back'),
    too_far: t('scan.move_closer'),
    ready: autoMode ? t('scan.ready') : t('scan.point_garment'),
  };

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[120px] pointer-events-none z-10">
      <div className={cn(
        'px-4 py-2 rounded-full backdrop-blur-sm text-xs font-medium transition-all duration-300',
        hint === 'ready' ? 'bg-accent/20 text-accent' :
        hint === 'more_light' ? 'bg-warning/20 text-warning' :
        'bg-foreground/10 text-muted-foreground'
      )}>
        {labels[hint] || labels.ready}
      </div>
    </div>
  );
}

/* ─── Permission check helper ─── */
async function checkCameraPermission(): Promise<PermissionState | 'unknown'> {
  try {
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return result.state;
  } catch {
    return 'unknown';
  }
}

export default function LiveScan() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const [autoMode, setAutoMode] = useState(true);

  const isMedian = isMedianApp();
  const useFileInputMode = isMedian || !navigator.mediaDevices?.getUserMedia;

  const { scanCount, isProcessing, lastResult, error, capture, captureFromFile, accept, retake, finish } = useLiveScan();
  const { subscription, isPremium } = useSubscription();

  const remainingSlots = isPremium ? Infinity : PLAN_LIMITS.free.maxGarments - (subscription?.garments_count || 0) - scanCount;
  const canCapture = useFileInputMode
    ? !isProcessing && !lastResult && !showAccepted
    : cameraReady && !isProcessing && !lastResult && !showAccepted;
  const hasSlots = isPremium || remainingSlots > 0;

  const handleAutoCapture = useCallback(() => {
    if (!videoRef.current || !canCapture || !hasSlots) return;
    capture(videoRef.current);
    if (navigator.vibrate) navigator.vibrate(30);
  }, [capture, canCapture, hasSlots]);

  const { progress: autoProgress, framingHint } = useAutoDetect({
    enabled: !useFileInputMode && autoMode && canCapture && hasSlots,
    videoEl: videoRef.current,
    busy: isProcessing || !!lastResult || showAccepted,
    onStable: handleAutoCapture,
  });

  /** Handle file input change (Median / fallback mode) */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can be selected again
    e.target.value = '';
    if (!hasSlots) { setShowPaywall(true); return; }
    captureFromFile(file);
  }, [captureFromFile, hasSlots]);

  /** Trigger file input for Median / fallback capture */
  const handleFileCapture = useCallback(() => {
    if (!hasSlots) { setShowPaywall(true); return; }
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.setAttribute('accept', 'image/*');
      fileInputRef.current.click();
    }
  }, [hasSlots]);

  /** Start camera — must be called from a user gesture (onClick) for Android WebView */
  const startCamera = useCallback(async () => {
    if (useFileInputMode) {
      // In Median / no-getUserMedia mode, just trigger file input directly
      handleFileCapture();
      return;
    }

    setCameraStarted(true);
    setCameraError(null);

    // Check permission state first
    const permState = await checkCameraPermission();
    if (permState === 'denied') {
      setCameraError(t('scan.camera_denied'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err: unknown) {
      console.error('Camera error:', err);
      const error = err instanceof Error ? err : null;
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setCameraError(t('scan.camera_denied'));
      } else if (error?.name === 'NotFoundError') {
        setCameraError(t('scan.no_camera'));
      } else {
        setCameraError(t('scan.camera_error'));
      }
    }
  }, [t, useFileInputMode, handleFileCapture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCapture = useCallback(() => {
    if (useFileInputMode) {
      handleFileCapture();
      return;
    }
    if (!videoRef.current || isProcessing || lastResult) return;
    if (!isPremium && remainingSlots <= 0) { setShowPaywall(true); return; }
    capture(videoRef.current);
  }, [capture, isProcessing, lastResult, isPremium, remainingSlots, useFileInputMode, handleFileCapture]);

  const handleAccept = useCallback(() => { accept(); setShowAccepted(true); }, [accept]);
  const handleAcceptedDone = useCallback(() => { setShowAccepted(false); }, []);

  const handleDone = useCallback(async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    await finish(); navigate('/wardrobe');
  }, [finish, navigate]);

  const handleClose = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    finish(); navigate('/wardrobe');
  }, [finish, navigate]);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Hidden file input for Median / fallback mode */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top bar — glass */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-background/70 backdrop-blur-xl border-b border-border/10">
        <Button variant="ghost" size="icon" className="text-foreground hover:bg-foreground/[0.06]" onClick={handleClose}>
          <X className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          {cameraReady && !useFileInputMode && (
            <button
              onClick={() => setAutoMode((v) => !v)}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center transition-all',
                autoMode ? 'bg-accent/20 text-accent' : 'bg-foreground/10 text-muted-foreground'
              )}
            >
              {autoMode ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}
        </div>
        {scanCount > 0 ? (
          <Button variant="ghost" size="sm" className="text-foreground hover:bg-foreground/[0.06] font-medium text-sm" onClick={handleDone}>{t('scan.done')}</Button>
        ) : <div className="w-12" />}
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden">
        {useFileInputMode ? (
          /* File-input mode (Median or no getUserMedia) */
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <div className="space-y-6">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                <ImagePlus className="w-10 h-10 text-accent" />
              </div>
              <div className="space-y-2">
                <p className="text-foreground text-base font-medium">{t('scan.title')}</p>
                <p className="text-muted-foreground text-sm">{t('scan.tap_to_capture')}</p>
              </div>
              <Button onClick={handleFileCapture} disabled={isProcessing} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Camera className="w-4 h-4 mr-2" />{t('scan.take_photo')}
              </Button>
            </div>
          </div>
        ) : !cameraStarted ? (
          /* Start Camera button — required for user-gesture */
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <div className="space-y-4">
              <Camera className="w-16 h-16 text-muted-foreground/50 mx-auto" />
              <p className="text-muted-foreground text-sm">{t('scan.tap_to_start')}</p>
              <Button onClick={startCamera} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Camera className="w-4 h-4 mr-2" />{t('scan.start_camera')}
              </Button>
            </div>
          </div>
        ) : cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <div className="space-y-4">
              <Camera className="w-16 h-16 text-muted-foreground/50 mx-auto" />
              <p className="text-muted-foreground text-sm">{cameraError}</p>
              <Button variant="outline" onClick={handleClose}>{t('common.back')}</Button>
            </div>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        )}

        {/* Idle: circular reticle + guidance (only in camera mode) */}
        {!useFileInputMode && cameraReady && !lastResult && !isProcessing && !showAccepted && (
          <>
            <Reticle stable={autoMode && autoProgress > 0} />
            <ScanGuidance hint={framingHint} autoMode={autoMode} />
          </>
        )}

        {isProcessing && <ScanOverlay label={t('scan.analyzing')} />}
        
        <AnimatePresence>
          {showAccepted && <AcceptedOverlay onDone={handleAcceptedDone} label={t('scan.added')} />}
        </AnimatePresence>

        {error && !isProcessing && (
          <div className="absolute bottom-32 left-4 right-4 z-20">
            <div className="bg-destructive/80 backdrop-blur-md rounded-xl p-3 text-center">
              <p className="text-destructive-foreground text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Fullscreen result overlay */}
        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-background/90 backdrop-blur-xl flex flex-col items-center justify-center p-6"
            >
              <div className="w-full max-w-sm space-y-6">
                <img
                  src={lastResult.thumbnailUrl}
                  alt="Scanned garment"
                  className="w-full aspect-[3/4] object-cover rounded-2xl shadow-2xl border border-border/20"
                />
                <div className="text-center space-y-1">
                  <p className="text-foreground text-lg font-semibold">{lastResult.analysis.title}</p>
                  <p className="text-muted-foreground text-sm capitalize">
                    {lastResult.analysis.category} · {lastResult.analysis.color_primary}
                    {lastResult.analysis.material ? ` · ${lastResult.analysis.material}` : ''}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={retake}>
                    <RotateCcw className="w-4 h-4 mr-2" />{t('scan.retake')}
                  </Button>
                  <Button className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleAccept}>
                    <Check className="w-4 h-4 mr-2" />{t('scan.accept')}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scan counter pill — bottom left */}
        {scanCount > 0 && !lastResult && (
          <div className="absolute bottom-4 left-4 z-10">
            <div className="flex items-center gap-1.5 bg-background/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/10">
              <Check className="w-3.5 h-3.5 text-accent" />
              <span className="text-foreground text-xs font-medium">{scanCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Shutter button — only in camera stream mode */}
      {!useFileInputMode && cameraReady && (
        <div className="relative z-10 flex items-center justify-center py-6 bg-background/70 backdrop-blur-xl border-t border-border/10">
          <div className="relative w-16 h-16">
            {autoMode && autoProgress > 0 && <AutoProgressRing progress={autoProgress} />}
            <button
              disabled={!canCapture}
              onClick={handleCapture}
              className={cn(
                'w-16 h-16 rounded-full border-[3px] border-foreground flex items-center justify-center transition-all active:scale-90',
                !canCapture ? 'opacity-30' : 'opacity-100'
              )}
              aria-label="Scan"
            >
              <div className={cn(
                'w-12 h-12 rounded-full transition-colors',
                autoMode && autoProgress > 0.5 ? 'bg-accent/80' : 'bg-foreground/90'
              )} />
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar for file-input mode — take another photo */}
      {useFileInputMode && !lastResult && !isProcessing && !showAccepted && scanCount > 0 && (
        <div className="relative z-10 flex items-center justify-center py-6 bg-background/70 backdrop-blur-xl border-t border-border/10">
          <Button onClick={handleFileCapture} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Camera className="w-4 h-4 mr-2" />{t('scan.take_photo')}
          </Button>
        </div>
      )}

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="garments" />
    </div>
  );
}
