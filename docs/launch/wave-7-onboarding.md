## Wave 7 — Onboarding Rebuild

### P42 — Migration: 4 new profiles columns

**Problem**
Per spec, onboarding needs persistent state tracking columns that don't exist yet.

**Fix**
Create migration `<ts>_onboarding_state.sql`:
```sql
ALTER TABLE profiles ADD COLUMN onboarding_step TEXT DEFAULT 'not_started'
  CHECK (onboarding_step IN (
    'not_started', 'style_questions', 'photo_tutorial', 'batch_capture',
    'achievement', 'studio_selection', 'coach_tour', 'completed'
  ));
ALTER TABLE profiles ADD COLUMN onboarding_garment_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN onboarding_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN onboarding_completed_at TIMESTAMPTZ;

-- Backfill existing users to 'completed' so they don't get forced back into onboarding
UPDATE profiles SET onboarding_step = 'completed',
  onboarding_completed_at = COALESCE(created_at, NOW())
WHERE onboarding_step = 'not_started';

CREATE INDEX ON profiles (onboarding_step) WHERE onboarding_step != 'completed';
```

Commit the file with a timestamp matching what MCP `apply_migration` returns.

**Files**
- new migration file

**Acceptance**
- Migration applies cleanly
- Existing users unaffected (backfilled to `completed`)
- New signups default to `not_started`

**Deploy** `npx supabase db push --linked --yes` (post-merge)

---

### P43 — Onboarding rate-limit boost

**Problem**
Rate limits are tight (e.g., analyze_garment 30/min). During batch capture (20+ garments), user would hit limit mid-session.

**Fix**
In `supabase/functions/_shared/scale-guard.ts` `enforceRateLimit`:
```typescript
// After resolving plan:
const onboardingBoost = await checkOnboardingBoost(supabaseAdmin, userId);
if (onboardingBoost) {
  tier = { maxPerHour: 2000, maxPerMinute: 100 };  // boosted for first 24h
}
```

Add helper:
```typescript
async function checkOnboardingBoost(supabaseAdmin: any, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('onboarding_started_at, onboarding_step')
    .eq('id', userId)
    .single();
  if (!data || data.onboarding_step === 'completed') return false;
  if (!data.onboarding_started_at) return false;
  const started = new Date(data.onboarding_started_at).getTime();
  return Date.now() - started < 24 * 60 * 60 * 1000;  // 24h window
}
```

Cache the boost decision per-isolate for 1 minute to avoid repeated DB calls.

**Files**
- `supabase/functions/_shared/scale-guard.ts`

**Acceptance**
- User in first 24h of onboarding can scan 20+ garments without hitting limit
- Post-24h or post-completion: normal limits apply

**Deploy** Every AI function using scale-guard (batch across sessions).

---

### P44 — Route gate

**Problem**
No enforcement of onboarding completion. User can skip via direct URL.

**Fix**
Modify `src/components/auth/ProtectedRoute.tsx`:
```typescript
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { data: profile } = useProfile();
  const location = useLocation();

  if (loading) return <PageSkeleton />;
  if (!user) return <Navigate to="/auth" replace />;

  const EXEMPT_PATHS = ['/paywall', '/billing/success', '/billing/cancel', '/auth', '/login', '/signup'];
  const isExempt = EXEMPT_PATHS.some(p => location.pathname.startsWith(p));

  if (profile && profile.onboarding_step !== 'completed' && !location.pathname.startsWith('/onboarding')) {
    return <Navigate to={`/onboarding?step=${profile.onboarding_step}`} replace />;
  }

  if (isExempt) return <>{children}</>;
  return <>{children}</>;
}
```

Block browser back navigation during onboarding:
```typescript
// src/pages/Onboarding.tsx
useEffect(() => {
  const handler = (e: PopStateEvent) => {
    if (profile?.onboarding_step !== 'completed') {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    }
  };
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}, [profile]);
```

**Files**
- `src/components/auth/ProtectedRoute.tsx`
- `src/pages/Onboarding.tsx`

**Acceptance**
- User with onboarding_step != 'completed' can't navigate to `/home`, `/wardrobe`, etc.
- Back button during onboarding doesn't escape the flow
- Paywall + billing pages accessible

**Deploy** None.

---

### P45 — Style DNA Quiz (12-question rebuild)

