import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, RotateCcw, Camera, Zap, ZapOff } from 'lucide-react';
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
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center gap-3"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check className="w-10 h-10 text-emerald-400" strokeWidth={3} />
        </div>
        <p className="text-white text-sm font-medium">{label}</p>
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
      <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(34,197,94,0.2)" strokeWidth="3" />
      <circle cx="36" cy="36" r="30" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 80ms ease-out' }} />
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
      {/* Radial pulse */}
      <div className="w-48 h-48 rounded-full border border-emerald-400/30 animate-ping" />
      <div className="absolute">
        <span className="text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm animate-pulse">
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
          ? 'border-emerald-400/60 shadow-[0_0_30px_rgba(34,197,94,0.15)]'
          : 'border-white/20'
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
        hint === 'ready' ? 'bg-emerald-500/20 text-emerald-300' :
        hint === 'more_light' ? 'bg-amber-500/20 text-amber-300' :
        'bg-white/10 text-white/70'
      )}>
        {labels[hint] || labels.ready}
      </div>
    </div>
  );
}

export default function LiveScan() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const [autoMode, setAutoMode] = useState(true);

  const { scanCount, isProcessing, lastResult, error, capture, accept, retake, finish } = useLiveScan();
  const { subscription, isPremium } = useSubscription();

  const remainingSlots = isPremium ? Infinity : PLAN_LIMITS.free.maxGarments - (subscription?.garments_count || 0) - scanCount;
  const canCapture = cameraReady && !isProcessing && !lastResult && !showAccepted;
  const hasSlots = isPremium || remainingSlots > 0;

  const handleAutoCapture = useCallback(() => {
    if (!videoRef.current || !canCapture || !hasSlots) return;
    capture(videoRef.current);
    if (navigator.vibrate) navigator.vibrate(30);
  }, [capture, canCapture, hasSlots]);

  const { progress: autoProgress, framingHint } = useAutoDetect({
    enabled: autoMode && canCapture && hasSlots,
    videoEl: videoRef.current,
    busy: isProcessing || !!lastResult || showAccepted,
    onStable: handleAutoCapture,
  });

  useEffect(() => {
    // In Median native app, the web camera may be restricted — if getUserMedia
    // fails we can still use the native camera bridge via AddGarment flow.
    // LiveScan's continuous video feed works best with browser camera access.
    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setCameraReady(true); }
      } catch (err) {
        console.error('Camera error:', err);
        // In Median, suggest using the single-capture flow instead
        if (isMedianApp()) {
          setCameraError(t('scan.use_add_garment'));
        } else {
          setCameraError(t('scan.camera_error'));
        }
      }
    }
    startCamera();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const handleCapture = useCallback(() => {
    if (!videoRef.current || isProcessing || lastResult) return;
    if (!isPremium && remainingSlots <= 0) { setShowPaywall(true); return; }
    capture(videoRef.current);
  }, [capture, isProcessing, lastResult, isPremium, remainingSlots]);

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
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Top bar — minimal */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur-xl">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleClose}>
          <X className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          {/* Auto mode — icon only */}
          <button
            onClick={() => setAutoMode((v) => !v)}
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center transition-all',
              autoMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50'
            )}
          >
            {autoMode ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
          </button>
        </div>
        {scanCount > 0 ? (
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 font-medium text-sm" onClick={handleDone}>{t('scan.done')}</Button>
        ) : <div className="w-12" />}
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <div className="space-y-4">
              <Camera className="w-16 h-16 text-white/30 mx-auto" />
              <p className="text-white/70 text-sm">{cameraError}</p>
              <Button variant="outline" className="text-white border-white/20" onClick={handleClose}>{t('common.back')}</Button>
            </div>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        )}

        {/* Idle: circular reticle + guidance */}
        {cameraReady && !lastResult && !isProcessing && !showAccepted && (
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
              className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6"
            >
              <div className="w-full max-w-sm space-y-6">
                {/* Captured image */}
                <img
                  src={lastResult.thumbnailUrl}
                  alt="Scanned garment"
                  className="w-full aspect-[3/4] object-cover rounded-2xl shadow-2xl"
                />
                {/* Analysis text */}
                <div className="text-center space-y-1">
                  <p className="text-white text-lg font-semibold">{lastResult.analysis.title}</p>
                  <p className="text-white/60 text-sm capitalize">
                    {lastResult.analysis.category} · {lastResult.analysis.color_primary}
                    {lastResult.analysis.material ? ` · ${lastResult.analysis.material}` : ''}
                  </p>
                </div>
                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10" onClick={retake}>
                    <RotateCcw className="w-4 h-4 mr-2" />{t('scan.retake')}
                  </Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAccept}>
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
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-white text-xs font-medium">{scanCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Shutter button — smaller, cleaner */}
      <div className="relative z-10 flex items-center justify-center py-6 bg-black/30 backdrop-blur-xl">
        <div className="relative w-16 h-16">
          {autoMode && autoProgress > 0 && <AutoProgressRing progress={autoProgress} />}
          <button
            disabled={!canCapture}
            onClick={handleCapture}
            className={cn(
              'w-16 h-16 rounded-full border-[3px] border-white flex items-center justify-center transition-all active:scale-90',
              !canCapture ? 'opacity-30' : 'opacity-100'
            )}
            aria-label="Scan"
          >
            <div className={cn(
              'w-12 h-12 rounded-full transition-colors',
              autoMode && autoProgress > 0.5 ? 'bg-emerald-400/80' : 'bg-white/90'
            )} />
          </button>
        </div>
      </div>

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="garments" />
    </div>
  );
}
