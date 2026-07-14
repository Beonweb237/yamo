import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  User,
  UtensilsCrossed,
  Bike,
  Facebook,
  Instagram,
  Twitter,
  Send,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from 'lucide-react';
import { contactFAQ } from '../data/mockData';
import { whatsappLink } from '../data/support';

const contactChannels = [
  {
    icon: User,
    title: 'Support Client',
    description: 'Vous avez une question sur votre commande ? Notre \u00e9quipe client est l\u00e0 pour vous.',
    email: 'client@yamo.cm',
    phone: '+237 677 77 77 70',
    cta: 'Contacter le Support',
    whatsapp: whatsappLink('Bonjour Yamo, j\u2019ai une question sur ma commande.'),
  },
  {
    icon: UtensilsCrossed,
    title: 'Support Restaurateur',
    description: 'Besoin d\'aide avec votre tableau de bord, votre menu, ou vos paiements ?',
    email: 'partenaires@yamo.cm',
    phone: '+237 677 77 77 71',
    cta: 'Contacter le Support Partenaire',
    whatsapp: whatsappLink('Bonjour Yamo, je suis restaurateur partenaire et j\u2019ai besoin d\u2019aide.'),
  },
  {
    icon: Bike,
    title: 'Support Livreur',
    description: 'Questions sur l\'application livreur, vos revenus, ou votre compte ?',
    email: 'livreurs@yamo.cm',
    phone: '+237 677 77 77 72',
    cta: 'Contacter le Support Livreur',
    whatsapp: whatsappLink('Bonjour Yamo, je suis livreur et j\u2019ai besoin d\u2019aide.'),
  },
];

