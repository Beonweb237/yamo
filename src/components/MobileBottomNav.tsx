import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Package, Heart, User, ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useTranslation } from 'react-i18next';

const tabs = [
  { path: '/', label: 'Accueil', icon: Home },
  { path: '/restaurants', label: 'Explorer', icon: Search },
  { path: '/commandes', label: 'Commandes', icon: Package },
  { path: '/favoris', label: 'Favoris', icon: Heart },
  { path: '/profil', label: 'Compte', icon: User },
];

const hideOnPaths = ['/admin', '/partenaires/dashboard', '/livreurs/dashboard'];

export default function MobileBottomNav() {
  const location = useLocation();
  const { totalItems } = useCart();
  const { t } = useTranslation();

  // Hide on back-office routes
  if (hideOnPaths.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border-custom shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-1 py-1 flex items-center justify-around">
        {tabs.map((tab) => {
            const { t } = useTranslation();
          const isActive = tab.path === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.path.split('?')[0]);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0 ${isActive ? 'text-green-primary' : 'text-text-muted'
                }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-inter font-medium truncate">{t('nav.' + tab.label.toLowerCase(), tab.label)}</span>
            </Link>
          );
        })}
        {totalItems > 0 && (
          <Link
            to="/checkout"
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0 relative ${location.pathname === '/checkout' ? 'text-green-primary' : 'text-text-muted'
              }`}
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="text-[10px] font-inter font-medium truncate">{t("Panier")}</span>
            <span className="absolute -top-0.5 right-0 bg-green-primary text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {totalItems > 9 ? '9+' : totalItems}
            </span>
          </Link>
        )}
      </nav>
      <div className="md:hidden h-14" /> {/* spacer */}
    </>
  );
}
