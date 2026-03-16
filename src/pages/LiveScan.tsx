import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, RotateCcw, Camera, Zap, ZapOff, ImagePlus, Shirt } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLiveScan } from '@/hooks/useLiveScan';
import { useAutoDetect, type FramingHint } from '@/hooks/useAutoDetect';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { isMedianApp } from '@/lib/median';
import { EASE_CURVE } from '@/lib/motion';
import { categoryLabel, colorLabel, materialLabel } from '@/lib/humanize';

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
        <div className="w-20 h-20 bg-accent/20 flex items-center justify-center">
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

/* ─── Premium scan overlay — shimmer + phase text ─── */
function ScanOverlay() {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const phases = [
    t('scan.locking_on') || 'Locking on…',
    t('scan.reading_garment') || 'Reading garment…',
    t('scan.extracting') || 'Extracting details…',
  ];

  useEffect(() => {
    if (prefersReduced) return;
    const durations = [1200, 1800, 0];
    if (phase >= phases.length - 1) return;
    const timer = setTimeout(() => setPhase(p => p + 1), durations[phase]);
    return () => clearTimeout(timer);
  }, [phase, prefersReduced, phases.length]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5">
      {/* Subtle breathing glow */}
      {!prefersReduced && (
        <motion.div
          className="absolute w-40 h-40 rounded-full bg-accent/10 blur-2xl"
          animate={{ opacity: [0.3, 0.55, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      
      {/* Phase text */}
      <AnimatePresence mode="wait">
        <motion.span
          key={phase}
          initial={prefersReduced ? undefined : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReduced ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: EASE_CURVE }}
          className="text-foreground text-sm font-medium bg-background/60 px-4 py-2 backdrop-blur-sm"
        >
          {phases[phase]}
        </motion.span>
      </AnimatePresence>

      {/* Shimmer line */}
      {!prefersReduced && (
        <div className="w-24 h-px bg-border/20 overflow-hidden relative">
          <motion.div
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-accent/40 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Focus frame reticle (corner brackets) ─── */
function FocusFrame({ locked, confidence }: { locked: boolean; confidence: number }) {
  const size = 200;
  const corner = 28;
  const stroke = locked ? 'stroke-accent' : 'stroke-foreground/20';
  const glowOpacity = locked ? 0.12 : 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Subtle glow on lock */}
        {locked && (
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              boxShadow: `0 0 40px hsl(var(--accent) / ${glowOpacity})`,
              transition: 'box-shadow 300ms ease-out',
            }}
          />
        )}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          fill="none"
          className="transition-all duration-300"
        >
          {/* Top-left */}
          <path d={`M${corner} 2 H8 a6 6 0 0 0-6 6 V${corner}`} className={cn(stroke, 'transition-all duration-300')} strokeWidth="2.5" strokeLinecap="round" />
          {/* Top-right */}
          <path d={`M${size - corner} 2 H${size - 8} a6 6 0 0 1 6 6 V${corner}`} className={cn(stroke, 'transition-all duration-300')} strokeWidth="2.5" strokeLinecap="round" />
          {/* Bottom-left */}
          <path d={`M${corner} ${size - 2} H8 a6 6 0 0 1-6-6 V${size - corner}`} className={cn(stroke, 'transition-all duration-300')} strokeWidth="2.5" strokeLinecap="round" />
          {/* Bottom-right */}
          <path d={`M${size - corner} ${size - 2} H${size - 8} a6 6 0 0 0 6-6 V${size - corner}`} className={cn(stroke, 'transition-all duration-300')} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
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
    multiple_objects: t('scan.multiple_objects') || 'Focus on one garment',
    ready: autoMode ? t('scan.ready') : t('scan.point_garment'),
  };

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[120px] pointer-events-none z-10">
      <div className={cn(
        'px-4 py-2 backdrop-blur-sm text-xs font-medium transition-all duration-300',
        hint === 'ready' ? 'bg-accent/20 text-accent' :
        hint === 'more_light' ? 'bg-warning/20 text-warning' :
        hint === 'multiple_objects' ? 'bg-warning/20 text-warning' :
        'bg-foreground/10 text-muted-foreground'
      )}>
        {labels[hint] || labels.ready}
      </div>
    </div>
  );
}

/* ─── Confidence badge ─── */
function ConfidenceBadge({ confidence }: { confidence?: number }) {
  const { t } = useLanguage();
  if (confidence == null) return null;

  let label: string;
  let variant: 'default' | 'secondary' | 'outline';
  if (confidence >= 0.8) {
    label = t('scan.confidence_high') || 'High confidence';
    variant = 'default';
  } else if (confidence >= 0.5) {
    label = t('scan.confidence_medium') || 'Review recommended';
    variant = 'secondary';
  } else {
    label = t('scan.confidence_low') || 'Low confidence';
    variant = 'outline';
  }

  return <Badge variant={variant} className="text-[10px]">{label}</Badge>;
}

/* ─── Scan history thumbnail strip ─── */
function ScanHistoryStrip({ thumbnails }: { thumbnails: string[] }) {
  if (thumbnails.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_CURVE }}
      className="absolute bottom-4 left-4 right-20 z-10 flex items-center gap-2 overflow-x-auto scrollbar-hide"
    >
      {thumbnails.map((url, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.05, duration: 0.2 }}
          className="w-11 h-11 overflow-hidden border border-border/20 bg-secondary/40 flex-shrink-0 shadow-sm"
        >
          <img src={url} alt="" className="w-full h-full object-cover" />
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ─── Remaining slots pill ─── */
function SlotsPill({ remaining, isPremium }: { remaining: number; isPremium: boolean }) {
  const { t } = useLanguage();
  if (isPremium) return null;
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium backdrop-blur-sm border',
      remaining <= 2
        ? 'bg-destructive/10 text-destructive border-destructive/20'
        : 'bg-foreground/5 text-muted-foreground border-border/10'
    )}>
      <Shirt className="w-3 h-3" />
      <span>{remaining} {t('scan.slots_left') || 'left'}</span>
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
  const [scanThumbnails, setScanThumbnails] = useState<string[]>([]);

  const isMedian = isMedianApp();
  const useFileInputMode = isMedian || !navigator.mediaDevices?.getUserMedia;

  const { scanCount, isProcessing, isRemovingBackground, lastResult, error, capture, captureFromFile, accept, retake, finish } = useLiveScan();
  const { subscription, isPremium, isLoading: isSubLoading } = useSubscription();

  // Guard: don't allow scanning until subscription data is loaded (prevents race condition)
  const remainingSlots = isPremium ? Infinity : isSubLoading ? 0 : PLAN_LIMITS.free.maxGarments - (subscription?.garments_count || 0) - scanCount;
  const canCapture = useFileInputMode
    ? !isProcessing && !lastResult && !showAccepted
    : cameraReady && !isProcessing && !lastResult && !showAccepted;
  const hasSlots = isPremium || remainingSlots > 0;

  const handleAutoCapture = useCallback(() => {
    if (!videoRef.current || !canCapture || !hasSlots) return;
    capture(videoRef.current);
    if (navigator.vibrate) navigator.vibrate(30);
  }, [capture, canCapture, hasSlots]);

  const { progress: autoProgress, framingHint, lockConfidence } = useAutoDetect({
    enabled: !useFileInputMode && autoMode && canCapture && hasSlots,
    videoEl: videoRef.current,
    busy: isProcessing || !!lastResult || showAccepted,
    onStable: handleAutoCapture,
  });

  /** Handle file input change (Median / fallback mode) */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      handleFileCapture();
      return;
    }

    setCameraStarted(true);
    setCameraError(null);

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

  const handleAccept = useCallback(() => {
    // Save thumbnail for history strip
    if (lastResult?.thumbnailUrl) {
      setScanThumbnails(prev => [...prev, lastResult.thumbnailUrl]);
    }
    accept();
    setShowAccepted(true);
  }, [accept, lastResult]);

  const handleAcceptedDone = useCallback(() => { setShowAccepted(false); }, []);

  const handleDone = useCallback(async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    await finish(); navigate('/wardrobe');
  }, [finish, navigate]);

  const handleClose = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    finish(); navigate('/wardrobe');
  }, [finish, navigate]);

  const isLocked = autoMode && autoProgress > 0;

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
          <SlotsPill remaining={remainingSlots === Infinity ? 999 : remainingSlots} isPremium={isPremium} />
          {cameraReady && !useFileInputMode && (
            <button
              onClick={() => setAutoMode((v) => !v)}
              className={cn(
                'w-9 h-9 flex items-center justify-center transition-all',
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
            <div className="w-20 h-20 bg-accent/10 flex items-center justify-center mx-auto">
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

        {/* Idle: focus frame reticle + guidance (only in camera mode) */}
        {!useFileInputMode && cameraReady && !lastResult && !isProcessing && !showAccepted && (
          <>
            <FocusFrame locked={isLocked} confidence={lockConfidence} />
            <ScanGuidance hint={framingHint} autoMode={autoMode} />
          </>
        )}

        {isProcessing && <ScanOverlay />}
        {!isProcessing && isRemovingBackground && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <span className="text-foreground text-sm font-medium bg-background/60 px-4 py-2 backdrop-blur-sm">
              Isolating garment…
            </span>
          </div>
        )}
        
        <AnimatePresence>
          {showAccepted && <AcceptedOverlay onDone={handleAcceptedDone} label={t('scan.added')} />}
        </AnimatePresence>

        {error && !isProcessing && (
          <div className="absolute bottom-32 left-4 right-4 z-20">
            <div className="bg-destructive/80 backdrop-blur-md p-3 text-center">
              <p className="text-destructive-foreground text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Fullscreen result overlay — editorial card */}
        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-background/90 backdrop-blur-xl flex flex-col items-center justify-center p-6"
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: EASE_CURVE }}
                className="w-full max-w-sm space-y-5"
              >
                {/* Image with editorial overlay */}
                <div className="relative">
                  <img
                    src={lastResult.thumbnailUrl}
                    alt="Scanned garment"
                    className="w-full aspect-[3/4] object-cover border border-border/20"
                  />
                  {/* Gradient overlay at bottom for text */}
                  <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-background/80 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 space-y-1.5">
                    <p className="text-foreground text-lg font-semibold leading-tight drop-shadow-sm">{lastResult.analysis.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-foreground/70 text-sm capitalize">
                        {categoryLabel(t, lastResult.analysis.category)}
                      </span>
                      <span className="text-foreground/30 text-sm">·</span>
                      <span className="text-foreground/70 text-sm capitalize">
                        {colorLabel(t, lastResult.analysis.color_primary)}
                      </span>
                      {lastResult.analysis.material && (
                        <>
                          <span className="text-foreground/30 text-sm">·</span>
                          <span className="text-foreground/70 text-sm capitalize">
                            {materialLabel(t, lastResult.analysis.material)}
                          </span>
                        </>
                      )}
                    </div>
                    <ConfidenceBadge confidence={lastResult.confidence} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12" onClick={retake}>
                    <RotateCcw className="w-4 h-4 mr-2" />{t('scan.retake')}
                  </Button>
                  <Button className="flex-1 h-12 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleAccept}>
                    <Check className="w-4 h-4 mr-2" />{t('scan.accept')}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scan history thumbnail strip — bottom left */}
        {!lastResult && !isProcessing && !showAccepted && (
          <ScanHistoryStrip thumbnails={scanThumbnails} />
        )}

        {/* Scan counter pill — bottom right (if no history strip or as supplement) */}
        {scanCount > 0 && !lastResult && scanThumbnails.length === 0 && (
          <div className="absolute bottom-4 left-4 z-10">
            <div className="flex items-center gap-1.5 bg-background/60 backdrop-blur-sm px-3 py-1.5 border border-border/10">
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
