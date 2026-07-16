import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { fetchOrders, getOrderPreparationMessage, type Order, type OrderStatus } from '../lib/orders';

// Même clé que FoodRequestCreate.tsx (voir CLAUDE.md § clés localStorage) —
// à garder synchronisée si elle change là-bas.
const FOOD_REQUEST_DRAFT_KEY = 'miam_draft_food_request';

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivering',
];

// >=15s pour respecter la règle "pas de polling agressif" (voir CLAUDE.md).
const POLL_INTERVAL_MS = 20000;

export interface ActiveOperation {
  type: 'order' | 'cart' | 'foodRequestDraft';
  key: string;
  label: string;
  detail: string;
  to: string;
  /** type: 'order' uniquement — pour choisir l'icône (colis vs. en route). */
  orderInTransit?: boolean;
}

function readFoodRequestDraftTitle(): string | null {
  try {
    const raw = localStorage.getItem(FOOD_REQUEST_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { title?: string; dishes?: unknown[] } | null;
    // Un brouillon jamais rempli (titre vide, aucun plat) ne mérite pas de raccourci.
    if (!parsed || (!parsed.title && !(Array.isArray(parsed.dishes) && parsed.dishes.length > 0))) return null;
    return parsed.title || 'Brouillon sans titre';
  } catch {
    return null;
  }
}

export function useActiveOperations(): ActiveOperation[] {
  const { user } = useAuth();
  const { totalItems, totalPrice } = useCart();
  const location = useLocation();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = () => {
      fetchOrders(user.id).then((orders) => {
        if (cancelled) return;
        setActiveOrder(orders.find((o) => ACTIVE_ORDER_STATUSES.includes(o.status)) ?? null);
      });
    };
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  // Simple lecture localStorage (pas de polling nécessaire) : relue à chaque
  // rendu, ce qui suffit à refléter sa création/suppression après navigation.
  const draftTitle = readFoodRequestDraftTitle();

  const operations: ActiveOperation[] = [];

  if (user && activeOrder && !location.pathname.startsWith('/commandes')) {
    operations.push({
      type: 'order',
      key: `order-${activeOrder.id}`,
      label: getOrderPreparationMessage(activeOrder) ?? 'Commande en cours',
      detail: activeOrder.restaurantName,
      to: '/commandes',
      orderInTransit: activeOrder.status === 'picked_up' || activeOrder.status === 'delivering',
    });
  }

  if (totalItems > 0 && location.pathname !== '/checkout') {
    operations.push({
      type: 'cart',
      key: 'cart',
      label: `${totalItems} article${totalItems > 1 ? 's' : ''} au panier`,
      detail: `${totalPrice.toLocaleString()} FCFA`,
      to: '/checkout',
    });
  }

  if (draftTitle && !location.pathname.startsWith('/demandes/nouvelle')) {
    operations.push({
      type: 'foodRequestDraft',
      key: 'food-request-draft',
      label: 'Demande de plat en brouillon',
      detail: draftTitle,
      to: '/demandes/nouvelle',
    });
  }

  return operations;
}
