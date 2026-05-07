// usePickMustHaves — read + write the "shopping list" shortlist that the
// Pick Must-Haves screen builds from a wardrobe-gap analysis.
//
// Storage: persisted in `profiles.preferences.shopping_list_jsonb` rather
// than a dedicated table — the wave file said "default to JSONB-on-profiles
// unless a real table is justified" and the project rule is "never run a
// DB migration without the user explicitly asking". Read-modify-write
// merge keeps the rest of `preferences.*` (onboarding, language, etc.)
// intact, mirrors the OnboardingScreen pattern.
//
// Defensive parser: the JSON column is fluid — a malformed entry shape is
// silently dropped, and an entirely malformed list defaults to empty so
// the screen always renders. The mutation is optimistic with rollback on
// failure (matches the useUpdateGarment pattern in useGarments.ts).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { captureMutationError } from '../lib/sentry';

export type ShoppingListPriority = 1 | 2 | 3;

export interface ShoppingListEntry {
  id: string;
  gap_id: string;
  category: string;
  priority: ShoppingListPriority;
  notes?: string;
  /** ISO timestamp. */
  added_at: string;
}

export interface ShoppingList {
  entries: ShoppingListEntry[];
  /** ISO timestamp. */
  updated_at: string;
}

const EMPTY_LIST: ShoppingList = { entries: [], updated_at: '' };

function isPriority(value: unknown): value is ShoppingListPriority {
  return value === 1 || value === 2 || value === 3;
}

function parseEntry(value: unknown): ShoppingListEntry | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const { id, gap_id, category, priority, notes, added_at } = obj;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof gap_id !== 'string' || gap_id.length === 0) return null;
  if (typeof category !== 'string' || category.length === 0) return null;
  if (!isPriority(priority)) return null;
  if (typeof added_at !== 'string' || added_at.length === 0) return null;
  const entry: ShoppingListEntry = {
    id,
    gap_id,
    category,
    priority,
    added_at,
  };
  if (typeof notes === 'string' && notes.length > 0) {
    entry.notes = notes;
  }
  return entry;
}

/**
 * Defensive parser — accepts the raw `preferences.shopping_list_jsonb`
 * value and returns a strictly-typed `ShoppingList`. Anything malformed
 * downgrades to an empty list rather than throwing.
 */
export function parseShoppingList(value: unknown): ShoppingList {
  if (!value || typeof value !== 'object') return EMPTY_LIST;
  const obj = value as Record<string, unknown>;
  const rawEntries = Array.isArray(obj.entries) ? obj.entries : [];
  const entries: ShoppingListEntry[] = [];
  for (const raw of rawEntries) {
    const parsed = parseEntry(raw);
    if (parsed) entries.push(parsed);
  }
  const updated_at =
    typeof obj.updated_at === 'string' ? obj.updated_at : '';
  return { entries, updated_at };
}

/**
 * Reader — pulls `profiles.preferences.shopping_list_jsonb` for the
 * signed-in user via PostgREST. RLS already restricts to the caller's row;
 * the explicit `.eq('id', user.id)` is defensive and matches sibling hooks.
 */
export function useShoppingList(): {
  entries: ShoppingListEntry[];
  list: ShoppingList;
  isLoading: boolean;
  error: Error | null;
} {
  const { user } = useAuth();

  const query = useQuery<ShoppingList, Error>({
    queryKey: ['shoppingList', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return EMPTY_LIST;
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      const prefs = (data?.preferences ?? null) as
        | Record<string, unknown>
        | null;
      const raw = prefs ? prefs.shopping_list_jsonb : null;
      return parseShoppingList(raw);
    },
  });

  return {
    entries: query.data?.entries ?? [],
    list: query.data ?? EMPTY_LIST,
    isLoading: query.isLoading,
    error: query.error ?? null,
  };
}

/**
 * Writer — replaces the shopping list with `entries`. Optimistic update
 * + rollback on error so the UI doesn't lag behind the user's tap.
 *
 * Read-modify-write of `profiles.preferences` so we never clobber
 * sibling keys (`onboarding.*`, `language`, etc.). Mirrors the merge
 * pattern in `OnboardingScreen.tsx`.
 */
export function useSaveShoppingList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<
    ShoppingList,
    Error,
    ShoppingListEntry[],
    { previous: ShoppingList | undefined }
  >({
    mutationFn: async (entries: ShoppingListEntry[]) => {
      if (!user) throw new Error('Not authenticated');
      // Defensive cap so a runaway loop / bug can't balloon the JSONB
      // column past a sane payload size. 200 is comfortably above the
      // realistic max for a single user's must-have shortlist.
      if (entries.length > 200) {
        throw new Error('Shopping list too large (max 200 entries)');
      }

      // Read-modify-write — fetch the current prefs row, merge in the new
      // shopping_list_jsonb blob, write back. Concurrent edits from the
      // same device are not expected (single screen, single user) so a
      // simple read-modify-write is fine; the OnboardingScreen path uses
      // the same shape.
      const { data: existing, error: readError } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle();
      if (readError) throw readError;

      const prevPrefs = (existing?.preferences ?? {}) as Record<
        string,
        unknown
      >;
      const nextList: ShoppingList = {
        entries,
        updated_at: new Date().toISOString(),
      };
      const mergedPrefs = {
        ...prevPrefs,
        shopping_list_jsonb: nextList,
      };

      const { error: writeError } = await supabase
        .from('profiles')
        .update({ preferences: mergedPrefs })
        .eq('id', user.id);
      if (writeError) throw writeError;

      return nextList;
    },
    onMutate: async (entries) => {
      // Optimistic — patch the cached shopping list immediately so the
      // screen reflects the save before the round-trip lands.
      await queryClient.cancelQueries({
        queryKey: ['shoppingList', user?.id],
      });
      const previous = queryClient.getQueryData<ShoppingList>([
        'shoppingList',
        user?.id,
      ]);
      const optimistic: ShoppingList = {
        entries,
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData(['shoppingList', user?.id], optimistic);
      return { previous };
    },
    onError: (err, _entries, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(
          ['shoppingList', user?.id],
          context.previous,
        );
      }
      captureMutationError('useSaveShoppingList')(err);
    },
    onSuccess: (data) => {
      // Land the freshly-written list in cache so a navigation away +
      // back doesn't reset to the optimistic snapshot.
      queryClient.setQueryData(['shoppingList', user?.id], data);
    },
    onSettled: () => {
      // Refresh from server so the canonical updated_at + any concurrent
      // edits land. We don't invalidate `['profile', user?.id]` because
      // `AuthContext.profile` is plain React state, not a React-Query
      // cache entry — the invalidation would be a no-op.
      queryClient.invalidateQueries({
        queryKey: ['shoppingList', user?.id],
      });
    },
  });
}
