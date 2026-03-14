/**
 * useSupabaseQuery — Generic wrapper for authenticated Supabase queries.
 * Step 20: Reduces boilerplate across data hooks.
 */
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- filter builder type requires dynamic table generics
type SupabaseFilterBuilder = ReturnType<ReturnType<typeof supabase.from>['select']>;

interface SupabaseQueryOptions<T> {
  /** React Query cache key */
  queryKey: unknown[];
  /** Table name in public schema */
  table: string;
  /** Supabase select string (default: '*') */
  select?: string;
  /** Additional filters applied to the query builder */
  filters?: (query: SupabaseFilterBuilder) => SupabaseFilterBuilder;
  /** Whether auth is required (default: true) */
  requireAuth?: boolean;
  /** Zod schema for response validation */
  schema?: z.ZodType<T>;
  /** Whether to return a single row (default: false) */
  single?: boolean;
  /** React Query staleTime override */
  staleTime?: number;
  /** Only run when truthy (in addition to auth check) */
  enabled?: boolean;
}

export function useSupabaseQuery<T = unknown>(opts: SupabaseQueryOptions<T>) {
  const { user } = useAuth();
  const {
    queryKey,
    table,
    select = '*',
    filters,
    requireAuth = true,
    schema,
    single = false,
    staleTime,
    enabled = true,
  } = opts;

  return useQuery({
    queryKey: requireAuth ? [...queryKey, user?.id] : queryKey,
    queryFn: async () => {
      if (requireAuth && !user) return single ? null : [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name from caller
      let query = supabase.from(table as any).select(select);

      if (requireAuth && user) {
        query = query.eq('user_id', user.id);
      }

      if (filters) {
        query = filters(query);
      }

      if (single) {
        const { data, error } = await query.single();
        if (error) throw error;
        if (schema) {
          const result = schema.safeParse(data);
          return (result.success ? result.data : data) as T;
        }
        return data as T;
      }

      const { data, error } = await query;
      if (error) throw error;

      if (schema && Array.isArray(data)) {
        return data.map((item) => {
          const result = schema.safeParse(item);
          return result.success ? result.data : item;
        }) as T;
      }

      return data as T;
    },
    enabled: requireAuth ? !!user && enabled : enabled,
    staleTime: staleTime ?? 2 * 60 * 1000,
  } as UseQueryOptions);
}
