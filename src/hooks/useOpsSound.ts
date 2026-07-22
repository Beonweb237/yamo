import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'yamo_ops_sound';

// Bip d'alerte via WebAudio (aucun asset à charger — 3G friendly).
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => ctx.close().catch(() => {});
  } catch { /* audio indisponible : silencieux */ }
}

/**
 * Alerte sonore optionnelle quand le nombre de commandes CRITIQUES augmente.
 * Préférence persistée (`yamo_ops_sound`). Ne sonne jamais au premier rendu
 * (on mémorise le compteur initial), ni si le son est coupé.
 */
export function useOpsSound(criticalCount: number) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });
  const prev = useRef<number | null>(null);

  useEffect(() => {
    if (prev.current !== null && enabled && criticalCount > prev.current) beep();
    prev.current = criticalCount;
  }, [criticalCount, enabled]);

  const toggle = useCallback(() => {
    setEnabled((e) => {
      const next = !e;
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      if (next) beep(); // confirmation audible + débloque l'autoplay au clic
      return next;
    });
  }, []);

  return { enabled, toggle };
}
