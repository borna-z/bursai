/**
 * prompt-builder.ts — Prompt construction, candidate outfits, stylist text,
 * suggestion chips, and formatting utilities for style chat.
 *
 * Extracted from style_chat/index.ts — zero logic changes.
 */

import type { StylistChatMode } from "../_shared/style-chat-contract.ts";
import type { UnifiedStylistResponse } from "../_shared/unified_stylist_engine.ts";
import type { GarmentRecord, MessageInput, ActiveLookContext, RefinementIntent } from "./index.ts";
import { getMessageText, getSlotKey, getLang, LANG_CONFIG, stripUnknownTagMarkup, VALID_OUTFIT_TAG_RE, VALID_GARMENT_TAG_RE } from "./index.ts";

// ── formatting utilities ───────────────────────────────────────────────────

export function formatGarmentLine(g: GarmentRecord): string {
  const aiRaw = g.ai_raw && typeof g.ai_raw === "object" ? g.ai_raw : {};
  const e = aiRaw.enrichment || aiRaw;
  const parts = [
    `${g.title} [ID:${g.id}]`,
    `(${g.category}${g.subcategory ? "/" + g.subcategory : ""}`,
    g.color_primary ? `, ${g.color_primary}` : "",
    g.material ? `, ${g.material}` : "",
    g.fit ? `, ${g.fit}` : "",
    g.formality ? `, formality ${g.formality}` : "",
    g.pattern && g.pattern !== "solid" ? `, ${g.pattern}` : "",
    g.season_tags?.length ? `, ${g.season_tags.join("/")}` : "",
    `, worn ${g.wear_count ?? 0}x`,
    g.last_worn_at ? `, last ${g.last_worn_at.slice(0, 10)}` : "",
  ];

  const enrichParts: string[] = [];
  if (e.style_archetype) enrichParts.push(e.style_archetype);
  if (e.silhouette) enrichParts.push(`sil:${e.silhouette}`);
  if (e.visual_weight) enrichParts.push(`weight:${e.visual_weight}`);
  if (e.texture_intensity) enrichParts.push(`texture:${e.texture_intensity}`);
  if (e.drape) enrichParts.push(`drape:${e.drape}`);
  if (e.shoulder_structure) enrichParts.push(`shoulder:${e.shoulder_structure}`);
  if (typeof e.versatility_score === "number") enrichParts.push(`vers:${e.versatility_score}`);
  if (e.layering_role) enrichParts.push(`layer:${e.layering_role}`);
  if (Array.isArray(e.occasion_tags) && e.occasion_tags.length) enrichParts.push(`occ:${e.occasion_tags.slice(0, 4).join(",")}`);
  if (e.color_harmony_notes) enrichParts.push(`color:${String(e.color_harmony_notes).slice(0, 80)}`);
  if (e.stylist_note) enrichParts.push(`note:${String(e.stylist_note).slice(0, 120)}`);
  if (enrichParts.length) parts.push(` | ${enrichParts.join(", ")}`);
  parts.push(")");

  return `• ${parts.join("")}`;
}

export function formatGarmentList(garments: GarmentRecord[]): string {
  const titles = garments.map((garment) => garment.title).filter(Boolean);
  if (titles.length <= 1) return titles[0] || "";
  if (titles.length === 2) return `${titles[0]} + ${titles[1]}`;
  return `${titles.slice(0, -1).join(", ")} + ${titles[titles.length - 1]}`;
}

export function trimToSentences(text: string, maxSentences = 3): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean.match(/[^.!?…]+[.!?…]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [clean];
  return sentences.slice(0, maxSentences).map((sentence) => /[.!?…]$/.test(sentence) ? sentence : `${sentence}.`).join(" ");
}

// ── outfit explanation ─────────────────────────────────────────────────────

export function buildOutfitExplanation(rawText: string, fallbackIds: string[]): string {
  const withoutTags = rawText
    .replace(VALID_OUTFIT_TAG_RE, " ")
    .replace(VALID_GARMENT_TAG_RE, (_match: string, _id: string, label: string) => (label ? String(label).trim() : " "));
  const clean = stripUnknownTagMarkup(withoutTags)
    .replace(/\s+/g, " ")
    .trim();

  const firstSentence = clean.split(/(?<=[.!?])\s+/).find(Boolean) || clean;
  if (firstSentence) return firstSentence.slice(0, 140);
  if (fallbackIds.length >= 2) return "Current active look";
  return "";
}

