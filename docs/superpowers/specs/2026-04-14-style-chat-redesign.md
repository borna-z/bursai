# Style Chat Redesign — Design Spec

> **Goal:** Transform the AI chat from a trigger-happy outfit generator into a conversational stylist that listens before acting, refines intelligently, and handles natural language properly.

**Scope:** `style_chat` edge function + `AIChat.tsx` page + `OutfitSuggestionCard.tsx` component. No other pages or edge functions are affected.

---

## Problem Statement

Four bugs in the current style chat:

1. **Everything generates an outfit.** After a greeting, any follow-up message triggers outfit generation. The regex-based intent detection (`SHORT_RE`, `detectStylistChatMode()`) has no middle ground between "trivial greeting" and "generate outfit."
2. **Refinement doesn't work.** Saying "make it warmer" while viewing an outfit should refine it, but the active look context isn't reliably passed back, so the AI generates a new unrelated outfit.
3. **Refine button anchors one garment instead of the whole outfit.** The per-garment swap icon is the only interaction — there's no "refine this entire look" action.
4. **No conversational depth.** The AI can't gather context before acting. "I have a dinner date Friday" should prompt "what's the vibe?" — instead it immediately generates an outfit with insufficient context.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Intent detection method | AI classifier (replaces regex) | Natural language can't be parsed with regex. A 50-token Flash Lite call handles any phrasing. |
| Fallback when classifier fails | Default to `conversation` + `needs_more_context: true` | "Tell me more" is always a safe response. Better than guessing wrong. |
| Old regex code | Deleted entirely | No dual paths. Clean cut. Regex fast-path for trivial greetings (`SHORT_RE`) stays as a pre-filter to avoid unnecessary classifier calls. |
| Refine interaction | Full-outfit anchor + context-aware chips + free text + tap-to-lock | Most flexible. Quick actions for common tweaks, free text for anything specific. |
| Response envelope shape | Unchanged | `AIChat.tsx` parses the existing `StyleChatResponseEnvelope` from SSE. Classifier is internal to the edge function — client never sees it. |

---

## Architecture

### Intent Classifier (Pass 1)

A lightweight AI call that runs before the main response. Replaces `detectStylistChatMode()` and `detectRefinementIntent()`.

**Input:**
- User message text (text portion only if multimodal)
- `has_active_look: boolean`
- `has_anchor: boolean`
- `garment_count: number`
- Last 2 messages for conversational context
- `locked_slots: string[]` (user-locked garments from tap-to-lock)

**Output (structured JSON, ~50 tokens):**
```json
{
  "intent": "conversation | generate_outfit | refine_outfit | explain_outfit",
  "needs_more_context": true | false,
  "refinement_hint": "warmer | cooler | more_formal | less_formal | swap_shoes | swap_top | swap_bottom | swap_outerwear | different_style | use_less_worn | null",
  "locked_slots": ["top", "shoes"] | null,
  "clear_active_look": true | false
}
```

**Model:** Flash Lite (trivial complexity). ~50 tokens output. Timeout: 3 seconds hard cap.

**Failure handling:** If the classifier times out or returns unparseable JSON, default to:
```json
{
  "intent": "conversation",
  "needs_more_context": true,
  "refinement_hint": null,
  "locked_slots": null,
  "clear_active_look": false
}
```
This makes the AI ask a follow-up question — always a safe and reasonable response.

**Pre-filters (skip classifier entirely):**
- `SHORT_RE` trivial greetings → `conversation`, no classifier call needed
- `KNOW_RE` knowledge questions with no active look/anchor → `conversation`
- `garment_count === 0` → `conversation` with "add garments first" system hint

### Intent Definitions

