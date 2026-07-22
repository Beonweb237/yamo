import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, User, Menu, X, Minus, Plus,
  ChevronDown, Home, Compass, Store, UtensilsCrossed,
  Bike, Phone, Star, Search,
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import GlobalSearch from './GlobalSearch';
import { useTranslation } from 'react-i18next';

// ── Mega Menu Structure ──
interface MegaLink {
  name: string;
  path: string;
  icon?: typeof Home;
  description?: string;
}

interface MegaSection {
  title: string;
  links: MegaLink[];
}

const mainLinks: (MegaLink | MegaSection)[] = [
  {
    title: 'Explorer',
    links: [
      { name: 'Restaurants', path: '/restaurants', icon: Store, description: 'Trouvez un restaurant près de chez vous' },
      { name: 'Tous les plats', path: '/restaurants?mode=plats', icon: Compass, description: 'Parcourez tout le catalogue' },
      { name: 'Sur mesure', path: '/demandes/nouvelle', icon: UtensilsCrossed, description: 'Commandez un plat personnalisé' },
      { name: 'Mes favoris', path: '/favoris', icon: Star, description: 'Vos restaurants et plats préférés' },
      { name: 'Devenir livreur', path: '/livreurs', icon: Bike, description: 'Rejoignez notre flotte' },
    ],
  },
  { name: 'Partenaires', path: '/partenaires', icon: Store },
  { name: 'Contact', path: '/contact', icon: Phone },
];

