// In-memory cache of the user's most recently used outfit-generation context.
// Survives client-side navigation within a tab session; resets on hard reload.
// Deliberately not persisted to browser storage — per CLAUDE.md, React state only.

let lastOccasion: string | null = null;
let lastStyles: string[] = [];

export function getLastOccasion(): string | null {
  return lastOccasion;
}

export function getLastStyles(): readonly string[] {
  return lastStyles;
}

export function setLastOccasion(value: string): void {
  lastOccasion = value;
}

export function setLastStyles(value: readonly string[]): void {
  lastStyles = [...value];
}

export function clearLastStyles(): void {
  lastStyles = [];
}