| Intent | When | Card policy | AI complexity | Example messages |
|---|---|---|---|---|
| `conversation` | Greeting, fashion question, unclear request, or needs more info | No card | Trivial/Standard | "Hi", "What colors go with navy?", "I have a wedding next month" |
| `generate_outfit` | User explicitly asks for a look AND enough context exists | Show new card | Standard/Complex | "Put together a work outfit", "What should I wear tonight?" |
| `refine_outfit` | Active look exists and user wants to modify it | Show updated card | Standard | "Make it warmer", "I don't like the pants", "Swap the shoes" |
| `explain_outfit` | User asks about current look's styling logic | Preserve existing card | Standard | "Why does this work?", "What shoes would go better?" |

### `needs_more_context` Behavior

When `true`, the main AI responds conversationally to gather information instead of generating an outfit, regardless of intent. Examples:

- Intent `generate_outfit` + `needs_more_context: true` → "A wedding — sounds great! What's the dress code? Indoor or outdoor?"
- Intent `refine_outfit` + `needs_more_context: true` → "What specifically would you like to change about this look?"

### `clear_active_look` Behavior

When the classifier detects a new outfit request that's unrelated to the current active look:

- "Now something for Friday night" (while viewing a work outfit) → `clear_active_look: true`
- Client clears refine mode and active look before processing the response
- Previous outfit stays visible in chat history, but is no longer the active context

### Intent → Mode Mapping

The classifier output maps to the existing `StylistChatMode` constants. No mode constants are renamed or removed.

| Classifier intent | Mapped mode |
|---|---|
| `conversation` | `CONVERSATIONAL` |
| `generate_outfit` (no anchor) | `OUTFIT_GENERATION` |
| `generate_outfit` (with anchor) | `GARMENT_FIRST_STYLING` |
| `refine_outfit` | `ACTIVE_LOOK_REFINEMENT` |
| `explain_outfit` | `LOOK_EXPLANATION` |

The existing specialty modes (`PURCHASE_PRIORITIZATION`, `WARDROBE_GAP_ANALYSIS`, `PLANNING`, `STYLE_IDENTITY_ANALYSIS`) are detected by the classifier prompt — it's told about these modes and when to use them. They map 1:1 to the same constants.

### Main Response (Pass 2)

Unchanged in structure. Receives the classified mode and generates the response using the existing prompt builder, unified stylist engine, and normalizer. The only difference is that the mode now comes from the classifier instead of regex.

**What stays identical:**
- `callBursAI()` for the main response
- SSE streaming format
- `StyleChatResponseEnvelope` shape
- `[[outfit:id1,id2|explanation]]` tag extraction
- `normalizeStyleChatAssistantReply()` processing
- Rate limiting via `enforceRateLimit()` + `checkOverload()`
- Chat history persistence in `chat_messages`

---

## Refine Flow Redesign

### Outfit Card Changes (`OutfitSuggestionCard.tsx`)

**New "Refine" button:**
- Single button on the whole card (bottom, full-width)
- Anchors ALL garments in the outfit as the active look
- Sends `active_look.garment_ids` with `anchor_locked: true` to backend

**New "Save" button:**
- Next to "Refine", a "Save" button
- Saves outfit to `outfits` + `outfit_items` tables
- Changes to "✓ Saved" with link to view in Outfits page
- Uses existing `useCreateOutfit` / outfit save logic

**Per-garment swap icons stay:**
- Small refresh icon on each garment slot for quick local swaps without AI
- This is the "I just want different sneakers" shortcut

### Refine Mode (new UI state in `AIChat.tsx`)

When user taps "Refine":

1. **Card enters refine mode** — subtle gold border on the outfit card
2. **Context-aware chips appear below the card** — generated based on outfit properties
3. **"Refining this look" banner above chat input** — mini thumbnail strip of the outfit + "✕ Stop refining" button
4. **Garments become tappable to lock/unlock** — tap toggles gold lock icon, locked garments preserved through refinements

### Context-Aware Chips

Chips are determined client-side based on the outfit's garment properties (category, formality, season_tags). Not an AI call — simple logic:

