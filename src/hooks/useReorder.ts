import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useCart } from '../contexts/CartContext';
import { fetchMenuItems } from '../lib/catalog';
import type { Order } from '../lib/orders';

// Re-commande 1-clic : reconstruit le panier à partir d'une commande passée en
// re-matchant chaque ligne au MENU ACTUEL du restaurant (par id, puis par nom).
// Les plats devenus indisponibles sont ignorés (toast informatif). `loadCart`
// remplace tout le panier — la re-commande écrase donc un panier d'un autre resto.
// Logique alignée sur celle de Orders.tsx (source unique réutilisable).
export function useReorder() {
  const { loadCart } = useCart();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [reordering, setReordering] = useState(false);

  const reorder = useCallback(async (order: Order): Promise<boolean> => {
    setReordering(true);
    try {
      const menu = await fetchMenuItems(order.restaurantId);
      const matched: { item: (typeof menu)[number]; quantity: number; baseItemId: string }[] = [];
      const missing: string[] = [];
      for (const line of order.items) {
        const byId = line.baseItemId ? menu.find((m) => m.id === line.baseItemId) : undefined;
        // Plat personnalisé : nom composite « Plat + Option » → on retombe sur le plat de base.
        const baseName = line.name.split(' + ')[0].trim();
        const found = byId ?? menu.find((m) => m.name === line.name) ?? menu.find((m) => m.name === baseName);
        if (found && found.isAvailable !== false) {
          const existing = matched.find((mLine) => mLine.item.id === found.id);
          if (existing) existing.quantity += line.quantity;
          else matched.push({ item: found, quantity: line.quantity, baseItemId: found.id });
        } else {
          missing.push(line.name);
        }
      }
      if (matched.length === 0) {
        toast.error(t('Aucun de ces plats n’est encore disponible chez ce restaurant.'));
        return false;
      }
      loadCart(matched);
      if (missing.length > 0) {
        toast.info(`${missing.length} ${t('article(s) indisponible(s), non repris :')} ${missing.join(', ')}`, { duration: 8000 });
      }
      const count = matched.reduce((s, mLine) => s + mLine.quantity, 0);
      toast.success(`${t('Panier rechargé :')} ${count} ${t('article(s) de')} ${order.restaurantName || t('votre commande')}.`);
      navigate('/checkout');
      return true;
    } finally {
      setReordering(false);
    }
  }, [loadCart, navigate, t]);

  return { reorder, reordering };
}
