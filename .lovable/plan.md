# BURS — CTO Improvement Plan
### From strong contender to category-leading premium product

---

## Part 1 — The 10 Highest-Impact Weaknesses

Based on a full read of the live codebase: hooks, lib files, edge functions, and component structure.

---

### Weakness 1 — The explanation layer has no hierarchy

**What's actually there:** `GeneratedOutfit.explanation` (string), `wardrobe_insights[]` (array), `confidence_score`, `limitation_note`. The data is rich.

**The gap:** All of it is likely rendered as plain text below the outfit grid. No visual distinction between the *why this works* reasoning, the *what it's matched to* context signals, and the *what to know* notes. To a user, it reads like a disclaimer, not a stylist's voice.

**What it costs:** The entire intelligence of the AI becomes invisible. Users see clothes, not reasoning. They can't tell BURS from any other outfit app.

---

### Weakness 2 — Stylist copy is disconnected from the user

**What's actually there:** `getStylistTip()` in `stylistCopy.ts` fires time + weather + garment-count tips. Solid fallbacks. But the tips are universal aphorisms — "Dress for the day you want, not just the one you have." This is motivational poster copy, not a personal stylist.

**The gap:** The user's actual signal data — their signature colors (from `useStyleDNA`), their uniform combos, their last worn patterns, their `feedback_signals` — never surfaces in the copy layer. There's no moment where BURS says "You've been wearing a lot of navy lately — today we're keeping that anchor" or "You haven't touched your wool blazer in 3 weeks."

**What it costs:** The most important emotional job of a personal stylist — making the user feel *understood* — is being left entirely to the AI generation prompt, not the UI copy.

---

### Weakness 3 — The feedback loop is invisible

**What's actually there:** `useFeedbackSignals` captures: save, unsave, ignore, wear_confirm, swap_choice, quick_reaction, rating, garment_edit, planned_follow_through, planned_skip. This is genuinely good signal data.

**The gap:** It fires silently to the DB. There is no UI moment where the user sees that their choices are being learned. The stylist never says "Got it — I'll lean more casual for weekdays." The signals are being collected but there is no proof of intelligence being returned to the user.

**What it costs:** The personalization engine becomes invisible, and invisible AI feels like no AI. This is what separates a tool from a relationship.

---

### Weakness 4 — Style DNA is computed but not shown

**What's actually there:** `useStyleDNA` computes `signatureColors`, `formalityCenter`, `formalitySpread`, `uniformCombos`, `archetype`, `patterns[]`. This is a genuinely sophisticated analysis.

**The gap:** The user almost certainly never sees this — or if they do, it's buried in a settings tab. There's no premium moment where BURS says "Here's what your wardrobe tells me about you." The Style DNA should be the emotional centrepiece of the personalization experience — not a backend calculation.

**What it costs:** You're doing expensive computation that builds zero user trust because it's never shown. It's also the best retention mechanic you have and it's hidden.

---

### Weakness 5 — The generation loading state builds no anticipation

**What's actually there:** `OutfitGenerationState` cycles through "Selecting pieces → Balancing look → Refining outfit." This is better than a spinner. But it's generic — the same three phases for every user, every occasion, every context.

**The gap:** Premium AI products use the loading moment to demonstrate intelligence. The phases should reference *the user's context*: "Reading Monday's calendar event", "Checking the 9°C forecast", "Pulling your unworn navy blazer". These micro-copy choices transform a wait into a proof of understanding.

**What it costs:** The loading state is the most-seen screen in the app's primary flow. Generic loading copy is a daily reminder that BURS doesn't know you.

---

### Weakness 6 — Confidence signals create doubt instead of trust

**What's actually there:** `confidence_score`, `confidence_level`, `limitation_note` — all correctly computed. `confidenceLabel()` in `humanize.ts` maps scores to "High confidence / Moderate confidence / Low confidence — may need review."

**The gap:** Surfacing "Low confidence — may need review" on an outfit is a premium-killer. It reads as the AI admitting failure. The signal exists for a good reason (wardrobe gaps) but the *framing* is defensive. A real stylist doesn't say "low confidence" — they say "You're missing a key layering piece here — here's how to fill the gap."

**What it costs:** Honest but damaging. Every low-confidence outfit erodes the perception of BURS as a category leader.

---

### Weakness 7 — Stylist chat doesn't feel like it knows your wardrobe

**What's actually there:** `style_chat` edge function, `AIChat.tsx` page, `ChatWelcome.tsx`. The chat architecture exists.