// ── visual reasoning ───────────────────────────────────────────────────────

export function buildVisualReasoning(garments: GarmentRecord[], locale: string): string {
  const colors = Array.from(new Set(garments.map((garment) => garment.color_primary).filter(Boolean))).slice(0, 2);
  const materials = Array.from(new Set(garments.map((garment) => garment.material).filter(Boolean))).slice(0, 2);
  const hasOuterwear = garments.some((garment) => getSlotKey(garment.category) === "outerwear");
  if (locale === "sv") {
    const colorLine = colors.length > 0 ? `paletten håller sig till ${colors.join(" och ")}` : "paletten hålls ren";
    const materialLine = materials.length > 0 ? `materialen ${materials.join(" och ")} ger djup` : "texturen ger djup utan att störa linjen";
    return hasOuterwear
      ? `Det ger mer struktur uppåt, ${colorLine}, och ${materialLine}.`
      : `Silhuetten känns ren, ${colorLine}, och ${materialLine}.`;
  }

  const colorLine = colors.length > 0 ? `the palette stays tight around ${colors.join(" and ")}` : "the palette stays tight";
  const materialLine = materials.length > 0 ? `${materials.join(" and ")} add depth without noise` : "the texture adds depth without adding noise";
  return hasOuterwear
    ? `That adds structure up top, ${colorLine}, and ${materialLine}.`
    : `The line stays clean, ${colorLine}, and ${materialLine}.`;
}

// ── thread brief ───────────────────────────────────────────────────────────

export function buildThreadBrief(
  messages: MessageInput[],
  anchor: GarmentRecord | null,
  activeLook?: ActiveLookContext | null,
  refinementIntent?: RefinementIntent | null,
): string {
  const recent = messages.slice(-4);
  const userTurns = recent.filter((m) => m.role === "user").map((m) => getMessageText(m.content)).filter(Boolean);
  const latestUser = userTurns[userTurns.length - 1] || "";
  const priorGoals = userTurns.slice(0, -1).slice(-1);

  // Active look titles — only titles here; full garment spec lines live in refinementContract
  // to avoid duplicating detailed data that's already in the system prompt.
  const activeLookTitles = activeLook?.garmentIds && activeLook.garmentIds.length >= 2
    ? activeLook.garmentIds
        .map((_id, i) => activeLook.garmentLines[i]
          ? activeLook.garmentLines[i].replace(/^•\s*/, "").split(" [ID:")[0].trim()
          : null)
        .filter(Boolean)
        .join(" + ")
    : null;

  // Last refinement intent — not stated elsewhere in system prompt; used to prevent topic resets
  const intentLabel = refinementIntent && refinementIntent.mode !== "new_look" ? refinementIntent.mode : null;

  const lines = [
    latestUser ? `Latest user ask: ${latestUser}` : "",
    priorGoals.length ? `Recent user goals: ${priorGoals.join(" | ")}` : "",
    anchor ? `Current anchor garment: ${anchor.title} [ID:${anchor.id}]` : "No confirmed anchor garment yet.",
    activeLookTitles ? `Active look: ${activeLookTitles}` : "",
    intentLabel ? `Last refinement intent: ${intentLabel}` : "",
  ].filter(Boolean);

  return lines.length ? `THREAD BRIEF:\n${lines.join("\n")}` : "";
}

// ── mode contract ──────────────────────────────────────────────────────────

