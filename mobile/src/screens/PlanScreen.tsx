import React from 'react';
import { PlaceholderScreen } from './PlaceholderScreen';

export function PlanScreen() {
  // Eyebrow derives from today so the placeholder doesn't go stale across months.
  // Real PlanScreen will replace this with the focused-week's range; same time-aware contract.
  const now = new Date();
  const eyebrow = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return (
    <PlaceholderScreen
      eyebrow={eyebrow}
      title="Your week"
      body="Week strip · planned outfit card · upcoming list. Coming next."
      showBack={false}
    />
  );
}
