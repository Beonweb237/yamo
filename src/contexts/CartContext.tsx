import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { MenuItem } from '../data/mockData';

export interface CartItem {
  item: MenuItem;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  /** Restaurant du panier en cours (un panier = un seul restaurant) */
  restaurantId: string | null;
  /**
   * Ajoute l'article au panier. Retourne 'conflict' (sans rien ajouter) si le
   * panier contient déjà des articles d'un autre restaurant.
   */
  addToCart: (item: MenuItem) => 'added' | 'conflict';
  /** Vide le panier puis ajoute l'article (résolution d'un conflit de restaurant) */
  replaceCartWith: (item: MenuItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const restaurantId = items[0]?.item.restaurantId ?? null;

  const addToCart = useCallback((item: MenuItem): 'added' | 'conflict' => {
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
      return [...prev, { item, quantity: 1 }];
    });
    return result;
  }, []);

  const replaceCartWith = useCallback((item: MenuItem) => {
    setItems([{ item, quantity: 1 }]);
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