export function buildModeContract(mode: StylistChatMode, lang: { name: string }): string {
  const universalRules = [
    `MODE=${mode}. Obey this mode first, then style quality.`,
    "- Do not collapse every request into generic outfit generation.",
    "- Keep output decisive and premium; no generic assistant filler.",
    "- Prefer styling action over abstract analysis whenever the user is clearly asking for a look or a refinement.",
    "- Default styling reply shape: one clear decision, one short visual reason, and one short change note only if a change is relevant.",
    "- If the request is genuinely ambiguous, ask exactly one short clarifying question and stop there.",
    "- Use wardrobe evidence: category balance, wear frequency, layering role, archetype, texture, drape, structure, versatility.",
  ];

  const modeRules: Record<StylistChatMode, string[]> = {
    ACTIVE_LOOK_REFINEMENT: [
      "- Keep continuity with the active look; preserve unchanged pieces unless directly asked to swap.",
      "- Make 1-2 high-leverage edits, then explain visual impact (proportion, texture, formality, color harmony).",
      "- Prioritize edits over full resets.",
      "- Your response MUST name which garments changed versus which stayed.",
      '- Examples: "I swapped the blazer for a heavier coat and kept the rest." or "Changed the trousers to something darker — everything else works."',
      "- If you kept the same outfit, say something changed anyway. Identical output is a failure.",
      "- Keep the explanation to 1-2 sentences. Do not write an essay.",
      "- Response shape: **What stays** → **What changes** → **Why this improves it**.",
    ],
    GARMENT_FIRST_STYLING: [
      "- Build around the anchor garment first and name why it is the hero.",
      "- Support the anchor with balancing pieces (visual weight, drape/structure, occasion coherence).",
      "- If anchor is weak for the ask, say so and provide the cleanest adjacent option.",
      "- Response shape: **Hero garment** → **Best full look** → **Optional variant**.",
    ],
    OUTFIT_GENERATION: [
      "- Return the strongest complete look first; at most one backup.",
      "- Match occasion/weather/formality and avoid repetition patterns from recent outfits.",
      "- Briefly explain why this look wins versus nearby alternatives.",
      "- Response shape: **Primary look** → **Why it works** → **Optional backup**.",
    ],
    WARDROBE_GAP_ANALYSIS: [
      "- Do NOT lead with a generic outfit card.",
      "- Output in this order with section headers: 1) **Overrepresented**, 2) **Underrepresented**, 3) **Weak links**, 4) **Highest-leverage fixes**, 5) **Stop overbuying**.",
      "- Separate NEED vs NICE-TO-HAVE and explain impact per addition.",
    ],
    PURCHASE_PRIORITIZATION: [
      "- Treat this as shopping strategy, not outfit generation.",
      "- Rank top purchases by impact, versatility, and outfit unlock potential.",
      "- Include why now, budget sensitivity (if inferred), and what each purchase replaces or upgrades.",
      "- Response shape with section headers: **Top priorities (ranked)**, **Why each matters**, **What each unlocks**, **Skip buying more of**.",
    ],
    STYLE_IDENTITY_ANALYSIS: [
      "- Diagnose current style identity from wardrobe evidence, then define a sharper target direction.",
      "- Identify missing identity markers (shape, texture, contrast level, footwear language, outerwear structure).",
      "- Give a short action plan: keep / add / reduce.",
      "- Response shape with section headers: **Current style read**, **What is holding it back**, **Keep / Add / Reduce**.",
    ],
    LOOK_EXPLANATION: [
      "- Explain the look as visual reasoning: silhouette, proportion, contrast, texture, color harmony, occasion fit.",
      "- Do not default to proposing a new outfit unless the current one fails.",
      "- Keep explanation concrete and stylist-level, not generic.",
      "- Response shape with section headers: **Silhouette & proportion**, **Texture & color**, **Formality & occasion fit**.",
    ],
    PLANNING: [
      "- Produce a multi-look plan (days or slots) with clear non-repetitive backbone pieces.",
      "- Reuse intelligently across looks; avoid fatigue from overused items.",
      "- Include quick swap logic for weather/formality changes.",
      "- Response shape: day-by-day or slot-by-slot plan with explicit labels (e.g., Day 1..Day N), then a **Quick swaps** section.",
    ],
    CONVERSATIONAL: [
      "- CONVERSATIONAL MODE: The user is chatting. Respond naturally and warmly in 2-3 sentences maximum.",
      "- Do NOT generate, suggest, or reference specific outfits unless the user explicitly asks.",
      "- Do NOT end with outfit-generation prompts like 'Want me to put a look together?'.",
      "- If the user is asking a fashion knowledge question, answer it directly.",
      "- You can end with one gentle, natural follow-up question if genuinely relevant. Never force it.",
    ],
  };

  return [
    `MODE RESPONSE CONTRACT (${lang.name}):`,
    ...universalRules,
    ...(modeRules[mode] || []),
  ].join("\n");
}

// ── refinement contract ────────────────────────────────────────────────────

