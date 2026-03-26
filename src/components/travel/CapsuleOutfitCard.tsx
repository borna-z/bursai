import { motion } from 'framer-motion';
import { OutfitSuggestionCard } from '@/components/chat/OutfitSuggestionCard';
import { STAGGER_DELAY } from '@/lib/motion';
import type { CapsuleOutfit } from './types';

interface CapsuleOutfitCardProps {
  outfit: CapsuleOutfit;
  animationIndex: number;
  garmentMap: Map<string, { id: string; title: string; image_path: string; category: string }>;
  allGarmentsMap: Map<string, { id: string; title: string; image_path: string; category: string }>;
}

export function CapsuleOutfitCard({
  outfit,
  animationIndex,
  garmentMap,
  allGarmentsMap,
}: CapsuleOutfitCardProps) {
  const outfitGarments = outfit.items
    .map((id: string) => garmentMap.get(id) ?? allGarmentsMap.get(id))
    .filter(Boolean) as Array<{ id: string; title: string; image_path: string; category: string }>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationIndex * STAGGER_DELAY, duration: 0.35 }}
    >
      <OutfitSuggestionCard
        garments={outfitGarments}
        explanation={outfit.note ?? ''}
        onTryOutfit={() => {/* no-op in capsule context */}}
        isCreating={false}
      />
    </motion.div>
  );
}
