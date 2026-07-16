import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { MenuItem } from '../data/mockData';

export interface CartItem {
  item: MenuItem;
  quantity: number;
  /**
   * Id du plat d'origine au menu. Identique à `item.id` pour un plat simple ;
   * pour un plat personnalisé, `item.id` devient un id composite
   * (base + variante + suppléments) afin que chaque combinaison soit une
   * ligne distincte du panier — `baseItemId` reste la référence serveur.
   */
  baseItemId: string;
}

// Persistance du panier (voir CLAUDE.md § clés localStorage).
const CART_KEY = 'yamo_cart';
// Au-delà de 24 h, le panier est considéré périmé (prix/disponibilités ont pu changer).
const CART_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredCart {
  savedAt: number;
  items: CartItem[];
}

function readStoredCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredCart>;
    if (!parsed || !Array.isArray(parsed.items)) return [];
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > CART_TTL_MS) {
      localStorage.removeItem(CART_KEY);
      return [];
    }
    // Valide la forme minimale de chaque ligne ; tolère les paniers écrits
    // avant l'ajout de `baseItemId` (fallback sur l'id de l'article).
    return parsed.items
      .filter((ci): ci is CartItem =>
        Boolean(ci && typeof ci === 'object' && ci.item && typeof ci.item.id === 'string'
          && typeof ci.item.price === 'number' && typeof ci.quantity === 'number' && ci.quantity > 0))
      .map((ci) => ({ ...ci, baseItemId: ci.baseItemId ?? ci.item.id }));
  } catch {
    return [];
  }
}

interface CartContextType {
  items: CartItem[];
  /** Restaurant du panier en cours (un panier = un seul restaurant) */
  restaurantId: string | null;
  /**
   * Ajoute l'article au panier. Retourne 'conflict' (sans rien ajouter) si le
   * panier contient déjà des articles d'un autre restaurant.
   * `baseItemId` : id du plat d'origine quand `item` est une version personnalisée.
   */
  addToCart: (item: MenuItem, baseItemId?: string) => 'added' | 'conflict';
  /** Vide le panier puis ajoute l'article (résolution d'un conflit de restaurant) */
  replaceCartWith: (item: MenuItem, baseItemId?: string) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  /** Remplace tout le panier (re-commande 1-clic). */
  loadCart: (items: CartItem[]) => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readStoredCart);

  // Persiste chaque changement ; supprime la clé quand le panier est vide.
  useEffect(() => {
    try {
      if (items.length === 0) {
        localStorage.removeItem(CART_KEY);
      } else {
        const stored: StoredCart = { savedAt: Date.now(), items };
        localStorage.setItem(CART_KEY, JSON.stringify(stored));
      }
    } catch {
      // Stockage indisponible (quota, navigation privée) : le panier reste en mémoire.
    }
  }, [items]);

  const restaurantId = items[0]?.item.restaurantId ?? null;

  const addToCart = useCallback((item: MenuItem, baseItemId?: string): 'added' | 'conflict' => {
    let result: 'added' | 'conflict' = 'added';
    setItems((prev) => {
      const currentRestaurant = prev[0]?.item.restaurantId;
      if (currentRestaurant && currentRestaurant !== item.restaurantId) {
        result = 'conflict';
        return prev;
      }
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { item, quantity: 1, baseItemId: baseItemId ?? item.id }];
    });
    return result;
  }, []);

  const replaceCartWith = useCallback((item: MenuItem, baseItemId?: string) => {
    setItems([{ item, quantity: 1, baseItemId: baseItemId ?? item.id }]);
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((i) => i.item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.item.id !== itemId));
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.item.id === itemId ? { ...i, quantity } : i
        )
      );
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // Re-commande 1-clic (LOT-09) : remplace tout le panier par les lignes
  // fournies (déjà validées/re-matchées par l'appelant contre le catalogue).
  const loadCart = useCallback((newItems: CartItem[]) => {
    setItems(newItems);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.item.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        restaurantId,
        addToCart,
        replaceCartWith,
        removeFromCart,
        updateQuantity,
        clearCart,
        loadCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