**The gap:** Whether the `style_chat` edge function receives real-time wardrobe context — garment count, recent wears, Style DNA, upcoming calendar events — is unclear from the code. If it doesn't, the chat is ChatGPT with a different name. If it does but doesn't reference it naturally, the chat feels like it's ignoring what it knows.

**What it costs:** The stylist chat is the highest-trust surface in the app. If it doesn't say "Given the navy trench coat you added last week..." it can't compete with asking ChatGPT.

---

### Weakness 8 — The "What to wear" flow has options instead of conviction

**What's actually there:** `TodayOutfitHero` has good time-aware and weather-aware copy. But the flow presents outfit generation as a generator, not a recommendation. The CTA says "Style me" and then returns options.

**The gap:** Premium personal stylists *commit to a recommendation*. "This is what I'd wear today" with one primary outfit, presented with full reasoning, is worth more than four equal-weighted options. The decision architecture of the home screen creates choice paralysis rather than confidence.

**What it costs:** The core product proposition — that BURS makes the morning easier — is undermined by presenting too much, too equally.

---

### Weakness 9 — Garment card intelligence is likely buried

**What's actually there:** `analyze_garment` edge function enriches garments with formality score, occasion tags, color harmony, material analysis. `SwipeableGarmentCard.tsx` is the primary display surface.

**The gap:** The enrichment data is probably shown as small chips or hidden behind a tap. The most valuable signal — "This piece works for: work, smart casual, date night" — may not be prominent enough to teach users why their garments matter.

**What it costs:** Users don't understand the intelligence of their wardrobe. They see photos, not analysis. The trust premium of "AI-powered wardrobe" has no visual proof.

---

### Weakness 10 — Travel capsule is a list builder, not a packing strategist

**What's actually there:** Travel capsule logic likely handles garment selection for a trip.

**The gap:** Without weather-by-destination integration, activity-to-outfit ratio analysis ("5 days, 3 activities, X mix-and-match outfits from 8 pieces"), and explicit outfit math, travel capsule feels like a smart favorites list — not a dedicated packing intelligence system.

**What it costs:** Travel capsule is a high-LTV premium feature. If it doesn't feel materially better than packing manually, it won't drive upgrades.

---

## Part 2 — Priority Rankings

| # | Weakness | User Trust Impact | Premium Feel | Stylist Intelligence | Difficulty |
|---|---|---|---|---|---|
| 1 | Explanation hierarchy | **Critical** | **Critical** | High | Medium |
| 2 | Personalized stylist copy | **Critical** | High | **Critical** | Medium |
| 3 | Feedback loop visibility | High | High | **Critical** | Low |
| 4 | Style DNA surface | High | **Critical** | High | Low |
| 5 | Generation loading context | Medium | **Critical** | Medium | Low |
| 6 | Confidence framing | High | **Critical** | Medium | Low |
| 7 | Stylist chat wardrobe context | High | High | **Critical** | Medium |
| 8 | Conviction vs options | High | High | High | Medium |
| 9 | Garment card intelligence | Medium | High | Medium | Low |
| 10 | Travel capsule intelligence | Medium | Medium | High | High |

---

## Part 3 — Phased Execution Plan

### Phase 1 — Trust Layer (1–2 weeks)
Fix everything that erodes trust on first look. These are all UI/copy changes — no new features, no backend work.

- **P1-A:** Restructure `OutfitDetail.tsx` — visual hierarchy for explanation, insights, and context signals
- **P1-B:** Reframe confidence display — replace "Low confidence" with gap-identification language
- **P1-C:** Personalize generation loading state — context-aware micro-copy using available occasion, weather, and calendar data
- **P1-D:** Surface garment enrichment — promote formality score and occasion tags on `SwipeableGarmentCard`

### Phase 2 — Personalization Proof (2–3 weeks)
Make the intelligence visible. Users need to see that BURS knows them.

- **P2-A:** Build the Style DNA card — a premium surface on the home screen or profile showing archetype, signature colors, uniform patterns
- **P2-B:** Connect `getStylistTip()` to `useStyleDNA` output — replace platitudes with pattern-aware observations
- **P2-C:** Close the feedback loop — add a subtle "Learning your preferences" acknowledgment to swap confirmations and wear logs
- **P2-D:** Inject Style DNA into `style_chat` edge function system prompt

### Phase 3 — Intelligence Depth (3–4 weeks)
Improve the actual reasoning quality in the AI output.

