// Placeholder until the wardrobe grid screen ships in a follow-up PR.
// Garment-card design is intentionally NOT reimplemented here — per design handoff README,
// the user has an existing component they want to keep as-is when wired up.

import React from 'react';
import { PlaceholderScreen } from './PlaceholderScreen';

export function WardrobeScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Inventory"
      title="Your wardrobe"
      body="Garment grid + Garments / Outfits / Laundry chips + smart-tile counts. Coming next."
      showBack={false}
    />
  );
}
