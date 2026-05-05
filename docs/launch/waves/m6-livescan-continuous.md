# M6 — Multi-garment LiveScan continuous-scan

| Field | Value |
|---|---|
| Goal | Upgrade LiveScan from single-shot capture to continuous frame analysis that detects multiple garments per session. |
| Status | TODO |
| Branch | `mobile-m6-livescan-continuous` |
| PR count | 1 |
| Depends on | V0, M1 (render polling reuses) |
| Complexity | L |

## Background

Web LiveScan is single-shot — capture, analyze, decide. Mobile already ships single-shot in W5 (#720). Continuous scan: keep the camera open, sample frames at ~1.5 Hz, run a lightweight detection pass, surface a "tap to add this one" tile when a stable garment is detected. User can chain multiple adds without leaving the camera.

`react-native-vision-camera` frame processors give us native-loop access. **Vision Camera doesn't run in Expo Go — verify against an EAS dev build.**

## Files touched

### New
- `mobile/src/hooks/useLiveScanContinuous.ts` — frame processor consumer. State machine: `idle → detecting → stable → captured`. Stable threshold: same bbox center within 24 px for 4 frames.
- `mobile/src/components/LiveScanDetectionTile.tsx` — bottom-sheet card showing detected garment thumbnail + "Add" / "Skip" actions.

### Modified
- `mobile/src/screens/LiveScanScreen.tsx` — adopt continuous mode behind a setting toggle (default on). Replace single-shot UI with the tile-based loop.
- `mobile/src/hooks/useAnalyzeGarment.ts` — accept already-cropped frame buffers (skip the upload-then-analyze round-trip when frame buffer can be passed directly).

## Pattern reference

No web reference — this is mobile-only. Vision Camera frame processor docs are the primary source. Run the analyze step on a cropped frame, NOT the full preview.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual on EAS dev build: lay 4 garments side by side, confirm app detects each one in turn, tap "Add" 4 times → 4 garments in wardrobe
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M6 — LiveScan continuous-scan`

PR body must call out: requires EAS dev build for testing (not Expo Go).
