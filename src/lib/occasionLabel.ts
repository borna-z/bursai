export function getOccasionLabel(occasion: string, t: (key: string) => string): string {
  if (occasion.startsWith('mood:')) {
    const moodKey = occasion.replace('mood:', '');
    const label = t(`ai.mood_${moodKey}`);
    return label.startsWith('ai.') ? moodKey : label;
  }
  const label = t(`occasion.${occasion.toLowerCase()}`);
  return label.startsWith('occasion.') ? occasion : label;
}
