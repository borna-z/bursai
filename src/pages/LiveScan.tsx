import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, RotateCcw, Camera, Zap, ZapOff, ImagePlus, Shirt } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';
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
import { GarmentConfirmSheet } from '@/components/garment/GarmentConfirmSheet';
import { useProfile } from '@/hooks/useProfile';
import { asPreferences } from '@/types/preferences';
import { logger } from '@/lib/logger';

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
        <div className="flex h-20 w-20 items-center justify-center rounded-[1.25rem] border border-accent/20 bg-background/90 shadow-[0_18px_40px_rgba(28,25,23,0.12)]">
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
    <div className="min-h-screen bg-background px-6 py-24 text-foreground">
      <div className="mx-auto max-w-sm">
        <Card surface="editorial" className="space-y-6 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.1rem] bg-background/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <Camera className="h-7 w-7 text-foreground/70" />
          </div>
          <PageHeader title={t('scan.title') || 'Live Scan'} showBack />
          <Button onClick={() => navigate('/wardrobe')} className="w-full">
            Go to Wardrobe
          </Button>
        </Card>
      </div>
    </div>
  );
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

  const coach = useFirstRunCoach();
  const { scanCount, isProcessing, lastResult, lastAccepted, clearLastAccepted, error, capture, captureFromFile, accept, retake, finish } = useLiveScan();
  const { subscription, isPremium, isLoading: isSubLoading } = useSubscription();
  const { data: profile } = useProfile();
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);

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

  const handleAcceptedDone = useCallback(() => {
    setShowAccepted(false);
    const prefs = asPreferences(profile?.preferences);
    if (prefs.showRenderPrompt !== false && lastAccepted) {
      setShowConfirmSheet(true);
    } else {
      navigate('/wardrobe');
    }
  }, [profile, lastAccepted, navigate]);

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
    <PageErrorBoundary fallback={<LiveScanFallback />}>
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top_left,rgba(157,126,86,0.16),transparent_36%),radial-gradient(circle_at_top_right,rgba(88,99,148,0.09),transparent_34%)]"
      />
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
      <div className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-3">
          <Button variant="quiet" size="icon" onClick={handleClose}>
            <X className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <SlotsPill remaining={remainingSlots === Infinity ? 999 : remainingSlots} isPremium={isPremium} />
            {cameraReady && !useFileInputMode ? (
              <Button
                type="button"
                variant={autoMode ? 'editorial' : 'outline'}
                size="icon"
                onClick={() => setAutoMode((value) => !value)}
                className={cn(autoMode ? 'text-accent' : 'text-muted-foreground')}
              >
                {autoMode ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </Button>
            ) : null}
          </div>
          {scanCount > 0 ? (
            <Button variant="quiet" size="sm" className="text-sm font-medium" onClick={handleDone}>
              {t('scan.done')}
            </Button>
          ) : <div className="w-12" />}
        </div>
      </div>

      {/* Camera view */}
      <div className="relative flex-1 overflow-hidden">
        {useFileInputMode ? (
          /* File-input mode (Median or no getUserMedia) */
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <Card surface="editorial" className="w-full max-w-sm space-y-6 p-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-background/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <ImagePlus className="h-8 w-8 text-foreground/70" />
              </div>
              <PageHeader title={t('scan.title') || 'Live Scan'} showBack />
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
              <PageHeader title={t('scan.title') || 'Live Scan'} showBack />
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
              <PageHeader title={t('scan.title') || 'Live Scan'} showBack />
              <div className="flex flex-col gap-2.5">
                <Button onClick={() => fileInputRef.current?.click()} size="lg" className="w-full">
                  <ImagePlus className="w-4 h-4" />
                  Upload a photo instead
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

        {isProcessing && <ScanOverlay />}
        
        <AnimatePresence>
          {showAccepted && <AcceptedOverlay onDone={handleAcceptedDone} label={t('scan.added')} />}
        </AnimatePresence>

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
              className="absolute inset-0 z-20 bg-background/90 backdrop-blur-xl flex flex-col items-center justify-center p-6"
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: EASE_CURVE }}
                className="w-full max-w-sm space-y-5"
              >
                {/* Image with editorial overlay */}
                <div className="relative bg-[hsl(36_33%_93%)]">
                  <img
                    src={lastResult.thumbnailUrl}
                    alt="Scanned garment"
                    className="w-full aspect-[3/4] object-contain"
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
            <div className="flex items-center gap-1.5 rounded-full border border-border/55 bg-background/84 px-3 py-1.5 shadow-[0_10px_22px_rgba(28,25,23,0.08)] backdrop-blur-xl">
              <Check className="w-3.5 h-3.5 text-accent" />
              <span className="text-foreground text-xs font-medium">{scanCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Shutter button — only in camera stream mode */}
      {!useFileInputMode && cameraReady && (
        <div className="relative z-10 border-t border-border/50 bg-background/80 backdrop-blur-2xl">
          <div className="mx-auto flex w-full max-w-md items-center justify-center px-4 py-4">
            <Card surface="utility" className="w-full max-w-sm p-4">
              <div className="mb-4 text-center">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">Live scan</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Hold still for a clean read, or tap the shutter manually whenever you are ready.
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

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="garments" />

      {lastAccepted && (
        <GarmentConfirmSheet
          open={showConfirmSheet}
          garmentId={lastAccepted.garmentId}
          garmentImagePath={lastAccepted.imagePath}
          detectedTitle={lastAccepted.analysis.title}
          detectedCategory={lastAccepted.analysis.category}
          detectedColor={lastAccepted.analysis.color_primary}
          detectedMaterial={lastAccepted.analysis.material || null}
          detectedFit={lastAccepted.analysis.fit || null}
          formalityScore={lastAccepted.analysis.formality ?? null}
          onClose={() => {
            setShowConfirmSheet(false);
            clearLastAccepted();
            streamRef.current?.getTracks().forEach((t) => t.stop());
            finish();
          }}
        />
      )}
    </div>
    </PageErrorBoundary>
  );
}
