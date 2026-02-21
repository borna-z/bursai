
## Fix Insights Layout -- Remove Nested Card Effect

### Problem
On the Insights page, the garment list items inside cards (Top Garments, Unused, etc.) have their own background color (`bg-muted/50`) and rounded corners (`rounded-xl`), creating a "card within a card" effect. This makes items look like they jump out from the parent card, breaking the clean Nordic minimalist design.

### Solution
Remove the inner card styling from garment list items so they sit flat inside their parent card, using only subtle dividers or spacing to separate them.

### Changes

**1. `src/pages/Insights.tsx` -- `GarmentMini` component (line 22)**
- Remove `bg-muted/50 rounded-xl` from the wrapper div
- Replace with a flat layout using a subtle bottom border for separation
- Keep hover state but make it more subtle (no background, just slight opacity change)

**2. `src/pages/Insights.tsx` -- Top Garments section (lines 203-208)**
- Add `divide-y divide-border/50` to the list container instead of `space-y-2`
- This gives clean, flat separation between items

**3. `src/pages/Insights.tsx` -- Unused Garments section (lines 219-222)**  
- Same treatment: flat items with divider lines instead of rounded inner cards

**4. `src/components/insights/UnusedGemCard.tsx` (line 31)**
- Remove `bg-muted/50 rounded-xl` from wrapper
- Use flat layout with subtle border-bottom instead

**5. `src/pages/Home.tsx` -- InsightsSection garment rows (lines 145-153, 168-176)**
- Same fix for the embedded insights on the Home tab: remove inner card backgrounds from garment rows

### Visual Result
- Items will sit cleanly inside their parent card with no "popping out" effect
- Subtle horizontal dividers separate entries
- Hover remains functional but without competing background layers
- Consistent flat layout across both the Insights page and the Home tab insights section
