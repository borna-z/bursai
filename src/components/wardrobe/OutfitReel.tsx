import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Pause, Play, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { toPng as ToPngType } from 'html-to-image';
import type { OutfitWithItems } from '@/hooks/useOutfits';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/lib/dateLocale';

interface OutfitReelProps {
  outfits: OutfitWithItems[];
  onClose: () => void;
}

const SLIDE_DURATION = 3000;

export function OutfitReel({ outfits, onClose }: OutfitReelProps) {
  const { t, locale } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const slideRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(Date.now());
  const rafRef = useRef<number>();

  const goNext = useCallback(() => {
    if (currentIndex < outfits.length - 1) {
      setSlideDirection('left');
      setDragOffset(0);
      setCurrentIndex(i => i + 1);
      setProgress(0);
      startTimeRef.current = Date.now();
    } else {
      onClose();
    }
  }, [currentIndex, outfits.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setSlideDirection('right');
      setDragOffset(0);
      setCurrentIndex(i => i - 1);
      setProgress(0);
      startTimeRef.current = Date.now();
    }
  }, [currentIndex]);

  // Auto-advance timer with smooth progress
  useEffect(() => {
    if (isPaused) return;
    startTimeRef.current = Date.now() - (progress * SLIDE_DURATION);

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(elapsed / SLIDE_DURATION, 1);
      setProgress(pct);
      if (pct >= 1) {
        goNext();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [currentIndex, isPaused, goNext]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goNext, goPrev]);

  // Touch swipe
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    // Only track horizontal drags
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      setDragOffset(dx);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;
    setDragOffset(0);

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 400) {
      if (dx < 0) goNext();
      else goPrev();
      return;
    }
  };

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.3) { goPrev(); }
    else if (x > rect.width * 0.7) { goNext(); }
    else { setIsPaused(p => !p); }
  };

  const handleDownload = async () => {
    if (!slideRef.current) return;
    try {
      const dataUrl = await toPng(slideRef.current, { quality: 0.95, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `outfit-${currentIndex + 1}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(t('wardrobe.reel_download'));
    } catch {
      toast.error(t('wardrobe.reel_save_error'));
    }
  };

  const outfit = outfits[currentIndex];
  if (!outfit) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-3 pb-2 z-10">
        {outfits.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-none"
              style={{ width: `${i < currentIndex ? 100 : i === currentIndex ? progress * 100 : 0}%` }}
            />
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 z-10">
        <span className="text-white/70 text-sm font-medium">{currentIndex + 1}/{outfits.length}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => setIsPaused(p => !p)}>
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10" onClick={handleDownload}>
            <Download className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Slide area */}
      <div className="flex-1 relative overflow-hidden" onClick={handleTap} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div
          ref={slideRef}
          key={outfit.id}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black"
          style={{
            transform: dragOffset !== 0
              ? `translateX(${dragOffset}px)`
              : undefined,
            transition: dragOffset !== 0 ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease',
            animation: slideDirection && dragOffset === 0
              ? `reel-slide-${slideDirection} 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both`
              : undefined,
          }}
          onAnimationEnd={() => setSlideDirection(null)}
        >
          {/* Outfit images grid */}
          <div className="w-full max-w-sm mx-auto grid grid-cols-2 gap-1 px-4">
            {outfit.outfit_items.slice(0, 4).map((item) => (
              <div key={item.id} className="aspect-square rounded-xl overflow-hidden bg-muted/10">
                <LazyImageSimple
                  imagePath={item.garment?.image_path}
                  alt={item.garment?.title || item.slot}
                  className="w-full h-full"
                />
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="mt-6 text-center px-4">
              <Badge variant="secondary" className="capitalize mb-2 bg-white/10 text-white border-white/20">
                {t(`occasion.${outfit.occasion}`)}
            </Badge>
            {outfit.explanation && (
              <p className="text-white/60 text-sm mt-2 max-w-xs mx-auto line-clamp-2">{outfit.explanation}</p>
            )}
            {outfit.generated_at && (
              <p className="text-white/40 text-xs mt-2">
                {format(new Date(outfit.generated_at), 'd MMM yyyy', { locale: getDateFnsLocale(locale) })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 backdrop-blur-sm rounded-full p-4 animate-scale-in">
            <Pause className="w-8 h-8 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}