export function buildRefinementContract(intent: RefinementIntent, activeLook: ActiveLookContext): string {
  const activeLookLine = activeLook.summary
    ? `ACTIVE LOOK TO PRESERVE:\n- ${activeLook.summary}\n- Source: ${activeLook.source}${activeLook.garmentLines.length ? `\n${activeLook.garmentLines.join("\n")}` : ""}\n`
    : "ACTIVE LOOK TO PRESERVE:\n- No stable active look confirmed yet.\n";

  const targetedRules = [
    "- If the latest user ask is a refinement, edit the active look instead of restarting from zero.",
    "- Keep unchanged pieces stable unless the user explicitly asks to replace them or the look fails technically.",
    "- Make one strong move, not three weak ones.",
    "- Name the kept piece first, then describe the key swap or styling adjustment.",
    "- Justify changes through silhouette, balance, contrast, texture, visual weight, formality, or color harmony.",
    "- Avoid generic filler. No 'nice', 'great', 'good option', or vague encouragement.",
    "- If explaining the look, explain the current active look rather than inventing a new one.",
    "- Keep replies tight: usually 2-4 sentences, with the rationale compressed into one decisive line.",
    "- Never expose raw [[...]] markup in prose; tags exist only to power UI cards.",
    "- EVERY assistant reply must include exactly one authoritative [[outfit:id1,id2,...|localized explanation]] tag for the current active look.",
    "- That outfit tag must reflect the latest full look snapshot after any refinement, even if only one garment changed.",
    "- Reuse garment IDs for unchanged pieces so the UI can replace the active look instead of leaving stale cards on screen.",
    "- Mention the outfit naturally in prose first, then place the single outfit tag at the end of the message.",
    "- Do not emit partial tags, placeholder IDs, or multiple competing outfit tags.",
  ];

  const modeRuleMap: Record<RefinementIntent["mode"], string[]> = {
    swap_shoes: [
      "- SWAP SHOES: keep the jacket/top/bottom unless there is a direct conflict; only change footwear and explain the effect on formality/proportion.",
    ],
    swap_layer: [
      "- SWAP LAYER: preserve the core look and change only the visible layering piece unless the user asks for a broader reset.",
    ],
    keep_jacket: [
      "- KEEP THE JACKET: preserve the current jacket or outer layer and rebuild only the supporting pieces around it.",
    ],
    less_formal: [
      "- LESS FORMAL: relax fabrication, footwear, or base layer before replacing the hero piece.",
    ],
    more_formal: [
      "- MORE FORMAL: increase polish through cleaner structure, dressier footwear, and less visual noise without breaking continuity.",
    ],
    more_elevated: [
      "- MORE ELEVATED: sharpen structure, cleaner footwear, or sleeker base layers while preserving the active look's core identity.",
    ],
    warmer: [
      "- WARMER: add warmth through layer weight, knit texture, or more closed footwear before changing the outfit's character.",
      "- Protect the vibe while making the look physically warmer.",
    ],
    cooler: [
      "- COOLER: lighten weight, open the silhouette, or swap into easier footwear while keeping the look coherent.",
      "- Protect the vibe while making the outfit feel physically lighter.",
    ],
    sharper: [
      "- SHARPER: clean the line with more structure, cleaner footwear, or tighter contrast. Think precision, not extra formality by default.",
    ],
    softer: [
      "- SOFTER: relax the contrast, drape, or texture so the look feels easier and less severe without turning shapeless.",
    ],
    more_elegant: [
      "- MORE ELEGANT: raise refinement through cleaner lines, richer texture, sleeker shoe choice, or a more deliberate column of color.",
      "- Aim for poised and expensive-looking, not simply more formal.",
    ],
    dinner: [
      "- DINNER SHIFT: keep the backbone of the look, then add evening definition through cleaner shoes, darker grounding pieces, sharper waist/shoulder balance, or richer texture.",
    ],
    work: [
      "- WORK SHIFT: make the look credible for meetings through structure and restraint. Reduce visual noise before replacing hero pieces.",
    ],
    weekend: [
      "- WEEKEND SHIFT: relax the look without making it sloppy. Ease the fabrication, footwear, or outer layer while keeping balance intact.",
    ],
    travel: [
      "- TRAVEL SHIFT: keep the outfit easy to move in, low-friction to pack, and clean enough to survive transit without feeling sloppy.",
    ],
    simpler: [
      "- SIMPLER: remove visual noise first. Fewer statements, cleaner lines, and one clear focal point beat extra styling tricks.",
    ],
    bolder: [
      "- BOLDER: increase impact through contrast, sharper shape, richer texture, or a stronger focal piece without making the outfit chaotic.",
    ],
    use_less_worn: [
      "- USE SOMETHING I WEAR LESS: swap in the strongest underused garment only if it improves or preserves outfit quality. Do not force a weak piece into the look.",
    ],
    explain_why: [
      "- EXPLAIN WHY THIS WORKS: do not propose a new outfit first; explain silhouette, proportion, color harmony, contrast, texture, and occasion fit of the active look in place.",
      "- Sound like a stylist reading the look visually, not a generic explainer listing garments.",
    ],
    targeted_refinement: [
      "- TARGETED REFINEMENT: treat the request as an edit to the active look, not a fresh recommendation.",
      "- Infer whether the user wants elevate, relax, warm up, sharpen, soften, or an occasion shift, then make the cleanest possible move.",
    ],
    new_look: [
      "- NEW LOOK: build the strongest option from the wardrobe subset, but still stay consistent with the thread brief.",
    ],
  };

  return `${activeLookLine}
REFINEMENT MODE: ${intent.mode}
${[...targetedRules, ...(modeRuleMap[intent.mode] || [])].join("\n")}`;
}

