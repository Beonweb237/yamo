import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Truck,
  Megaphone,
  Check,
  Phone,
  ChevronDown,
  ChevronUp,
  Quote,
} from 'lucide-react';
import { partnerReviews, partnerFAQ } from '../data/mockData';

const benefits = [
  {
    icon: TrendingUp,
    title: 'Augmentez Vos Revenus',
    description: 'Touchez une client\u00e8le plus large sans investissement initial. Nos partenaires constatent en moyenne une augmentation de 30% de leur chiffre d\'affaires d\u00e8s les premiers mois.',
  },
  {
    icon: Truck,
    title: 'Nous G\u00e9rons la Livraison',
    description: 'Plus besoin de vous soucier des livreurs, des itin\u00e9raires ou des retards. Notre r\u00e9seau de livreurs professionnels assure une livraison rapide et fiable \u00e0 vos clients.',
  },
  {
    icon: Megaphone,
    title: 'Boostez Votre Visibilit\u00e9',
    description: 'Profitez de notre audience de milliers d\'utilisateurs actifs. Votre restaurant appara\u00eet dans les recherches, les recommandations, et nos campagnes marketing.',
  },
];

const steps = [
  {
    num: '1',
    title: 'Inscrivez-Vous',
    desc: 'Remplissez notre formulaire d\'inscription en ligne. Notre \u00e9quipe vous contactera sous 24h pour finaliser votre dossier.',
  },
  {
    num: '2',
    title: 'Configurez Votre Menu',
    desc: 'Ajoutez vos plats, photos, prix et options de personnalisation via notre tableau de bord intuitif. Notre \u00e9quipe vous accompagne.',
  },
  {
    num: '3',
    title: 'Recevez des Commandes',
    desc: 'Une fois approuv\u00e9, votre restaurant est en ligne ! Vous recevez les commandes en temps r\u00e9el sur notre syst\u00e8me d\u00e9di\u00e9.',
  },
  {
    num: '4',
    title: 'Livrez & Encaissez',
    desc: 'Pr\u00e9parez vos plats, nos livreurs s\'occupent du reste. Les paiements sont s\u00e9curis\u00e9s et vers\u00e9s r\u00e9guli\u00e8rement sur votre compte.',
  },
];

const includedFeatures = [
  'Inscription gratuite',
  'Tableau de bord complet',
  'Support d\u00e9di\u00e9 7j/7',
  'Photos professionnelles offertes',
  'Visibilit\u00e9 sur l\'application',
  'Paiements s\u00e9curis\u00e9s',
];

