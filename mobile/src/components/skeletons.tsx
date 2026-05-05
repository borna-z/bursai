// Loading skeleton compositions used by data-driven screens. Each variant matches the shape of
// the final layout so the user gets a sense of structure while mock data resolves.
//
// All variants compose the existing `Skeleton` primitive — they are static layout wrappers, not
// independent animations. This file exists so each screen can drop in a one-liner instead of
// rebuilding the same shimmer-grid by hand.

import React from 'react';
import { View } from 'react-native';
import { Skeleton } from './Skeleton';

// 9 tiles in a 3-col grid (matches the wardrobe layout). aspectRatio 0.78 mirrors the garment
// card thumb proportions inside `GarmentCard`.
export function GarmentGridSkeleton() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton
          key={i}
          radius={14}
          style={{ width: '31.5%', aspectRatio: 0.78 }}
        />
      ))}
    </View>
  );
}

// 4 outfit cards in 2-col grid. Each cell = full-thumb (square) + two short text lines.
export function OutfitGridSkeleton() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={{ width: '48%', flexGrow: 1 }}>
          <Skeleton radius={18} style={{ width: '100%', aspectRatio: 1 }} />
          <View style={{ paddingTop: 10, gap: 6 }}>
            <Skeleton radius={4} height={14} style={{ width: '70%' }} />
            <Skeleton radius={4} height={10} style={{ width: '45%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// 5 list rows: 52x68 thumb + two stacked text lines. Used by UsedGarments and Laundry.
export function GarmentListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={{ paddingHorizontal: 20, gap: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Skeleton radius={10} width={52} height={68} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton radius={4} height={14} style={{ width: '60%' }} />
            <Skeleton radius={4} height={10} style={{ width: '40%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// 2 stat blocks side-by-side, with a tall numeral skeleton + small label below.
export function StatRowSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 16, gap: 8 }}>
          <Skeleton radius={4} height={28} style={{ width: '50%' }} />
          <Skeleton radius={4} height={10} style={{ width: '70%' }} />
        </View>
      ))}
    </View>
  );
}

// Replaces the Today's Look hero card while the planned outfit hydrates. 4-thumb row + two body lines.
export function PlanCardSkeleton() {
  return (
    <View style={{ gap: 10 }}>
      <Skeleton radius={4} height={11} style={{ width: 90 }} />
      <Skeleton radius={4} height={26} style={{ width: 200 }} />
      <Skeleton radius={4} height={14} style={{ width: '90%' }} />
      <Skeleton radius={4} height={14} style={{ width: '70%' }} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            radius={14}
            style={{ flex: 1, aspectRatio: 1 }}
          />
        ))}
      </View>
    </View>
  );
}

// 3 alternating skeleton message bubbles for StyleChat — left-aligned AI bubbles + right-aligned
// user bubble. Bubble proportions roughly match `MessageItem` so the load-in transition feels
// continuous.
export function ChatBubbleSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
      <View style={{ alignSelf: 'flex-start', maxWidth: '78%', width: '70%' }}>
        <Skeleton radius={18} height={48} style={{ width: '100%' }} />
      </View>
      <View style={{ alignSelf: 'flex-end', maxWidth: '78%', width: '60%' }}>
        <Skeleton radius={18} height={36} style={{ width: '100%' }} />
      </View>
      <View style={{ alignSelf: 'flex-start', maxWidth: '78%', width: '78%' }}>
        <Skeleton radius={18} height={68} style={{ width: '100%' }} />
      </View>
    </View>
  );
}

// Profile header skeleton: avatar circle + identity lines + style summary block.
export function ProfileSkeleton() {
  return (
    <View style={{ paddingHorizontal: 20, gap: 18 }}>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
        <Skeleton radius={40} width={80} height={80} />
        <Skeleton radius={4} height={14} style={{ width: 160 }} />
        <Skeleton radius={4} height={11} style={{ width: 220 }} />
      </View>
      <Skeleton radius={18} height={220} style={{ width: '100%' }} />
      <StatRowSkeleton count={3} />
    </View>
  );
}

// Re-export so screens can pick the variant they need from a single import.
export { Skeleton };