| Outfit signal | Chips shown |
|---|---|
| All `season_tags` include `summer` | "Make warmer", "Add a layer" |
| All `season_tags` include `winter` | "Make lighter", "Remove a layer" |
| Average `formality` >= 4 | "More casual", "Weekend version" |
| Average `formality` <= 2 | "Dress it up", "Date night version" |
| Has outerwear | "Swap the jacket", "Remove outerwear" |
| No outerwear | "Add outerwear", "Add a layer" |

**Always-present chips:**
- **"Something fresh"** — sends "Use garments I haven't worn recently" (feeds into `use_less_worn` refinement hint)
- **"Different vibe"** — sends "Show me a completely different style direction"
- **"← Undo"** — appears after any refinement, reverts to previous outfit version

### Tap-to-Lock

- In refine mode, tapping a garment in the card toggles a gold lock icon
- Locked garment IDs are sent as `locked_slots` in the next request
- Backend respects locks: only swaps unlocked garments
- Visual: locked garments have a small gold lock badge, unlocked garments have a subtle "unlocked" state

### Outfit Version History

In-memory array (not persisted to DB) tracking outfit states during a refine session:

```typescript
const [outfitHistory, setOutfitHistory] = useState<OutfitVersion[]>([]);

interface OutfitVersion {
  garmentIds: string[];
  explanation: string;
  timestamp: number;
}
```

- Each refinement pushes the previous state to the array
- "← Undo" pops the last state and restores it as active look
- History clears when refine mode exits or a new outfit is generated
- Max 10 versions (older ones drop off)

### Refine Flow

```
User sees outfit card
    ↓
Taps "Refine"
    ↓
Card enters refine mode:
  - Gold border on card
  - Context-aware chips appear below
  - "Refining this look" banner above input
  - Garments become tappable to lock/unlock
    ↓
User either:
  A) Taps a chip → sends pre-written message
  B) Types freely with full outfit as context
  C) Locks some garments first, then A or B
    ↓
Classifier: intent=refine_outfit, locked_slots=[user-locked items]
Main AI: generates updated outfit respecting locks
    ↓
New outfit card replaces current card in refine mode
Changed garments briefly highlighted (gold flash, 600ms)
"← Undo" chip appears
Still in refine mode — user can keep iterating
    ↓
User taps "✕ Stop refining" or sends a non-refine message
    ↓
Refine mode exits, final outfit stays as active look
```

---

## Image Message Handling

The classifier handles three cases:

| Input | Classifier behavior | Main AI behavior |
|---|---|---|
| Text only | Normal classification | Normal response |
| Image + text | Classify based on text portion, note `has_image: true` | Full multimodal analysis with image |
| Image only (no text) | Default: `generate_outfit` + `needs_more_context: true` | "What are you looking for with this? Inspiration, or should I find something similar from your wardrobe?" |

No structural change to the classifier — just prompt awareness that images may be present.

---

## Empty / Insufficient Wardrobe

Handled as a pre-filter before the classifier, using `garment_count`:

| Garment count | Behavior |
|---|---|
| 0 | AI responds: "Your wardrobe is empty — add some garments first and I'll help you style them!" No outfit generation attempted. |
| 1-4 | AI can suggest but prefixes: "Working with a small wardrobe here — add more items for better outfit combinations." Outfit generation allowed but may produce incomplete outfits. |
| 5+ | Normal behavior |

---

## Conversation Memory

### Within a Session

- Classifier receives last 2 messages for intent context
- Main AI receives full conversation history (existing behavior)
- Outfit version history tracked in-memory for undo support (max 10 versions)

### Across Sessions

- On new session start, load last 10 messages from `chat_messages` as context for both classifier and main AI
- Long-term preference learning (e.g., "I hate bright colors" persisting across months) is out of scope for this redesign — that belongs in `feedback_signals` / `style_dna` as a separate feature

---

## Multiple Outfits / Clean Break

