import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Instagram, Twitter, Leaf } from 'lucide-react';
import { motion } from 'framer-motion';

const quickLinks = [
  { name: 'Accueil', path: '/' },
  { name: 'Restaurants', path: '/restaurants' },
  { name: 'Partenaires', path: '/partenaires' },
  { name: 'Livreurs', path: '/livreurs' },
  { name: 'Contact', path: '/contact' },
  { name: 'FAQ', path: '/contact' },
];

const categories = [
  'Cuisine Camerounaise',
  'Fast-Food',
  'Pizza & Burgers',
  'Grillades',
  'Fruits de Mer',
  'P\u00e2tisseries',
  'Boissons & Jus',
];

export default function Footer() {
  return (
    <footer className="bg-bg-secondary border-t border-border-custom">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-16 pb-8"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {/* Brand Column */}
          <div>
            <Link to="/" className="flex items-center gap-1.5 mb-4">
              <Leaf className="w-5 h-5 text-green-primary" />
              <span className="font-poppins font-extrabold text-xl text-green-primary">
                Yamo
              </span>
            </Link>
            <p className="text-text-secondary text-sm font-inter leading-relaxed max-w-[280px]">
              La plateforme de livraison de repas qui c\u00e9l\u00e8bre la richesse culinaire du Cameroun. De Douala \u00e0 Yaound\u00e9, savourez l&apos;excellence \u00e0 domicile.
            </p>
            <div className="flex items-center gap-2 mt-4">
              {[Facebook, Instagram, Twitter].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 rounded-full bg-bg-main flex items-center justify-center text-text-secondary hover:bg-green-light hover:text-green-primary transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-inter font-semibold text-sm text-text-primary mb-4">
              Liens Rapides
            </h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.path}
                    className="text-text-secondary text-sm font-inter hover:text-green-primary hover:translate-x-1 transition-all inline-block"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-inter font-semibold text-sm text-text-primary mb-4">
              Cat\u00e9gories
            </h4>
            <ul className="space-y-2.5">
              {categories.map((cat) => (
                <li key={cat}>
                  <Link
                    to="/restaurants"
                    className="text-text-secondary text-sm font-inter hover:text-green-primary hover:translate-x-1 transition-all inline-block"
                  >
                    {cat}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-inter font-semibold text-sm text-text-primary mb-4">
              Nous Contacter
            </h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-text-secondary text-sm font-inter">
                <Mail className="w-4 h-4" />
                support@yamo.cm
              </li>
              <li className="flex items-center gap-2 text-text-secondary text-sm font-inter">
                <Phone className="w-4 h-4" />
                +237 677 77 77 77
              </li>
              <li className="flex items-center gap-2 text-text-secondary text-sm font-inter">
                <MapPin className="w-4 h-4" />
                Douala & Yaound\u00e9, Cameroun
              </li>
            </ul>
            <p className="text-text-muted text-xs font-inter mt-3">
              Lun&ndash;Sam, 8h&ndash;22h
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-border-custom flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-text-muted text-xs font-inter">
            &copy; 2025 Yamo. Tous droits r\u00e9serv\u00e9s.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-text-muted text-xs font-inter hover:text-text-secondary transition-colors">
              Politique de confidentialit\u00e9
            </a>
            <a href="#" className="text-text-muted text-xs font-inter hover:text-text-secondary transition-colors">
              Conditions d&apos;utilisation
            </a>
          </div>
        </div>
      </motion.div>
    </footer>
  );
}
