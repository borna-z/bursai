# Mobile Launch — M4 — Style DNA + wardrobe stats + ProfileScreen refetch

**Goal:** Replace six surfaces of hardcoded "Quiet luxe / 142-38-186 / Smart casual" with real `useStyleDNA()` + `useWardrobeStats()` hooks. Wire ProfileScreen pull-to-refresh to refetch all three (profile + DNA + stats).

**Status:** 🔜 TODO
**Branch:** `mobile-w4-style-dna`
**PR count:** 1
**Depends on:** M0
**Complexity:** M

---

## Files touched

**New:**
- `mobile/src/hooks/useStyleDNA.ts` (port from `src/hooks/useStyleDNA.ts`)
- `mobile/src/hooks/useWardrobeStats.ts` (new — three HEAD count queries)

**Modified:**
- `mobile/src/screens/ProfileScreen.tsx` — L30, L33, L40 (replace useMockRefresh), L162-164
- `mobile/src/screens/SettingsScreen.tsx` — L146 (Premium caption uses useSubscription state if M6 done; otherwise reads from existing profile fields)
- `mobile/src/screens/SettingsStyleScreen.tsx` — L24-26, L64

**Tracker (same PR):** mobile-launch-overview.md, completion-log.md, root CLAUDE.md.

---

## Code skeletons

**Full verbatim:** see `docs/launch/mobile-launch-fix-plan-2026-05-31.md` § P1.10 (Style DNA + Real Wardrobe Stats). The master plan contains:
- `useStyleDNA` full implementation (frequency-weighted archetype voting matching web's algorithm exactly)
- `useWardrobeStats` full implementation (3 parallel HEAD count queries)
- ProfileScreen, SettingsScreen, SettingsStyleScreen diffs

Apply verbatim. **Important:** the Style DNA algorithm must match web exactly — same archetype voting logic, same dominant-color extraction. Read `src/hooks/useStyleDNA.ts` once and ensure mobile mirrors line-for-line where logic matters; the master plan version is correct but verify before commit.

For the SettingsScreen L146 Premium caption: if M6 (RevenueCat) hasn't shipped yet, fall back to reading `profiles.is_premium` directly. Once M6 lands, swap to `useSubscription().isPremium / .plan / .status`. Add a TODO comment marking the swap point.

---

## Acceptance gates

```bash
cd mobile && npx tsc --noEmit
```
0 errors.

**Manual smoke test:**
1. Empty wardrobe (or fresh test user): ProfileScreen shows dashes/zeros, not 142/38/186.
2. Add 5 garments + 2 outfits + 3 wear logs. Pull-to-refresh on ProfileScreen.
3. Verify counts update to 5/2/3.
4. SettingsStyleScreen archetype list reflects the wardrobe (not hardcoded "Minimal/Editorial/Earth tones").
5. SettingsScreen caption reads "Free" for the test user (since no subscription row yet).

**Grep verification:**
```bash
grep -n "ARCHETYPES\s*=\|142\|Quiet luxe\|Smart casual" mobile/src/screens/{Profile,Settings,SettingsStyle}Screen.tsx
```
Zero matches for the hardcoded values.

**Code-reviewer subagent:** mandatory.

---

## PR template

**Title:** `feat(mobile): M4 — useStyleDNA + useWardrobeStats — replace 6 hardcoded surfaces`

**Body:** Problem (six screens render fake personalisation). Fix (port web's StyleDNA hook + new WardrobeStats counts hook + wire 3 screens + real refetch). Verification above. Out of scope: SettingsScreen caption full subscription state — partial fallback to profiles.is_premium until M6 RevenueCat ships, marked with TODO.

---

## Tracker updates (in this PR)

- mobile-launch-overview.md: M4 → DONE, pointer → M5.
- completion-log.md: append M4.
- CLAUDE.md root: CURRENT WAVE → `Mobile Launch M5 — Push notifications mobile-side`.
