# M23 — Shopping Chat → AIChat mode

| Field | Value |
|---|---|
| Goal | Add `shopping_chat` as a 9th mode of the chat contract; surface as a switch inside StyleChatScreen. |
| Status | DONE (PR #TBD) |
| Branch | `mobile-m23-shopping-chat` |
| PR count | 1 |
| Depends on | V0, M14 |
| Complexity | M |

## Background

Edge function `shopping_chat` deployed. M14 ports the 8-mode chat contract; this wave extends to 9 modes. Shopping mode swaps the system prompt + tool palette to focus on what to buy + where, returning structured product cards that link out.

## Files touched

### Modified
- `mobile/src/lib/styleChatContract.ts` — extend the mode union with `'shopping'`. Add `ShoppingResultCard` envelope type.
- `mobile/src/hooks/useStyleChat.ts` — route shopping-mode requests to `/functions/v1/shopping_chat`.
- `mobile/src/screens/StyleChatScreen.tsx` — mode toggle in the composer header (Style / Shopping). Render product result cards distinctly.
- `mobile/src/components/ShoppingResultCard.tsx` — new card primitive: image + title + price + "Open" external-link button.

## Pattern reference

The chat-mode union pattern from M14 — adding a new variant means adding the mode to the union, the request body, and the response normalizer.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: switch to Shopping mode → ask "I need a navy wool blazer for under 200" → confirm 3+ result cards with images + prices + working "Open" buttons
- Code-reviewer: approved

## Deploy

None — `shopping_chat` already deployed.

## PR template

Title: `feat(mobile): M23 — Shopping chat mode`