// ── candidate outfits ──────────────────────────────────────────────────────

export function buildCandidateOutfits(rankedGarments: GarmentRecord[], anchor: GarmentRecord | null): string {
  // Group garments by canonical slot key (not raw category) to avoid cross-slot confusion
  const slots = new Map<string, GarmentRecord[]>();
  for (const garment of rankedGarments) {
    const key = getSlotKey(garment.category);
    if (!slots.has(key)) slots.set(key, []);
    slots.get(key)!.push(garment);
  }

  const anchorSlot = anchor ? getSlotKey(anchor.category) : null;

  // Each slot: if anchor occupies it, anchor leads; otherwise take top-2 from slot pool
  const topCandidates = anchorSlot === "top"
    ? [anchor!]
    : (slots.get("top") || []).slice(0, 2);
  const bottomCandidates = anchorSlot === "bottom"
    ? [anchor!]
    : (slots.get("bottom") || []).slice(0, 2);
  const dressCandidates = anchorSlot === "dress"
    ? [anchor!]
    : (slots.get("dress") || []).slice(0, 2);
  const shoeCandidates = anchorSlot === "shoes"
    ? [anchor!]
    : (slots.get("shoes") || []).slice(0, 2);
  const outerwearCandidates = anchorSlot === "outerwear"
    ? [anchor!]
    : (slots.get("outerwear") || []).slice(0, 2);
  const accessoryCandidates = (slots.get("accessory") || []).slice(0, 2);

  const candidates: string[] = [];
  const hasDressMinimum = (items: GarmentRecord[]) => {
    const slotSet = new Set(items.map((item) => getSlotKey(item.category)));
    return slotSet.has("dress") && slotSet.has("shoes");
  };
  const hasSeparatesMinimum = (items: GarmentRecord[]) => {
    const slotSet = new Set(items.map((item) => getSlotKey(item.category)));
    return slotSet.has("top") && slotSet.has("bottom") && slotSet.has("shoes");
  };
  const hasValidCompleteMinimum = (items: GarmentRecord[]) => hasDressMinimum(items) || hasSeparatesMinimum(items);

  // ── Dress-led candidates ─────────────────────────────────────────────────
  for (const dress of dressCandidates) {
    const shoes = shoeCandidates.find((item) => item.id !== dress.id);
    const outerwear = outerwearCandidates.find((item) => item.id !== dress.id && item.id !== shoes?.id);
    const accessory = accessoryCandidates.find((item) => ![dress.id, shoes?.id, outerwear?.id].includes(item.id));
    const items = [dress, shoes, outerwear, accessory].filter(Boolean) as GarmentRecord[];
    if (hasDressMinimum(items)) {
      candidates.push(`- Candidate ${candidates.length + 1}: ${items.map((item) => `${item.title} [ID:${item.id}]`).join(" + ")} — rationale: dress-led silhouette with enough support pieces to finish the look.`);
    }
    if (candidates.length >= 3) return `PREBUILT OUTFIT CANDIDATES:\n${candidates.join("\n")}`;
  }

  // ── Separates candidates (top + bottom) ─────────────────────────────────
  for (const top of topCandidates) {
    // Only exclude top.id from bottom — anchor CAN be the bottom, it should NOT be excluded
    const bottom = bottomCandidates.find((item) => item.id !== top.id);
    const shoes = shoeCandidates.find((item) => ![top.id, bottom?.id].includes(item.id));
    const outerwear = outerwearCandidates.find((item) => ![top.id, bottom?.id, shoes?.id].includes(item.id));
    const accessory = accessoryCandidates.find((item) => ![top.id, bottom?.id, shoes?.id, outerwear?.id].includes(item.id));
    const items = [top, bottom, shoes, outerwear, accessory].filter(Boolean) as GarmentRecord[];
    // Verify no duplicate slots in this candidate
    const usedSlots = new Set(items.map((item) => getSlotKey(item.category)));
    if (usedSlots.size === items.length && hasSeparatesMinimum(items)) {
      candidates.push(`- Candidate ${candidates.length + 1}: ${items.map((item) => `${item.title} [ID:${item.id}]`).join(" + ")} — rationale: balanced separates with clear proportions and a finished focal point.`);
    }
    if (candidates.length >= 3) break;
  }

  // ── Anchor-only fallback ─────────────────────────────────────────────────
  if (anchor && candidates.length === 0) {
    // Pick support pieces from different slots than anchor
    const anchorSlotKey = getSlotKey(anchor.category);
    const support = rankedGarments
      .filter((item) => item.id !== anchor.id && getSlotKey(item.category) !== anchorSlotKey)
      .filter((item, _i, arr) => {
        // one per slot
        const slot = getSlotKey(item.category);
        return arr.findIndex((x) => getSlotKey(x.category) === slot) === arr.indexOf(item);
      })
      .slice(0, 4);
    const items = [anchor, ...support];
    if (hasValidCompleteMinimum(items)) {
      candidates.push(`- Candidate 1: ${items.map((item) => `${item.title} [ID:${item.id}]`).join(" + ")} — rationale: best available support pieces around the hero garment.`);
    }
  }

  return candidates.length ? `PREBUILT OUTFIT CANDIDATES:\n${candidates.join("\n")}` : "";
}

