# Style Chat Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace regex-based intent detection with an AI classifier and add a full-outfit refine flow with tap-to-lock, context-aware chips, save-from-chat, and undo.

**Architecture:** Two-pass AI: a ~50-token Flash Lite classifier (Pass 1) determines intent before the main stylist response (Pass 2). The client adds refine mode UI state that sends `locked_slots` and handles `clear_active_look`. The response envelope gains one optional boolean field (`clear_active_look`).

**Tech Stack:** Deno edge functions (Supabase), React 18 + TypeScript 5.8, Framer Motion, TanStack React Query, Radix/shadcn UI, Tailwind CSS.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/functions/_shared/style-chat-classifier.ts` | **Create** | Intent classifier: `classifyIntent()` function, classifier prompt, types, fallback logic |
| `supabase/functions/_shared/style-chat-contract.ts` | **Modify** | Add `ClassifierResult` type, add `clear_active_look` to envelope, remove `detectStylistChatModeFromSignals()` and its regex constants |
| `supabase/functions/style_chat/index.ts` | **Modify** | Replace `detectRefinementIntent()` + `detectStylistChatMode()` with classifier call. Wire `locked_slots` + `clear_active_look` through. Keep SHORT_RE fast path. |
| `src/hooks/useRefineMode.ts` | **Create** | Refine mode state: outfit history, locked slots, chip generation, undo |
| `src/components/chat/OutfitSuggestionCard.tsx` | **Modify** | Add Refine button, Save button, tap-to-lock, change-highlight animation |
| `src/components/chat/RefineChips.tsx` | **Create** | Context-aware chip bar component |
| `src/components/chat/RefineBanner.tsx` | **Create** | "Refining this look" banner above chat input |
| `src/pages/AIChat.tsx` | **Modify** | Wire refine mode hook, send `locked_slots`, handle `clear_active_look`, show banner/chips |
| `src/components/chat/ChatMessage.tsx` | **Modify** | Pass refine mode props to OutfitSuggestionCard |
| `src/lib/styleChatContract.ts` | **Modify** | Mirror `clear_active_look` addition to client-side type |
| `src/i18n/locales/en.ts` | **Modify** | Append new chat.* keys |
| `src/i18n/locales/sv.ts` | **Modify** | Append new chat.* keys |

### Test Files

| File | Tests |
|------|-------|
| `supabase/functions/_shared/__tests__/style-chat-classifier.test.ts` | **Create** — classifier prompt parsing, fallback on bad JSON, timeout default, intent mapping |
| `src/hooks/__tests__/useRefineMode.test.ts` | **Create** — outfit history push/pop, lock toggle, chip generation, max 10 versions |
| `src/components/chat/__tests__/RefineChips.test.tsx` | **Create** — chip rendering based on garment properties |

---

## Task 1: Classifier Types & Contract Updates (Backend)

**Files:**
- Modify: `supabase/functions/_shared/style-chat-contract.ts`
- Test: `supabase/functions/_shared/__tests__/style-chat-classifier.test.ts` (create)

- [ ] **Step 1: Write the classifier result type test**

Create the test file. We're testing that the type and mapping function work correctly.

```typescript
// supabase/functions/_shared/__tests__/style-chat-classifier.test.ts
import { describe, it, expect } from "https://deno.land/std@0.220.0/testing/bdd.ts";
import {
  mapClassifierToMode,
  CLASSIFIER_FALLBACK,
  type ClassifierResult,
} from "../style-chat-contract.ts";

