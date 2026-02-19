import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, RotateCcw, Camera, Loader2, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLiveScan } from '@/hooks/useLiveScan';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';

function AcceptedOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="flex flex-col items-center gap-3">
        {/* Animated circle + check */}
        <div className="relative w-24 h-24">
          {/* Ring drawing animation */}
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
            <circle
              cx="48" cy="48" r="40"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="4"
            />
            <circle
              cx="48" cy="48" r="40"
              fill="none"
              stroke="#22c55e"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="251.3"
              strokeDashoffset="251.3"
              className="animate-[draw-ring_0.5s_ease-out_forwards]"
            />
          </svg>
          {/* Check icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Check
              className="w-10 h-10 text-emerald-400 animate-[pop-check_0.3s_ease-out_0.4s_both]"
              strokeWidth={3}
            />
          </div>
        </div>
        <p className="text-white text-sm font-medium animate-[pop-check_0.3s_ease-out_0.5s_both]">
          Tillagt!
        </p>
      </div>
    </div>
  );
}

export default function LiveScan() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);

  const { scanCount, isProcessing, lastResult, error, capture, accept, retake, finish } = useLiveScan();
  const { canAddGarment, subscription, isPremium } = useSubscription();

  const remainingSlots = isPremium
    ? Infinity
    : PLAN_LIMITS.free.maxGarments - (subscription?.garments_count || 0) - scanCount;

  // Start camera
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err) {
        console.error('Camera error:', err);
        setCameraError('Kunde inte öppna kameran. Kontrollera att du gett behörighet.');
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCapture = useCallback(() => {
    if (!videoRef.current || isProcessing || lastResult) return;

    if (!isPremium && remainingSlots <= 0) {
      setShowPaywall(true);
      return;
    }

    capture(videoRef.current);
  }, [capture, isProcessing, lastResult, isPremium, remainingSlots]);

  const handleAccept = useCallback(() => {
    accept();
    setShowAccepted(true);
  }, [accept]);

  const handleAcceptedDone = useCallback(() => {
    setShowAccepted(false);
  }, []);

  const handleDone = useCallback(async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    await finish();
    navigate('/wardrobe');
  }, [finish, navigate]);

  const handleClose = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    finish();
    navigate('/wardrobe');
  }, [finish, navigate]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={handleClose}
        >
          <X className="w-6 h-6" />
        </Button>

        {scanCount > 0 && (
          <Badge className="bg-white/20 text-white border-0 text-sm px-3 py-1 backdrop-blur-sm">
            <ScanLine className="w-4 h-4 mr-1.5" />
            {scanCount} skannade
          </Badge>
        )}

        {scanCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 font-medium"
            onClick={handleDone}
          >
            Klar
          </Button>
        )}
        {scanCount === 0 && <div />}
      </div>

      {/* Camera feed */}
      <div className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <div className="space-y-4">
              <Camera className="w-16 h-16 text-white/40 mx-auto" />
              <p className="text-white/80 text-sm">{cameraError}</p>
              <Button variant="outline" className="text-white border-white/30" onClick={handleClose}>
                Tillbaka
              </Button>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Scanning overlay lines */}
        {cameraReady && !lastResult && !isProcessing && !showAccepted && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-8 border-2 border-white/20 rounded-2xl" />
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white/50 text-sm font-medium bg-black/30 px-4 py-2 rounded-full backdrop-blur-sm">
                Rikta mot ett plagg
              </p>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
              <p className="text-white text-sm font-medium">Analyserar…</p>
            </div>
          </div>
        )}

        {/* Accepted overlay with animated checkmark */}
        {showAccepted && <AcceptedOverlay onDone={handleAcceptedDone} />}

        {/* Error message */}
        {error && !isProcessing && (
          <div className="absolute bottom-32 left-4 right-4 z-20">
            <Card className="bg-destructive/90 border-0 backdrop-blur-sm">
              <CardContent className="p-3 text-center">
                <p className="text-destructive-foreground text-sm">{error}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Result card */}
        {lastResult && (
          <div className="absolute bottom-0 left-0 right-0 z-20 p-4 animate-slide-in-bottom">
            <Card className="bg-card/95 backdrop-blur-md border-border/50 shadow-2xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={lastResult.thumbnailUrl}
                    alt="Skannat plagg"
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{lastResult.analysis.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {lastResult.analysis.category} • {lastResult.analysis.color_primary}
                    </p>
                    {lastResult.analysis.material && (
                      <p className="text-xs text-muted-foreground capitalize">
                        {lastResult.analysis.material}
                        {lastResult.analysis.pattern && lastResult.analysis.pattern !== 'enfärgad'
                          ? ` • ${lastResult.analysis.pattern}`
                          : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={retake}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Ta om
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleAccept}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Godkänn
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Bottom capture bar */}
      <div className="relative z-10 flex items-center justify-center py-6 bg-gradient-to-t from-black/70 to-transparent">
        <button
          disabled={!cameraReady || isProcessing || !!lastResult}
          onClick={handleCapture}
          className={cn(
            'w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all active:scale-90',
            (!cameraReady || isProcessing || !!lastResult)
              ? 'opacity-30'
              : 'opacity-100 hover:bg-white/10'
          )}
          aria-label="Skanna plagg"
        >
          <div className="w-16 h-16 rounded-full bg-white/90" />
        </button>
      </div>

      {/* Remaining slots indicator */}
      {!isPremium && cameraReady && (
        <div className="absolute bottom-28 left-0 right-0 flex justify-center z-10">
          <span className="text-white/60 text-xs bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
            {remainingSlots > 0 ? `${remainingSlots} platser kvar` : 'Gräns nådd'}
          </span>
        </div>
      )}

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason="garments"
      />
    </div>
  );
}
