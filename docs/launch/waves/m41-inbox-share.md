# M41 — Notifications inbox + ShareOutfit image-share

| Field | Value |
|---|---|
| Goal | Real notifications inbox (table + UI + 3 source triggers) and ShareOutfit image-share via ViewShot + native Share API. |
| Status | TODO |
| Branch | `mobile-m41-inbox-share` |
| PR count | 2 (PR A: inbox; PR B: ShareOutfit ViewShot) |
| Depends on | V0, M30 |
| Complexity | M |

## Background

NotificationsScreen renders FIXTURES `[]`. ShareOutfit's "Save as image" is a coming-soon stub. Both block launch UX.

## Files touched

### PR A — inbox
#### New
- Migration: `<ts>_notifications_table.sql` — `notifications(id, user_id, type, title, body, data jsonb, read_at, created_at)` + RLS for SELECT/UPDATE on own rows + service-role INSERT.
- `mobile/src/hooks/useNotifications.ts` — paginated query.
- `mobile/src/hooks/useMarkNotificationRead.ts` — mark single + mark-all.
- 3 server-side triggers in existing edge functions: insert a `notifications` row when (a) push fires, (b) render completes, (c) outfit-of-the-day computed.

#### Modified
- `mobile/src/screens/NotificationsScreen.tsx` — replace fixtures with `useNotifications` + Mark all read CTA.

### PR B — ShareOutfit
#### New
- `mobile/src/lib/outfitImage.ts` — wrap `react-native-view-shot` to capture an outfit card → temp file URI → `Sharing.shareAsync` (expo-sharing).

#### Modified
- `mobile/src/screens/ShareOutfitScreen.tsx` — "Save as image" → image preview → native Share sheet.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green (migration smoke check)
- Manual PR A: trigger a render → confirm a notification row appears + Inbox shows it; mark read → row collapses
- Manual PR B: open an outfit → "Share as image" → native Share sheet opens with image attached
- Code-reviewer: approved

## Deploy

PR A:
```bash
npx supabase db push --linked --yes
# redeploy any edge functions whose body now writes to notifications
```

PR B: none.

## PR template

PR A: `feat(mobile): M41 PR A — notifications inbox + 3 source triggers`
PR B: `feat(mobile): M41 PR B — ShareOutfit image-share via ViewShot`