describe("ClassifierResult", () => {
  it("maps generate_outfit without anchor to OUTFIT_GENERATION", () => {
    const result: ClassifierResult = {
      intent: "generate_outfit",
      needs_more_context: false,
      refinement_hint: null,
      locked_slots: null,
      clear_active_look: false,
    };
    expect(mapClassifierToMode(result, false)).toBe("OUTFIT_GENERATION");
  });

  it("maps generate_outfit with anchor to GARMENT_FIRST_STYLING", () => {
    const result: ClassifierResult = {
      intent: "generate_outfit",
      needs_more_context: false,
      refinement_hint: null,
      locked_slots: null,
      clear_active_look: false,
    };
    expect(mapClassifierToMode(result, true)).toBe("GARMENT_FIRST_STYLING");
  });

  it("maps refine_outfit to ACTIVE_LOOK_REFINEMENT", () => {
    const result: ClassifierResult = {
      intent: "refine_outfit",
      needs_more_context: false,
      refinement_hint: "warmer",
      locked_slots: ["top"],
      clear_active_look: false,
    };
    expect(mapClassifierToMode(result, false)).toBe("ACTIVE_LOOK_REFINEMENT");
  });

  it("maps explain_outfit to LOOK_EXPLANATION", () => {
    const result: ClassifierResult = {
      intent: "explain_outfit",
      needs_more_context: false,
      refinement_hint: null,
      locked_slots: null,
      clear_active_look: false,
    };
    expect(mapClassifierToMode(result, false)).toBe("LOOK_EXPLANATION");
  });

  it("maps conversation to CONVERSATIONAL", () => {
    const result: ClassifierResult = {
      intent: "conversation",
      needs_more_context: false,
      refinement_hint: null,
      locked_slots: null,
      clear_active_look: false,
    };
    expect(mapClassifierToMode(result, false)).toBe("CONVERSATIONAL");
  });

  it("CLASSIFIER_FALLBACK defaults to conversation with needs_more_context", () => {
    expect(CLASSIFIER_FALLBACK.intent).toBe("conversation");
    expect(CLASSIFIER_FALLBACK.needs_more_context).toBe(true);
    expect(CLASSIFIER_FALLBACK.clear_active_look).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase/functions && deno test _shared/__tests__/style-chat-classifier.test.ts --allow-net --allow-read`
Expected: FAIL — `mapClassifierToMode` and `CLASSIFIER_FALLBACK` don't exist yet.

- [ ] **Step 3: Add ClassifierResult type, mapping function, and fallback constant**

In `supabase/functions/_shared/style-chat-contract.ts`, append after the existing `StyleChatIntentKind` type (around line 20):

```typescript
// ── Intent classifier types (replaces regex-based detection) ──

export type ClassifierIntent = "conversation" | "generate_outfit" | "refine_outfit" | "explain_outfit";

export type RefinementHint =
  | "warmer" | "cooler" | "more_formal" | "less_formal"
  | "swap_shoes" | "swap_top" | "swap_bottom" | "swap_outerwear"
  | "different_style" | "use_less_worn"
  | null;

export interface ClassifierResult {
  intent: ClassifierIntent;
  needs_more_context: boolean;
  refinement_hint: RefinementHint;
  locked_slots: string[] | null;
  clear_active_look: boolean;
}

export const CLASSIFIER_FALLBACK: ClassifierResult = {
  intent: "conversation",
  needs_more_context: true,
  refinement_hint: null,
  locked_slots: null,
  clear_active_look: false,
};

/**
 * Maps classifier output to the existing StylistChatMode constants.
 * Specialty modes (PURCHASE_PRIORITIZATION, etc.) are handled by the
 * classifier prompt directly — they output as the `intent` field with
 * the mode name. This function handles the core 4 intents.
 */
export function mapClassifierToMode(
  result: ClassifierResult,
  hasAnchor: boolean,
): StylistChatMode {
  switch (result.intent) {
    case "conversation":
      return "CONVERSATIONAL";
    case "generate_outfit":
      return hasAnchor ? "GARMENT_FIRST_STYLING" : "OUTFIT_GENERATION";
    case "refine_outfit":
      return "ACTIVE_LOOK_REFINEMENT";
    case "explain_outfit":
      return "LOOK_EXPLANATION";
    default:
      return "CONVERSATIONAL";
  }
}
```

- [ ] **Step 4: Add `clear_active_look` to StyleChatResponseEnvelope**

In the same file, add `clear_active_look: boolean;` to `StyleChatResponseEnvelope` after the `render_outfit_card` field:

```typescript
  render_outfit_card: boolean;
  clear_active_look: boolean;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd supabase/functions && deno test _shared/__tests__/style-chat-classifier.test.ts --allow-net --allow-read`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/style-chat-contract.ts supabase/functions/_shared/__tests__/style-chat-classifier.test.ts
git commit -m "feat: add ClassifierResult types and mapClassifierToMode to style-chat-contract"
```

---

## Task 2: Classifier Function (Backend)

**Files:**
- Create: `supabase/functions/_shared/style-chat-classifier.ts`
- Modify test: `supabase/functions/_shared/__tests__/style-chat-classifier.test.ts`

- [ ] **Step 1: Write tests for classifyIntent**

Append to the existing test file:

```typescript
import { classifyIntent, buildClassifierPrompt } from "../style-chat-classifier.ts";

describe("buildClassifierPrompt", () => {
  it("includes user message in the prompt", () => {
    const prompt = buildClassifierPrompt({
      userMessage: "Make it warmer",
      hasActiveLook: true,
      hasAnchor: false,
      garmentCount: 12,
      lastMessages: [],
      lockedSlots: [],
    });
    expect(prompt).toContain("Make it warmer");
    expect(prompt).toContain("has_active_look: true");
  });

  it("includes locked slots when provided", () => {
    const prompt = buildClassifierPrompt({
      userMessage: "swap the shoes",
      hasActiveLook: true,
      hasAnchor: false,
      garmentCount: 8,
      lastMessages: [],
      lockedSlots: ["top", "bottom"],
    });
    expect(prompt).toContain("locked_slots: top, bottom");
  });
});

describe("classifyIntent", () => {
  it("returns CLASSIFIER_FALLBACK when AI response is not valid JSON", async () => {
    // classifyIntent accepts a callAI function for testability
    const mockCallAI = async () => "this is not json";
    const result = await classifyIntent({
      userMessage: "hello",
      hasActiveLook: false,
      hasAnchor: false,
      garmentCount: 5,
      lastMessages: [],
      lockedSlots: [],
    }, mockCallAI);
    expect(result.intent).toBe("conversation");
    expect(result.needs_more_context).toBe(true);
  });

  it("parses valid classifier JSON response", async () => {
    const mockCallAI = async () => JSON.stringify({
      intent: "refine_outfit",
      needs_more_context: false,
      refinement_hint: "warmer",
      locked_slots: ["top"],
      clear_active_look: false,
    });
    const result = await classifyIntent({
      userMessage: "make it warmer",
      hasActiveLook: true,
      hasAnchor: false,
      garmentCount: 10,
      lastMessages: [],
      lockedSlots: [],
    }, mockCallAI);
    expect(result.intent).toBe("refine_outfit");
    expect(result.refinement_hint).toBe("warmer");
    expect(result.locked_slots).toEqual(["top"]);
  });

  it("returns fallback when intent is not a valid enum value", async () => {
    const mockCallAI = async () => JSON.stringify({
      intent: "invalid_intent",
      needs_more_context: false,
      refinement_hint: null,
      locked_slots: null,
      clear_active_look: false,
    });
    const result = await classifyIntent({
      userMessage: "something weird",
      hasActiveLook: false,
      hasAnchor: false,
      garmentCount: 5,
      lastMessages: [],
      lockedSlots: [],
    }, mockCallAI);
    expect(result.intent).toBe("conversation");
    expect(result.needs_more_context).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase/functions && deno test _shared/__tests__/style-chat-classifier.test.ts --allow-net --allow-read`
Expected: FAIL — `classifyIntent` and `buildClassifierPrompt` don't exist.

- [ ] **Step 3: Implement the classifier module**

Create `supabase/functions/_shared/style-chat-classifier.ts`:

```typescript
import { CLASSIFIER_FALLBACK, type ClassifierResult, type ClassifierIntent, type RefinementHint } from "./style-chat-contract.ts";

const VALID_INTENTS: Set<string> = new Set([
  "conversation", "generate_outfit", "refine_outfit", "explain_outfit",
  // Specialty modes the classifier can also output:
  "PURCHASE_PRIORITIZATION", "WARDROBE_GAP_ANALYSIS", "PLANNING", "STYLE_IDENTITY_ANALYSIS",
]);

const VALID_HINTS: Set<string> = new Set([
  "warmer", "cooler", "more_formal", "less_formal",
  "swap_shoes", "swap_top", "swap_bottom", "swap_outerwear",
  "different_style", "use_less_worn",
]);

export interface ClassifierInput {
  userMessage: string;
  hasActiveLook: boolean;
  hasAnchor: boolean;
  garmentCount: number;
  lastMessages: Array<{ role: string; text: string }>;
  lockedSlots: string[];
}

export type CallAIFn = (messages: Array<{ role: string; content: string }>, complexity: string) => Promise<string>;

export function buildClassifierPrompt(input: ClassifierInput): string {
  const contextLines = input.lastMessages
    .map((m) => `${m.role}: ${m.text.slice(0, 150)}`)
    .join("\n");

  return `You are an intent classifier for a personal stylist AI. Classify the user's message.

Context:
- has_active_look: ${input.hasActiveLook}
- has_anchor: ${input.hasAnchor}
- garment_count: ${input.garmentCount}
- locked_slots: ${input.lockedSlots.length > 0 ? input.lockedSlots.join(", ") : "none"}
${contextLines ? `- recent_conversation:\n${contextLines}` : ""}

User message: "${input.userMessage}"

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "intent": "conversation | generate_outfit | refine_outfit | explain_outfit",
  "needs_more_context": true | false,
  "refinement_hint": "warmer | cooler | more_formal | less_formal | swap_shoes | swap_top | swap_bottom | swap_outerwear | different_style | use_less_worn | null",
  "locked_slots": ["slot1", "slot2"] | null,
  "clear_active_look": true | false
}

Rules:
- "conversation" = greeting, fashion question, unclear request, or user needs to provide more info
- "generate_outfit" = user explicitly asks for an outfit AND enough context exists. If context is vague (e.g. "I have a wedding"), set needs_more_context=true
- "refine_outfit" = active look exists AND user wants to modify it (warmer, swap shoes, more casual, etc.)
- "explain_outfit" = user asks about current look's styling logic (why does this work, what shoes go better)
- If has_active_look=false and user says "make it warmer" or similar refinement language, use intent="conversation" + needs_more_context=true (nothing to refine)
- clear_active_look=true ONLY when user starts a completely new outfit context unrelated to current look (e.g. "now something for Friday night" while viewing a work outfit)
- For purchase advice: use intent "PURCHASE_PRIORITIZATION"
- For wardrobe gaps/audits: use intent "WARDROBE_GAP_ANALYSIS"
- For weekly planning: use intent "PLANNING"
- For style identity questions: use intent "STYLE_IDENTITY_ANALYSIS"`;
}

function parseClassifierResponse(raw: string): ClassifierResult {
  // Try to extract JSON from the response (handle markdown code blocks)
  let jsonStr = raw.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

  const parsed = JSON.parse(jsonStr);

  // Validate intent
  if (!parsed.intent || !VALID_INTENTS.has(parsed.intent)) {
    return CLASSIFIER_FALLBACK;
  }

  // Map specialty modes back to "conversation" intent (they're handled separately)
  let intent: ClassifierIntent = parsed.intent as ClassifierIntent;
  if (!["conversation", "generate_outfit", "refine_outfit", "explain_outfit"].includes(intent)) {
    // It's a specialty mode string — keep it, but the mapClassifierToMode won't handle it.
    // The caller in index.ts will check for specialty mode strings before calling mapClassifierToMode.
    intent = parsed.intent;
  }

  const hint = parsed.refinement_hint && VALID_HINTS.has(parsed.refinement_hint)
    ? parsed.refinement_hint as RefinementHint
    : null;

  const lockedSlots = Array.isArray(parsed.locked_slots)
    ? parsed.locked_slots.filter((s: unknown) => typeof s === "string")
    : null;

  return {
    intent,
    needs_more_context: Boolean(parsed.needs_more_context),
    refinement_hint: hint,
    locked_slots: lockedSlots?.length ? lockedSlots : null,
    clear_active_look: Boolean(parsed.clear_active_look),
  };
}

/**
 * Classify user intent via a lightweight AI call.
 * Accepts a `callAI` function for testability — in production this is
 * a thin wrapper around `callBursAI()`.
 */
export async function classifyIntent(
  input: ClassifierInput,
  callAI: CallAIFn,
): Promise<ClassifierResult> {
  try {
    const prompt = buildClassifierPrompt(input);
    const raw = await callAI(
      [
        { role: "system", content: prompt },
        { role: "user", content: input.userMessage },
      ],
      "trivial",
    );
    return parseClassifierResponse(raw);
  } catch {
    return CLASSIFIER_FALLBACK;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd supabase/functions && deno test _shared/__tests__/style-chat-classifier.test.ts --allow-net --allow-read`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/style-chat-classifier.ts supabase/functions/_shared/__tests__/style-chat-classifier.test.ts
git commit -m "feat: implement classifyIntent for style chat AI-based intent detection"
```

---

## Task 3: Wire Classifier Into style_chat Edge Function

**Files:**
- Modify: `supabase/functions/style_chat/index.ts`

This is the biggest single change. We replace `detectRefinementIntent()` (lines 684-751), `detectStylistChatMode()` (lines 754-778), and the references to `detectStylistChatModeFromSignals` with the new classifier. The SHORT_RE fast path stays.

- [ ] **Step 1: Delete `detectRefinementIntent()` function**

Remove lines 684-751 (the entire `detectRefinementIntent` function with its 20+ regex patterns). Also remove the `RefinementIntent` type if it's defined in index.ts (check near line 40-60 for `interface RefinementIntent`).

- [ ] **Step 2: Delete `detectStylistChatMode()` function**

Remove lines 754-778 (the entire `detectStylistChatMode` function). This also means removing the import of `detectStylistChatModeFromSignals` from `style-chat-contract.ts`.

- [ ] **Step 3: Add classifier imports**

At the top of `index.ts`, add:

```typescript
import { classifyIntent, type ClassifierInput } from "../_shared/style-chat-classifier.ts";
import { mapClassifierToMode, CLASSIFIER_FALLBACK, type ClassifierResult } from "../_shared/style-chat-contract.ts";
```

- [ ] **Step 4: Add `locked_slots` to request body parsing**

Find where the request body is parsed (look for `selected_garment_ids` destructuring). Add `locked_slots` to the destructured fields:

```typescript
const { messages, locale, garmentCount, archetype, selected_garment_ids, active_look: explicitActiveLook, locked_slots } = await req.json();
```

- [ ] **Step 5: Add classifier call after fast path, before DB queries**

After the quick conversational fast path (around line 1130, after `return createSseTextResponse(quickEnvelope);`), add the classifier call. This replaces the old `detectRefinementIntent()` + `detectStylistChatMode()` calls:

```typescript
    // ── Intent classification (Pass 1) ──
    const hasActiveLookForClassifier = Array.isArray(explicitActiveLook?.garment_ids) && explicitActiveLook.garment_ids.length >= 2;
    const hasAnchorForClassifier = Array.isArray(selected_garment_ids) && selected_garment_ids.length > 0;

    // Pre-filter: no garments → skip classifier
    const garmentCountNum = typeof garmentCount === "number" ? garmentCount : 0;
    let classifierResult: ClassifierResult;

    if (garmentCountNum === 0) {
      classifierResult = {
        ...CLASSIFIER_FALLBACK,
        needs_more_context: false,  // We know what to say: "add garments first"
      };
    } else {
      // Build context for classifier
      const lastTwoMessages = safeMessagesQuick
        .filter((m: any) => m.role === "user" || m.role === "assistant")
        .slice(-2)
        .map((m: any) => ({
          role: m.role as string,
          text: typeof m.content === "string" ? m.content.slice(0, 150) : "",
        }));

      const classifierInput: ClassifierInput = {
        userMessage: latestUserText,
        hasActiveLook: hasActiveLookForClassifier,
        hasAnchor: hasAnchorForClassifier,
        garmentCount: garmentCountNum,
        lastMessages: lastTwoMessages,
        lockedSlots: Array.isArray(locked_slots) ? locked_slots : [],
      };

      // 3-second hard timeout for classifier
      const classifierPromise = classifyIntent(classifierInput, async (msgs, complexity) => {
        const resp = await callBursAI({
          functionName: "style_chat",
          messages: msgs.map((m) => ({ role: m.role as "system" | "user", content: m.content })),
          complexity: complexity as "trivial",
          cacheTtlSeconds: 0,
          cacheNamespace: "style_chat_classifier",
        });
        return typeof resp.data === "string" ? resp.data : "";
      });

      const timeoutPromise = new Promise<ClassifierResult>((resolve) =>
        setTimeout(() => resolve(CLASSIFIER_FALLBACK), 3000)
      );

      classifierResult = await Promise.race([classifierPromise, timeoutPromise]);
    }

    // Check for specialty mode strings from classifier
    const specialtyModes = new Set(["PURCHASE_PRIORITIZATION", "WARDROBE_GAP_ANALYSIS", "PLANNING", "STYLE_IDENTITY_ANALYSIS"]);
    const chatMode: StylistChatMode = specialtyModes.has(classifierResult.intent as string)
      ? classifierResult.intent as StylistChatMode
      : mapClassifierToMode(classifierResult, hasAnchorForClassifier);
```

- [ ] **Step 6: Replace old mode variable references**

Find where the old code assigns `chatMode` (or equivalent variable name — might be called `mode` or `stylistMode`). Search for calls to `detectStylistChatMode(` and `detectRefinementIntent(`. Replace them with the new `chatMode` and `classifierResult` from Step 5.

The old pattern was:
```typescript
const refinementIntent = detectRefinementIntent(safeMessages);
const chatMode = detectStylistChatMode({ messages: safeMessages, activeLook, anchor, refinementIntent });
```

Replace with just the classifier result computed in Step 5 (the new `chatMode` variable).

Where `refinementIntent.mode` was used in prompt building, replace with `classifierResult.refinement_hint ?? "new_look"`.

- [ ] **Step 7: Add `clear_active_look` to the response envelope**

Find where `quickEnvelope` and the main response envelope are constructed. Add `clear_active_look` field:

For the quick conversational envelope (already exists around line 1099):
```typescript
clear_active_look: false,
```

For the main response envelope (search for `kind: "stylist_response"` in the main flow):
```typescript
clear_active_look: classifierResult.clear_active_look,
```

- [ ] **Step 8: Wire `locked_slots` into the active look context**

Where the active look context is built (around line 781, `buildActiveLookContext`), pass `locked_slots` so the AI prompt knows which garments are locked:

Find where the system prompt is built for the main AI call. Add locked slots info:
```typescript
const lockedSlotsInfo = Array.isArray(locked_slots) && locked_slots.length > 0
  ? `\nThe user has LOCKED these garments (do NOT swap them): ${locked_slots.join(", ")}. Only swap unlocked garments.`
  : "";
```

Append `lockedSlotsInfo` to the relevant system prompt section.

- [ ] **Step 9: Add empty wardrobe hint**

When `garmentCountNum === 0`, add a system hint to the main AI prompt:
```typescript
const emptyWardrobeHint = garmentCountNum === 0
  ? "\nThe user's wardrobe is empty. Tell them to add garments first. Do NOT attempt outfit generation."
  : garmentCountNum <= 4
    ? "\nThe user has very few garments. Mention they should add more for better combinations."
    : "";
```

- [ ] **Step 10: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: 0 errors

- [ ] **Step 11: Commit**

```bash
git add supabase/functions/style_chat/index.ts
git commit -m "feat: replace regex intent detection with AI classifier in style_chat"
```

---

## Task 4: Remove Dead Regex Code from Contract

**Files:**
- Modify: `supabase/functions/_shared/style-chat-contract.ts`

- [ ] **Step 1: Delete `detectStylistChatModeFromSignals()` and its regex constants**

Remove these items from `style-chat-contract.ts`:
- `LOOK_EXPLANATION_RE` (line 88)
- `GARMENT_FIRST_RE` (line 89)
- `CREATE_LOOK_RE` (line 90)
- `CONTEXT_DEPENDENT_STYLE_RE` (line 91)
- `resolveStyleChatIntentFromSignals()` function (lines 93-127)
- `detectStylistChatModeFromSignals()` function (lines 129-166)

Keep everything else: types, enums, `resolveStyleCardPolicy`, `resolveStyleCardState`, `resolveActiveLookStatus`, `resolveStyleResponseKind`, `shouldRenderStyleCard`, `shouldRenderStyleCardFromPolicy`, `isStylingMode`, `mapClassifierToMode`, `CLASSIFIER_FALLBACK`.

Also keep the `StyleChatIntentKind` type — it may be used elsewhere.

- [ ] **Step 2: Verify no other files import the deleted functions**

Search for `detectStylistChatModeFromSignals` and `resolveStyleChatIntentFromSignals` across the codebase. If `style_chat/index.ts` was the only consumer (which it was after Task 3), we're safe.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/style-chat-contract.ts
git commit -m "refactor: remove dead regex intent detection from style-chat-contract"
```

---

## Task 5: Client-Side Contract Update

**Files:**
- Modify: `src/lib/styleChatContract.ts`

- [ ] **Step 1: Add `clear_active_look` to the client-side envelope type**

Find the `StyleChatResponseEnvelope` interface in `src/lib/styleChatContract.ts` and add:

```typescript
clear_active_look: boolean;
```

Also add it to the `isStyleChatResponseEnvelope` type guard if one exists.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: 0 errors (or fix any references that now expect this field)

- [ ] **Step 3: Commit**

```bash
git add src/lib/styleChatContract.ts
git commit -m "feat: add clear_active_look to client-side StyleChatResponseEnvelope"
```

---

## Task 6: Refine Mode Hook

**Files:**
- Create: `src/hooks/useRefineMode.ts`
- Create: `src/hooks/__tests__/useRefineMode.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/hooks/__tests__/useRefineMode.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRefineMode } from '../useRefineMode';

describe('useRefineMode', () => {
  it('starts with refine mode off', () => {
    const { result } = renderHook(() => useRefineMode());
    expect(result.current.isRefining).toBe(false);
    expect(result.current.lockedSlots).toEqual([]);
    expect(result.current.outfitHistory).toEqual([]);
  });

  it('enters refine mode with garment IDs', () => {
    const { result } = renderHook(() => useRefineMode());
    act(() => {
      result.current.enterRefineMode(['g1', 'g2', 'g3'], 'A nice outfit');
    });
    expect(result.current.isRefining).toBe(true);
    expect(result.current.activeGarmentIds).toEqual(['g1', 'g2', 'g3']);
  });

  it('toggles lock on a slot', () => {
    const { result } = renderHook(() => useRefineMode());
    act(() => {
      result.current.enterRefineMode(['g1', 'g2'], 'test');
    });
    act(() => {
      result.current.toggleLock('g1');
    });
    expect(result.current.lockedSlots).toEqual(['g1']);
    act(() => {
      result.current.toggleLock('g1');
    });
    expect(result.current.lockedSlots).toEqual([]);
  });

  it('pushes outfit history on refinement and supports undo', () => {
    const { result } = renderHook(() => useRefineMode());
    act(() => {
      result.current.enterRefineMode(['g1', 'g2'], 'first');
    });
    act(() => {
      result.current.pushRefinement(['g1', 'g3'], 'swapped bottom');
    });
    expect(result.current.activeGarmentIds).toEqual(['g1', 'g3']);
    expect(result.current.outfitHistory).toHaveLength(1);

    act(() => {
      result.current.undo();
    });
    expect(result.current.activeGarmentIds).toEqual(['g1', 'g2']);
    expect(result.current.outfitHistory).toHaveLength(0);
  });

  it('caps history at 10 versions', () => {
    const { result } = renderHook(() => useRefineMode());
    act(() => {
      result.current.enterRefineMode(['g0'], 'start');
    });
    for (let i = 1; i <= 12; i++) {
      act(() => {
        result.current.pushRefinement([`g${i}`], `version ${i}`);
      });
    }
    expect(result.current.outfitHistory.length).toBeLessThanOrEqual(10);
  });

  it('exits refine mode and clears state', () => {
    const { result } = renderHook(() => useRefineMode());
    act(() => {
      result.current.enterRefineMode(['g1', 'g2'], 'test');
      result.current.toggleLock('g1');
    });
    act(() => {
      result.current.exitRefineMode();
    });
    expect(result.current.isRefining).toBe(false);
    expect(result.current.lockedSlots).toEqual([]);
    expect(result.current.outfitHistory).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useRefineMode.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement useRefineMode**

Create `src/hooks/useRefineMode.ts`:

```typescript
import { useState, useCallback } from 'react';

export interface OutfitVersion {
  garmentIds: string[];
  explanation: string;
  timestamp: number;
}

const MAX_HISTORY = 10;

export function useRefineMode() {
  const [isRefining, setIsRefining] = useState(false);
  const [activeGarmentIds, setActiveGarmentIds] = useState<string[]>([]);
  const [activeExplanation, setActiveExplanation] = useState('');
  const [lockedSlots, setLockedSlots] = useState<string[]>([]);
  const [outfitHistory, setOutfitHistory] = useState<OutfitVersion[]>([]);

  const enterRefineMode = useCallback((garmentIds: string[], explanation: string) => {
    setIsRefining(true);
    setActiveGarmentIds(garmentIds);
    setActiveExplanation(explanation);
    setLockedSlots([]);
    setOutfitHistory([]);
  }, []);

  const exitRefineMode = useCallback(() => {
    setIsRefining(false);
    setActiveGarmentIds([]);
    setActiveExplanation('');
    setLockedSlots([]);
    setOutfitHistory([]);
  }, []);

  const toggleLock = useCallback((garmentId: string) => {
    setLockedSlots((prev) =>
      prev.includes(garmentId)
        ? prev.filter((id) => id !== garmentId)
        : [...prev, garmentId],
    );
  }, []);

  const pushRefinement = useCallback((newGarmentIds: string[], newExplanation: string) => {
    setOutfitHistory((prev) => {
      const entry: OutfitVersion = {
        garmentIds: activeGarmentIds,
        explanation: activeExplanation,
        timestamp: Date.now(),
      };
      const next = [...prev, entry];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
    setActiveGarmentIds(newGarmentIds);
    setActiveExplanation(newExplanation);
  }, [activeGarmentIds, activeExplanation]);

  const undo = useCallback(() => {
    setOutfitHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setActiveGarmentIds(last.garmentIds);
      setActiveExplanation(last.explanation);
      return prev.slice(0, -1);
    });
  }, []);

  const canUndo = outfitHistory.length > 0;

  return {
    isRefining,
    activeGarmentIds,
    activeExplanation,
    lockedSlots,
    outfitHistory,
    canUndo,
    enterRefineMode,
    exitRefineMode,
    toggleLock,
    pushRefinement,
    undo,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/__tests__/useRefineMode.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRefineMode.ts src/hooks/__tests__/useRefineMode.test.ts
git commit -m "feat: add useRefineMode hook with outfit history, lock toggle, and undo"
```

---

## Task 7: Context-Aware Chips Component

**Files:**
- Create: `src/components/chat/RefineChips.tsx`
- Create: `src/components/chat/__tests__/RefineChips.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// src/components/chat/__tests__/RefineChips.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RefineChips } from '../RefineChips';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';

// Mock useLanguage
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

function makeGarment(overrides: Partial<GarmentBasic> & { id: string }): GarmentBasic {
  return {
    title: 'Test',
    category: 'top',
    color_primary: 'black',
    image_path: null,
    original_image_path: null,
    processed_image_path: null,
    image_processing_status: null,
    rendered_image_path: null,
    render_status: null,
    ...overrides,
  } as GarmentBasic;
}

describe('RefineChips', () => {
  it('shows "Something fresh" and "Different vibe" always', () => {
    const onChip = vi.fn();
    render(<RefineChips garments={[makeGarment({ id: '1' })]} onChipTap={onChip} canUndo={false} onUndo={() => {}} />);
    expect(screen.getByText('chat.something_fresh')).toBeTruthy();
    expect(screen.getByText('chat.different_vibe')).toBeTruthy();
  });

  it('shows undo chip when canUndo is true', () => {
    const onUndo = vi.fn();
    render(<RefineChips garments={[]} onChipTap={() => {}} canUndo={true} onUndo={onUndo} />);
    const undoBtn = screen.getByText('chat.undo');
    fireEvent.click(undoBtn);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('fires onChipTap with message text when tapped', () => {
    const onChip = vi.fn();
    render(<RefineChips garments={[makeGarment({ id: '1' })]} onChipTap={onChip} canUndo={false} onUndo={() => {}} />);
    fireEvent.click(screen.getByText('chat.something_fresh'));
    expect(onChip).toHaveBeenCalledWith(expect.any(String));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/chat/__tests__/RefineChips.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement RefineChips**

Create `src/components/chat/RefineChips.tsx`:

```tsx
import { useMemo } from 'react';
import { Undo2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';

interface ChipDef {
  label: string;
  message: string;
}

interface RefineChipsProps {
  garments: GarmentBasic[];
  onChipTap: (message: string) => void;
  canUndo: boolean;
  onUndo: () => void;
}

function getFormality(g: GarmentBasic): number {
  return (g as Record<string, unknown>).formality as number ?? 3;
}

function getSeasonTags(g: GarmentBasic): string[] {
  const tags = (g as Record<string, unknown>).season_tags;
  return Array.isArray(tags) ? tags : [];
}

function hasOuterwear(garments: GarmentBasic[]): boolean {
  const outerCategories = new Set(['outerwear', 'jacket', 'coat', 'blazer', 'cardigan']);
  return garments.some((g) => outerCategories.has(g.category?.toLowerCase() ?? ''));
}

export function RefineChips({ garments, onChipTap, canUndo, onUndo }: RefineChipsProps) {
  const { t } = useLanguage();

  const contextChips = useMemo<ChipDef[]>(() => {
    const chips: ChipDef[] = [];

    // Season-based chips
    const allSeasons = garments.flatMap(getSeasonTags).map((s) => s.toLowerCase());
    const allSummer = garments.length > 0 && garments.every((g) => getSeasonTags(g).some((s) => s.toLowerCase() === 'summer'));
    const allWinter = garments.length > 0 && garments.every((g) => getSeasonTags(g).some((s) => s.toLowerCase() === 'winter'));

    if (allSummer) {
      chips.push({ label: t('chat.make_warmer'), message: 'Make this outfit warmer' });
      chips.push({ label: t('chat.add_layer'), message: 'Add a layer to this outfit' });
    }
    if (allWinter) {
      chips.push({ label: t('chat.make_lighter'), message: 'Make this outfit lighter for warmer weather' });
    }

    // Formality-based chips
    const avgFormality = garments.length > 0
      ? garments.reduce((sum, g) => sum + getFormality(g), 0) / garments.length
      : 3;

    if (avgFormality >= 4) {
      chips.push({ label: t('chat.more_casual'), message: 'Make this more casual' });
      chips.push({ label: t('chat.weekend_version'), message: 'Give me a weekend version of this' });
    }
    if (avgFormality <= 2) {
      chips.push({ label: t('chat.dress_it_up'), message: 'Dress this outfit up' });
      chips.push({ label: t('chat.date_night'), message: 'Make this a date night version' });
    }

    // Outerwear-based chips
    if (hasOuterwear(garments)) {
      chips.push({ label: t('chat.swap_jacket'), message: 'Swap the jacket for something different' });
    } else {
      chips.push({ label: t('chat.add_outerwear'), message: 'Add outerwear to this outfit' });
      chips.push({ label: t('chat.add_layer'), message: 'Add a layer to this outfit' });
    }

    // Deduplicate by label
    const seen = new Set<string>();
    return chips.filter((c) => {
      if (seen.has(c.label)) return false;
      seen.add(c.label);
      return true;
    });
  }, [garments, t]);

  const alwaysChips: ChipDef[] = [
    { label: t('chat.something_fresh'), message: 'Use garments I haven\'t worn recently' },
    { label: t('chat.different_vibe'), message: 'Show me a completely different style direction' },
  ];

  const handleChipTap = (message: string) => {
    hapticLight();
    onChipTap(message);
  };

  const handleUndo = () => {
    hapticLight();
    onUndo();
  };

  return (
    <div className="flex flex-wrap gap-1.5 px-[var(--page-px)]">
      {canUndo && (
        <button
          onClick={handleUndo}
          className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[12px] font-medium text-accent transition-colors hover:bg-accent/20 active:scale-95"
        >
          <Undo2 className="h-3 w-3" />
          {t('chat.undo')}
        </button>
      )}
      {[...contextChips, ...alwaysChips].map((chip) => (
        <button
          key={chip.label}
          onClick={() => handleChipTap(chip.message)}
          className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-muted active:scale-95"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/chat/__tests__/RefineChips.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/RefineChips.tsx src/components/chat/__tests__/RefineChips.test.tsx
git commit -m "feat: add RefineChips component with context-aware chip generation"
```

---

## Task 8: Refine Banner Component

**Files:**
- Create: `src/components/chat/RefineBanner.tsx`

- [ ] **Step 1: Create the banner component**

```tsx
// src/components/chat/RefineBanner.tsx
import { X, Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { hapticLight } from '@/lib/haptics';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

interface RefineBannerProps {
  garments: GarmentBasic[];
  onStopRefining: () => void;
}

export function RefineBanner({ garments, onStopRefining }: RefineBannerProps) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-2 rounded-[1.25rem] border border-accent/30 bg-accent/5 px-3 py-2 mx-[var(--page-px)]">
      <Lock className="h-3.5 w-3.5 text-accent shrink-0" />
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {garments.slice(0, 4).map((g) => (
          <div key={g.id} className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-border/40">
            <LazyImageSimple
              imagePath={getPreferredGarmentImagePath(g)}
              alt={g.title}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
      <span className="text-[12px] font-medium text-accent whitespace-nowrap">
        {t('chat.refining_look')}
      </span>
      <button
        onClick={() => {
          hapticLight();
          onStopRefining();
        }}
        className="ml-auto shrink-0 flex items-center gap-1 rounded-full border border-accent/30 px-2 py-1 text-[11px] font-medium text-accent/80 hover:bg-accent/10 active:scale-95 transition-all"
      >
        <X className="h-3 w-3" />
        {t('chat.stop_refining')}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/RefineBanner.tsx
git commit -m "feat: add RefineBanner component for refine mode indicator"
```

---

## Task 9: OutfitSuggestionCard — Refine & Save Buttons + Tap-to-Lock

**Files:**
- Modify: `src/components/chat/OutfitSuggestionCard.tsx`

- [ ] **Step 1: Extend props interface**

Add refine mode props to `OutfitSuggestionCardProps`:

```typescript
interface OutfitSuggestionCardProps {
  garments: GarmentBasic[];
  explanation: string;
  onTryOutfit: (garmentIds: string[]) => void;
  isCreating?: boolean;
  // New refine mode props
  isRefining?: boolean;
  lockedSlots?: string[];
  onRefine?: (garmentIds: string[], explanation: string) => void;
  onSave?: (garmentIds: string[]) => void;
  onToggleLock?: (garmentId: string) => void;
  isSaving?: boolean;
  isSaved?: boolean;
  changedGarmentIds?: string[];
}
```

- [ ] **Step 2: Add state for save status and change highlight**

Inside the component, add:

```typescript
const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

// Highlight changed garments briefly on prop change
useEffect(() => {
  if (changedGarmentIds && changedGarmentIds.length > 0) {
    setHighlightIds(new Set(changedGarmentIds));
    const timer = setTimeout(() => setHighlightIds(new Set()), 600);
    return () => clearTimeout(timer);
  }
}, [changedGarmentIds]);
```

- [ ] **Step 3: Add tap-to-lock behavior on garment slots**

In the garment grid, wrap each garment with a lock toggle when `isRefining` is true:

```tsx
{garments.map((g, i) => (
  <div key={g.id} className="group relative min-w-0">
    {/* Tap-to-lock overlay in refine mode */}
    {isRefining && (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          hapticLight();
          onToggleLock?.(g.id);
        }}
        className="absolute inset-0 z-10 flex items-center justify-center"
      >
        {lockedSlots?.includes(g.id) && (
          <div className="absolute inset-0 rounded-[1.1rem] ring-2 ring-accent/60 bg-accent/10 z-0" />
        )}
        {lockedSlots?.includes(g.id) && (
          <Lock className="h-3.5 w-3.5 text-accent z-10" />
        )}
      </button>
    )}
    {/* Change highlight animation */}
    <div className={`mx-auto aspect-square w-full max-w-[72px] overflow-hidden rounded-[1.1rem] border bg-muted transition-all duration-300 ${
      highlightIds.has(g.id) ? 'border-accent ring-2 ring-accent/40' : 'border-border/40'
    }`}>
      ...existing LazyImageSimple...
    </div>
    ...existing title + swap popover...
  </div>
))}
```

- [ ] **Step 4: Add Refine and Save buttons below existing action area**

Replace the single "Try this" button section with a two-button layout when not in refine mode, and keep the existing buttons when in refine mode:

```tsx
{/* Action buttons */}
<div className="px-3 pb-3">
  {missingShoes ? (
    /* ...existing missing shoes buttons stay unchanged... */
  ) : isRefining ? (
    /* In refine mode, the card is already active — no action buttons needed */
    null
  ) : (
    <div className="flex gap-2">
      {/* Refine button */}
      {onRefine && (
        <Button
          size="sm"
          variant="outline"
          className="flex-1 rounded-full text-[13px] h-11 gap-1.5 border-accent/40 text-accent hover:bg-accent/10"
          onClick={() => {
            hapticLight();
            onRefine(garments.map(g => g.id), explanation);
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('chat.refine')}
        </Button>
      )}
      {/* Save button */}
      {onSave && (
        <Button
          size="sm"
          variant={isSaved ? 'ghost' : 'default'}
          className={`flex-1 rounded-full text-[13px] h-11 gap-1.5 ${isSaved ? 'text-accent' : ''}`}
          onClick={() => {
            if (!isSaved) {
              hapticLight();
              onSave(garments.map(g => g.id));
            }
          }}
          disabled={isSaving || isSaved}
        >
          {isSaving ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : isSaved ? (
            <>✓ {t('chat.saved')}</>
          ) : (
            <>{t('chat.save')}</>
          )}
        </Button>
      )}
      {/* Existing try button as fallback when no refine/save handlers */}
      {!onRefine && !onSave && (
        <Button
          size="sm"
          className="w-full rounded-full text-[13px] h-11 gap-1.5"
          onClick={() => onTryOutfit(garments.map(g => g.id))}
          disabled={isCreating}
        >
          {isCreating ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <ArrowRight className="w-3.5 h-3.5" />
              {t('outfit.try_this')}
            </>
          )}
        </Button>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 5: Add gold border when in refine mode**

Update the card's outer div className:

```tsx
<div className={`rounded-[1.25rem] border bg-card overflow-hidden animate-scale-in shadow-sm ${
  isRefining ? 'border-accent/60 ring-1 ring-accent/20' : 'border-border/80'
}`}>
```

- [ ] **Step 6: Add Lock import and hapticLight import**

```typescript
import { ArrowRight, RefreshCw, Shirt, Plus, Lock } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
```

- [ ] **Step 7: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add src/components/chat/OutfitSuggestionCard.tsx
git commit -m "feat: add Refine, Save, tap-to-lock, and change highlight to OutfitSuggestionCard"
```

---

## Task 10: ChatMessage — Pass Refine Props Through

**Files:**
- Modify: `src/components/chat/ChatMessage.tsx`

- [ ] **Step 1: Extend ChatMessageProps**

Add refine mode props to the interface:

```typescript
interface ChatMessageProps {
  message: { role: 'user' | 'assistant'; content: string | MultimodalPart[]; stylistMeta?: StyleChatResponseEnvelope | null };
  isStreaming: boolean;
  garmentMap: Map<string, GarmentBasic>;
  isShopping?: boolean;
  onTryOutfit?: (garmentIds: string[]) => void;
  isCreatingOutfit?: boolean;
  showStyleCards?: boolean;
  onGarmentClick?: (garmentId: string) => void;
  displayMetaOverride?: StyleChatResponseEnvelope | null;
  // New refine mode props
  isRefining?: boolean;
  lockedSlots?: string[];
  onRefine?: (garmentIds: string[], explanation: string) => void;
  onSave?: (garmentIds: string[]) => void;
  onToggleLock?: (garmentId: string) => void;
  isSaving?: boolean;
  isSaved?: boolean;
  changedGarmentIds?: string[];
}
```

- [ ] **Step 2: Pass refine props to OutfitSuggestionCard**

In the component body, destructure the new props and pass them to `OutfitSuggestionCard`:

```tsx
export function ChatMessage({ message, isStreaming, garmentMap, onTryOutfit, isCreatingOutfit, showStyleCards = true, onGarmentClick, displayMetaOverride, isRefining, lockedSlots, onRefine, onSave, onToggleLock, isSaving, isSaved, changedGarmentIds }: ChatMessageProps) {
```

Then where `OutfitSuggestionCard` is rendered (two places in the JSX), add the new props:

```tsx
<OutfitSuggestionCard
  key={`outfit-${i}`}
  garments={oc.garments}
  explanation={oc.explanation}
  onTryOutfit={onTryOutfit || (() => {})}
  isCreating={isCreatingOutfit}
  isRefining={isRefining}
  lockedSlots={lockedSlots}
  onRefine={onRefine}
  onSave={onSave}
  onToggleLock={onToggleLock}
  isSaving={isSaving}
  isSaved={isSaved}
  changedGarmentIds={changedGarmentIds}
/>
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ChatMessage.tsx
git commit -m "feat: pass refine mode props through ChatMessage to OutfitSuggestionCard"
```

---

## Task 11: AIChat — Wire Everything Together

**Files:**
- Modify: `src/pages/AIChat.tsx`

This is the integration task that wires the refine mode hook, banner, chips, and save into the main chat page.

- [ ] **Step 1: Add imports**

```typescript
import { useRefineMode } from '@/hooks/useRefineMode';
import { RefineChips } from '@/components/chat/RefineChips';
import { RefineBanner } from '@/components/chat/RefineBanner';
```

- [ ] **Step 2: Initialize useRefineMode hook**

After the existing state declarations (around line 244), add:

```typescript
const refineMode = useRefineMode();
const [savedOutfitIds, setSavedOutfitIds] = useState<Set<string>>(new Set());
const [isSavingOutfit, setIsSavingOutfit] = useState(false);
```

- [ ] **Step 3: Add save handler**

After the existing handlers, add a save-from-chat handler:

```typescript
const handleSaveFromChat = useCallback(async (garmentIds: string[]) => {
  if (!user || isSavingOutfit) return;
  setIsSavingOutfit(true);
  try {
    const items = garmentIds.map((id) => {
      const garment = garmentMap.get(id);
      const slot = garment ? inferOutfitSlotFromGarment(garment) : 'top';
      return { garment_id: id, slot };
    });
    await createOutfit.mutateAsync({
      outfit: {
        name: t('chat.outfit_from_stylist'),
        generated_at: new Date().toISOString(),
        saved: true,
      },
      items,
    });
    setSavedOutfitIds((prev) => new Set([...prev, garmentIds.sort().join(',')]));
    hapticLight();
    toast.success(t('chat.saved'));
  } catch {
    toast.error(t('common.something_wrong'));
  } finally {
    setIsSavingOutfit(false);
  }
}, [user, garmentMap, createOutfit, t, isSavingOutfit]);
```

- [ ] **Step 4: Add refine enter handler**

```typescript
const handleEnterRefine = useCallback((garmentIds: string[], explanation: string) => {
  refineMode.enterRefineMode(garmentIds, explanation);
  hapticLight();
}, [refineMode]);
```

- [ ] **Step 5: Add chip tap handler**

```typescript
const handleChipTap = useCallback((message: string) => {
  sendMessageRef.current(message);
}, []);
```

- [ ] **Step 6: Send `locked_slots` in the request body**

In `sendMessage`, modify the `body: JSON.stringify({...})` call to include `locked_slots`:

```typescript
body: JSON.stringify({
  messages: requestMessages,
  locale,
  garmentCount: garmentCount ?? 0,
  archetype: styleDNA?.archetype ?? null,
  selected_garment_ids: anchoredGarmentId ? [anchoredGarmentId] : undefined,
  locked_slots: refineMode.isRefining ? refineMode.lockedSlots : undefined,
  active_look: refineMode.isRefining
    ? {
      garment_ids: refineMode.activeGarmentIds,
      explanation: refineMode.activeExplanation,
      source: 'refine_mode',
      anchor_garment_id: anchoredGarmentId ?? null,
      anchor_locked: Boolean(anchoredGarmentId),
    }
    : currentVisibleLook
      ? {
        garment_ids: currentVisibleLook.active_look?.garment_ids?.length
          ? currentVisibleLook.active_look.garment_ids
          : currentVisibleLook.outfit_ids,
        explanation: currentVisibleLook.active_look?.explanation || currentVisibleLook.outfit_explanation,
        source: currentVisibleLook.active_look?.source || currentVisibleLook.active_look_status,
        anchor_garment_id: currentVisibleLook.active_look?.anchor_garment_id ?? anchoredGarmentId ?? null,
        anchor_locked: currentVisibleLook.active_look?.anchor_locked ?? Boolean(anchoredGarmentId),
      }
      : undefined,
}),
```

- [ ] **Step 7: Handle `clear_active_look` in response processing**

In the streaming response handler, after `assistantMeta` is parsed from the SSE event, add:

```typescript
// Handle clear_active_look from classifier
if (assistantMeta?.clear_active_look) {
  refineMode.exitRefineMode();
  setLastConfirmedLook(null);
  setPendingLookUpdate(null);
  setAnchoredGarmentId(null);
}
```

Also after a successful refinement response, update the refine mode:

```typescript
// After streaming completes (in the finally block or after sawDone):
if (refineMode.isRefining && assistantMeta?.active_look?.garment_ids?.length) {
  refineMode.pushRefinement(
    assistantMeta.active_look.garment_ids,
    assistantMeta.active_look.explanation ?? assistantMeta.outfit_explanation ?? '',
  );
}
```

- [ ] **Step 8: Render the refine banner above chat input**

Find the chat input area (search for `<ChatInput`). Add the banner and chips above it:

```tsx
{/* Refine mode UI */}
{refineMode.isRefining && (
  <div className="space-y-2 pb-2">
    <RefineChips
      garments={refineMode.activeGarmentIds.map((id) => garmentMap.get(id)).filter(Boolean) as GarmentBasic[]}
      onChipTap={handleChipTap}
      canUndo={refineMode.canUndo}
      onUndo={refineMode.undo}
    />
  </div>
)}
{refineMode.isRefining && (
  <RefineBanner
    garments={refineMode.activeGarmentIds.map((id) => garmentMap.get(id)).filter(Boolean) as GarmentBasic[]}
    onStopRefining={refineMode.exitRefineMode}
  />
)}
```

- [ ] **Step 9: Pass refine props to ChatMessage**

Where `ChatMessage` is rendered in the message list, pass refine props to the **last assistant message** (the one with the active outfit):

```tsx
<ChatMessage
  key={i}
  message={m}
  isStreaming={isStreaming && i === messages.length - 1}
  garmentMap={garmentMap}
  onTryOutfit={handleTryOutfit}
  isCreatingOutfit={createOutfit.isPending}
  onGarmentClick={(id) => navigate(`/wardrobe/${id}`)}
  displayMetaOverride={i === messages.length - 1 ? pendingLookUpdate : undefined}
  // Refine props — only on the last assistant message with an outfit
  isRefining={refineMode.isRefining && i === messages.length - 1}
  lockedSlots={refineMode.lockedSlots}
  onRefine={handleEnterRefine}
  onSave={handleSaveFromChat}
  onToggleLock={refineMode.toggleLock}
  isSaving={isSavingOutfit}
  isSaved={savedOutfitIds.has(
    (m.stylistMeta?.active_look?.garment_ids ?? m.stylistMeta?.outfit_ids ?? []).sort().join(',')
  )}
/>
```

- [ ] **Step 10: Run TypeScript check and build**

Run: `npx tsc --noEmit --skipLibCheck && npm run build`
Expected: 0 errors, clean build

- [ ] **Step 11: Commit**

```bash
git add src/pages/AIChat.tsx
git commit -m "feat: wire refine mode, save-from-chat, locked_slots, and clear_active_look into AIChat"
```

---

## Task 12: i18n Keys

**Files:**
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/sv.ts`

- [ ] **Step 1: Append new keys to en.ts**

Add these keys at the end of the chat section (before the closing of the object):

```typescript
    'chat.refine': 'Refine',
    'chat.save': 'Save',
    'chat.saved': 'Saved',
    'chat.refining_look': 'Refining this look',
    'chat.stop_refining': 'Stop refining',
    'chat.undo': 'Undo',
    'chat.something_fresh': 'Something fresh',
    'chat.different_vibe': 'Different vibe',
    'chat.make_warmer': 'Make warmer',
    'chat.make_lighter': 'Make lighter',
    'chat.dress_it_up': 'Dress it up',
    'chat.more_casual': 'More casual',
    'chat.add_layer': 'Add a layer',
    'chat.remove_layer': 'Remove a layer',
    'chat.swap_jacket': 'Swap the jacket',
    'chat.add_outerwear': 'Add outerwear',
    'chat.date_night': 'Date night version',
    'chat.weekend_version': 'Weekend version',
    'chat.empty_wardrobe': 'Your wardrobe is empty — add some garments first and I\'ll help you style them!',
    'chat.small_wardrobe': 'Working with a small wardrobe — add more items for better combinations.',
```

- [ ] **Step 2: Append corresponding keys to sv.ts**

```typescript
    'chat.refine': 'Förfina',
    'chat.save': 'Spara',
    'chat.saved': 'Sparad',
    'chat.refining_look': 'Förfinar denna look',
    'chat.stop_refining': 'Sluta förfina',
    'chat.undo': 'Ångra',
    'chat.something_fresh': 'Något fräscht',
    'chat.different_vibe': 'Annan stil',
    'chat.make_warmer': 'Gör varmare',
    'chat.make_lighter': 'Gör lättare',
    'chat.dress_it_up': 'Klä upp det',
    'chat.more_casual': 'Mer avslappnat',
    'chat.add_layer': 'Lägg till ett lager',
    'chat.remove_layer': 'Ta bort ett lager',
    'chat.swap_jacket': 'Byt jackan',
    'chat.add_outerwear': 'Lägg till ytterkläder',
    'chat.date_night': 'Dejtkväll-version',
    'chat.weekend_version': 'Helgversion',
    'chat.empty_wardrobe': 'Din garderob är tom — lägg till plagg först så hjälper jag dig styla dem!',
    'chat.small_wardrobe': 'Jobbar med en liten garderob — lägg till fler plagg för bättre kombinationer.',
```

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build, no warnings

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en.ts src/i18n/locales/sv.ts
git commit -m "feat: add i18n keys for style chat refine mode"
```

---

## Task 13: Full Integration Verification

- [ ] **Step 1: Run all checks**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/ --ext .ts,.tsx --max-warnings 0
npm run build
npx vitest run src/hooks/__tests__/useRefineMode.test.ts
npx vitest run src/components/chat/__tests__/RefineChips.test.tsx
```

Expected: All pass, 0 errors, 0 warnings, clean build.

- [ ] **Step 2: Run existing test suite for touched files**

```bash
npx vitest run src/lib/__tests__/edgeFunctionClient.test.ts
```

Expected: PASS (no regressions)

- [ ] **Step 3: Create branch and PR**

```bash
git checkout -b prompt-N-style-chat-redesign main
git push origin prompt-N-style-chat-redesign
gh pr create --title "Style Chat Redesign: AI classifier + refine flow" --body "$(cat <<'EOF'
## Summary
- Replace regex-based intent detection with AI classifier (Flash Lite, ~50 tokens)
- Add full-outfit refine flow: Refine button, tap-to-lock garments, context-aware chips, undo
- Add Save button on outfit cards to save directly from chat
- Handle clear_active_look for clean breaks between outfits
- Add locked_slots support for preserving specific garments during refinement
- Empty wardrobe handling (0 garments → helpful message, 1-4 → warning)

## Test plan
- [ ] Verify greeting messages don't trigger outfit generation
- [ ] Verify "I have a wedding" asks follow-up questions (needs_more_context)
- [ ] Verify explicit outfit requests generate outfits
- [ ] Verify "make it warmer" with active look triggers refinement
- [ ] Verify "make it warmer" without active look asks "what look?"
- [ ] Verify Refine button enters refine mode with gold border
- [ ] Verify tap-to-lock toggles lock icon and preserves garments
- [ ] Verify Save button creates outfit in database
- [ ] Verify undo restores previous outfit version
- [ ] Verify "now something for Friday" clears active look
- [ ] Verify empty wardrobe shows helpful message

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Deploy edge function**

```bash
npx supabase functions deploy style_chat --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

---

## Dependency Graph

```
Task 1 (contract types) ──→ Task 2 (classifier fn) ──→ Task 3 (wire into edge fn) ──→ Task 4 (remove dead regex)
                        └──→ Task 5 (client contract)
                                                        Task 6 (useRefineMode hook)
                                                        Task 7 (RefineChips)        ──→ Task 11 (AIChat wiring)
                                                        Task 8 (RefineBanner)       ──→ Task 11
                                                        Task 9 (OutfitSuggestionCard) → Task 10 (ChatMessage) → Task 11
                                                                                                                  ↓
                                                                                                           Task 12 (i18n)
                                                                                                                  ↓
                                                                                                           Task 13 (verify)
```

Tasks 6, 7, 8, 9 are independent of each other and can be parallelized. Tasks 1→2→3→4 are sequential. Task 11 depends on everything before it.