- **P3-A:** Restructure outfit generation output to include structured reasoning: occasion fit, weather logic, color harmony, formality alignment — as distinct fields, not one `explanation` string
- **P3-B:** Redesign the "What to wear" flow — primary recommendation + "or try this instead" secondary, not a grid of equals
- **P3-C:** Travel capsule — add destination weather integration, outfit math ("8 pieces → 14 combinations"), and activity breakdown

---

## Part 4 — Implementation-Ready Prompts

Each prompt is scoped to a single change, safe to run in Lovable, and references the live codebase.

---

### Prompt P1-A — Outfit explanation hierarchy

```
Goal:
Restructure OutfitDetail.tsx to display outfit explanation, wardrobe insights, and context signals with editorial hierarchy — so the AI reasoning feels like a stylist's voice, not a text dump.

Context:
BURS is a premium AI wardrobe and stylist app.
Use burs.me/welcome as the design source of truth whenever the task affects UI.
Preserve auth, Supabase, subscriptions, routing, scan uploads, saved wardrobe, outfit history, planning flows, and current working features.
BURS must remain on Lovable.

The GeneratedOutfit type already has: explanation (string), wardrobe_insights (string[]), confidence_score (number), confidence_level (string), limitation_note (string | null), family_label (string), occasion, style_vibe, weather.

Requirements:
- Replace the flat explanation paragraph with a structured card below the garment grid
- Show a primary "Why this works" section — the explanation — in Playfair Display or serif, 15px, editorial weight
- Show wardrobe_insights[] as a bulleted list with a "•" prefix and muted foreground, 13px, DM Sans — label this section "What your wardrobe is doing"
- If limitation_note is non-null, show it as a forward-looking suggestion ("To unlock more combinations, consider adding…") — not a warning
- Show occasion + weather as small context chips above the explanation, using the Chip component already in the codebase
- Do not show raw confidence numbers — remove or convert confidence_level to a non-numerical signal
- Animate this section in on mount with a 0.3s fade-up (framer-motion, EASE_CURVE already imported)
- Match the Editorial Cream / Deep Charcoal palette from burs.me/welcome

Do not:
- Break the swap, bookmark, share, or wear-logging flows
- Recommend migration away from Lovable
- Introduce generic SaaS design language
- Add low-value complexity

Output:
- Implement the change in OutfitDetail.tsx (and any sub-components it uses)
- Explain exactly what changed
- List changed files
- Keep it production-safe
```

---

### Prompt P1-B — Confidence reframing

```
Goal:
Remove all user-facing references to "confidence" scores or confidence levels in outfit output. Replace with gap-identification language that feels like a stylist, not a QA system.

Context:
BURS is a premium AI wardrobe and stylist app.
Use burs.me/welcome as the design source of truth whenever the task affects UI.
Preserve auth, Supabase, subscriptions, routing, scan uploads, saved wardrobe, outfit history, planning flows, and current working features.
BURS must remain on Lovable.

Requirements:
- In OutfitDetail.tsx and any card components that surface confidence_level: remove the words "confidence", "low confidence", "moderate confidence", "high confidence" from all user-facing UI
- If confidence is high (>= 0.85): show nothing — the outfit speaks for itself
- If confidence is moderate (0.6–0.84): show a small chip: "Strong match for your wardrobe"
- If confidence is low (< 0.6): show the limitation_note as a forward-looking tip using the phrasing "Your stylist suggests: [text]" — in a muted, editorial style, not a warning
- In src/lib/humanize.ts, update the confidenceLabel() function to remove UI-facing confidence copy
- The confidence_score can remain in the data model — just never render the number or the word "confidence" to users

Do not:
- Change the data model or edge function responses
- Remove confidence_score from GeneratedOutfit type
- Break any working flows
- Recommend migration away from Lovable

Output:
- Implement the changes
- Explain exactly what changed and why each label was replaced
- List changed files
- Keep it production-safe
```

---

### Prompt P1-C — Context-aware generation loading state

