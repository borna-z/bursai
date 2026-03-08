

## Update Product Showcase with New Screenshots and Animated Labels

### What changed
The user provided 3 new, cleaner screenshots:
- **image-9.png** → Wardrobe page (dark, garment grid with categories)
- **image-10.png** → Home/Today page ("Good afternoon" with outfit suggestion)
- **image-11.png** → Plan page (weekly planner with weather + AI day summary)

Note: The third screenshot is now the **Plan** page instead of the Stylist/Chat page.

### Plan

1. **Replace screenshot assets**
   - Copy `image-9.png` → `src/assets/screenshot-wardrobe.png`
   - Copy `image-10.png` → `src/assets/screenshot-home.png`
   - Copy `image-11.png` → `src/assets/screenshot-planner.png` (new file, replacing stylist)

2. **Update `ProductShowcase.tsx`**
   - Update SCREENS array: replace stylist with planner screenshot
   - Update labels to be more descriptive and compelling:
     - Wardrobe: "Your entire wardrobe, organized" / subtitle about smart categories
     - Home: "Your daily outfit, ready to go" / subtitle about AI-picked looks
     - Planner: "Plan your week effortlessly" / subtitle about weather-aware scheduling
   - Add animated labels beneath each phone using the existing `reveal-up` system with staggered delays
   - Style labels as small pill/chip elements with a subtle glass background and fade-in animation

3. **Add translation keys** in `translations.ts`
   - Add new label keys for the three screens (both `sv` and `en` locales):
     - `landing.showcase_wardrobe_title` / `landing.showcase_wardrobe_desc`
     - `landing.showcase_home_title` / `landing.showcase_home_desc`
     - `landing.showcase_planner_title` / `landing.showcase_planner_desc`

4. **Enhanced label design**
   - Each phone gets a title (bold, white, ~14px) + a one-line description (gray-400, ~12px)
   - Labels use `reveal-up` with staggered `--reveal-delay` for a cascading entrance
   - On mobile (single center phone visible), show only the center label

