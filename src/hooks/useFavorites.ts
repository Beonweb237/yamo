import { useState, useCallback } from 'react';

const FAVORITES_KEY = 'yamo_favorite_restaurants';

function readFavorites(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

/** Favoris restaurants persistés dans localStorage. */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(readFavorites);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      } catch {
        // stockage plein ou indisponible : les favoris restent en mémoire
      }
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}
