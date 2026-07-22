import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOperations, type OpsSnapshot } from '../lib/operations';

const POLL_MS = 30000; // 30 s — rafraîchissement raisonnable (contexte 3G).

export interface UseOperationsResult {
  data: OpsSnapshot | null;
  loading: boolean;      // premier chargement seulement
  refreshing: boolean;   // rechargement silencieux en arrière-plan
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

/**
 * Charge et rafraîchit le cliché du Centre Opérations toutes les 30 s.
 * - Ne montre le skeleton qu'au premier chargement ; les suivants sont silencieux.
 * - Se met en pause quand l'onglet est masqué (économie batterie/réseau) et
 *   recharge immédiatement au retour.
 */
export function useOperations(): UseOperationsResult {
  const [data, setData] = useState<OpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);

  const load = useCallback(async (silent: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (silent) setRefreshing(true);
    try {
      const snap = await fetchOperations();
      if (!mounted.current) return;
      setData(snap);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
      inFlight.current = false;
    }
  }, []);

  const refresh = useCallback(() => { void load(true); }, [load]);

  useEffect(() => {
    mounted.current = true;
    void load(false);
    let timer: ReturnType<typeof setInterval> | null = setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, POLL_MS);

    const onVisible = () => { if (document.visibilityState === 'visible') void load(true); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mounted.current = false;
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return { data, loading, refreshing, error, lastUpdated, refresh };
}
