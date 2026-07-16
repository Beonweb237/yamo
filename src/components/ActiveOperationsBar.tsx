import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Package, ShoppingCart, Truck, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { useActiveOperations, type ActiveOperation } from '../hooks/useActiveOperations';

// Masqué sur les mêmes routes back-office que MobileBottomNav — ce raccourci
// ne concerne que le parcours client.
const hideOnPaths = ['/admin', '/partenaires/dashboard', '/livreurs/dashboard'];

function iconFor(op: ActiveOperation): LucideIcon {
  if (op.type === 'order') return op.orderInTransit ? Truck : Package;
  if (op.type === 'cart') return ShoppingCart;
  return UtensilsCrossed;
}

export default function ActiveOperationsBar() {
  const location = useLocation();
  const operations = useActiveOperations();

  if (hideOnPaths.some((p) => location.pathname.startsWith(p))) return null;
  if (operations.length === 0) return null;

  // Les fiches plat (/article/:slug) ont leur propre barre fixe pleine largeur
  // en bas d'écran (DishDetail.tsx) : décaler ce widget au-dessus pour éviter
  // qu'il ne soit masqué derrière (même zone bas-écran, z-index plus faible).
  const isDishDetail = location.pathname.startsWith('/article/');

  return (
    <div className={`fixed z-30 inset-x-0 ${isDishDetail ? 'bottom-32 md:bottom-[88px]' : 'bottom-[64px] md:bottom-6'} md:inset-x-auto md:right-6 flex flex-col gap-2 px-3 md:px-0 md:w-full md:max-w-sm pointer-events-none`}>
      {operations.map((op) => {
        const Icon = iconFor(op);
        return (
          <Link
            key={op.key}
            to={op.to}
            className="pointer-events-auto flex items-center gap-3 bg-white border border-border-custom shadow-[0_4px_16px_rgba(0,0,0,0.14)] rounded-full pl-3 pr-4 py-2 hover:shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition-shadow"
          >
            <span className="shrink-0 w-9 h-9 rounded-full bg-green-light text-green-primary flex items-center justify-center">
              <Icon className="w-4 h-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-inter font-semibold text-text-primary truncate">{op.label}</span>
              <span className="block text-[11px] font-inter text-text-secondary truncate">{op.detail}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}
