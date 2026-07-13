import { useEffect, useState } from 'react';
import { fetchRestaurants, fetchRestaurant, fetchMenuItems } from '../lib/catalog';
import { restaurants as mockRestaurants, menuItems as mockMenuItems } from '../data/mockData';
import type { Restaurant, MenuItem } from '../data/mockData';

// These hooks return mock data synchronously on first render (no loading
// flash for the common no-backend case) and swap in live Supabase data
// once the fetch resolves, if configured.

export function useRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>(mockRestaurants);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchRestaurants().then((data) => {
      if (active) {
        setRestaurants(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return { restaurants, loading };
}

export function useRestaurant(id: string | undefined) {
  const fallback = mockRestaurants.find((r) => r.id === id) ?? mockRestaurants[0];
  const [restaurant, setRestaurant] = useState<Restaurant | undefined>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchRestaurant(id).then((data) => {
      if (active) {
        setRestaurant(data ?? fallback);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { restaurant, loading };
}

export function useMenuItems(restaurantId: string | undefined) {
  const [items, setItems] = useState<MenuItem[]>(
    mockMenuItems.filter((m) => m.restaurantId === restaurantId)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    let active = true;
    fetchMenuItems(restaurantId).then((data) => {
      if (active) {
        setItems(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [restaurantId]);

  return { items, loading };
}