When the classifier detects `generate_outfit` while an active look exists, it evaluates whether this is a new context:

- **Same context refinement:** "Make it more casual" → `clear_active_look: false`, maps to `refine_outfit`
- **New context:** "Now something for Friday night" → `clear_active_look: true`, generates fresh

Client behavior on `clear_active_look: true`:
1. Exit refine mode if active
2. Clear active look state
3. Clear outfit version history
4. Previous outfit card stays in chat history (scrolled up) but is no longer interactive for refinement

---

## Files Changed

### Edge Function (deploy required)

| File | Change |
|---|---|
| `supabase/functions/style_chat/index.ts` | Replace regex intent detection with classifier call. Delete `detectStylistChatMode()`, `detectRefinementIntent()`, and related regex constants. Add `classifyIntent()` function. Preserve all other logic (streaming, normalization, rate limiting, prompt building). |
| `supabase/functions/_shared/style-chat-contract.ts` | Remove `detectStylistChatModeFromSignals()`. Add classifier response type. Keep mode constants, card policy logic, and all type definitions. |

### Client (Vercel deploy via git push)

| File | Change |
|---|---|
| `src/pages/AIChat.tsx` | Add refine mode state. Send `locked_slots` in request. Handle `clear_active_look` in response. Add "Refining this look" banner. Track outfit version history for undo. |
| `src/components/chat/OutfitSuggestionCard.tsx` | Add full-card "Refine" button. Add "Save" button. Add tap-to-lock on garments in refine mode. Add context-aware chip generation logic. Add change-highlight animation on garment swap. |
| `src/components/chat/ChatMessage.tsx` | Pass refine mode state to `OutfitSuggestionCard`. No structural changes. |

### Files NOT Changed

- `_shared/style-chat-normalizer.ts` — unchanged
- `_shared/unified_stylist_engine.ts` — unchanged
- `_shared/burs-ai.ts` — called, not changed
- `_shared/scale-guard.ts` — called, not changed
- `_shared/cors.ts` — not touched
- All other edge functions — unaffected
- All other pages — unaffected
- `src/integrations/supabase/types.ts` — auto-generated, not touched
- `src/i18n/locales/en.ts` / `sv.ts` — append new keys only

### New i18n Keys (appended to en.ts and sv.ts)

```
chat.refine — "Refine"
chat.save — "Save"
chat.saved — "Saved"
chat.refining_look — "Refining this look"
chat.stop_refining — "Stop refining"
chat.undo — "Undo"
chat.something_fresh — "Something fresh"
chat.different_vibe — "Different vibe"
chat.make_warmer — "Make warmer"
chat.make_lighter — "Make lighter"
chat.dress_it_up — "Dress it up"
chat.more_casual — "More casual"
chat.add_layer — "Add a layer"
chat.remove_layer — "Remove a layer"
chat.swap_jacket — "Swap the jacket"
chat.add_outerwear — "Add outerwear"
chat.date_night — "Date night version"
chat.weekend_version — "Weekend version"
chat.empty_wardrobe — "Your wardrobe is empty — add some garments first and I'll help you style them!"
chat.small_wardrobe — "Working with a small wardrobe — add more items for better combinations."
```

---

## Design Constraints

- **No new npm packages** — uses existing Framer Motion for animations, existing UI components
- **No new edge functions** — classifier is a `callBursAI()` call within `style_chat`
- **No DB migrations** — outfit save uses existing `outfits` + `outfit_items` tables
- **No changes to Median-specific code** — `useMedianCamera.ts`, `useMedianStatusBar.ts`, `src/lib/median.ts` untouched
- **Insights.tsx remains frozen** — untouched
- **Response envelope shape unchanged** — `AIChat.tsx` SSE parsing stays identical, with one new optional field: `clear_active_look: boolean`
- **Rate limits unchanged** — style_chat stays at 60/hour, 15/minute. Classifier call does not count as a separate rate-limited call (it's internal to the function).