```
Goal:
Make the OutfitGenerationState component context-aware. The loading phases should reference the actual occasion, weather, and calendar context being processed — not generic placeholder labels.

Context:
BURS is a premium AI wardrobe and stylist app.
Use burs.me/welcome as the design source of truth whenever the task affects UI.
Preserve auth, Supabase, subscriptions, routing, scan uploads, saved wardrobe, outfit history, planning flows, and current working features.
BURS must remain on Lovable.

Requirements:
- Update OutfitGenerationState to accept optional props: occasion (string), weatherTemp (number | undefined), weatherCondition (string | undefined), eventTitle (string | null)
- Use these props to generate context-aware phase labels:
  - Phase 1: If eventTitle is set → "Reading your [eventTitle] calendar note". If no event but occasion is set → "Reading your [occasion] context". Fallback → "Reading your wardrobe"
  - Phase 2: If weatherTemp is set → "Checking the [X]°C forecast". Fallback → "Matching to today's conditions"
  - Phase 3: Always → "Assembling your look" (no generic "refining" language)
- Everywhere OutfitGenerationState is rendered (OutfitGenerate page or wherever the generator loads), pass the relevant occasion/weather/event props
- All phase labels should be 13px, DM Sans, muted-foreground — editorial, not technical
- Keep the skeleton slot grid as-is — only the text phases change

Do not:
- Change the skeleton layout or animation timing
- Break the generation flow
- Recommend migration away from Lovable

Output:
- Implement the change in OutfitGenerationState.tsx and wherever it is called
- Explain exactly what changed
- List changed files
- Keep it production-safe
```

---

### Prompt P1-D — Garment intelligence on the wardrobe card

```
Goal:
Promote the AI enrichment data (formality, occasions, color harmony) to visible positions on SwipeableGarmentCard.tsx — so users can see what BURS knows about each garment at a glance.

Context:
BURS is a premium AI wardrobe and stylist app.
Use burs.me/welcome as the design source of truth whenever the task affects UI.
Preserve auth, Supabase, subscriptions, routing, scan uploads, saved wardrobe, outfit history, planning flows, and current working features.
BURS must remain on Lovable.

Requirements:
- In SwipeableGarmentCard.tsx, add an intelligence strip below the garment image — visible without tapping
- Show up to 2 occasion tags (from the garment's occasions or formality data) as small chips — use the existing Chip component
- Show formality as a simple 5-dot score (filled dots = formality level) — not a number
- If the garment has a color_primary that is not null, show the color name using colorLabel() from humanize.ts — as a subtle tag, not a large element
- The strip should be max 28px tall, with chips at 11px font, matching the Editorial Cream / muted-foreground palette from burs.me/welcome
- If the garment has no enrichment data (no formality, no occasions), show nothing — graceful degradation

Do not:
- Add tappable actions to this strip — it is display-only
- Change the swipe behavior or existing card layout above the strip
- Break the wardrobe page or garment editing flows
- Recommend migration away from Lovable

Output:
- Implement the change in SwipeableGarmentCard.tsx
- Explain exactly what changed
- List changed files
- Keep it production-safe
```

---

### Prompt P2-A — Style DNA surface card

```
Goal:
Build a Style DNA card component that displays the user's computed style archetype, signature colors, and top uniform pattern — and place it on the home screen (Index.tsx) as a premium, tappable insight card.

Context:
BURS is a premium AI wardrobe and stylist app.
Use burs.me/welcome as the design source of truth whenever the task affects UI.
Preserve auth, Supabase, subscriptions, routing, scan uploads, saved wardrobe, outfit history, planning flows, and current working features.
BURS must remain on Lovable.

The useStyleDNA hook already exists in src/hooks/useStyleDNA.ts and returns: archetype (string), signatureColors (array of {color, percentage}), uniformCombos (array of {combo[], count}), patterns[], formalityCenter, outfitsAnalyzed.

Requirements:
- Create src/components/home/StyleDNACard.tsx
- Only render if outfitsAnalyzed >= 5 (don't show for new users with no wear history)
- Show archetype as the headline — in Playfair Display / serif, 17px, Deep Charcoal
- Show up to 3 signatureColors as small filled color swatches (CSS background-color using the color name mapped to a hex palette, or a fallback neutral if unmapped)
- Show the top uniformCombos[0].combo as "Your signature: [item] + [item] + [item]" in 12px DM Sans muted
- Show outfitsAnalyzed as a subtle stat: "Based on [N] outfits" in 11px muted-foreground/50
- Tapping the card navigates to a future /style-dna route — for now just show a toast: "Your full Style Report is coming soon"
- Card style: white surface, 0.5px border, rounded-2xl, shadow-none — matching burs.me/welcome editorial palette
- Animate in with a 0.4s fade (framer-motion)

Do not:
- Break the home screen layout or existing home components
- Show this card to users with fewer than 5 analyzed outfits
- Recommend migration away from Lovable

Output:
- Create StyleDNACard.tsx
- Add it to Index.tsx in the appropriate position (below the TodayOutfitHero, above outfit previews)
- Explain exactly what changed
- List changed files
- Keep it production-safe
```