// ── card-first stylist text ────────────────────────────────────────────────

export function buildCardFirstStylistText(params: {
  locale: string;
  mode: StylistChatMode;
  outfit: UnifiedStylistResponse["outfits"][number] | null;
  outfitGarments: GarmentRecord[];
  activeLookGarments: GarmentRecord[];
  anchor: GarmentRecord | null;
  refinementIntent: RefinementIntent;
}): string {
  const { locale, mode, outfit, outfitGarments, activeLookGarments, anchor, refinementIntent } = params;
  const isSwedish = locale === "sv";
  if (!outfitGarments.length) {
    return isSwedish
      ? "Jag kunde inte låsa en stark komplett look här. Justera önskemålet lite så bygger jag om den."
      : "I couldn't lock a strong complete look here. Nudge the request a little and I'll rebuild it.";
  }

  if (!outfit && outfitGarments.length > 0) {
    const garmentNames = outfitGarments.map(g => g.title).join(', ');
    return `Here's a look built around your wardrobe: ${garmentNames}.`;
  }

  const outfitLine = formatGarmentList(outfitGarments);
  const activeIds = new Set(activeLookGarments.map((garment) => garment.id));
  const changed = outfitGarments.filter((garment) => !activeIds.has(garment.id));
  const kept = outfitGarments.filter((garment) => activeIds.has(garment.id));
  const rationale = trimToSentences(String(outfit?.rationale || ""), 1);
  const visualReasoning = buildVisualReasoning(outfitGarments, locale);
  const limitation = outfit?.limitations?.[0] ? trimToSentences(outfit.limitations[0], 1) : "";

  if (mode === "LOOK_EXPLANATION") {
    const first = isSwedish
      ? `Det här funkar eftersom ${outfitLine} bygger en tydlig och bärbar helhet.`
      : `This works because ${outfitLine} builds a clear, wearable whole.`;
    const third = isSwedish
      ? "Det känns genomtänkt snarare än övertänkt, vilket håller looken stark i verkligheten."
      : "It feels intentional rather than overworked, which is what keeps the look strong in real life.";
    return trimToSentences([first, visualReasoning, third].join(" "), 3);
  }

  if (mode === "ACTIVE_LOOK_REFINEMENT") {
    const first = changed.length > 0
      ? (isSwedish
        ? `Behåll ${kept.length > 0 ? formatGarmentList(kept) : "grunden"} och byt in ${formatGarmentList(changed)}.`
        : `Keep ${kept.length > 0 ? formatGarmentList(kept) : "the core"} and switch in ${formatGarmentList(changed)}.`)
      : (isSwedish
        ? "Jag håller den nuvarande looken intakt och stramar upp den utan att starta om."
        : "I'm keeping the current look intact and tightening it up without restarting it.");
    return trimToSentences([first, rationale || visualReasoning, limitation].filter(Boolean).join(" "), 3);
  }

  if (mode === "GARMENT_FIRST_STYLING" && anchor && outfitGarments.some((garment) => garment.id === anchor.id)) {
    const first = isSwedish
      ? `Bygg looken runt ${anchor.title}: ${outfitLine}.`
      : `Build the look around ${anchor.title}: ${outfitLine}.`;
    return trimToSentences([first, rationale || visualReasoning, limitation].filter(Boolean).join(" "), 3);
  }

  const first = isSwedish
    ? `Gå på ${outfitLine}.`
    : `Go with ${outfitLine}.`;
  const second = rationale || visualReasoning;
  const third = limitation || (isSwedish
    ? "Det här är den renaste starka looken jag kan säkra från garderoben."
    : "This is the cleanest strong look I can secure from the wardrobe.");
  return trimToSentences([first, second, third].join(" "), 3);
}

