import { useState, useCallback } from 'react';

const FAVORITE_DISHES_KEY = 'yamo_favorite_dishes';

function readFavoriteDishes(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(FAVORITE_DISHES_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

/** Favoris plats (par nom de plat normalisé — group.key) persistés dans localStorage. */
export function useFavoriteDishes() {
  const [favoriteDishes, setFavoriteDishes] = useState<Set<string>>(readFavoriteDishes);

  const toggleFavoriteDish = useCallback((key: string) => {
    setFavoriteDishes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(FAVORITE_DISHES_KEY, JSON.stringify([...next]));
      } catch {
        // stockage plein ou indisponible : les favoris restent en mémoire
      }
      return next;
    });
  }, []);

  return { favoriteDishes, toggleFavoriteDish };
}
