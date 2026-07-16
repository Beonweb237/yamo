import { useEffect, useRef } from 'react';

/**
 * Polling raisonné (CONF-24 — remplace les setInterval 5 s dispersés).
 *
 * - Intervalle minimal imposé : 15 s (CLAUDE.md interdit tout polling < 15 s
 *   sur le réseau 3G/batterie du terrain camerounais).
 * - Pause automatique quand l'onglet est masqué (`visibilitychange`),
 *   tick immédiat au retour sur l'onglet.
 * - Tick initial au montage.
 *
 * Conventions d'intervalle : 15 000 ms pour les vues opérationnelles
 * (commandes restaurant, courses livreur, suivi client actif) ;
 * 30 000-60 000 ms pour l'admin et les historiques.
 *
 * Remplacement cible à terme : WebSocket/Socket.IO côté VPS.
 */
export function usePolling(fetcher: () => void | Promise<void>, intervalMs: number) {
  const savedFetcher = useRef(fetcher);
  useEffect(() => {
    savedFetcher.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    const effectiveMs = Math.max(15000, intervalMs);
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      void savedFetcher.current();
    };
    const start = () => {
      if (timer !== null) return;
      timer = setInterval(tick, effectiveMs);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        tick();
        start();
      }
    };

    tick();
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs]);
}
