import { type ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  Bike, Home, LayoutDashboard, LogOut, ShoppingBag, Store, Menu, X,
  Package, Utensils, User, Wallet, AlertTriangle, UserCheck, UserCircle, ChevronDown, ChefHat,
  MapPin, DollarSign, Image, Users, MessageSquare, Trash2, Coins, Gauge, ShieldCheck,
  Layers, Settings, LifeBuoy, UserPlus, RadioTower, Palette, HeartPulse, UtensilsCrossed, BadgePercent,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasAdminPermission, primaryAdminRoleLabel } from '../lib/adminRbac';
import { fetchAllOrders } from '../lib/orders';
import { fetchAllIncidents } from '../lib/incidents';
import { fetchOperations } from '../lib/operations';
import NetworkBanner from './NetworkBanner';
import ScrollToTop from './ScrollToTop';
import { useTranslation } from "react-i18next";

interface SidebarLink {
  name: string;
  path: string;
  icon: typeof LayoutDashboard;
  permission?: string;
}

interface CategoryGroup {
  label: string;
  icon: typeof Layers;
  children: SidebarLink[];
}

// Catégories accordéon pour l'admin
const adminCategories: CategoryGroup[] = [
  {
    label: 'Pilotage',
    icon: LayoutDashboard,
    children: [
      { name: 'Tableau de bord', path: '/admin/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
      { name: 'Commandes', path: '/admin/orders', icon: ShoppingBag, permission: 'orders.view' },
      { name: 'Candidatures', path: '/admin/applications', icon: UserCheck, permission: 'applications.view' },
    ],
  },
  {
    label: 'Supervision',
    icon: RadioTower,
    children: [
      { name: 'Centre opérations', path: '/admin/operations', icon: RadioTower, permission: 'operations.view' },
      { name: 'Centre KYC', path: '/admin/kyc', icon: ShieldCheck, permission: 'kyc.view' },
    ],
  },
  {
    label: 'Utilisateurs',
    icon: Users,
    children: [
      { name: 'Clients', path: '/admin/customers', icon: Users, permission: 'customers.view' },
      { name: 'Restaurants', path: '/admin/restaurants', icon: Store, permission: 'restaurants.view' },
      { name: 'Livreurs', path: '/admin/drivers', icon: Bike, permission: 'couriers.view' },
    ],
  },
  {
    label: 'Contenu',
    icon: Layers,
    children: [
      { name: 'Catalogue plats', path: '/admin/dishes', icon: ChefHat, permission: 'dishes.manage' },
      { name: 'Avis', path: '/admin/reviews', icon: MessageSquare, permission: 'reviews.view' },
      { name: 'Médiathèque', path: '/admin/media', icon: Image, permission: 'media.manage' },
    ],
  },
  {
    label: 'Finances',
    icon: Coins,
    children: [
      { name: 'Centre Financier', path: '/admin/finance', icon: Coins, permission: 'finance.dashboard.view' },
      { name: 'Points', path: '/admin/points', icon: Coins, permission: 'points.manage' },
    ],
  },
  {
    label: 'Configuration',
    icon: Settings,
    children: [
      { name: 'Apparence', path: '/admin/apparence', icon: Palette, permission: 'appearance.manage' },
      { name: 'Promotions', path: '/admin/promotions', icon: BadgePercent, permission: 'promotions.manage' },
      { name: 'Zones', path: '/admin/zones', icon: MapPin, permission: 'zones.manage' },
      { name: 'Frais livraison', path: '/admin/delivery-fees', icon: DollarSign, permission: 'delivery_fees.manage' },
      { name: 'Rôles & accès', path: '/admin/roles', icon: ShieldCheck, permission: 'admin.roles.view' },
      { name: 'Quotas', path: '/admin/quotas', icon: Gauge, permission: 'quotas.manage' },
    ],
  },
  {
    label: 'Alimentaire',
    icon: HeartPulse,
    children: [
      { name: 'Validation programmes', path: '/admin/programmes-validation', icon: ShieldCheck, permission: 'food.subscriptions.manage' },
      { name: 'Abonnements', path: '/admin/subscriptions', icon: HeartPulse, permission: 'food.subscriptions.view' },
    ],
  },
  {
    label: 'Support',
    icon: LifeBuoy,
    children: [
      { name: 'Litiges', path: '/admin/disputes', icon: AlertTriangle, permission: 'orders.disputes.resolve' },
      { name: 'Corbeille', path: '/admin/trash', icon: Trash2, permission: 'trash.manage' },
    ],
  },
];

const restaurantSidebar: SidebarLink[] = [
  { name: 'Commandes', path: '/partenaires/dashboard', icon: Package },
  { name: 'Menu', path: '/partenaires/dashboard/menu', icon: Utensils },
  { name: 'Demandes', path: '/partenaires/dashboard/demandes', icon: UtensilsCrossed },
  { name: 'Programmes', path: '/partenaires/dashboard/programmes', icon: HeartPulse },
  { name: 'Livreurs', path: '/partenaires/dashboard/livreurs', icon: Bike },
  { name: 'Finances', path: '/partenaires/dashboard/finances', icon: Wallet },
  { name: 'Profil', path: '/partenaires/dashboard/profile', icon: User },
];

const driverSidebar: SidebarLink[] = [
  { name: 'Disponibles', path: '/livreurs/dashboard', icon: Bike },
  { name: 'Mes courses', path: '/livreurs/dashboard/courses', icon: Package },
  { name: 'Gains', path: '/livreurs/dashboard/gains', icon: Wallet },
];

const roleSidebars: Record<string, SidebarLink[]> = {
  admin: [],
  restaurant: restaurantSidebar,
  livreur: driverSidebar,
};

// Top nav links used on desktop (for admin to jump between restaurant/driver dashboards)
const adminTopLinks = [
  { name: 'Restaurants', path: '/partenaires/dashboard', icon: Store },
  { name: 'Livraisons', path: '/livreurs/dashboard', icon: Bike },
];

export default function BackOfficeLayout({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Espaces privés (dashboards resto/livreur + admin) : jamais indexés.
  useEffect(() => {
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, follow');
    return () => { document.head.querySelector('meta[name="robots"]')?.remove(); };
  }, []);

  // Compteur de litiges ouverts (CONF-20) — badge sur l'entrée « Litiges »,
  // admin uniquement, rafraîchi toutes les 30 s (pas de polling agressif).
  const [openDisputesCount, setOpenDisputesCount] = useState(0);
  useEffect(() => {
    if (user?.role !== 'admin' || !hasAdminPermission(user, 'orders.disputes.resolve')) return;
    const load = () => {
      Promise.all([fetchAllOrders(), fetchAllIncidents()]).then(([orders, incidents]) => {
        const cancellations = orders.filter((o) => o.status === 'cancelled' && !o.disputeResolved).length;
        const open = incidents.filter((i) => i.status === 'open').length;
        setOpenDisputesCount(cancellations + open);
      });
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user, user?.role, location.pathname]);

  // Compteur de commandes CRITIQUES (Centre Opérations) — badge sur l'entrée
  // « Centre opérations », gated sur operations.view, rafraîchi toutes les 30 s.
  const [opsCritical, setOpsCritical] = useState(0);
  useEffect(() => {
    if (user?.role !== 'admin' || !hasAdminPermission(user, 'operations.view')) return;
    let alive = true;
    const load = () => {
      fetchOperations()
        .then((snap) => { if (alive) setOpsCritical(snap.counts.critical); })
        .catch(() => { /* silencieux : badge simplement absent */ });
    };
    load();
    const interval = setInterval(load, 30000);
    return () => { alive = false; clearInterval(interval); };
  }, [user, user?.role, location.pathname]);

  const roleLabels: Record<string, string> = {
    client: 'Client', restaurant: 'Restaurateur', livreur: 'Livreur', admin: primaryAdminRoleLabel(user),
  };

  // Show sidebar based on current path context, not just role.
  // This way an admin visiting /partenaires/dashboard sees the restaurant sidebar,
  // an admin visiting /livreurs/dashboard sees the driver sidebar, etc.
  const contextualRole: string =
    location.pathname.startsWith('/partenaires/dashboard') ? 'restaurant' :
      location.pathname.startsWith('/livreurs/dashboard') ? 'livreur' :
        user?.role ?? 'client';
  const rawLinks = roleSidebars[contextualRole] ?? [];
  const links = contextualRole === 'admin'
    ? rawLinks.filter((link) => hasAdminPermission(user, link.permission))
    : rawLinks;

  // Catégories filtrées par permission (admin uniquement)
  const filteredCategories = contextualRole === 'admin'
    ? adminCategories
      .map((cat) => ({
        ...cat,
        children: cat.children.filter((link) => hasAdminPermission(user, link.permission)),
      }))
      .filter((cat) => cat.children.length > 0)
    : [];

  // Accordéon au survol
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const categoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCategoryEnter = (label: string) => {
    if (categoryTimerRef.current) clearTimeout(categoryTimerRef.current);
    setHoveredCategory(label);
  };

  const handleCategoryLeave = () => {
    // Petit délai pour éviter le clignotement
    categoryTimerRef.current = setTimeout(() => setHoveredCategory(null), 150);
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === '/admin/dashboard' || path === '/partenaires/dashboard' || path === '/livreurs/dashboard') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-bg-secondary font-inter">
      {/* Top bar — WordPress-style */}
      <header className="fixed top-0 left-0 right-0 z-50 h-[56px] bg-[#1E293B] text-white flex items-center">
        <div className="w-full flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 rounded-lg text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to={user?.role === 'admin' ? '/admin/dashboard' : '/'} className="flex items-center gap-2">
              <img src="/logo-icon.png" alt="MiamExpress" className="w-7 h-7 object-contain" />
              <span className="font-poppins font-bold text-white text-base">{t("MiamExpress")}</span>
            </Link>

            {/* Admin quick-jump links (desktop only) */}
            {user?.role === 'admin' && (hasAdminPermission(user, 'restaurants.view') || hasAdminPermission(user, 'couriers.view')) && (
              <nav className="hidden lg:flex items-center gap-1 ml-6">
                {adminTopLinks.filter((link) => link.path.startsWith('/partenaires') ? hasAdminPermission(user, 'restaurants.view') : hasAdminPermission(user, 'couriers.view')).map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="flex items-center gap-1 px-2 h-8 rounded text-xs font-inter font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <link.icon className="w-3.5 h-3.5" />
                    {t(link.name)}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {/* Right side — WordPress-style profile dropdown */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-3 h-9 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-green-primary flex items-center justify-center shrink-0">
                  <UserCircle className="w-4 h-4 text-white" />
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <p className="text-xs font-inter font-medium text-white">{user.phone}</p>
                  <p className="text-[10px] font-inter text-white/50">{roleLabels[user.role] || user.role}</p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-white/50 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl border border-border-custom shadow-lg z-20 overflow-hidden">
                    <div className="p-3 border-b border-border-light">
                      <p className="text-sm font-inter font-semibold text-text-primary">{user.phone}</p>
                      <p className="text-xs text-text-muted font-inter">{roleLabels[user.role] || user.role}</p>
                    </div>
                    <div className="p-1">
                      <Link
                        to="/profil"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-3 h-9 rounded-lg text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
                      >
                        <UserCircle className="w-4 h-4" />
                        {t("Mon profil")}
                      </Link>
                      <Link
                        to="/"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-3 h-9 rounded-lg text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
                      >
                        <Home className="w-4 h-4" />
                        {t("Voir le site")}
                      </Link>
                      <button
                        onClick={() => { signOut(); setProfileOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 h-9 rounded-lg text-sm text-error hover:bg-error/5 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        {t("Se déconnecter")}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link to="/connexion" className="text-sm font-inter font-medium text-white/70 hover:text-white transition-colors">
              {t("Connexion")}
            </Link>
          )}
        </div>
      </header>

      <NetworkBanner topOffset={56} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-[56px] left-0 bottom-0 z-40 w-[240px] bg-white border-r border-border-custom overflow-y-auto transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="p-4 pt-6">
          <div className="flex items-center justify-between mb-6 lg:hidden">
            <span className="font-poppins font-semibold text-text-primary text-sm">{t("Navigation")}</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-11 h-11 rounded-lg text-text-secondary hover:bg-bg-secondary flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <nav className="flex flex-col gap-0.5">
            {/* Admin : accordéon par catégories */}
            {contextualRole === 'admin' && filteredCategories.length > 0 && filteredCategories.map((cat) => {
              const isOpen = hoveredCategory === cat.label;
              const hasActiveChild = cat.children.some((l) => isActive(l.path));
              return (
                <div
                  key={cat.label}
                  className="relative"
                  onMouseEnter={() => handleCategoryEnter(cat.label)}
                  onMouseLeave={handleCategoryLeave}
                >
                  {/* Header de la catégorie */}
                  <div
                    className={`flex items-center gap-2.5 px-3 h-10 rounded-lg text-sm font-inter font-medium transition-colors cursor-default ${hasActiveChild && !isOpen ? 'bg-green-light/50 text-green-primary' : 'text-text-secondary'
                      }`}
                  >
                    <cat.icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{t(cat.label)}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                    />
                  </div>

                  {/* Enfants (déroulés au survol) */}
                  <div
                    className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                      }`}
                  >
                    <div className="pl-3 pt-0.5 pb-1 space-y-0.5 border-l-2 border-green-primary/20 ml-4">
                      {cat.children.map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-inter font-medium transition-colors ${isActive(link.path)
                            ? 'bg-green-light text-green-primary'
                            : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                            }`}
                        >
                          <link.icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1">{t(link.name)}</span>
                          {link.path === '/admin/disputes' && openDisputesCount > 0 && (
                            <span className="bg-error text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center" aria-label={`${openDisputesCount} litiges ouverts`}>
                              {openDisputesCount > 99 ? '99+' : openDisputesCount}
                            </span>
                          )}
                          {link.path === '/admin/operations' && opsCritical > 0 && (
                            <span className="bg-error text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center" aria-label={`${opsCritical} commandes critiques`}>
                              {opsCritical > 99 ? '99+' : opsCritical}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Restaurant / Livreur : liste plate */}
            {contextualRole !== 'admin' && links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-2.5 px-3 h-10 rounded-lg text-sm font-inter font-medium transition-colors ${isActive(link.path)
                  ? 'bg-green-light text-green-primary'
                  : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                  }`}
              >
                <link.icon className="w-4 h-4 shrink-0" />
                {t(link.name)}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main content area */}
      <div className="lg:pl-[240px] pt-[56px]">
        <main className="min-h-[calc(100vh-56px)]">
          {children ?? <Outlet />}
        </main>
      </div>
      <ScrollToTop />
    </div>
  );
}



