

# Fix Missing `common.*` Translation Keys

## Problem
Four `common.*` keys are used in code but never defined in `src/i18n/translations.ts`, causing raw key strings like "common.read_more" to appear in the UI.

**Missing keys (used but not defined):**
| Key | Used in | Should say (EN) |
|-----|---------|-----------------|
| `common.read_more` | `OutfitDetail.tsx` | Read more |
| `common.less` | `OutfitDetail.tsx` | Less |
| `common.retry` | `UnusedOutfits.tsx` | Retry |
| `common.error` | `UnusedOutfits.tsx` | Something went wrong |

## Changes

### `src/i18n/translations.ts`
Add these 4 keys to all locale blocks:

- **sv**: `'Läs mer'`, `'Mindre'`, `'Försök igen'`, `'Något gick fel'`
- **en**: `'Read more'`, `'Less'`, `'Retry'`, `'Something went wrong'`
- **no**: `'Les mer'`, `'Mindre'`, `'Prøv igjen'`, `'Noe gikk galt'`
- **da**: `'Læs mere'`, `'Mindre'`, `'Prøv igen'`, `'Noget gik galt'`
- **fi**: `'Lue lisää'`, `'Vähemmän'`, `'Yritä uudelleen'`, `'Jokin meni pieleen'`
- **de**: `'Mehr lesen'`, `'Weniger'`, `'Erneut versuchen'`, `'Etwas ist schiefgelaufen'`
- **fr**: `'Lire plus'`, `'Moins'`, `'Réessayer'`, `'Une erreur est survenue'`
- **es**: `'Leer más'`, `'Menos'`, `'Reintentar'`, `'Algo salió mal'`
- **it**: `'Leggi di più'`, `'Meno'`, `'Riprova'`, `'Qualcosa è andato storto'`
- **nl**: `'Lees meer'`, `'Minder'`, `'Opnieuw proberen'`, `'Er is iets misgegaan'`
- **pt/pl/ar/fa**: English fallback will cover these automatically

Also remove the `|| 'Less'` and `|| 'Read more'` fallbacks in `OutfitDetail.tsx` since the keys will now exist.

