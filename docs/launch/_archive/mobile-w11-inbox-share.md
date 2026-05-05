# Mobile Launch — M11 — Notifications inbox + ShareOutfit image-share

**Goal:** Ship a real notifications inbox (table + UI + 3 source triggers) and replace ShareOutfit's mock URL with image-share via `react-native-view-shot` + native Share API. Both were originally cut for v1.0.1; the user requested they ship in v1.0.

**Status:** 🔜 TODO
**Branch:** `mobile-w11-inbox-share`
**PR count:** 2 (inbox is its own PR; share-as-image is a second smaller PR)
**Depends on:** M0; M5 (push delivery integrates with inbox)
**Complexity:** M (each PR)

---

## PR A — Notifications inbox

**Files:**
- `supabase/migrations/<UTCnow>_notifications_table.sql` (new — table + RLS + index)
- `mobile/src/hooks/useNotifications.ts` (new)
- `mobile/src/hooks/useMarkNotificationRead.ts` (new)
- `mobile/src/screens/NotificationsScreen.tsx` — replace `FIXTURES = []` (L45) with `useNotifications()` data
- `mobile/src/screens/HomeScreen.tsx` — re-add bell icon if M9/M10 hid it; show unread badge

**Migration:**
```sql
-- <TIMESTAMP>_notifications_table.sql
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,           -- e.g. 'laundry_reminder', 'render_complete', 'weekly_digest', 'subscription_state', 'milestone'
  title text NOT NULL,
  body text NOT NULL,
  url text,                      -- deep-link URL, e.g. burs://o/<id>
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "service role inserts notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

**Initial 3 source triggers (server-side — these go in the existing edge functions or DB triggers):**

1. **Render complete** — when `render_jobs.status` flips to `'rendered'`, insert a `kind='render_complete'` notification with `url='burs://garment/<garment_id>'`. Add to the existing `process_render_jobs` cron body or as a DB AFTER UPDATE trigger.
2. **Weekly digest** — pg_cron Sunday 9am, insert a `kind='weekly_digest'` per active user with `body` containing wear count + top archetype this week.
3. **Subscription state change** — when M6 webhook updates `subscriptions.status`, insert a `kind='subscription_state'` notification with body matching the new state.

These sit on the server; mobile only reads + marks-as-read.

**Hook skeletons:**
```ts
// useNotifications.ts
export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// useMarkNotificationRead.ts (mutation)
return useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  onError: captureMutationError('useMarkNotificationRead'),
});
```

## PR B — ShareOutfit image-share

**Files:**
- `mobile/package.json` — add `react-native-view-shot`
- `mobile/src/screens/ShareOutfitScreen.tsx` — replace mock URL share with view-shot capture + Share.share({ url: localFileUri })

**Approach:** `useRef` + `<ViewShot>` wrapping the rendered outfit card. On Share tap, `viewShotRef.current.capture()` → returns local file URI → pass to `Share.share({ url: fileUri })` so the user sees the rendered card in Instagram/Messages without needing a public web URL. Keeps the feature shippable without web-side `share_slug` or OG image generation.

---

## Acceptance gates

PR A:
- TypeScript: 0 errors
- `npx supabase migration list --linked` → new migration Local-only
- Manual: insert a notification row via SQL → appears in inbox → tap → marked as read.
- 3 source triggers verified by triggering each scenario and confirming a row appears.

PR B:
- TypeScript: 0 errors
- Manual: open OutfitDetail → tap Share → image renders correctly → share to Photos / Messages → image is the outfit card, no fake URL.

**Code-reviewer subagent:** mandatory both PRs.

---

## Deploy command (post-merge of PR A)

```bash
npx supabase db push --linked --yes
```

If the source triggers are inside edge functions:
```bash
npx supabase functions deploy <function_name> --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

---

## Tracker updates: M11 → DONE (after PR B), pointer → M12.