**Problem**
Current `QuickStyleQuiz` captures ~6 fields. Spec requires 12-question comprehensive quiz.

**Fix**
Create new component `src/components/onboarding/StyleQuizV4.tsx`. Implement Q1-Q12 per spec in CLAUDE.md Launch Plan discussion:

1. Identity & body (gender, height, build, age)
2. Lifestyle mix (5 sliders summing 100%)
3. Climate & location (home city + secondary + climate type)
4. Style identity (3-5 archetypes from 12 + optional free-text icons)
5. Color DNA (3 favorites + 3 avoid + palette vibe + pattern comfort)
6. Fit & silhouette (overall + top vs bottom + layering + body focus)
7. Formality (ceiling + floor sliders)
8. Fabric & feel (preferred 3 + sensitivities + care preference)
9. Occasions (multi-select)
10. Shopping habits (frequency + budget + style)
11. Primary style goal (single select from 7)
12. Cultural/accessibility (optional free-text)

Save to `profiles.preferences.styleProfile` with new `version: 4` field for migration safety:
```typescript
{
  version: 4,
  gender: 'feminine',
  height: 170,
  build: 'athletic',
  // ... all 12 fields
}
```

**Files**
- `src/components/onboarding/StyleQuizV4.tsx` (new)
- `src/pages/Onboarding.tsx` (route to new quiz)
- `src/types/styleProfile.ts` (new — type definition)

**Acceptance**
- Completing quiz saves all 12 fields to profiles.preferences.styleProfile
- On reload, answers persist
- `onboarding_step` advances to `photo_tutorial`

**Deploy** None.

---

### P46 — PhotoTutorial screen

**Problem**
No screen teaching users how to photograph garments. Results in bad photos → bad enrichment → bad AI recommendations.

**Fix**
Create `src/components/onboarding/PhotoTutorialStep.tsx`:
- Hero illustration (4 good/bad photo examples)
- 5 bullet points: lighting, surface, full garment in frame, no people, one garment per photo
- "I'm ready" primary button → advances `onboarding_step` to `batch_capture`

**Files**
- `src/components/onboarding/PhotoTutorialStep.tsx` (new)
- `src/pages/Onboarding.tsx`
- `src/i18n/locales/*.ts` (new keys)
- `public/photo-tutorial-*.svg` or image assets

**Acceptance**
- Screen renders with visual guide
- "I'm ready" advances to next step
- Step persisted in DB

**Deploy** None.

---

### P47 — BatchCapture screen

**Problem**
Current add-garment UX captures one at a time with form filling. Onboarding needs rapid batch capture with minimal friction.

**Fix**
Create `src/components/onboarding/BatchCaptureStep.tsx`:
- Full-screen camera with AUTO-capture when garment in frame
- Each capture triggers: upload → `analyze_garment` (fast mode) → save to DB → increment `onboarding_garment_count`
- Progress bar: "X of 20 minimum"
- "Continue" button disabled until count >= 20
- "Done" button appears at count >= 30

Implementation:
- Reuse `useLiveScan` hook (update for batch mode)
- After each capture, call `enqueue_render_job` in background (fire-and-forget)
- No form — batch saves with AI-inferred fields, user can edit later

State persists via `profiles.onboarding_garment_count`. User closes app at 14 → resumes at 15.

**Files**
- `src/components/onboarding/BatchCaptureStep.tsx` (new)
- `src/hooks/useLiveScan.ts` (extend)
- `src/pages/Onboarding.tsx`

**Acceptance**
- Can capture 20+ garments in one session
- Count persists across app close/reopen
- "Continue" locks at < 20, unlocks at 20+
- Each garment saves immediately with `render_status='none'`, enrichment runs in background

**Deploy** None (uses existing edge functions).

---

### P48 — Achievement screen + grantTrialGift

**Problem**
Spec requires celebratory screen that grants 3 trial_gift render credits.

**Fix**
Create `src/components/onboarding/AchievementStep.tsx`:
- Playfair italic celebratory title
- Warm Gold accent
- Subtext mentions 3 free studio renders
- Primary button advances to `studio_selection`

On screen mount, call edge function that invokes `grantTrialGift(userId, 3, idempotencyKey)`:
```typescript
const idempotencyKey = `onboarding_gift_${userId}`;
await invokeEdgeFunction('grant_trial_gift', { body: { user_id: userId, amount: 3, idempotency_key: idempotencyKey } });
```

