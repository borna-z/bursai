

## Redesign "Our Mission" Section

### Problem
The current three cards talk about "Privacy first", "Zero lock-in", and "Offline-ready PWA" -- these are technical features that don't resonate with users and don't align with BURS's brand positioning as an AI wardrobe stylist.

### New Content Direction

**Section label:** "Why BURS" (sv: "Varför BURS")
**Section title:** "Style smarter, not harder." (sv: "Styla smartare, inte mer.")

Three new pillars that speak to the user's actual experience:

| Card | Icon | Title (EN) | Description (EN) |
|------|------|------------|-------------------|
| 1 | Sparkles | **Learns your style** | The more you wear, the smarter it gets. BURS adapts to your taste and lifestyle over time. |
| 2 | Leaf | **Less buying, more wearing** | Rediscover forgotten favorites. Get more outfits from the clothes you already own. |
| 3 | Calendar | **Dressed for every moment** | From Monday meetings to weekend plans. BURS matches your outfits to your schedule and weather. |

These pillars connect directly to BURS's core value props: AI personalization, sustainability, and contextual outfit planning.

### Technical Changes

**`src/i18n/translations.ts`**
- Update all 6 translation keys (`mission_label`, `mission_title`, `trust1_title`, `trust1_desc`, `trust2_title`, `trust2_desc`, `trust3_title`, `trust3_desc`) across all languages (Swedish, English, Norwegian, Danish, Finnish)

**`src/components/landing/MissionSection.tsx`**
- Replace icons: `Shield, Smartphone` with `Sparkles, Leaf, Calendar` from lucide-react
- Map the three cards to the updated translation keys (no structural changes needed -- same layout, just new icons and text)

