# G1 — Style/Shopping Chat: outfit cards + history sheet + per-mode threads + restyle contract

| Field | Value |
|---|---|
| Goal | `StyleChatScreen` renders `OutfitSuggestionCard` when the assistant produces one; a new `ChatHistorySheet` lets users browse prior threads; mode toggle reloads mode-filtered history; restyle/shopping nav contract lands so G4 + G5 can hand off. |
| Status | TODO |
| Branch | `fix/mobile-g1-style-chat` |
| PR count | 1 |
| Depends on | G6 (outfit cards inside chat use upgraded `OutfitCard`) |
| Complexity | L |
| Spec | [`docs/launch/g-campaign.md`](../g-campaign.md) |

## Background

Audit findings vs `src/`:
1. **No outfit card on "generate an outfit."** `mobile/src/screens/StyleChatScreen.tsx` `MessageItem` (lines 676–788) never imports `OutfitSuggestionCard` and never checks `stylistMeta.render_outfit_card`. Web does this at `src/components/chat/ChatMessage.tsx:101,243`.
2. **No chat history UI.** Mobile persists messages to `chat_messages` (M14) but has no browsing surface. Web mounts `ChatHistorySheet` from `src/pages/AIChat.tsx:23`.
3. **Mode toggle bleeds context.** `mobile/src/hooks/useStyleChat.ts:337` only hydrates `'stylist'` on mount; `setMode()` aborts the stream but doesn't reload mode-filtered history. Web persists per-mode via `ACTIVE_CHAT_MODE_KEY` and `loadMessages(user.id, activeChatMode)`.
4. **Restyle contract missing.** G5 (Style Me) and G4 (Wardrobe Gaps) need to navigate into StyleChat with seed state. `StyleChatScreen` doesn't read `route.params.{mode, anchorGarmentIds, gapContext, sourceOutfitId}` on mount.

Mobile already supports the 9-mode chat contract (audit confirmed) and supports anchoring inside the screen (`useStyleChat` lines 100–101, 428–452, 506–507). The work is purely surface: render an outfit card, expose history, separate mode threads, accept seed nav params.

## Files touched

### New
- `mobile/src/components/chat/OutfitSuggestionCard.tsx` — native equivalent of web's `src/components/chat/OutfitSuggestionCard.tsx`. Wraps G6's upgraded `OutfitCard` with chat-message-row chrome (rounded corners, "Try it" button → calls `onTry(outfitId)` prop).
- `mobile/src/components/chat/ChatHistorySheet.tsx` — Modal/BottomSheet listing threads grouped by `mode` and `created_at::date`. Each row: mode badge, first user message snippet, relative date. Tap → `onSelect({ mode, threadId })`. Uses `@gorhom/bottom-sheet` if present in mobile deps; otherwise React Native `Modal` per `mobile/CLAUDE.md` line 90–93.

### Modified
- `mobile/src/screens/StyleChatScreen.tsx` — (a) `MessageItem` (lines 676–788): when `msg.role === 'assistant' && msg.stylistMeta?.render_outfit_card === true && Array.isArray(msg.stylistMeta?.outfit_garment_ids)`, render `<OutfitSuggestionCard outfitId={msg.stylistMeta.outfit_id} garmentIds={msg.stylistMeta.outfit_garment_ids} onTry={handleTryOutfit} />`. (b) Header: add a history icon button → opens `ChatHistorySheet`. (c) On mount, read `route.params.{mode, anchorGarmentIds, gapContext, sourceOutfitId}` and seed `setMode`, `setAnchoredGarmentId`, and (if `gapContext`) prefill the input box with `${gapContext.item_name}` and call `setMode('shopping')`.
- `mobile/src/hooks/useStyleChat.ts` — `setMode(newMode)`: in addition to aborting the active stream, call a new `reloadHistoryForMode(newMode)` helper that re-runs the existing init query with `.eq('mode', newMode)` and replaces the message buffer. Maintain a small per-mode cache so toggling back is instant.
- `mobile/src/components/chat/index.ts` (or wherever the barrel lives) — export `OutfitSuggestionCard` and `ChatHistorySheet`.
- `mobile/src/i18n/locales/en.ts` + `sv.ts` — append-only: `chat.history.title`, `chat.history.empty`, `chat.outfitCard.try`, `chat.modeToggle.style`, `chat.modeToggle.shopping`. Both files; no reorder.

### Verified
- `mobile/src/lib/styleChatContract.ts` — confirm `render_outfit_card` is part of the typed `stylistMeta` payload. If not, extend the type union (read-only contract from the edge function — types only).

## Pattern reference

- Web `OutfitSuggestionCard`: `src/components/chat/OutfitSuggestionCard.tsx`.
- Web `ChatHistorySheet`: `src/components/chat/ChatHistorySheet.tsx`.
- Mobile chat persistence: `mobile/src/hooks/useStyleChat.ts:337` (existing init query template — clone for `reloadHistoryForMode`).
- Mobile bottom-sheet: per `mobile/CLAUDE.md` lines 90–93 (Modal+Animated OR @gorhom/bottom-sheet, stay consistent within feature surface — check what AIChat already uses).

## Acceptance gates

- `tsc --noEmit` → 0 errors
- `eslint "src/**/*.{ts,tsx}" --max-warnings 0` → clean
- `expo-doctor` → passes
- `expo export -p ios` → bundle delta ≤ +25 KB
- Manual: ask "generate me an outfit" in style mode → outfit card renders inline.
- Manual: tap history icon → sheet shows past threads with mode badges.
- Manual: switch mode style → shopping → message buffer empties; switch back → previous style thread re-hydrates.
- Manual: navigate from a stub screen with `route.params = { mode: 'shopping', gapContext: { category: 'shirt', item_name: 'cream linen shirt' } }` → screen opens in shopping mode with the input prefilled.
- i18n: en/sv both have new keys.
- Code-reviewer: approved.
- Codex: 👍 / "no bugs found" + quiet window.
- Mandatory 2nd self-review: clean.

## Deploy

None.

## PR template

Title: `fix(mobile): G1 — Style/Shopping Chat outfit cards + history + per-mode threads + restyle contract`

Body:
- New `OutfitSuggestionCard` (chat row wrapping G6's `OutfitCard`).
- New `ChatHistorySheet` modal.
- `setMode()` reloads mode-filtered history.
- `route.params` seed contract for G4/G5 handoff.
- i18n appended.
- Plan: `docs/launch/waves/g1-style-chat.md`
