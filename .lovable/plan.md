

## Plan: Clean up Home page layout and fix AI suggestion language

### Problem 1: Messy layout on the Today page
The occasion selector section ("Vad ska du göra?") feels cluttered — buttons are just thrown on the page with too much visual noise. The section header is tiny (11px), there's no visual grouping, and the horizontal scroll chips feel disconnected from each other. Combined with styles, sub-options, cold weather hint, and the CTA button, it's information overload.

### Problem 2: "Top 3 Worn" section should be removed
User explicitly asked to remove the top garments list from the Today page.

### Problem 3: AI suggestions are always in Swedish
The edge function `suggest_outfit_combinations` has hardcoded Swedish in the prompt:
- Line 171: `"Short descriptive title in Swedish"`
- Line 173: `"Why this combination works (2 sentences, in Swedish)"`
- Line 174: `"Suitable occasion in Swedish (e.g. Vardag, Jobb, Dejt)"`
- Line 155: User message is also in English but asks for Swedish output

The hook `useAISuggestions` does not pass the user's locale to the edge function. It needs to send `locale` so the prompt can adapt.

---

### Changes

#### File: `src/pages/Home.tsx`

1. **Better visual grouping for occasion + style selector** — Wrap the occasion selector, sub-options, style picker, and CTA in a single card-like container (`rounded-2xl bg-foreground/[0.02] border border-border/30 p-4 space-y-4`) so they feel like one cohesive "outfit builder" block instead of scattered elements.

2. **Remove the "Top 3 Worn" section** (lines 302-328) and the "See all insights" ghost button below it (lines 330-337). The AI suggestion and stats strip remain.

3. **Tighten spacing** — Reduce `space-y-6` to `space-y-5` on the main container, and use consistent internal spacing within the outfit builder card.

#### File: `src/hooks/useAISuggestions.ts`

4. **Pass locale to the edge function** — Import `useLanguage`, get `locale`, and send it in the request body: `body: { locale }`.

#### File: `supabase/functions/suggest_outfit_combinations/index.ts`

5. **Read locale from request body** — Parse the optional JSON body to get `locale` (default to `'sv'`).

6. **Make the AI prompt language-aware** — Replace all hardcoded "in Swedish" references with dynamic language instructions based on locale. Map locale codes to language names (sv→Swedish, en→English, de→German, etc.) and inject into the tool parameter descriptions and system prompt.

7. **Make error messages language-neutral** — Replace Swedish error strings like "Inte tillräckligt med plagg" and "AI-tjänsten är överbelastad" with English defaults (the frontend already handles i18n for display).

---

### Technical details

**Locale mapping in the edge function:**
```text
const LOCALE_NAMES: Record<string, string> = {
  sv: "Swedish", en: "English", de: "German", fr: "French",
  es: "Spanish", it: "Italian", nl: "Dutch", da: "Danish",
  nb: "Norwegian", fi: "Finnish", pt: "Portuguese",
  ja: "Japanese", ko: "Korean", ar: "Arabic", fa: "Persian",
};
const lang = LOCALE_NAMES[locale] || "English";
```

Then in the tool schema:
- `title`: `"Short descriptive title in ${lang}"`
- `explanation`: `"Why this combination works (2 sentences, in ${lang})"`
- `occasion`: `"Suitable occasion in ${lang}"`

**Home page visual structure after changes:**
```text
Greeting + WeatherPill
[Onboarding nudge if needed]
┌─────────────────────────────────┐
│  Section: "Vad ska du göra?"    │
│  [occasion chips row]           │
│  [sub-option chips if active]   │
│                                 │
│  Section: "Stil (valfritt)"     │
│  [style chips row]              │
│                                 │
│  [Generate CTA button]          │
│  [min garments hint if needed]  │
└─────────────────────────────────┘
[Cold weather hint if applicable]
[Stats strip]
[AI Suggestions]
```

