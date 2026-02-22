

# Fix analytics_events Data Leakage

## Problem
The `analytics_events` table allows anyone to INSERT events (intentional for anonymous analytics), but there is no explicit policy preventing SELECT access. This means user behavior data could potentially be read by unauthorized users.

## Solution
Add a restrictive SELECT policy so only authenticated users can read their own events (or deny all client SELECT access if analytics are only consumed server-side).

### Database Migration

```sql
-- Deny all client SELECT on analytics_events (server-side only consumption)
CREATE POLICY "Deny client select on analytics_events"
  ON public.analytics_events
  FOR SELECT
  USING (false);
```

If users should be able to read their own analytics:
```sql
CREATE POLICY "Users can read own analytics_events"
  ON public.analytics_events
  FOR SELECT
  USING (auth.uid() = user_id);
```

### Post-Fix
- Re-run security scan to verify the finding is resolved
- Delete the security finding once confirmed

## Technical Details
- **File changed**: Database migration only (no code changes)
- **Risk**: None -- this is additive (new policy), no existing functionality breaks
- **The INSERT with `USING (true)` for anonymous event capture remains untouched**
