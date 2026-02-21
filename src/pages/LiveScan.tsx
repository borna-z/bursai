import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, RotateCcw, Camera, ScanLine, Zap, ZapOff, Sun, MoveHorizontal, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLiveScan } from '@/hooks/useLiveScan';
import { useAutoDetect, type FramingHint } from '@/hooks/useAutoDetect';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { useLanguage } from '@/contexts/LanguageContext';

/* ─── Accepted overlay with fast ring + check ─── */
function AcceptedOverlay({ onDone, label }: { onDone: () => void; label: string }) {
  useEffect(() => { const t = setTimeout(onDone, 600); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
            <circle cx="48" cy="48" r="40" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeDasharray="251.3" strokeDashoffset="251.3" className="animate-[draw-ring_0.35s_ease-out_forwards]" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Check className="w-10 h-10 text-emerald-400 animate-[pop-check_0.25s_ease-out_0.3s_both]" strokeWidth={3} />
          </div>
        </div>
        <p className="text-white text-sm font-medium animate-[pop-check_0.25s_ease-out_0.4s_both]">{label}</p>
      </div>
    </div>
  );
}

/* ─── Auto-progress ring around shutter ─── */
function AutoProgressRing({ progress }: { progress: number }) {
  const circumference = 2 * Math.PI * 44;
  const offset = circumference * (1 - progress);
  return (
    <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(34,197,94,0.3)" strokeWidth="3" />
      <circle cx="48" cy="48" r="44" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 100ms ease-out' }} />
    </svg>
  );
}

/* ─── Scan overlay with haptic + fast laser sweep ─── */
function ScanOverlay({ label }: { label: string }) {
  useEffect(() => {
    if (!navigator.vibrate) return;
    const id = setInterval(() => { navigator.vibrate([6, 80, 6]); }, 400);
    return () => { clearInterval(id); navigator.vibrate(0); };
  }, []);

  return (
    <div className="absolute inset-0 z-20">
      {/* Fast horizontal laser sweep */}
      <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-90 animate-[scan-line_0.8s_ease-in-out_infinite]" />
      {/* Radial pulse on capture */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-32 h-32 rounded-full border-2 border-emerald-400/40 animate-[radial-pulse_0.8s_ease-out_forwards]" />
      </div>
      {/* Corner brackets */}
      <div className="absolute inset-12 pointer-events-none animate-[pulse-bracket_1.2s_ease-in-out_infinite]">
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm animate-pulse">
          {label}
        </span>
      </div>
    </div>
  );
}

/* ─── Real-time framing guidance pill ─── */
function ScanGuidance({ hint, autoMode }: { hint: FramingHint; autoMode: boolean }) {
  const { t } = useLanguage();

  const config: Record<string, { icon: React.ReactNode; label: string }> = {
    more_light: { icon: <Sun className="w-3.5 h-3.5" />, label: t('scan.more_light') },
    too_close: { icon: <ZoomOut className="w-3.5 h-3.5" />, label: t('scan.move_back') },
    too_far: { icon: <ZoomIn className="w-3.5 h-3.5" />, label: t('scan.move_closer') },
    ready: { icon: <MoveHorizontal className="w-3.5 h-3.5" />, label: autoMode ? t('scan.ready') : t('scan.point_garment') },
  };

  const current = hint && config[hint] ? config[hint] : config.ready;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        key={hint}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm text-sm font-medium transition-all duration-300',
          hint === 'ready' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/20' :
          hint === 'more_light' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/20' :
          'bg-white/10 text-white/80 border border-white/10'
        )}
      >
        {current.icon}
        {current.label}
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
    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setCameraReady(true); }
      } catch (err) {
        console.error('Camera error:', err);
        setCameraError(t('scan.camera_error'));
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
      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-xl backdrop-saturate-150">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handleClose}>
          <X className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoMode((v) => !v)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm transition-all', autoMode ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/30' : 'bg-white/10 text-white/60 border border-white/10')}>
            {autoMode ? <Zap className="w-3.5 h-3.5" /> : <ZapOff className="w-3.5 h-3.5" />}
            {t('scan.auto')}
          </button>
          {scanCount > 0 && (
            <Badge key={scanCount} className="bg-white/20 text-white border-0 text-sm px-3 py-1 backdrop-blur-sm animate-[badge-pop_0.3s_ease-out]">
              <ScanLine className="w-4 h-4 mr-1.5" />{scanCount} {t('scan.scanned')}
            </Badge>
          )}
        </div>
        {scanCount > 0 ? (
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 font-medium" onClick={handleDone}>{t('scan.done')}</Button>
        ) : <div className="w-12" />}
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <div className="space-y-4">
              <Camera className="w-16 h-16 text-white/40 mx-auto" />
              <p className="text-white/80 text-sm">{cameraError}</p>
              <Button variant="outline" className="text-white border-white/30" onClick={handleClose}>{t('common.back')}</Button>
            </div>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        )}

        {/* Idle state: framing guide + guidance pill */}
        {cameraReady && !lastResult && !isProcessing && !showAccepted && (
          <div className="absolute inset-0 pointer-events-none">
            <div className={cn(
              'absolute inset-8 border-2 rounded-2xl transition-all duration-200',
              autoMode && autoProgress > 0
                ? 'border-emerald-400/60 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                : 'border-white/20'
            )} />
            <ScanGuidance hint={framingHint} autoMode={autoMode} />
          </div>
        )}

        {isProcessing && <ScanOverlay label={t('scan.analyzing')} />}
        {showAccepted && <AcceptedOverlay onDone={handleAcceptedDone} label={t('scan.added')} />}

        {error && !isProcessing && (
          <div className="absolute bottom-32 left-4 right-4 z-20">
            <Card className="bg-destructive/80 border-0 backdrop-blur-md">
              <CardContent className="p-3 text-center"><p className="text-destructive-foreground text-sm">{error}</p></CardContent>
            </Card>
          </div>
        )}

        {/* Result card */}
        {lastResult && (
          <div className="absolute bottom-0 left-0 right-0 z-20 p-4 animate-slide-in-bottom">
            <Card className="bg-card/80 backdrop-blur-xl border-border/40 shadow-2xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <img src={lastResult.thumbnailUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{lastResult.analysis.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{lastResult.analysis.category} • {lastResult.analysis.color_primary}</p>
                    {lastResult.analysis.material && (
                      <p className="text-xs text-muted-foreground capitalize">
                        {lastResult.analysis.material}{lastResult.analysis.pattern && lastResult.analysis.pattern !== 'enfärgad' ? ` • ${lastResult.analysis.pattern}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={retake}>
                    <RotateCcw className="w-4 h-4 mr-2" />{t('scan.retake')}
                  </Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAccept}>
                    <Check className="w-4 h-4 mr-2" />{t('scan.accept')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Shutter button */}
      <div className="relative z-10 flex items-center justify-center py-6 bg-black/40 backdrop-blur-xl backdrop-saturate-150">
        <div className="relative w-20 h-20">
          {autoMode && autoProgress > 0 && <AutoProgressRing progress={autoProgress} />}
          <button disabled={!canCapture} onClick={handleCapture} className={cn('w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all active:scale-90', !canCapture ? 'opacity-30' : 'opacity-100 hover:bg-white/10')} aria-label="Scan">
            <div className={cn('w-16 h-16 rounded-full transition-colors', autoMode && autoProgress > 0.5 ? 'bg-emerald-400/80' : 'bg-white/90')} />
          </button>
        </div>
      </div>

      {/* Free tier remaining slots */}
      {!isPremium && cameraReady && (
        <div className="absolute bottom-28 left-0 right-0 flex justify-center z-10">
          <span className="text-white/60 text-xs bg-black/30 px-3 py-1 rounded-full backdrop-blur-md">
            {remainingSlots > 0 ? `${remainingSlots} ${t('scan.slots_remaining')}` : t('scan.limit_reached')}
          </span>
        </div>
      )}

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="garments" />
    </div>
  );
}