// ── style clarifier ────────────────────────────────────────────────────────

export function buildStyleClarifierText(locale: string, latestUser: string): string {
  const isSwedish = locale === "sv";

  if (/(why|explain|break down|what makes)/i.test(latestUser)) {
    return isSwedish
      ? "Vilken look vill du att jag förklarar?"
      : "Which look do you want me to explain?";
  }

  if (/(change|make it|style this|style it|swap|replace|remove|drop)/i.test(latestUser)) {
    return isSwedish
      ? "Vilket plagg eller vilken look ska jag utgå från?"
      : "Which garment or look should I work from?";
  }

  return isSwedish
    ? "Vilket plagg eller vilken look vill du att jag stylar?"
    : "Which garment or look do you want me to style?";
}

// ── suggestion chips ───────────────────────────────────────────────────────

export function buildSuggestionChips(
  stylistMode: StylistChatMode,
  hasOutfitTag: boolean,
  locale: string,
): string[] {
  const lang = getLang(locale);
  const isSwedish = locale === "sv";
  const isEnglish = locale === "en" || !LANG_CONFIG[locale];

  // Refinement chips when an outfit is shown
  if (hasOutfitTag) {
    if (isSwedish) return ["Gör det mer avslappnat", "Byt skor", "Varmare variant", "Ny look"];
    return ["Make it more casual", "Swap the shoes", "Warmer version", "New look"];
  }

  // Mode-specific chips
  switch (stylistMode) {
    case "OUTFIT_GENERATION":
    case "GARMENT_FIRST_STYLING":
      if (isSwedish) return ["Mer formellt", "Helgvariant", "Varför fungerar detta?"];
      return ["More formal", "Weekend version", "Why does this work?"];
    case "WARDROBE_GAP_ANALYSIS":
      if (isSwedish) return ["Vad ska jag köpa först?", "Visa mig en outfit"];
      return ["What should I buy first?", "Show me an outfit"];
    case "PURCHASE_PRIORITIZATION":
      if (isSwedish) return ["Visa mig en outfit", "Analysera min stil"];
      return ["Show me an outfit", "Analyze my style"];
    case "STYLE_IDENTITY_ANALYSIS":
      if (isSwedish) return ["Klä mig idag", "Vad saknas i garderoben?"];
      return ["Style me today", "What's missing in my wardrobe?"];
    case "LOOK_EXPLANATION":
      if (isSwedish) return ["Gör det mer avslappnat", "Middagsversion"];
      return ["Make it more casual", "Dinner version"];
    case "PLANNING":
      if (isSwedish) return ["Lägg till i planen", "Visa alternativ"];
      return ["Add to plan", "Show alternatives"];
    case "CONVERSATIONAL":
      if (isSwedish) return ["Klä mig idag", "Analysera min stil", "Vad saknas?"];
      return ["Style me today", "Analyze my style", "What's missing?"];
    default:
      if (isSwedish) return ["Klä mig idag", "Analysera min stil", "Vad saknas?"];
      return ["Style me today", "Analyze my style", "What's missing?"];
  }
}
