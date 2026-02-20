

# Skeleton-rad vid laddning av nasta sida

Byter ut den enkla spinnern som visas vid infinite scroll mot en subtil skeleton-rad som matchar garment-kortens layout.

## Andringar

### `src/pages/Wardrobe.tsx`
- Ersatt `Loader2`-spinnern som visas nar `isFetchingNextPage` ar true med skeleton-kort
- Grid-vy: 2 skeleton-kort i ett 2-kolumns grid med aspect-square och textplatshallare
- List-vy: 2 skeleton-rader med bild-platshallare och textrader
- Anvander befintliga `Skeleton`-komponenten fran `src/components/ui/skeleton.tsx`

### Tekniska detaljer
- Importera `Skeleton` fran `@/components/ui/skeleton`
- Rad ~280-284: Byt ut `Loader2`-blocket mot skeleton-kort som matchar `GarmentCard`-layouten
- Grid-skelettet far `aspect-square` + `p-2.5` med tva textrader
- List-skelettet far `h-14 w-14` bildplatshallare + tva textrader
- Villkorlig rendering baserat pa `isGridView` for att matcha aktuell vy