function Accordion({ items }: { items: { question: string; answer: string }[] }) {
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

export default function Partenaires() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-[72px]">
      {/* Hero */}
      <section className="bg-bg-dark min-h-[80vh] flex items-center relative overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 w-full py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="text-gold-accent text-xs font-inter font-semibold tracking-[0.15em] uppercase"
              >
                Espace Restaurateur
              </motion.span>
              <motion.h1
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="font-poppins font-bold text-white text-3xl sm:text-4xl lg:text-[52px] leading-[1.1] mt-4 mb-5"
              >
                D&eacute;veloppez Votre Activit&eacute; avec Yamo
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="text-white/70 font-inter text-base leading-relaxed max-w-[500px] mb-8"
              >
                Rejoignez le r&eacute;seau de livraison le plus dynamique du Cameroun. Touchez des milliers de nouveaux clients, augmentez votre chiffre d&apos;affaires, et laissez-nous g&eacute;rer la logistique.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1, duration: 0.4 }}
                className="flex flex-wrap gap-3 mb-10"
              >
                <a href="#signup" className="bg-green-primary text-white font-inter font-medium text-sm px-6 h-12 rounded-lg hover:bg-green-dark transition-colors inline-flex items-center">
                  Devenir Partenaire
                </a>
                <a href="#howitworks" className="border border-white text-white font-inter font-medium text-sm px-6 h-12 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center">
                  En Savoir Plus
                </a>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.5 }}
                className="flex gap-8 sm:gap-12"
              >
                {[
                  { num: '500+', label: 'Restaurants Partenaires' },
                  { num: '50K+', label: 'Commandes par Mois' },
                  { num: '2', label: 'Villes Couvertes' },
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="font-poppins font-bold text-gold-accent text-2xl sm:text-3xl">
                      {stat.num}
                    </div>
                    <div className="text-white/60 text-xs font-inter mt-1">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="relative hidden lg:block"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-bg-dark to-transparent z-10 w-[30%]" />
              <img
                src="/partner-kitchen.jpg"
                alt="Professional kitchen"
                className="rounded-xl w-full object-cover h-[450px]"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl lg:text-[48px] leading-tight mb-3">
              Pourquoi Rejoindre Yamo ?
            </h2>
            <p className="text-text-secondary font-inter text-base">
              Une solution compl&egrave;te pour faire cro&icirc;tre votre restaurant sans complexit&eacute;
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="bg-white border border-border-custom rounded-xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-lg hover:border-green-primary/30 transition-all duration-250"
              >
                <div className="w-16 h-16 rounded-full bg-green-light flex items-center justify-center mb-4">
                  <b.icon className="w-8 h-8 text-green-primary" />
                </div>
                <h3 className="font-poppins font-semibold text-text-primary text-xl mb-2">
                  {b.title}
                </h3>
                <p className="text-text-secondary font-inter text-[15px] leading-relaxed">
                  {b.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="howitworks" className="py-16 sm:py-20 bg-bg-secondary">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl lg:text-[48px] leading-tight mb-3">
              Comment &Ccedil;a Marche ?
            </h2>
            <p className="text-text-secondary font-inter text-base">
              Quatre &eacute;tapes simples pour commencer &agrave; recevoir des commandes
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            <div className="hidden lg:block absolute top-6 left-[12%] right-[12%] border-t-2 border-dashed border-border-custom" />
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.15 }}
                className="flex flex-col items-center text-center relative z-10"
              >
                <div className="w-12 h-12 rounded-full bg-green-primary text-white flex items-center justify-center font-poppins font-bold text-xl mb-4">
                  {step.num}
                </div>
                <h4 className="font-poppins font-semibold text-text-primary text-lg mb-2">
                  {step.title}
                </h4>
                <p className="text-text-secondary font-inter text-sm leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl lg:text-[48px] leading-tight text-center mb-12"
          >
            Ils Nous Font Confiance
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {partnerReviews.map((review, i) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="bg-bg-secondary p-6 rounded-xl relative"
              >
                <Quote className="absolute top-4 right-4 w-10 h-10 text-green-light" />
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="w-14 h-14 rounded-full bg-green-primary text-white flex items-center justify-center font-inter font-bold text-lg">
                    {review.initial}
                  </div>
                  <div>
                    <h4 className="font-inter font-semibold text-text-primary text-sm">
                      {review.name}
                    </h4>
                    <p className="text-text-secondary text-xs font-inter">{review.role}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: review.rating }).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-gold-accent text-gold-accent" />
                  ))}
                </div>
                <p className="text-text-primary font-inter text-sm italic leading-relaxed relative z-10">
                  &ldquo;{review.comment}&rdquo;
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 sm:py-20 bg-bg-secondary">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h2 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl lg:text-[48px] leading-tight mb-3">
              Une Commission Transparente
            </h2>
            <p className="text-text-secondary font-inter text-base">
              Pas de frais cach&eacute;s, pas d&apos;abonnement. Vous ne payez que lorsque vous vendez.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-[480px] mx-auto bg-white rounded-2xl border-2 border-green-primary p-8 shadow-[0_8px_32px_rgba(21,127,61,0.10)]"
          >
            <div className="text-center mb-4">
              <span className="font-poppins font-extrabold text-green-primary text-6xl sm:text-7xl">
                15%
              </span>
              <p className="text-text-secondary font-inter text-base mt-1">
                de commission par commande
              </p>
            </div>
            <div className="border-t border-border-light my-6" />
            <div className="space-y-3">
              {includedFeatures.map((feat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.3 }}
                  className="flex items-center gap-3"
                >
                  <Check className="w-5 h-5 text-green-primary shrink-0" />
                  <span className="text-text-primary font-inter text-[15px]">{feat}</span>
                </motion.div>
              ))}
            </div>
            <a
              href="#signup"
              className="block w-full mt-8 bg-green-primary text-white font-inter font-semibold h-12 rounded-lg hover:bg-green-dark transition-colors text-center leading-[48px]"
            >
              Rejoindre Yamo
            </a>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="signup" className="py-16 sm:py-20 bg-green-primary">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-poppins font-bold text-white text-2xl sm:text-3xl lg:text-[48px] leading-tight mb-4"
          >
            Pr&ecirc;t &agrave; Faire Cro&icirc;tre Votre Restaurant ?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-white/80 font-inter text-base max-w-[560px] mx-auto mb-8"
          >
            Rejoignez les 500+ restaurants qui font d&eacute;j&agrave; confiance &agrave; Yamo. Inscrivez-vous aujourd&apos;hui et recevez votre premi&egrave;re commande sous 48h.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-6"
          >
            <button className="bg-white text-green-primary font-inter font-semibold text-sm h-12 px-8 rounded-lg hover:bg-green-light transition-colors">
              Devenir Partenaire Maintenant
            </button>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-2 text-white/60 font-inter text-sm"
          >
            <Phone className="w-4 h-4" />
            Questions ? Contactez-nous au +237 677 77 77 77
          </motion.p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl lg:text-[48px] leading-tight text-center mb-10"
          >
            Questions Fr&eacute;quentes
          </motion.h2>
          <Accordion items={partnerFAQ} />
        </div>
      </section>
    </div>
  );
}

function Star(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0}
      className={props.className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