function Accordion({ items }: { items: { question: string; answer: string; category?: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-border-light">
      {items.map((item, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between py-4 text-left cursor-pointer group"
          >
            <span className={`font-inter font-medium text-base transition-colors ${open === i ? 'text-green-primary' : 'text-text-primary group-hover:text-green-primary'}`}>
              {item.question}
            </span>
            {open === i ? (
              <ChevronUp className="w-5 h-5 text-text-muted shrink-0 ml-2" />
            ) : (
              <ChevronDown className="w-5 h-5 text-text-muted shrink-0 ml-2" />
            )}
          </button>
          <motion.div
            initial={false}
            animate={{ height: open === i ? 'auto' : 0, opacity: open === i ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="text-text-secondary text-[15px] font-inter leading-relaxed pb-4">
              {item.answer}
            </p>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

export default function Contact() {
  const [formSubmitted, setFormSubmitted] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setTimeout(() => setFormSubmitted(false), 5000);
  };

  return (
    <div className="pt-[72px]">
      {/* Hero */}
      <section className="bg-green-primary pt-12 pb-24 sm:pt-16 sm:pb-28">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-white/60 text-xs font-inter mb-4"
          >
            <Link to="/" className="hover:text-white transition-colors">Accueil</Link>
            <span className="mx-2">/</span>
            <span className="text-white">Contact</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="font-poppins font-semibold text-white text-3xl sm:text-4xl lg:text-[38px]/[1.18] tracking-normal mb-3"
          >
            Nous Sommes L&agrave; pour Vous Aider
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="text-white/75 font-inter text-base max-w-[600px] mx-auto mb-8"
          >
            Que vous soyez client, restaurateur ou livreur &mdash; notre &eacute;quipe de support est disponible 7 jours sur 7 pour r&eacute;pondre &agrave; vos questions.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-6 sm:gap-10"
          >
            {[
              { icon: Mail, text: 'support@yamo.cm' },
              { icon: Phone, text: '+237 677 77 77 77' },
              { icon: Clock, text: 'Lun\u2013Sam, 8h\u201322h' },
            ].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2 text-white font-inter text-sm">
                <item.icon className="w-5 h-5" />
                {item.text}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Contact Channel Cards */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 -mt-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {contactChannels.map((ch, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-6 hover:-translate-y-1 hover:shadow-lg transition-all duration-250"
            >
              <div className="w-14 h-14 rounded-full bg-green-light flex items-center justify-center mb-4">
                <ch.icon className="w-7 h-7 text-green-primary" />
              </div>
              <h3 className="font-poppins font-semibold text-text-primary text-lg mb-2">
                {ch.title}
              </h3>
              <p className="text-text-secondary font-inter text-sm mb-4 leading-relaxed">
                {ch.description}
              </p>
              <div className="space-y-2 mb-5">
                <a href={`mailto:${ch.email}`} className="flex items-center gap-2 text-green-primary font-inter text-sm hover:underline">
                  <Mail className="w-4 h-4" />
                  {ch.email}
                </a>
                <span className="flex items-center gap-2 text-text-secondary font-inter text-sm">
                  <Phone className="w-4 h-4" />
                  {ch.phone}
                </span>
              </div>
              <a
                href={ch.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-2.5 border border-green-primary text-green-primary text-center font-inter text-sm font-medium rounded-lg hover:bg-green-light transition-colors"
              >
                {ch.cta} (WhatsApp)
              </a>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Contact Form + Info */}
      <section className="py-16 sm:py-20 bg-bg-secondary mt-10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex-[3]"
            >
              <h2 className="font-poppins font-semibold text-text-primary text-xl sm:text-2xl mb-2">
                Envoyez-Nous un Message
              </h2>
              <p className="text-text-secondary font-inter text-sm mb-6">
                Remplissez le formulaire ci-dessous et nous vous r&eacute;pondrons sous 24h.
              </p>

              {formSubmitted && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 bg-green-light text-green-primary font-inter text-sm p-4 rounded-lg mb-4"
                >
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  Message envoy&eacute; ! Nous vous r&eacute;pondrons sous 24h.
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="font-inter font-medium text-text-primary text-sm mb-1.5 block">
                    Nom complet <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Votre nom et pr&eacute;nom"
                    className="w-full h-12 px-4 border border-border-custom rounded-lg font-inter text-text-primary bg-white outline-none focus:border-green-primary focus:ring-[3px] focus:ring-green-primary/12 placeholder:text-text-muted"
                  />
                </div>
                <div>
                  <label className="font-inter font-medium text-text-primary text-sm mb-1.5 block">
                    Email <span className="text-error">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="votre@email.com"
                    className="w-full h-12 px-4 border border-border-custom rounded-lg font-inter text-text-primary bg-white outline-none focus:border-green-primary focus:ring-[3px] focus:ring-green-primary/12 placeholder:text-text-muted"
                  />
                </div>
                <div>
                  <label className="font-inter font-medium text-text-primary text-sm mb-1.5 block">
                    T&eacute;l&eacute;phone
                  </label>
                  <input
                    type="tel"
                    placeholder="+237 6XX XXX XXX"
                    className="w-full h-12 px-4 border border-border-custom rounded-lg font-inter text-text-primary bg-white outline-none focus:border-green-primary focus:ring-[3px] focus:ring-green-primary/12 placeholder:text-text-muted"
                  />
                </div>
                <div>
                  <label className="font-inter font-medium text-text-primary text-sm mb-1.5 block">
                    Sujet <span className="text-error">*</span>
                  </label>
                  <select
                    required
                    className="w-full h-12 px-4 border border-border-custom rounded-lg font-inter text-text-primary bg-white outline-none focus:border-green-primary focus:ring-[3px] focus:ring-green-primary/12"
                  >
                    <option value="">S&eacute;lectionnez un sujet</option>
                    <option value="order">Question sur une commande</option>
                    <option value="technical">Probl&egrave;me technique</option>
                    <option value="partner">Devenir partenaire restaurant</option>
                    <option value="driver">Devenir livreur</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="font-inter font-medium text-text-primary text-sm mb-1.5 block">
                    Message <span className="text-error">*</span>
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="D&eacute;crivez votre question ou probl&egrave;me en d&eacute;tail..."
                    className="w-full px-4 py-3 border border-border-custom rounded-lg font-inter text-text-primary bg-white outline-none focus:border-green-primary focus:ring-[3px] focus:ring-green-primary/12 placeholder:text-text-muted resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-green-primary text-white font-inter font-semibold h-12 rounded-lg hover:bg-green-dark transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Envoyer le Message
                </button>
              </form>
            </motion.div>

            {/* Info Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex-[2]"
            >
              <div className="bg-white rounded-xl border border-border-custom p-6">
                <h3 className="font-poppins font-semibold text-text-primary text-lg mb-5">
                  Informations de Contact
                </h3>

                {/* Address */}
                <div className="mb-5">
                  <p className="font-inter font-semibold text-text-primary text-base">
                    Yamo SARL
                  </p>
                  <p className="text-text-secondary font-inter text-sm">
                    Rue des Palmiers, Bonapriso
                  </p>
                  <p className="text-text-secondary font-inter text-sm">
                    Douala, Cameroun
                  </p>
                </div>

                <div className="border-t border-border-light my-5" />

                {/* Hours */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-green-primary" />
                    <span className="font-inter font-medium text-text-primary text-sm">
                      Heures d&apos;ouverture du support
                    </span>
                  </div>
                  <p className="text-text-secondary font-inter text-sm pl-6">
                    Lundi &ndash; Samedi : 8h00 &ndash; 22h00
                  </p>
                  <p className="text-text-secondary font-inter text-sm pl-6">
                    Dimanche : 10h00 &ndash; 18h00
                  </p>
                </div>

                <div className="border-t border-border-light my-5" />

                {/* Social */}
                <div>
                  <span className="font-inter font-medium text-text-primary text-sm block mb-3">
                    Suivez-nous
                  </span>
                  <div className="flex gap-2">
                    {[Facebook, Instagram, Twitter].map((Icon, i) => (
                      <a
                        key={i}
                        href="#"
                        className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center text-text-secondary hover:bg-green-light hover:text-green-primary transition-colors"
                      >
                        <Icon className="w-4 h-4" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Map placeholder */}
              <div className="mt-6 bg-bg-secondary rounded-xl border border-border-custom overflow-hidden h-[200px] flex items-center justify-center relative">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="grid2" width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e0e0e0" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid2)" />
                  <line x1="0" y1="40%" x2="100%" y2="40%" stroke="#e8e8e8" strokeWidth="6" />
                  <line x1="30%" y1="0" x2="30%" y2="100%" stroke="#e8e8e8" strokeWidth="4" />
                </svg>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute"
                >
                  <MapPin className="w-10 h-10 text-green-primary" />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h2 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl lg:text-[44px] leading-[1.14] tracking-normal mb-3">
              Questions Fr&eacute;quentes
            </h2>
            <p className="text-text-secondary font-inter text-base">
              Trouvez rapidement une r&eacute;ponse &agrave; vos questions
            </p>
          </motion.div>
          <Accordion items={contactFAQ} />
        </div>
      </section>
    </div>
  );
}
