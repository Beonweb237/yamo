import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Package, ShoppingCart, Truck, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { useActiveOperations, type ActiveOperation } from '../hooks/useActiveOperations';

// Masqué sur les routes back-office (comme MobileBottomNav) et sur les pages
// d'authentification/candidature, où le widget flottant chevauche la carte de
// formulaire — ce raccourci ne concerne que la navigation client.
const hideOnPaths = [
  '/admin',
  '/partenaires/dashboard',
  '/livreurs/dashboard',
  '/connexion',
  '/partenaires/connexion',
  '/livreurs/connexion',
  '/inscription',
  '/candidature',
];

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

  // Les fiches plat (/plat/:slug) et resto (/restaurant/:slug) ont leur
  // propre barre panier fixe en bas d'écran : décaler ce widget au-dessus pour
  // éviter qu'il ne soit masqué derrière (même zone bas-écran), et y masquer
  // le raccourci « panier », redondant avec leur barre dédiée.
  const hasOwnCartBar = location.pathname.startsWith('/plat/') || location.pathname.startsWith('/restaurant/');
  const visibleOperations = hasOwnCartBar ? operations.filter((op) => op.type !== 'cart') : operations;

  if (visibleOperations.length === 0) return null;

  return (
    // left/right : réserve le coin inférieur droit pour le bouton ScrollToTop
    // (fixed bottom-20 right-4 mobile / bottom-6 right-6 desktop, 44px) — les deux
    // éléments sont centrés verticalement l'un sur l'autre pour éviter tout chevauchement.
    <div className={`fixed z-30 left-0 right-16 ${hasOwnCartBar ? 'bottom-32 md:bottom-[88px]' : 'bottom-[76px] md:bottom-5'} md:left-auto md:right-[84px] flex flex-col gap-2 pl-3 md:pl-0 md:w-full md:max-w-sm pointer-events-none`}>
      {visibleOperations.map((op) => {
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
