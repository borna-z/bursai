import { useState, useCallback, useRef, useEffect } from 'react';

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

  // Refs to avoid stale closures in pushRefinement — always capture
  // the latest active state when saving to history.
  const activeGarmentIdsRef = useRef(activeGarmentIds);
  const activeExplanationRef = useRef(activeExplanation);
  useEffect(() => { activeGarmentIdsRef.current = activeGarmentIds; }, [activeGarmentIds]);
  useEffect(() => { activeExplanationRef.current = activeExplanation; }, [activeExplanation]);

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
    // Read from refs to avoid stale closure — ensures history snapshot
    // captures the actual current state even if called before re-render.
    const currentIds = activeGarmentIdsRef.current;
    const currentExplanation = activeExplanationRef.current;
    setOutfitHistory((prev) => {
      const entry: OutfitVersion = {
        garmentIds: currentIds,
        explanation: currentExplanation,
        timestamp: Date.now(),
      };
      const next = [...prev, entry];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
    setActiveGarmentIds(newGarmentIds);
    setActiveExplanation(newExplanation);
  }, []);

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
