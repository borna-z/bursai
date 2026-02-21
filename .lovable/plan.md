

## Outfit Cards in AI Stylist Chat

Currently the AI stylist shows individual garment chips (small pills with tiny images). The user wants a richer experience: when the AI recommends an outfit, it should render as a **visual outfit card** showing all the garments together with an explanation, and allow swapping individual items directly in the chat.

---

### What changes

#### 1. New "Outfit Card" component in chat
A new `OutfitSuggestionCard` component that renders when the AI suggests a complete outfit. The card will:
- Show garment images in a horizontal row (thumbnails)
- Display a short "Why this works" explanation from the AI
- Have a "Try this outfit" button that creates the outfit and navigates to the detail page
- Each garment in the card is tappable to view details

#### 2. Swap alternatives on each garment within the card
- Each garment in the outfit card shows a small swap icon
- Tapping it reveals 2 alternative garments (fetched client-side from the user's wardrobe using the existing swap scoring logic)
- Tapping an alternative replaces the garment in the card before creating the outfit

#### 3. New AI output format -- `[[outfit:...]]` tags
Update the `style_chat` edge function prompt to instruct the AI to output outfit suggestions in a structured format:
```
[[outfit:id1,id2,id3,id4|Why this works explanation here]]
```
The ChatMessage component parses this tag and renders the `OutfitSuggestionCard` instead of inline text.

#### 4. Update ChatMessage to parse and render outfit cards
The existing garment tag parsing (`[[garment:ID]]`) stays for single garment references. A new regex handles `[[outfit:...]]` tags and renders the full outfit card component.

---

### Technical details

**New file: `src/components/chat/OutfitSuggestionCard.tsx`**
- Props: `garments: GarmentBasic[]`, `explanation: string`, `onSwap: (index, newGarmentId) => void`, `onTryOutfit: (garmentIds) => void`
- Layout: rounded card with border, garment image row, explanation text, action button
- Each garment shows a small "swap" indicator; tapping opens a mini popover with 2 alternatives
- Alternatives are fetched using existing swap scoring logic from `useSwapGarment` (color harmony, wear count, recency)
- "Try this outfit" button creates the outfit in the database and navigates to `/outfits/:id`

**Modified file: `src/components/chat/ChatMessage.tsx`**
- Add regex for `[[outfit:id1,id2,...|explanation]]` pattern
- When matched, render `OutfitSuggestionCard` with the garments from `garmentMap` and the explanation text
- Keep existing `[[garment:ID]]` handling for single garment references

**Modified file: `supabase/functions/style_chat/index.ts`**
- Update the system prompt to instruct the AI to use the new `[[outfit:...]]` tag format when suggesting complete outfits
- Keep `[[garment:ID]]` for individual garment mentions
- Add prompt instructions like: "When suggesting a complete outfit, use [[outfit:id1,id2,id3|kort förklaring]] format"

**Modified file: `src/pages/AIChat.tsx`**
- Add outfit creation handler that the `OutfitSuggestionCard` calls when user taps "Try this outfit"
- Uses existing `useCreateOutfit` mutation to save the outfit and navigate to its detail page

**Modified file: `src/hooks/useGarmentsByIds.ts`**
- No changes needed -- already fetches the data we need

### Swap alternatives logic
- When user taps swap on a garment in the card, fetch 2 top-scoring alternatives from the same category using the existing scoring from `useSwapGarment` (color harmony with other outfit items, wear recency, wear count)
- Show as 2 small thumbnail buttons below the garment
- Tapping one replaces the garment in the local card state (before outfit creation)

### Files summary (4 modified, 1 new)
1. **New**: `src/components/chat/OutfitSuggestionCard.tsx` -- outfit card with garment row, explanation, swap, and create action
2. `src/components/chat/ChatMessage.tsx` -- parse `[[outfit:...]]` tags and render outfit cards
3. `supabase/functions/style_chat/index.ts` -- update AI prompt for outfit tag format
4. `src/pages/AIChat.tsx` -- add outfit creation handler
5. `src/hooks/useGarmentsByIds.ts` -- potentially expand fields if needed for swap logic
