

## Home Page Layout Restructure — AI Suggestions First

### Current order
1. Greeting + weather + settings
2. Stylist tip
3. Hero (state-aware: empty wardrobe / planned outfit / "what to wear")
4. Quick Actions
5. Retention nudges (week planning + unused gem)
6. **AI Suggestions** ← currently buried
7. Tertiary (wardrobe gap + mood outfit)

### New order
1. Greeting + weather + settings
2. Stylist tip
3. **AI Suggestions** ← promoted to first content block (right after greeting)
4. Hero (state-aware: today's outfit / empty wardrobe / "what to wear")
5. Quick Actions
6. Retention nudges
7. Tertiary (wardrobe gap + mood)

### Changes
**File: `src/pages/Home.tsx`**
- Move the `AISuggestions` block (lines 234–237) to directly after the stylist tip (after line 140), before the FadeReplace hero
- Keep the `garmentCount >= 3` guard
- The hero block shifts down but remains state-aware with its FadeReplace logic
- All other sections stay in their current relative order

This is a single-file reorder — no new components or logic changes needed.