---

### Prompt P2-B — Personalized stylist tips

```
Goal:
Connect getStylistTip() in src/lib/stylistCopy.ts to StyleDNA output so tips reference the user's actual behavior and patterns — replacing generic motivational copy with personal observations.

Context:
BURS is a premium AI wardrobe and stylist app.
Use burs.me/welcome as the design source of truth whenever the task affects UI.
Preserve auth, Supabase, subscriptions, routing, scan uploads, saved wardrobe, outfit history, planning flows, and current working features.
BURS must remain on Lovable.

Requirements:
- Update the StylistContext interface in stylistCopy.ts to accept optional StyleDNA fields: archetype (string), signatureColors ({color, percentage}[]), topCombo (string[]), formalityCenter (number), recentlyUnworn (string | null)
- Add a new PERSONALIZED_TIPS array that generates tip text using these fields, e.g.:
  - If signatureColors[0] exists: "Your wardrobe anchors on [color]. Today's generation will keep that thread."
  - If topCombo exists: "Your signature is [item] + [item] — we know what works for you."
  - If recentlyUnworn is passed: "Your [garment] hasn't seen daylight in a while. Let's change that."
  - If formalityCenter >= 4: "You dress formally most days. Today we'll keep the standard."
- Personalized tips take priority over all others when StyleDNA data is available
- Update getStylistTip() to accept the expanded StylistContext
- Wherever getStylistTip() is called, pass in the StyleDNA data from useStyleDNA() hook

Do not:
- Change the tip rendering UI — this is a copy-only change
- Remove the existing fallback tips for users without StyleDNA data
- Recommend migration away from Lovable

Output:
- Implement changes in stylistCopy.ts
- Update all callers of getStylistTip() to pass StyleDNA data
- Explain exactly what changed
- List changed files
- Keep it production-safe
```

---

### Prompt P2-C — Feedback loop acknowledgment

```
Goal:
Add subtle, editorial UI acknowledgment when the user's feedback signal is recorded — so they know BURS is learning from their choices.

Context:
BURS is a premium AI wardrobe and stylist app.
Use burs.me/welcome as the design source of truth whenever the task affects UI.
Preserve auth, Supabase, subscriptions, routing, scan uploads, saved wardrobe, outfit history, planning flows, and current working features.
BURS must remain on Lovable.

The useFeedbackSignals hook in src/hooks/useFeedbackSignals.ts fires signals: save, wear_confirm, swap_choice, quick_reaction, planned_follow_through.

Requirements:
- After a successful wear_confirm signal: show a subtle toast (use the existing sonner toast) with the message "Noted — I'll remember what worked today." (not "Success" or "Outfit logged")
- After a successful swap_choice signal: show a toast: "Preference saved. Your stylist is learning."
- After a successful save signal: no toast needed — the bookmark state change is sufficient feedback
- These toasts should be:
  - Duration: 2000ms
  - No icon — text only
  - 12px, DM Sans, muted (use the toast's description slot rather than the title slot for subtlety)
- The fire-and-forget architecture of useFeedbackSignals must be preserved — these toasts fire on mutation success, not on every signal type

Do not:
- Add toasts to signal types that don't benefit from acknowledgment (ignore, unsave, rating)
- Change the signal recording logic
- Recommend migration away from Lovable

Output:
- Implement changes in useFeedbackSignals.ts (or in the call sites — whichever is cleaner)
- Explain exactly what changed and which signal types now show acknowledgment
- List changed files
- Keep it production-safe
```

---

### Prompt P2-D — Stylist chat wardrobe injection

