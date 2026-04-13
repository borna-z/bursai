import { WifiOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useLanguage } from '@/contexts/LanguageContext';

export function OfflineBanner() {
  const { isOffline, queueCount, isReplaying } = useOfflineQueue();
  const { t } = useLanguage();

  // Show banner when offline OR when replaying queued items
  const show = isOffline || isReplaying;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-0 left-0 right-0 flex items-center justify-center gap-2 py-2 text-xs font-medium"
          style={{
            zIndex: 'var(--z-offline-banner)' as unknown as number,
            background: isReplaying ? 'hsl(var(--accent))' : 'hsl(var(--destructive))',
            color: isReplaying ? 'hsl(var(--accent-foreground))' : 'hsl(var(--destructive-foreground))',
          }}
        >
          {isReplaying ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t('offline.syncing') || 'Syncing changes…'}
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              {t('offline.banner') || "You're offline"}
              {queueCount > 0 && (
                <span className="ml-1 opacity-80">
                  · {queueCount} {t('offline.pending') || 'pending'}
                </span>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