New edge function `grant_trial_gift` wraps the RPC:
```typescript
// supabase/functions/grant_trial_gift/index.ts
serve(async (req) => {
  const { user_id, amount, idempotency_key } = await req.json();
  // auth check user matches user_id
  const result = await grantTrialGift(serviceClient, user_id, amount, idempotency_key);
  return new Response(JSON.stringify(result), { headers });
});
```

**Files**
- `src/components/onboarding/AchievementStep.tsx` (new)
- `supabase/functions/grant_trial_gift/index.ts` (new — requires user approval since new edge function)
- `src/pages/Onboarding.tsx`

**Acceptance**
- Screen grants exactly 3 trial_gift credits (verify in render_credits table)
- Idempotent — reload doesn't grant more
- Advances to studio_selection

**Deploy** `grant_trial_gift` (new function deploy)

---

### P49 — StudioSelection screen

**Problem**
User picks 3 garments to see rendered during onboarding. Spec: cannot skip, must select exactly 3.

**Fix**
Create `src/components/onboarding/StudioSelectionStep.tsx`:
- Grid of all captured garments
- Multi-select with hard limit of 3 (disable further selection, allow deselect)
- "Generate" button disabled until exactly 3 selected
- On confirm: call `enqueue_render_job` 3 times (parallel) with `source: 'trial_gift'`
- Screen closes immediately; renders process in background
- Advances `onboarding_step` to `coach_tour`

Render job enqueue:
```typescript
await Promise.all(selectedIds.map(garmentId =>
  invokeEdgeFunction('enqueue_render_job', {
    body: {
      garmentId,
      source: 'trial_gift',
      clientNonce: crypto.randomUUID(),
    },
  })
));
```

**Files**
- `src/components/onboarding/StudioSelectionStep.tsx` (new)
- `src/pages/Onboarding.tsx`

**Acceptance**
- Exactly 3 garments selectable
- Cannot skip/close
- 3 render_jobs rows created with `source='trial_gift'`
- Trial credits consumed (reserved) from the 3 granted in P48

**Deploy** None.

---

### P50 — Coach Tour

**Problem**
New users don't know where things are. Spec: linear tour ending on a rendered garment.

**Fix**
Create `src/components/onboarding/CoachTour.tsx`:
- Full-screen overlay with callouts pointing to Home tiles, Wardrobe tabs, Outfits card, AI Chat button, Garment Detail sections
- Linear — "Next" advances to next stop
- Final stop: navigates to one of the 3 selected garments' detail page
- Subscribes to `render_status` via Supabase realtime; when render completes, fires the reveal
- Advances `onboarding_step` to `completed` AFTER reveal screen closes

Realtime subscription:
```typescript
const selectedId = selectedGarmentIds[0];  // first of the 3
useEffect(() => {
  const sub = supabase.channel(`garment:${selectedId}`)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'garments',
      filter: `id=eq.${selectedId}`,
    }, (payload) => {
      if (payload.new.render_status === 'ready') setRevealReady(true);
    })
    .subscribe();
  return () => { sub.unsubscribe(); };
}, [selectedId]);
```

**Files**
- `src/components/onboarding/CoachTour.tsx` (new)
- `src/pages/Onboarding.tsx`

**Acceptance**
- Tour steps linearly
- Lands on a garment detail
- Realtime reveals studio render when ready

**Deploy** None.

---

### P51 — Reveal screen

**Problem**
Final "wow moment" — user sees their garment as a studio render.

**Fix**
Create `src/components/onboarding/RevealStep.tsx`:
- Two-panel side-by-side: original photo ←→ studio render
- "Look what BURS did with your photo" copy
- If render ready → show render immediately
- If render still pending → show original + shimmer loader; subscribe to update (handled in P50)
- If render failed → show original + "still processing — we'll retry"; trigger auto-retry via `enqueue_render_job` with `force: true`
- "Continue" button sets `onboarding_step = 'completed'` + `onboarding_completed_at = NOW()`, navigates to `/home`

**Files**
- `src/components/onboarding/RevealStep.tsx` (new)
- `src/pages/Onboarding.tsx`

**Acceptance**
- Reveal shows studio render side-by-side
- Failure auto-retry doesn't block user
- Completion unlocks the app (route gate now allows all paths)

**Deploy** None.

---

