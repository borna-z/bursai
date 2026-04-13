import { useState, useCallback } from 'react';

export interface OutfitVersion {
  garmentIds: string[];
  explanation: string;
  timestamp: number;
}

const MAX_HISTORY = 10;

export function useRefineMode() {
  const [isRefining, setIsRefining] = useState(false);
  const [activeGarmentIds, setActiveGarmentIds] = useState<string[]>([]);
  const [activeExplanation, setActiveExplanation] = useState('');
  const [lockedSlots, setLockedSlots] = useState<string[]>([]);
  const [outfitHistory, setOutfitHistory] = useState<OutfitVersion[]>([]);

  const enterRefineMode = useCallback((garmentIds: string[], explanation: string) => {
    setIsRefining(true);
    setActiveGarmentIds(garmentIds);
    setActiveExplanation(explanation);
    setLockedSlots([]);
    setOutfitHistory([]);
  }, []);

  const exitRefineMode = useCallback(() => {
    setIsRefining(false);
    setActiveGarmentIds([]);
    setActiveExplanation('');
    setLockedSlots([]);
    setOutfitHistory([]);
  }, []);

  const toggleLock = useCallback((garmentId: string) => {
    setLockedSlots((prev) =>
      prev.includes(garmentId)
        ? prev.filter((id) => id !== garmentId)
        : [...prev, garmentId],
    );
  }, []);

  const pushRefinement = useCallback((newGarmentIds: string[], newExplanation: string) => {
    setOutfitHistory((prev) => {
      const entry: OutfitVersion = {
        garmentIds: activeGarmentIds,
        explanation: activeExplanation,
        timestamp: Date.now(),
      };
      const next = [...prev, entry];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
    setActiveGarmentIds(newGarmentIds);
    setActiveExplanation(newExplanation);
  }, [activeGarmentIds, activeExplanation]);

  const undo = useCallback(() => {
    setOutfitHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setActiveGarmentIds(last.garmentIds);
      setActiveExplanation(last.explanation);
      return prev.slice(0, -1);
    });
  }, []);

  const canUndo = outfitHistory.length > 0;

  return {
    isRefining,
    activeGarmentIds,
    activeExplanation,
    lockedSlots,
    outfitHistory,
    canUndo,
    enterRefineMode,
    exitRefineMode,
    toggleLock,
    pushRefinement,
    undo,
  };
}
