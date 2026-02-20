
# Visa bara 1 AI-forslag i Insikter

Andringen ar enkel -- begransar antalet AI-forslag som visas i Insikter-sidan till 1 styck.

## Andringar

### `src/components/insights/AISuggestions.tsx`
- Andra renderingen av forslag fran `suggestions.map(...)` till att bara visa det forsta forslaget: `suggestions.slice(0, 1).map(...)`
- Uppdatera aven den blurrade placeholder-sektionen (for icke-premium-anvandare) fran 2 skelett till 1

### Tekniska detaljer
- Rad ~208: Andra `suggestions.map(...)` till `suggestions.slice(0, 1).map(...)`
- Rad ~185-191: Andra placeholder-loopen fran `[1, 2].map(...)` till att bara visa 1 skelett-kort
- Refresh-knappen genererar fortfarande nya forslag fran backend -- men bara 1 visas at gangen
