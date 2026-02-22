

# Complete Onboarding Redesign

A modern, one-question-per-screen onboarding flow with 32 thoughtfully designed questions across 8 themed sections. Same design language, same animations, but a fundamentally better experience.

---

## What Changes

### Current Problems
- Body measurements as the first question feels intrusive and clinical
- Two massive color grids shown back-to-back are overwhelming and repetitive
- Questions grouped 4-5 per page creates wall-of-text fatigue
- Some questions overlap (age range AND age, style vibe asked multiple ways)
- Post-quiz checklist (add garments, create outfit, reminders) breaks flow
- No personality or engagement in the questions

### New Approach
- **One question per screen** — feels fast, modern, and intentional (like Hinge/Spotify onboarding)
- **32 unique questions** across 8 themed sections with clear purpose
- Smooth horizontal slide transitions between questions (existing animation system)
- Section headers appear when entering a new section
- Progress bar shows overall completion
- Skip button always available
- Questions ordered from easy/fun to more specific
- Body measurements moved later (less intrusive)
- Free text fields only for truly open-ended questions
- Every question clearly helps AI personalization

---

## New Flow Order

1. **Language selection** (keep as-is)
2. **Accent color** (keep as-is)
3. **Style Quiz v3** — 32 questions, one per screen, 8 sections
4. **App tutorial** (keep as-is)
5. Complete onboarding and go to Home (skip old checklist)

---

## The 32 Questions

### Section 1: About You (Q1-4)
1. How do you identify? — Male / Female / Non-binary / Prefer not to say
2. Age range — 18-24, 25-34, 35-44, 45-54, 55+
3. Your height (optional) — Number input with cm
4. What climate do you dress for most? — Nordic/cold, Temperate, Warm/tropical, Varies

### Section 2: Your Daily Life (Q5-8)
5. Typical weekday? — Office, Remote/WFH, Student, Active/outdoors, Mix
6. How formal is your work or school? — Very casual, Smart casual, Business casual, Formal
7. What do your weekends look like? — Relaxed at home, Active/sports, Social/going out, Family, Mix
8. How often do you need a special-occasion outfit? — Rarely, A few times a month, Weekly

### Section 3: Your Style DNA (Q9-13)
9. Pick up to 3 words that describe your style — Minimal, Classic, Street, Preppy, Bohemian, Sporty, Edgy, Romantic, Scandi, Avant-garde
10. Where do you fall? (slider) — Comfort ... Style
11. How adventurous are you with fashion? — Play it safe, Try new things sometimes, Love experimenting
12. How do you relate to trends? — Always up to date, Pick and choose, Prefer timeless
13. Open to gender-neutral suggestions? — Yes / No

### Section 4: Fit and Shape (Q14-17)
14. Preferred overall fit? — Loose, Regular, Slim, Depends on the piece
15. How do you feel about layering? — Keep it minimal, Love building layers
16. Top style preference? — Fitted, Regular, Oversized
17. Bottom length preference? — Ankle, Full length, Shorts, Mix

### Section 5: Colors and Patterns (Q18-21)
18. Your go-to colors (pick up to 5) — Curated palette of 20 colors with color swatches
19. Colors you never wear — Same palette
20. Overall palette vibe? — Neutrals and earth tones, Bold and vibrant, Dark and moody, Pastels and soft, Mix
21. How do you feel about patterns? — Love them, Some are fine, Prefer solid colors

### Section 6: Wardrobe Philosophy (Q22-25)
22. Shopping mindset? — Bargain hunter, Quality mid-range, Investment pieces, Mix of everything
23. How important is sustainability? — Very important, Nice to have, Not a priority
24. Are you building a capsule wardrobe? — Yes, actively, Interested, No / What's that?
25. Biggest wardrobe frustration? (multi-select) — "Nothing to wear" syndrome, Too many similar pieces, Hard to combine things, Wardrobe doesn't match my life

### Section 7: Inspiration (Q26-29)
26. Brands or people that inspire your style (optional free text)
27. What occasions are hardest to dress for? (multi) — Work/meetings, Dates, Casual weekends, Formal events, Travel
28. Favorite fabric feel? — Cotton/linen, Wool/knit, Denim, Technical, Silk/satin, No preference
29. Do you have signature pieces you always reach for? — Yes, a few favorites, Not really, I want to find them

### Section 8: Your Goals with BURS (Q30-32)
30. What should BURS help you with most? — Daily outfit ideas, Build a better wardrobe, Discover my personal style, Plan for events, All of the above
31. Morning routine — how much time for getting dressed? — Under 5 minutes, 5-15 minutes, I enjoy taking my time
32. Anything else the AI should know about your style? (optional free text)

---

## Technical Details

### Files to create
- **`src/components/onboarding/StyleQuizV3.tsx`** — New single-question-per-screen quiz component with all 32 questions, section transitions, progress bar, and slide animations

### Files to modify
- **`src/pages/Onboarding.tsx`** — Replace StyleQuizStep with StyleQuizV3, remove the post-quiz checklist flow (steps 1-3 cards), complete onboarding directly after tutorial
- **`src/hooks/useOnboarding.ts`** — Simplify: remove garment/outfit/reminder step tracking, onboarding completes after quiz + tutorial
- **`src/i18n/translations.ts`** — Replace old `quiz.*` keys with new `quiz3.*` keys for all 32 questions across supported languages (Swedish primary, English secondary, other languages get English fallbacks initially)

### Files to delete (no longer needed)
- **`src/components/onboarding/StylePreferencesStep.tsx`** — Replaced by StyleQuizV3
- **`src/components/onboarding/BodyMeasurementsStep.tsx`** — Body data now integrated into quiz Q1-3

### Design per screen
- Same gradient header with section icon + title (only shown on first question of each section)
- Single question with large readable label
- Answer options as full-width rounded buttons or chips (depending on type)
- Fixed bottom bar with Back/Next buttons
- Thin progress bar at the very top of the screen
- Smooth horizontal slide animation between questions (existing EASE_CURVE)
- Section transition has a brief "section intro" card with icon before questions

### Data shape
- All 32 answers saved to `profiles.preferences.styleProfile` as a single object
- Backward compatible: old styleProfile keys still work if present
- No database schema changes needed

