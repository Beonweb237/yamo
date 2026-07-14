import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  User,
  Menu,
  X,
  Minus,
  Plus,
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

const navLinks = [
  { name: 'Accueil', path: '/' },
  { name: 'Explorer', path: '/explorer' },
  { name: 'Restaurants', path: '/restaurants' },
  { name: 'Partenaires', path: '/partenaires' },
  { name: 'Livreurs', path: '/livreurs' },
  { name: 'Contact', path: '/contact' },
];

const transparentTopRoutes = ['/', '/partenaires', '/livreurs'];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { items, totalItems, totalPrice, updateQuantity } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const isActive = (path: string) => location.pathname === path;
  const isSolid = scrolled || !transparentTopRoutes.includes(location.pathname);

  const accountLink = !user
    ? { to: '/connexion', label: 'Se Connecter' }
    : user.role === 'admin'
      ? { to: '/admin', label: 'Back-office' }
      : user.role === 'restaurant'
        ? { to: '/partenaires/dashboard', label: 'Tableau de bord' }
        : user.role === 'livreur'
          ? { to: '/livreurs/dashboard', label: 'Mes livraisons' }
          : { to: '/profil', label: 'Mon compte' };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${isSolid
          ? 'bg-white/90 backdrop-blur-[12px] border-b border-[#E5E7EB] shadow-[0_1px_0_rgba(0,0,0,0.05)]'
          : 'bg-transparent'
          }`}
        style={{ height: 72 }}
      >
        <div className="max-w-[1280px] mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-12">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Yamo Logo" className="w-10 h-10 object-contain rounded-xl shadow-sm bg-white" />
            <span className={`font-inter font-semibold text-xl tracking-normal ${isSolid ? 'text-green-primary' : 'text-white'}`}>
              Yamo
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium font-inter transition-colors ${isActive(link.path)
                  ? isSolid
                    ? 'text-green-primary'
                    : 'text-white'
                  : isSolid
                    ? 'text-text-secondary hover:text-text-primary'
                    : 'text-white/80 hover:text-white'
                  }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Sign-up button — only visible when not logged in */}
            {!user && (
              <Link
                to="/inscription"
                className={`hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium font-inter transition-all ${isSolid
                  ? 'bg-green-primary text-white hover:bg-green-dark'
                  : 'bg-white text-green-primary hover:bg-green-light'
                  }`}
              >
                S'inscrire
                {/* EN: Sign Up */}
              </Link>
            )}
            <Link
              to={accountLink.to}
              className={`hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium font-inter transition-all ${isSolid
                ? !user
                  ? 'border border-green-primary text-green-primary hover:bg-green-light'
                  : 'border border-green-primary text-green-primary hover:bg-green-light'
                : !user
                  ? 'border border-white text-white hover:bg-white/10'
                  : 'border border-white text-white hover:bg-white/10'
                }`}
            >
              <User className="w-4 h-4" />
              {accountLink.label}
            </Link>
            {/* Desktop: cart preview popover */}
            <div className="hidden lg:block">
              <Popover open={cartOpen} onOpenChange={setCartOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`relative p-2 rounded-lg transition-colors ${isSolid
                      ? 'text-text-primary hover:bg-bg-secondary'
                      : 'text-white hover:bg-white/10'
                      }`}
                    aria-label="Panier"
                  >
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
                    <p className="text-text-secondary font-inter text-sm text-center py-4">
                      Votre panier est vide
                    </p>
                  ) : (
                    <>
                      <div className="space-y-3 mb-3 max-h-[280px] overflow-y-auto">
                        {items.map(({ item, quantity }) => (
                          <div key={item.id} className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-inter text-sm text-text-primary truncate">{item.name}</p>
                              <p className="text-text-muted text-xs font-inter">
                                {(item.price * quantity).toLocaleString()} FCFA
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => updateQuantity(item.id, quantity - 1)}
                                className="w-6 h-6 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
                                aria-label="Retirer un article"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-text-primary font-inter font-semibold text-xs w-4 text-center">
                                {quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, quantity + 1)}
                                className="w-6 h-6 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
                                aria-label="Ajouter un article"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-border-light pt-3 mb-3 flex justify-between font-inter">
                        <span className="text-text-primary font-semibold text-sm">Total</span>
                        <span className="text-text-primary font-bold text-sm">{totalPrice.toLocaleString()} FCFA</span>
                      </div>
                      <button
                        onClick={() => { setCartOpen(false); navigate('/checkout'); }}
                        className="w-full bg-green-primary text-white font-inter font-semibold h-11 rounded-lg hover:bg-green-dark transition-colors"
                      >
                        Voir le panier
                      </button>
                    </>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Mobile: direct link to checkout */}
            <Link
              to="/checkout"
              className={`lg:hidden relative p-2 rounded-lg transition-colors ${isSolid
                ? 'text-text-primary hover:bg-bg-secondary'
                : 'text-white hover:bg-white/10'
                }`}
              aria-label="Panier"
            >
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-green-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>

            <button
              onClick={() => setMobileOpen(true)}
              className={`lg:hidden p-2 rounded-lg transition-colors ${isSolid
                ? 'text-text-primary hover:bg-bg-secondary'
                : 'text-white hover:bg-white/10'
                }`}
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 right-0 bottom-0 w-[320px] max-w-[85vw] bg-white z-50 lg:hidden shadow-xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-border-light">
                <Link to="/" className="flex items-center gap-2">
                  <img src="/logo.png" alt="Yamo Logo" className="w-8 h-8 object-contain rounded-lg shadow-sm bg-white" />
                  <span className="font-inter font-semibold text-lg tracking-normal text-green-primary">
                    Yamo
                  </span>
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                  aria-label="Fermer le menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex flex-col py-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileOpen(false)}
                    className={`px-6 py-3.5 text-base font-medium font-inter transition-colors ${isActive(link.path)
                      ? 'text-green-primary bg-green-light'
                      : 'text-text-primary hover:text-green-primary hover:bg-green-light'
                      }`}
                  >
                    {link.name}
                  </Link>
                ))}
              </nav>

              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border-light flex flex-col gap-2">
                <Link
                  to={accountLink.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium font-inter border border-green-primary text-green-primary hover:bg-green-light"
                >
                  <User className="w-4 h-4" />
                  {accountLink.label}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}



