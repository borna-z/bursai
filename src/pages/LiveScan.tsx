import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, RotateCcw, Camera, Zap, ZapOff, ImagePlus, Shirt } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/lib/haptics';
import { useLiveScan } from '@/hooks/useLiveScan';
import { useAutoDetect, type FramingHint } from '@/hooks/useAutoDetect';
import { PageErrorBoundary } from '@/components/layout/PageErrorBoundary';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { isMedianApp, isMedianAndroid } from '@/lib/median';
import { EASE_CURVE } from '@/lib/motion';
import { categoryLabel, colorLabel, materialLabel } from '@/lib/humanize';
import { CoachMark } from '@/components/coach/CoachMark';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';
import { logger } from '@/lib/logger';
import { GarmentSaveChoiceSheet } from '@/components/garment/GarmentSaveChoiceSheet';
import { GarmentSavedCard } from '@/components/garment/GarmentSavedCard';

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
function ScanOverlay({ isDone }: { isDone: boolean }) {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const phases = [
    t('scan.locking_on') || 'Locking on…',
    t('scan.reading_garment') || 'Reading garment…',
    t('scan.extracting') || 'Extracting details…',
  ];

  useEffect(() => {
    if (isDone) { setPhase(phases.length - 1); return; }
    if (prefersReduced || phase >= phases.length - 1) return;
    const durations = [1000, 1400];
    const timer = setTimeout(() => setPhase(p => p + 1), durations[phase] ?? 1200);
    return () => clearTimeout(timer);
  }, [phase, isDone, prefersReduced, phases.length]);

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
function FocusFrame({ locked, confidence: _confidence }: { locked: boolean; confidence: number }) {
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
            className="absolute inset-0 rounded-[1.25rem]"
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
  const visibleThumbnails = thumbnails.slice(-3);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_CURVE }}
      className="absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-6rem)] items-center gap-2"
    >
      {visibleThumbnails.map((url, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.05, duration: 0.2 }}
          className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-[1rem] border border-border/55 bg-background/82 shadow-[0_10px_22px_rgba(28,25,23,0.08)]"
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
      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium backdrop-blur-sm',
      remaining <= 2
        ? 'bg-destructive/10 text-destructive border-destructive/20'
        : 'bg-background/85 text-muted-foreground border-border/55'
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

/* ─── Progressive camera constraint fallback (FIX 1) ─── */
async function tryGetCamera(): Promise<MediaStream> {
  const constraintSets: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    {
      video: { facingMode: 'environment' },
      audio: false,
    },
    {
      video: true,
      audio: false,
    },
  ];

  let lastError: unknown;
  for (const constraints of constraintSets) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err: unknown) {
      lastError = err;
      const name = err instanceof Error ? err.name : '';
      // Only fall through for constraint-related errors
      if (name !== 'OverconstrainedError' && name !== 'NotFoundError') {
        throw err;
      }
    }
  }
  throw lastError;
}

function LiveScanFallback() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <AppLayout hideNav>
      <PageHeader title={t('scan.title') || 'Live Scan'} showBack />
      <div className="page-shell !max-w-sm !pt-10">
        <Card surface="editorial" className="space-y-6 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.1rem] bg-background/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <Camera className="h-7 w-7 text-foreground/70" />
          </div>
          <p className="text-sm text-muted-foreground">{t('scan.fallback_message') || 'Live scan is unavailable. Try uploading a photo instead.'}</p>
          <Button onClick={() => navigate('/wardrobe')} className="w-full">
            Go to Wardrobe
          </Button>
        </Card>
      </div>
    </AppLayout>
  );
}

