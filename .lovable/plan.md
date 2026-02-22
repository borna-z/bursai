

## Make sinamobarraky@gmail.com Premium

### What
Set the user `sinamobarraky@gmail.com` (ID: `a9a3750d-2ab8-47d4-b278-7c3238d35088`) to premium plan.

### Technical steps

1. **Update `user_subscriptions` table** -- set `plan` to `'premium'` for this user
2. **Update `subscriptions` table** -- upsert a record with `plan = 'premium'` and `status = 'active'`

Both updates use the service role (via SQL migration) since client-side inserts/updates are denied by RLS on these tables.

### SQL to run

```sql
-- Update user_subscriptions
UPDATE public.user_subscriptions
SET plan = 'premium', updated_at = now()
WHERE user_id = 'a9a3750d-2ab8-47d4-b278-7c3238d35088';

-- Upsert subscriptions
INSERT INTO public.subscriptions (user_id, plan, status, updated_at)
VALUES ('a9a3750d-2ab8-47d4-b278-7c3238d35088', 'premium', 'active', now())
ON CONFLICT (user_id)
DO UPDATE SET plan = 'premium', status = 'active', updated_at = now();
```

No code changes needed -- this is a data-only operation.
