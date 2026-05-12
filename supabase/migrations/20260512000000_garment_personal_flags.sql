-- Q-C2 — personal-flags columns on `garments` for the mobile Wardrobe
-- Smart Access tiles. Adds two NEW boolean flags (is_lingerie + is_wishlist)
-- and matching partial indexes. `in_laundry` already exists on the table
-- (initial_schema.sql:901) and is reused for the In Laundry tile count —
-- no third column is introduced despite earlier draft specs naming
-- `is_in_laundry`. The matching `idx_garments_user_available` partial
-- index over `in_laundry = false` already exists (initial_schema.sql:1633)
-- so the In Laundry tile count benefits from the existing infra.
--
-- Both new flags default false. Existing rows pick up the default at ALTER
-- time so no backfill is needed and the column is non-null safe.
--
-- Partial indexes are scoped to `user_id` and gated on `is_X = true` so the
-- index footprint stays small (true is rare for both flags — most garments
-- aren't lingerie, and most aren't on a user's wishlist). Each index is
-- consulted by the Smart Filter count HEAD query `select * count exact head
-- where user_id = … and is_lingerie = true` (or is_wishlist).
--
-- Idempotent — `if not exists` lets a re-apply pass cleanly. Mirrors web
-- (web has no equivalent migration today; mobile-only feature extension
-- per Q-C2 wave spec scope decision — see docs/launch/waves/q-mobile-parity-2.md).

alter table public.garments
  add column if not exists is_lingerie boolean not null default false,
  add column if not exists is_wishlist boolean not null default false;

create index if not exists idx_garments_user_lingerie
  on public.garments (user_id) where is_lingerie;

create index if not exists idx_garments_user_wishlist
  on public.garments (user_id) where is_wishlist;