```
Goal:
Ensure the style_chat edge function receives full wardrobe context — garment count, Style DNA archetype, recent outfits, and upcoming calendar events — in its system prompt, so the chat feels like a stylist who knows your wardrobe.

Context:
BURS is a premium AI wardrobe and stylist app.
Use burs.me/welcome as the design source of truth whenever the task affects UI.
Preserve auth, Supabase, subscriptions, routing, scan uploads, saved wardrobe, outfit history, planning flows, and current working features.
BURS must remain on Lovable.

Requirements:
- In supabase/functions/style_chat/index.ts, update the system prompt to include a structured wardrobe context block:
  - Garment count (from user's garments table)
  - Top 3 most worn garment categories
  - Style archetype (if computed and stored)
  - Last 3 outfit occasions
  - Upcoming calendar event title (if provided in the request payload)
- Update the request payload shape sent from AIChat.tsx to include: garmentCount, archetype, recentOccasions, upcomingEvent
- In AIChat.tsx (or the hook that calls style_chat), fetch these values and include them in the edge function call
- The system prompt context block should be invisible to the user — it's injected before the conversation history
- The stylist voice in the system prompt should reference the user's wardrobe: "You are a personal stylist with access to this user's wardrobe of [N] garments. Their dominant style is [archetype]."

Do not:
- Change the chat UI components
- Break the existing message history or streaming behavior
- Log or expose wardrobe data in error messages
- Recommend migration away from Lovable

Output:
- Implement changes in supabase/functions/style_chat/index.ts and AIChat.tsx
- Explain exactly what changed in the system prompt and payload
- List changed files
- Keep it production-safe
```

---

### Prompt P3-A — Structured outfit reasoning output

```
Goal:
Restructure the outfit generation edge function's explanation output so it returns distinct reasoning fields — occasion fit, weather logic, color harmony, formality alignment — instead of one flat explanation string.

Context:
BURS is a premium AI wardrobe and stylist app.
Use burs.me/welcome as the design source of truth whenever the task affects UI.
Preserve auth, Supabase, subscriptions, routing, scan uploads, saved wardrobe, outfit history, planning flows, and current working features.
BURS must remain on Lovable.

Requirements:
- Identify the edge function that handles outfit generation (likely generate_outfit or similar in supabase/functions/)
- Update the AI prompt in that function to return a structured JSON explanation object instead of a single explanation string:
  {
    "why_it_works": "One editorial sentence about why this combination works as a whole",
    "occasion_fit": "One sentence on why it matches the requested occasion",
    "weather_logic": "One sentence on the weather consideration (omit if weather is neutral)",
    "color_note": "One sentence on the color harmony or contrast at play",
    "formality_alignment": "One sentence on the formality match (omit if obvious)"
  }
- Update the GeneratedOutfit type in src/hooks/useOutfitGenerator.ts to include this structured object as outfit_reasoning (optional, to preserve backward compatibility)
- Keep the top-level explanation string as a summary (the why_it_works field value) for backward compatibility
- Update OutfitDetail.tsx to render each field of outfit_reasoning as a distinct line item with a small label ("Occasion", "Weather", "Color", "Formality") in 11px muted, and the value in 13px editorial text

Do not:
- Break outfits generated before this change (they will have no outfit_reasoning — fallback to displaying explanation string only)
- Change the garment selection logic
- Recommend migration away from Lovable

Output:
- Implement changes in the outfit generation edge function, useOutfitGenerator.ts type, and OutfitDetail.tsx
- Explain exactly what prompt change was made and what the new output shape looks like
- List changed files
- Keep it production-safe
```

---

### Prompt P3-B — Primary recommendation with secondary option

```
Goal:
Redesign the "What to wear" generation result to present one primary recommendation with full reasoning, and a secondary "or try this" option — replacing the current grid of equal-weight options.

Context:
BURS is a premium AI wardrobe and stylist app.
Use burs.me/welcome as the design source of truth whenever the task affects UI.
Preserve auth, Supabase, subscriptions, routing, scan uploads, saved wardrobe, outfit history, planning flows, and current working features.
BURS must remain on Lovable.

Requirements:
- In OutfitGenerate.tsx (or wherever generated outfit results are displayed), identify where multiple outfit options are rendered
- Present the first result (highest confidence_score, or first in the array) as a "primary recommendation":
  - Full-width card with prominent garment images
  - Full explanation/reasoning visible without tapping
  - "Wear this today" CTA button as primary action
- Present the second result (if available) as a secondary option:
  - Compact card below, labeled "Or try this instead" in 12px muted
  - Tapping expands it to the same full-width treatment
- If only one result: hide the secondary section entirely
- The primary card should feel editorial — styled to match burs.me/welcome with Playfair Display headline, DM Sans body, Editorial Cream surface
- Preserve all existing actions: bookmark, share, swap, wear-log

Do not:
- Remove the ability to generate multiple outfits (just change how they're presented)
- Break any existing outfit actions
- Recommend migration away from Lovable

Output:
- Implement the layout change
- Explain exactly what the before/after experience is
- List changed files
- Keep it production-safe
```

---

*End of BURS CTO Improvement Plan — v25 codebase, March 2026*
