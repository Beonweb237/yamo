import { useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type RealtimeCallback<T> = (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: T; old: T }) => void;

/**
 * Subscribes to Supabase Realtime changes on a table.
 * Falls back to polling (via `pollIntervalMs`) when Supabase isn't configured
 * (local dev with VITE_FORCE_MOCK_AUTH=true) or the subscription fails.
 */
export function useRealtime<T extends Record<string, unknown>>(
  table: string,
  callback: RealtimeCallback<T>,
  pollIntervalMs = 5000,
) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchRef = useRef<(() => Promise<T[]>) | null>(null);

  const setFetcher = useCallback((fn: () => Promise<T[]>) => {
    fetchRef.current = fn;
  }, []);

  useEffect(() => {
    if (!fetchRef.current) return;

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel(`realtime:${table}`)
        .on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table },
          (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: T; old: T }) => {
            callback(payload);
          },
        )
        .subscribe();

      return () => {
        supabase?.removeChannel(channel);
      };
    }

    // Fallback: polling
    pollRef.current = setInterval(() => {
      fetchRef.current?.();
    }, pollIntervalMs);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [table, callback, pollIntervalMs]);

  return { setFetcher };
}
