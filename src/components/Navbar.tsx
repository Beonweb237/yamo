import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  User,
  Menu,
  X,
  Leaf,
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';

const navLinks = [
  { name: 'Accueil', path: '/' },
  { name: 'Restaurants', path: '/restaurants' },
  { name: 'Partenaires', path: '/partenaires' },
  { name: 'Livreurs', path: '/livreurs' },
  { name: 'Contact', path: '/contact' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { totalItems } = useCart();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-[12px] border-b border-[#E5E7EB] shadow-[0_1px_0_rgba(0,0,0,0.05)]'
            : 'bg-transparent'
        }`}
        style={{ height: 72 }}
      >
        <div className="max-w-[1280px] mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-1.5">
            <Leaf className={`w-6 h-6 ${scrolled ? 'text-green-primary' : 'text-white'}`} />
            <span className={`font-poppins font-extrabold text-2xl ${scrolled ? 'text-green-primary' : 'text-white'}`}>
              Yamo
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium font-inter transition-colors ${
                  isActive(link.path)
                    ? scrolled
                      ? 'text-green-primary'
                      : 'text-white'
                    : scrolled
                    ? 'text-text-secondary hover:text-text-primary'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <Link
              to="/restaurants"
              className={`hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium font-inter transition-all ${
                scrolled
                  ? 'border border-green-primary text-green-primary hover:bg-green-light'
                  : 'border border-white text-white hover:bg-white/10'
              }`}
            >
              <User className="w-4 h-4" />
              Se Connecter
            </Link>
            <Link
              to="/restaurants"
              className={`hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium font-inter transition-all ${
                scrolled
                  ? 'bg-green-primary text-white hover:bg-green-dark'
                  : 'bg-white text-green-primary hover:bg-green-light'
              }`}
            >
              S&apos;inscrire
            </Link>
            <Link
              to="/restaurants"
              className={`relative p-2 rounded-lg transition-colors ${
                scrolled
                  ? 'text-text-primary hover:bg-bg-secondary'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-green-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className={`lg:hidden p-2 rounded-lg transition-colors ${
                scrolled
                  ? 'text-text-primary hover:bg-bg-secondary'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 right-0 bottom-0 w-[320px] max-w-[85vw] bg-white z-50 lg:hidden shadow-xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-border-light">
                <Link to="/" className="flex items-center gap-1.5">
                  <Leaf className="w-5 h-5 text-green-primary" />
                  <span className="font-poppins font-extrabold text-xl text-green-primary">
                    Yamo
                  </span>
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex flex-col py-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-6 py-3.5 text-base font-medium font-inter transition-colors ${
                      isActive(link.path)
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
                  to="/restaurants"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium font-inter border border-green-primary text-green-primary hover:bg-green-light"
                >
                  <User className="w-4 h-4" />
                  Se Connecter
                </Link>
                <Link
                  to="/restaurants"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium font-inter bg-green-primary text-white hover:bg-green-dark"
                >
                  S&apos;inscrire
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