const transparentTopRoutes = ['/', '/partenaires', '/livreurs'];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { items, totalItems, totalPrice, updateQuantity } = useCart();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const currentLang = (i18n.language || 'fr').slice(0, 2);
  const setLanguage = (lng: 'fr' | 'en') => {
    if (currentLang === lng) return;
    // La langue vit dans l'URL (/fr/, /en/) : on navigue vers le même chemin
    // sous l'autre préfixe. Full reload = état propre + HTML prérendu.
    localStorage.setItem('miamexpress_lang', lng);
    const path = window.location.pathname.replace(/^\/(fr|en)(?=\/|$)/, `/${lng}`);
    window.location.assign(path + window.location.search + window.location.hash);
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Raccourci clavier ⌘K / Ctrl+K pour ouvrir la recherche globale.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close dropdown on route change
  useEffect(() => { setOpenDropdown(null); }, [location.pathname]);

  // Les entrées du menu peuvent porter une query (ex. /restaurants?mode=plats)
  const isActive = (path: string) => location.pathname === path.split('?')[0];
  const isSolid = scrolled || !transparentTopRoutes.includes(location.pathname);

  const handleDropdownEnter = (title: string) => {
    if (dropdownTimer.current) clearTimeout(dropdownTimer.current);
    setOpenDropdown(title);
  };
  const handleDropdownLeave = () => {
    dropdownTimer.current = setTimeout(() => setOpenDropdown(null), 200);
  };

  const accountLink = !user
    ? { to: '/connexion', label: t("Connexion") }
    : user.role === 'admin'
      ? { to: '/admin/dashboard', label: t("Back-office") }
      : user.role === 'restaurant'
        ? { to: '/partenaires/dashboard', label: t("Espace Resto") }
        : user.role === 'livreur'
          ? { to: '/livreurs/dashboard', label: t("Espace Livreur") }
          : { to: '/profil', label: t("Profil") };

  const linkClass = (active: boolean) =>
    `px-3 py-2 rounded-lg text-sm font-medium font-inter transition-colors ${active
      ? isSolid ? 'text-green-primary bg-green-light/50' : 'text-white bg-white/10'
      : isSolid ? 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary' : 'text-white/85 hover:text-white hover:bg-white/10'
    }`;

  const iconClass = (active: boolean) =>
    isSolid
      ? active ? 'text-green-primary' : 'text-text-muted'
      : active ? 'text-white' : 'text-white/70';

  return (
    <>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${isSolid
          ? 'bg-white/95 backdrop-blur-[12px] border-b border-border-custom shadow-[0_1px_0_rgba(0,0,0,0.05)]'
          : 'bg-transparent'
          }`}
        style={{ height: 64 }}
      >
        <div className="max-w-[1280px] mx-auto h-full flex items-center justify-between px-3 sm:px-6 lg:px-8 xl:px-12">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <img src="/logo-icon.png" alt="MiamExpress Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
            <span className={`font-inter font-semibold text-sm sm:text-lg md:text-xl tracking-normal ${isSolid ? 'text-green-primary' : 'text-white'}`}>
              {t("MiamExpress")}
            </span>
          </Link>

          {/* Desktop Mega Menu */}
          <nav className="hidden lg:flex items-center gap-1">
            {mainLinks.map((item) => {
              if ('path' in item) {
                const link = item as MegaLink;
                return (
                  <Link key={link.name} to={link.path} className={linkClass(isActive(link.path))}>
                    {link.icon && <link.icon className={`w-4 h-4 inline mr-1.5 ${iconClass(isActive(link.path))}`} />}
                    {t('nav.' + link.name.toLowerCase(), link.name)}
                  </Link>
                );
              }
              // Dropdown section
              const section = item as MegaSection;
              const isOpen = openDropdown === section.title;
              return (
                <div
                  key={section.title}
                  className="relative"
                  onMouseEnter={() => handleDropdownEnter(section.title)}
                  onMouseLeave={handleDropdownLeave}
                >
                  <button
                    type="button"
                    className={`${linkClass(false)} flex items-center gap-1`}
                    onClick={() => setOpenDropdown(isOpen ? null : section.title)}
                  >
                    {t('nav.' + section.title.toLowerCase(), section.title)}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-border-custom shadow-lg shadow-black/5 py-2 min-w-[280px] z-50"
                        onMouseEnter={() => handleDropdownEnter(section.title)}
                        onMouseLeave={handleDropdownLeave}
                      >
                        {section.links.map((link) => (
                          <Link
                            key={link.path}
                            to={link.path}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-bg-secondary transition-colors ${isActive(link.path) ? 'bg-green-light/50' : ''
                              }`}
                          >
                            {link.icon && (
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isActive(link.path) ? 'bg-green-primary text-white' : 'bg-bg-secondary text-text-muted'
                                }`}>
                                <link.icon className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <p className="font-inter font-medium text-sm text-text-primary">{t('nav.' + link.name.toLowerCase(), link.name)}</p>
                              {link.description && (
                                <p className="text-text-muted text-xs font-inter mt-0.5">{t('nav.' + link.name.toLowerCase() + '_desc', link.description)}</p>
                              )}
                            </div>
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Language segmented toggle FR | EN */}
            <div
              role="group"
              aria-label={t("Langue")}
              className={`inline-flex items-center rounded-lg overflow-hidden border shrink-0 ${isSolid ? 'border-border-custom' : 'border-white/30'
                }`}
            >
              {(['fr', 'en'] as const).map((lng) => {
                const active = currentLang === lng;
                return (
                  <button
                    key={lng}
                    type="button"
                    onClick={() => setLanguage(lng)}
                    aria-pressed={active}
                    title={lng === 'fr' ? 'Français' : 'English'}
                    className={`px-1.5 sm:px-2.5 py-1 text-xs font-semibold font-inter uppercase leading-none transition-colors ${active
                      ? 'bg-green-primary text-white'
                      : isSolid
                        ? 'text-text-muted hover:text-text-primary hover:bg-bg-secondary'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                  >
                    {lng}
                  </button>
                );
              })}
            </div>

            {/* Recherche globale — barre premium (desktop) */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className={`hidden xl:flex items-center gap-2 h-10 w-56 px-3 rounded-lg text-sm font-inter border transition-colors ${isSolid
                ? 'bg-bg-secondary text-text-muted border-border-custom hover:bg-white hover:border-border-light'
                : 'bg-white/10 text-white/85 border-white/25 hover:bg-white/20'
                }`}
              aria-label={t("Rechercher un plat ou un restaurant")}
            >
              <Search className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left truncate">{t("Rechercher…")}</span>
              <kbd className={`text-[11px] font-sans px-1.5 py-0.5 rounded border ${isSolid ? 'border-border-custom text-text-muted' : 'border-white/30 text-white/70'}`}>{t("⌘K")}</kbd>
            </button>

            {/* Recherche globale — icône (mobile / tablette) */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className={`xl:hidden min-w-9 min-h-9 sm:min-w-10 sm:min-h-10 inline-flex items-center justify-center rounded-lg transition-colors ${isSolid ? 'text-text-primary hover:bg-bg-secondary' : 'text-white hover:bg-white/10'
                }`}
              aria-label={t("Rechercher un plat ou un restaurant")}
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {!user && (
              <Link
                to="/inscription"
                className={`hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium font-inter whitespace-nowrap transition-all ${isSolid ? 'bg-green-primary text-white hover:bg-green-dark' : 'bg-white text-green-primary hover:bg-green-light'
                  }`}
              >
                {t("S'inscrire")}
              </Link>
            )}
            <Link
              to={accountLink.to}
              className={`hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium font-inter whitespace-nowrap transition-all ${isSolid
                ? 'border border-green-primary text-green-primary hover:bg-green-light'
                : 'border border-white text-white hover:bg-white/10'
                }`}
            >
              <User className="w-4 h-4" />
              {accountLink.label}
            </Link>

            {/* Cart */}
            <div className="hidden lg:block">
              <Popover open={cartOpen} onOpenChange={setCartOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className={`relative min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg transition-colors ${isSolid ? 'text-text-primary hover:bg-bg-secondary' : 'text-white hover:bg-white/10'
                    }`} aria-label="Panier">
                    <ShoppingCart className="w-5 h-5" />
                    {totalItems > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-green-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        {totalItems}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-4">
                  {items.length === 0 ? (
                    <p className="text-text-secondary font-inter text-sm text-center py-4">{t("Votre panier est vide")}</p>
                  ) : (
                    <>
                      <div className="space-y-3 mb-3 max-h-[280px] overflow-y-auto">
                        {items.map(({ item, quantity }) => (
                          <div key={item.id} className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-inter text-sm text-text-primary truncate">{item.name}</p>
                              <p className="text-text-muted text-xs font-inter">{(item.price * quantity).toLocaleString()} {t("FCFA")}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => updateQuantity(item.id, quantity - 1)} className="w-6 h-6 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors">
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-text-primary font-inter font-semibold text-xs w-4 text-center">{quantity}</span>
                              <button onClick={() => updateQuantity(item.id, quantity + 1)} className="w-6 h-6 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors">
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-border-light pt-3 mb-3 flex justify-between font-inter">
                        <span className="text-text-primary font-semibold text-sm">{t("Total")}</span>
                        <span className="text-text-primary font-bold text-sm">{totalPrice.toLocaleString()} {t("FCFA")}</span>
                      </div>
                      <button onClick={() => { setCartOpen(false); navigate('/checkout'); }} className="w-full bg-green-primary text-white font-inter font-semibold h-11 rounded-lg hover:bg-green-dark transition-colors">
                        {t("Voir le panier")}
                      </button>
                    </>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Mobile cart link */}
            <Link to="/checkout" className={`lg:hidden relative min-w-9 min-h-9 sm:min-w-11 sm:min-h-11 inline-flex items-center justify-center rounded-lg transition-colors ${isSolid ? 'text-text-primary hover:bg-bg-secondary' : 'text-white hover:bg-white/10'
              }`} aria-label="Panier">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-green-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{totalItems}</span>
              )}
            </Link>

            {/* Mobile menu toggle */}
            <button onClick={() => setMobileOpen(true)} className={`lg:hidden min-w-9 min-h-9 sm:min-w-11 sm:min-h-11 inline-flex items-center justify-center rounded-lg transition-colors ${isSolid ? 'text-text-primary hover:bg-bg-secondary' : 'text-white hover:bg-white/10'
              }`} aria-label="Menu">
              <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 lg:hidden" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed top-0 right-0 bottom-0 w-[320px] max-w-[85vw] bg-white z-50 lg:hidden shadow-xl flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border-light">
                <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <img src="/logo-icon.png" alt="MiamExpress Logo" className="w-8 h-8 object-contain" />
                  <div className="flex items-baseline gap-1">
                    <span className="font-inter font-semibold text-lg text-green-primary">{t("MiamExpress")}</span>
                  </div>
                </Link>
                <button onClick={() => setMobileOpen(false)} className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary" aria-label="Fermer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-2">
                {mainLinks.map((item) => {
                  if ('path' in item) {
                    const link = item as MegaLink;
                    return (
                      <Link key={link.path} to={link.path} onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-6 py-3.5 text-base font-medium font-inter transition-colors ${isActive(link.path) ? 'text-green-primary bg-green-light' : 'text-text-primary hover:bg-bg-secondary'
                          }`}>
                        {link.icon && <link.icon className="w-5 h-5" />}
                        {t('nav.' + link.name.toLowerCase(), link.name)}
                      </Link>
                    );
                  }
                  const section = item as MegaSection;
                  return (
                    <div key={section.title} className="mb-1">
                      <p className="px-6 py-2 text-xs font-inter font-semibold text-text-muted uppercase tracking-wider">
                        {t('nav.' + section.title.toLowerCase(), section.title)}
                      </p>
                      {section.links.map((link) => (
                        <Link key={link.path} to={link.path} onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-3 px-8 py-3 text-sm font-inter transition-colors ${isActive(link.path) ? 'text-green-primary bg-green-light' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                            }`}>
                          {link.icon && <link.icon className="w-4 h-4" />}
                          {t('nav.' + link.name.toLowerCase(), link.name)}
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-border-light space-y-2">
                <Link to={accountLink.to} onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border border-green-primary text-green-primary hover:bg-green-light">
                  <User className="w-4 h-4" /> {accountLink.label}
                </Link>
                {!user && (
                  <Link to="/inscription" onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium bg-green-primary text-white hover:bg-green-dark">
                    {t("S'inscrire")}
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}



