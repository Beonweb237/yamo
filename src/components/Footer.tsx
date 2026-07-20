import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Instagram, Twitter, MessageCircle } from 'lucide-react';
import { whatsappLink } from '../data/support';
import { motion } from 'framer-motion';
import { cuisineCategories } from '../data/mockData';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { useTranslation } from "react-i18next";

const quickLinks = [
  { name: 'Accueil', path: '/' },
  { name: 'Restaurants', path: '/restaurants' },
  { name: 'Partenaires', path: '/partenaires' },
  { name: 'Livreurs', path: '/livreurs' },
  { name: 'Contact', path: '/contact' },
  { name: 'FAQ', path: '/contact' },
];

const TERMS_CONTENT = `Ces conditions d'utilisation régissent l'accès et l'usage de la plateforme MiamExpress (application et site web) par les clients, restaurants et livreurs.

1. Objet — MiamExpress met en relation des clients, des restaurants partenaires et des livreurs indépendants pour la commande et la livraison de repas au Cameroun.

2. Comptes — Chaque utilisateur est responsable de l'exactitude des informations fournies lors de son inscription et de la confidentialité de ses identifiants.

3. Commandes — Les prix, délais de préparation et frais de livraison affichés sont fournis par les restaurants partenaires et peuvent varier. MiamExpress agit comme intermédiaire technique entre les parties.

4. Paiement — Les paiements peuvent être effectués en espèces à la livraison ou via Mobile Money (MTN MoMo, Orange Money). Toute commission MiamExpress est prélevée sur les restaurants partenaires, non sur les clients.

5. Candidatures restaurants/livreurs — L'accès à l'espace restaurant ou livreur est soumis à validation d'un dossier de candidature par l'équipe MiamExpress.

6. Résiliation — MiamExpress se réserve le droit de suspendre un compte en cas d'usage abusif, de fraude ou de non-respect des présentes conditions.`;

const PRIVACY_CONTENT = `MiamExpress collecte et traite les données personnelles nécessaires au bon fonctionnement du service : nom, numéro de téléphone, adresses de livraison, historique de commandes et, le cas échéant, position géographique.

Utilisation des données — Ces informations servent à traiter vos commandes, faciliter la livraison, améliorer nos services et vous contacter en cas de besoin (support client, notifications de commande).

Partage — Vos coordonnées de livraison sont partagées avec le restaurant et le livreur concernés par votre commande, dans la stricte mesure nécessaire à son exécution. MiamExpress ne vend pas vos données à des tiers.

Sécurité — Les accès aux données sont protégés par des règles de sécurité au niveau de la base de données (contrôle d'accès par rôle).

Vos droits — Vous pouvez à tout moment demander l'accès, la correction ou la suppression de vos données personnelles en contactant le support MiamExpress.`;

export default function Footer() {
    const { t } = useTranslation();
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

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
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src="/logo-compact.png" alt="MiamExpress" className="h-10 w-auto object-contain" />
            </Link>
            <p className="text-text-secondary text-sm font-inter leading-relaxed max-w-[280px]">
              {t("La plateforme de livraison de repas qui célèbre la richesse culinaire du Cameroun. De Douala à Yaoundé, savourez l’excellence à domicile.")}
            </p>
            <div className="flex items-center gap-2 mt-4">
              {[Facebook, Instagram, Twitter].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-11 h-11 rounded-full bg-bg-main flex items-center justify-center text-text-secondary hover:bg-green-light hover:text-green-primary transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-inter font-semibold text-sm text-text-primary mb-4">
              {t("Liens Rapides")}
            </h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.path}
                    className="text-text-secondary text-sm font-inter hover:text-green-primary hover:translate-x-1 transition-all inline-block py-1"
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
              {t("Catégories")}
            </h4>
            <ul className="space-y-2.5">
              {cuisineCategories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`/restaurants?category=${encodeURIComponent(cat.name)}`}
                    className="text-text-secondary text-sm font-inter hover:text-green-primary hover:translate-x-1 transition-all inline-block py-1"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-inter font-semibold text-sm text-text-primary mb-4">
              {t("Nous Contacter")}
            </h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-text-secondary text-sm font-inter">
                <Mail className="w-4 h-4" />
                {t("support@miamexpress.cm")}
              </li>
              <li className="flex items-center gap-2 text-text-secondary text-sm font-inter">
                <Phone className="w-4 h-4" />
                677 77 77 77
              </li>
              <li>
                <a
                  href={whatsappLink('Bonjour MiamExpress, j’ai besoin d’aide.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-text-secondary text-sm font-inter hover:text-green-primary transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t("Support WhatsApp")}
                </a>
              </li>
              <li className="flex items-center gap-2 text-text-secondary text-sm font-inter">
                <MapPin className="w-4 h-4" />
                {t("Douala & Yaoundé, Cameroun")}
              </li>
            </ul>
            <p className="text-text-muted text-xs font-inter mt-3">
              {t("Lun–Sam, 8h–22h")}
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-border-custom flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-text-muted text-xs font-inter">
            {t("© 2026 MiamExpress. Tous droits réservés.")}
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setLegalModal('privacy')}
              className="text-text-muted text-xs font-inter hover:text-text-secondary transition-colors py-2"
            >
              {t("Politique de confidentialité")}
            </button>
            <button
              type="button"
              onClick={() => setLegalModal('terms')}
              className="text-text-muted text-xs font-inter hover:text-text-secondary transition-colors py-2"
            >
              {t("Conditions d’utilisation")}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Legal modals */}
      <Dialog open={!!legalModal} onOpenChange={(open) => { if (!open) setLegalModal(null); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {legalModal === 'terms' ? "Conditions d'utilisation" : 'Politique de confidentialité'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-text-secondary font-inter text-sm whitespace-pre-line leading-relaxed">
            {legalModal === 'terms' ? TERMS_CONTENT : PRIVACY_CONTENT}
          </p>
        </DialogContent>
      </Dialog>
    </footer>
  );
}