export default function LiveScan() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const torchActiveRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const [showSaveChoice, setShowSaveChoice] = useState(false);
  const [isSavingAccepted, setIsSavingAccepted] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [scanThumbnails, setScanThumbnails] = useState<string[]>([]);

  const isMedian = isMedianApp();
  const useFileInputMode = isMedian || !navigator.mediaDevices?.getUserMedia;

  const coach = useFirstRunCoach();
  const { scanCount, isProcessing, lastResult, lastAccepted, clearLastAccepted, error, capture, captureFromFile, accept, retake, finish } = useLiveScan();
  const { subscription, isPremium, isLoading: isSubLoading } = useSubscription();

  // Guard: don't allow scanning until subscription data is loaded (prevents race condition)
  const remainingSlots = isPremium ? Infinity : isSubLoading ? 0 : PLAN_LIMITS.free.maxGarments - (subscription?.garments_count || 0) - scanCount;
  const canCapture = useFileInputMode
    ? !isProcessing && !lastResult && !showAccepted
    : cameraReady && !isProcessing && !lastResult && !showAccepted;
  const hasSlots = isPremium || remainingSlots > 0;

  const handleAutoCaptureRef = useRef<() => void>(() => {});

  const { progress: autoProgress, framingHint, lockConfidence, optimalCropRatio } = useAutoDetect({
    enabled: !useFileInputMode && autoMode && canCapture && hasSlots,
    videoEl: videoRef.current,
    busy: isProcessing || !!lastResult || showAccepted,
    onStable: useCallback(() => handleAutoCaptureRef.current(), []),
  });

  const handleAutoCapture = useCallback(() => {
    if (!videoRef.current || !canCapture || !hasSlots) return;
    capture(videoRef.current, optimalCropRatio);
    hapticLight();
  }, [capture, canCapture, hasSlots, optimalCropRatio]);

  useEffect(() => {
    handleAutoCaptureRef.current = handleAutoCapture;
  }, [handleAutoCapture]);

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
    fileInputRef.current?.click();
  }, [hasSlots]);

  /** Start camera — must be called from a user gesture (onClick) for Android WebView */
  const startCamera = useCallback(async () => {
    if (useFileInputMode) {
      handleFileCapture();
      return;
    }

    setCameraStarted(true);
    setCameraReady(false);
    setCameraError(null);

    const permState = await checkCameraPermission();
    if (permState === 'denied') {
      setCameraError(t('scan.camera_denied'));
      return;
    }

    try {
      const stream = await tryGetCamera();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
          setCameraReady(true);
        } catch (playErr) {
          logger.warn('[LiveScan] play() failed:', playErr);
          // Still mark ready — some Android versions autoplay without explicit play()
          setCameraReady(true);
        }
      }
    } catch (err: unknown) {
      logger.error('Camera error:', err);
      const errObj = err instanceof Error ? err : null;
      if (errObj?.name === 'NotAllowedError' || errObj?.name === 'PermissionDeniedError') {
        setCameraError(
          isMedianAndroid()
            ? 'Camera permission denied. Go to your phone Settings → Apps → BURS → Permissions → Camera → Allow'
            : t('scan.camera_denied')
        );
      } else if (errObj?.name === 'NotFoundError' || errObj?.name === 'OverconstrainedError') {
        setCameraError('Camera not available. Try using the photo upload option instead.');
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

  // Torch control — auto-enable when framing hint says more light needed
  useEffect(() => {
    if (useFileInputMode || !streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;
    const capabilities = (videoTrack.getCapabilities as (() => MediaTrackCapabilities) | undefined)?.();
    if (!(capabilities as Record<string, unknown>)?.torch) return;
    const wantTorch = framingHint === 'more_light';
    if (wantTorch === torchActiveRef.current) return;
    torchActiveRef.current = wantTorch;
    videoTrack.applyConstraints({ advanced: [{ torch: wantTorch } as MediaTrackConstraintSet] }).catch(() => {});
  }, [framingHint, useFileInputMode]);

  // Turn torch off on unmount
  useEffect(() => {
    return () => {
      if (!torchActiveRef.current || !streamRef.current) return;
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (!videoTrack) return;
      torchActiveRef.current = false;
      videoTrack.applyConstraints({ advanced: [{ torch: false } as MediaTrackConstraintSet] }).catch(() => {});
    };
  }, []);

  const handleCapture = useCallback(() => {
    if (useFileInputMode) {
      handleFileCapture();
      return;
    }
    if (!videoRef.current || isProcessing || lastResult) return;
    if (!isPremium && remainingSlots <= 0) { setShowPaywall(true); return; }
    capture(videoRef.current, optimalCropRatio);
  }, [capture, isProcessing, lastResult, isPremium, remainingSlots, useFileInputMode, handleFileCapture, optimalCropRatio]);

  const handleAccept = useCallback(async (enableStudioQuality: boolean) => {
    if (isSavingAccepted) return;
    setShowSaveChoice(false);
    setIsSavingAccepted(true);

    const saved = await accept(enableStudioQuality);
    setIsSavingAccepted(false);

    if (!saved) {
      toast.error(t('common.something_wrong'));
      return;
    }

    if (lastResult?.thumbnailUrl) {
      setScanThumbnails(prev => [...prev, lastResult.thumbnailUrl]);
    }
    setShowAccepted(true);
  }, [accept, isSavingAccepted, lastResult, t]);

  const handleAcceptedDone = useCallback(() => {
    setShowAccepted(false);
    clearLastAccepted();
  }, [clearLastAccepted]);

  const handleDone = useCallback(async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    void finish();
    navigate('/wardrobe');
  }, [finish, navigate]);

  const handleClose = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    void finish();
    navigate('/wardrobe');
  }, [finish, navigate]);

  const isLocked = autoMode && autoProgress > 0;

  return (
    <PageErrorBoundary fallback={<LiveScanFallback />}>
    <AppLayout hideNav>
    <div className="flex min-h-full flex-col">
      {/* Hidden file input for Median / fallback mode */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top bar */}
      <PageHeader
        title={t('scan.title') || 'Live Scan'}
        actions={(
          <>
            <Button variant="quiet" size="icon" onClick={handleClose} aria-label={t('common.close') || 'Close'}>
              <X className="w-5 h-5" />
            </Button>
            <SlotsPill remaining={remainingSlots === Infinity ? 999 : remainingSlots} isPremium={isPremium} />
            {cameraReady && !useFileInputMode ? (
              <Button
                type="button"
                variant={autoMode ? 'editorial' : 'outline'}
                size="icon"
                onClick={() => { hapticLight(); setAutoMode((value) => !value); }}
                className={cn(autoMode ? 'text-accent' : 'text-muted-foreground')}
              >
                {autoMode ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </Button>
            ) : null}
            {scanCount > 0 ? (
              <Button variant="quiet" size="sm" className="text-sm font-medium" onClick={handleDone}>
                {t('scan.done')}
              </Button>
            ) : null}
          </>
        )}
      />

      {/* Camera view */}
      <div className="relative flex-1 overflow-hidden">
        {useFileInputMode ? (
          /* File-input mode (Median or no getUserMedia) */
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <Card surface="editorial" className="w-full max-w-sm space-y-6 p-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-background/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <ImagePlus className="h-8 w-8 text-foreground/70" />
              </div>
              <Button onClick={handleFileCapture} disabled={isProcessing} size="lg" className="w-full">
                <Camera className="w-4 h-4" />
                {t('scan.take_photo')}
              </Button>
            </Card>
          </div>
        ) : !cameraStarted ? (
          /* Start Camera button — required for user-gesture */
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <Card surface="editorial" className="w-full max-w-sm space-y-6 p-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-background/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <Camera className="h-8 w-8 text-foreground/70" />
              </div>
              <Button onClick={startCamera} size="lg" className="w-full">
                <Camera className="w-4 h-4" />
                {t('scan.start_camera')}
              </Button>
            </Card>
          </div>
        ) : cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <Card surface="editorial" className="w-full max-w-sm space-y-6 p-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-background/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <Camera className="h-8 w-8 text-foreground/70" />
              </div>
              <p className="text-sm text-destructive">{cameraError}</p>
              <div className="flex flex-col gap-2.5">
                <Button onClick={() => fileInputRef.current?.click()} size="lg" className="w-full">
                  <ImagePlus className="w-4 h-4" />
                  {t('scan.upload_instead') || 'Upload a photo instead'}
                </Button>
                <Button variant="outline" onClick={handleClose} className="w-full">
                  {t('common.back')}
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            {...({ 'x-webkit-airplay': 'allow', 'webkit-playsinline': 'true' } as React.HTMLAttributes<HTMLVideoElement>)}
            onLoadedMetadata={() => {
              if (videoRef.current?.videoWidth && videoRef.current?.videoHeight) {
                setCameraReady(true);
              }
            }}
            onCanPlay={() => {
              if (videoRef.current?.videoWidth && videoRef.current?.videoHeight) {
                setCameraReady(true);
              }
            }}
            style={{ width: '100%', height: '100%' }}
            className="absolute inset-0 object-cover"
          />
        )}

        {/* Idle: focus frame reticle + guidance (only in camera mode) */}
        {!useFileInputMode && cameraReady && !lastResult && !isProcessing && !showAccepted && (
          <>
            <FocusFrame locked={isLocked} confidence={lockConfidence} />
            <ScanGuidance hint={framingHint} autoMode={autoMode} />
          </>
        )}

        {isProcessing && <ScanOverlay isDone={!!lastResult} />}
        
        {showAccepted && lastAccepted && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-4">
            <div className="pointer-events-auto w-full max-w-sm">
              <GarmentSavedCard
                garmentId={lastAccepted.garmentId}
                imagePath={lastAccepted.imagePath}
                title={lastAccepted.analysis.title}
                category={categoryLabel(t, lastAccepted.analysis.category)}
                colorPrimary={colorLabel(t, lastAccepted.analysis.color_primary)}
                studioQualityEnabled={lastAccepted.studioQualityEnabled}
                onDismiss={handleAcceptedDone}
              />
            </div>
          </div>
        )}

        {error && !isProcessing && (
          <div className="absolute bottom-32 left-4 right-4 z-20">
            <div className="mx-auto max-w-sm rounded-[1.2rem] border border-destructive/20 bg-background/88 p-3 text-center shadow-[0_16px_30px_rgba(28,25,23,0.12)] backdrop-blur-xl">
              <p className="text-sm text-destructive">{error}</p>
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
              className="fixed inset-0 overflow-y-auto bg-background/92 backdrop-blur-xl"
              style={{ zIndex: 'var(--z-modal)' as unknown as number }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: EASE_CURVE }}
                className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-end gap-5 px-6 pb-[calc(var(--app-safe-area-bottom,0px)+1.5rem)] sm:justify-center"
                style={{ paddingTop: 'calc(var(--safe-area-top) + 5.5rem)' }}
              >
                {/* Image with editorial overlay */}
                <div className="relative rounded-[1.25rem] overflow-hidden bg-[hsl(36_33%_93%)]">
                  <img
                    src={lastResult.thumbnailUrl}
                    alt="Scanned garment"
                    className="mx-auto aspect-[3/4] max-h-[44vh] w-full object-contain sm:max-h-[52vh]"
                  />
                  {/* Gradient overlay at bottom for text */}
                  <div className="absolute bottom-0 inset-x-0 h-2/5 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 space-y-2">
                    <p className="font-display italic text-[1.2rem] text-foreground leading-tight drop-shadow-sm">{lastResult.analysis.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-full border border-border/40 bg-background/60 px-2.5 py-1 text-[11px] font-body text-foreground/70 capitalize backdrop-blur-sm">
                        {categoryLabel(t, lastResult.analysis.category)}
                      </span>
                      <span className="rounded-full border border-border/40 bg-background/60 px-2.5 py-1 text-[11px] font-body text-foreground/70 capitalize backdrop-blur-sm">
                        {colorLabel(t, lastResult.analysis.color_primary)}
                      </span>
                      {lastResult.analysis.material && (
                        <span className="rounded-full border border-border/40 bg-background/60 px-2.5 py-1 text-[11px] font-body text-foreground/70 capitalize backdrop-blur-sm">
                          {materialLabel(t, lastResult.analysis.material)}
                        </span>
                      )}
                    </div>
                    <ConfidenceBadge confidence={lastResult.confidence} />
                  </div>
                </div>

                {/* Actions */}
                <div className="rounded-[1.2rem] border border-border/55 bg-background/84 p-4 shadow-[0_14px_28px_rgba(28,25,23,0.08)]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Ready to save</p>
                      <p className="text-xs text-muted-foreground">
                        Choose studio quality or original photo after you tap save.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 rounded-full border-border/40"
                    disabled={isSavingAccepted}
                    onClick={() => { hapticLight(); retake(); }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />{t('scan.retake')}
                  </Button>
                  <Button
                    variant="editorial"
                    className="flex-1 h-12 rounded-full"
                    disabled={isSavingAccepted}
                    onClick={() => { hapticLight(); setShowSaveChoice(true); }}
                  >
                    {isSavingAccepted ? (
                      <>
                        <RotateCcw className="w-4 h-4 mr-2 animate-spin" />{t('addgarment.saving')}
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />{t('addgarment.save')}
                      </>
                    )}
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
            <div className="flex items-center gap-1.5 rounded-full border border-border/55 bg-background/84 px-3 py-1.5 shadow-[0_10px_22px_rgba(28,25,23,0.08)] backdrop-blur-xl">
              <Check className="w-3.5 h-3.5 text-accent" />
              <span className="text-foreground text-xs font-medium">{scanCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Shutter button — only in camera stream mode */}
      {!useFileInputMode && cameraReady && !lastResult && !isProcessing && !showAccepted && (
        <div className="relative z-10 border-t border-border/50 bg-background/80 backdrop-blur-2xl">
          <div className="mx-auto flex w-full max-w-md items-center justify-center px-4 py-4">
            <Card surface="utility" className="w-full max-w-sm p-4">
              <div className="mb-4 text-center">
                <p className="label-editorial text-muted-foreground/40">SCANNING</p>
                <p className="mt-1.5 font-display italic text-[0.95rem] text-foreground/60 leading-snug">
                  Point camera at your clothing item
                </p>
              </div>
              <div className="flex items-center justify-center">
                <CoachMark
                  step={2}
                  currentStep={coach.currentStep}
                  isCoachActive={coach.isStepActive(2)}
                  title="Scan anything"
                  body="Point at a garment and hold still. BURS detects category, colour and material."
                  ctaLabel="Generate a look"
                  onCta={() => {
                    coach.advanceStep();
                    navigate('/ai/generate');
                  }}
                  onSkip={() => coach.completeTour()}
                  position="bottom"
                >
                  <div className="relative h-16 w-16">
                    {autoMode && autoProgress > 0 && <AutoProgressRing progress={autoProgress} />}
                    <button
                      disabled={!canCapture}
                      onClick={handleCapture}
                      className={cn(
                        'flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-foreground transition-all active:scale-90',
                        !canCapture ? 'opacity-30' : 'opacity-100'
                      )}
                      aria-label="Scan"
                    >
                      <div className={cn(
                        'h-12 w-12 rounded-full transition-colors',
                        autoMode && autoProgress > 0.5 ? 'bg-accent/80' : 'bg-foreground/90'
                      )} />
                    </button>
                  </div>
                </CoachMark>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Bottom bar for file-input mode — take another photo */}
      {useFileInputMode && !lastResult && !isProcessing && !showAccepted && scanCount > 0 && (
        <div className="relative z-10 border-t border-border/50 bg-background/80 backdrop-blur-2xl">
          <div className="mx-auto flex w-full max-w-md items-center justify-center px-4 py-4">
            <Card surface="utility" className="w-full max-w-sm p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">Continue scanning</p>
                  <p className="mt-1 text-sm text-muted-foreground">Add another garment to keep building your wardrobe.</p>
                </div>
                <Button onClick={handleFileCapture}>
                  <Camera className="w-4 h-4" />
                  {t('scan.take_photo')}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      <GarmentSaveChoiceSheet
        open={showSaveChoice}
        isSaving={isSavingAccepted}
        onOpenChange={setShowSaveChoice}
        onSelectStudio={() => { void handleAccept(true); }}
        onSelectOriginal={() => { void handleAccept(false); }}
      />

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="garments" />
    </div>
    </AppLayout>
    </PageErrorBoundary>
  );
}
