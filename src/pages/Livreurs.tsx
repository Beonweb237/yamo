import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Banknote,
  Smartphone,
  Shield,
  CheckCircle,
  Package,
  Shirt,
  BadgeCheck,
  Headphones,
  ChevronDown,
  ChevronUp,
  Phone,
  Quote,
} from 'lucide-react';
import { driverReviews, driverFAQ } from '../data/mockData';

const benefits = [
  {
    icon: Clock,
    title: 'Horaires Flexibles',
    description: 'Vous choisissez quand travailler. Matin, midi, soir \u2014 c\'est vous qui d\u00e9cidez de vos cr\u00e9neaux. Parfait pour compl\u00e9ter vos revenus.',
  },
  {
    icon: Banknote,
    title: 'Revenus Attractifs',
    description: 'Gagnez jusqu\'\u00e0 50 000 FCFA par semaine. Des primes de performance, des pourboires des clients, et des bonus aux heures de pointe.',
  },
  {
    icon: Smartphone,
    title: 'Simple & Rapide',
    description: 'Notre application livreur est intuitive. Recevez les commandes, suivez l\'itin\u00e9raire, encaissez \u2014 tout depuis votre t\u00e9l\u00e9phone.',
  },
  {
    icon: Shield,
    title: 'S\u00e9curit\u00e9 & Support',
    description: 'Assurance couvrant vos livraisons, support 7j/7 par t\u00e9l\u00e9phone et chat, et une communaut\u00e9 de livreurs solidaire.',
  },
];

const requirements = [
  '\u00c2ge minimum : 18 ans',
  'Un smartphone Android ou iOS',
  'Un moyen de transport (moto, v\u00e9lo, voiture)',
  'Une pi\u00e8ce d\'identit\u00e9 valide',
  'Un compte Mobile Money actif',
];

const equipment = [
  { icon: Package, text: 'Sac thermique de livraison Yamo' },
  { icon: Shirt, text: 'T-shirt Yamo officiel' },
  { icon: BadgeCheck, text: 'Badge livreur professionnel' },
  { icon: Headphones, text: 'Support et formation gratuits' },
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

export default function Livreurs() {
  const [hours, setHours] = useState(20);
  const [city, setCity] = useState('Douala');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const hourlyRate = city === 'Douala' ? 750 : 650;
  const peakBonus = Math.round(hours * 225);
  const tips = Math.round(hours * 150);
  const weekly = hours * hourlyRate + peakBonus + tips;
  const monthly = weekly * 4;

  return (
    <div className="pt-[72px]">
      {/* Hero */}
      <section className="bg-bg-dark min-h-[85vh] flex items-center relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-green-primary/10 rounded-full blur-3xl" />
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 w-full py-20 relative z-10">
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
                Devenez Livreur Yamo
              </motion.span>
              <motion.h1
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="font-poppins font-extrabold text-white text-3xl sm:text-4xl lg:text-[56px] leading-[1.1] mt-4 mb-5"
              >
                Gagnez de l&apos;Argent en Livrant de D&eacute;licieux Repas
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75, duration: 0.5 }}
                className="text-white/75 font-inter text-lg leading-relaxed max-w-[480px] mb-8"
              >
                Un revenu flexible, un emploi qui vous permet d&apos;&ecirc;tre votre propre patron. Livrez quand vous voulez, gagnez ce dont vous avez besoin.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.95, duration: 0.4 }}
              >
                <a
                  href="#register"
                  className="inline-flex items-center bg-green-primary text-white font-inter font-medium text-sm px-8 h-12 rounded-lg hover:bg-green-dark transition-colors"
                >
                  Devenir Livreur
                </a>
                <p className="text-white/50 text-xs font-inter mt-2">
                  C&apos;est gratuit et rapide
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1, duration: 0.5 }}
                className="flex gap-8 sm:gap-10 mt-10"
              >
                {[
                  { num: '200+', label: 'Livreurs Actifs' },
                  { num: '50 000 FCFA+', label: 'Revenu Moyen / Semaine' },
                  { num: 'Flexible', label: 'Horaires Libres' },
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="font-poppins font-bold text-gold-accent text-2xl sm:text-4xl">
                      {stat.num}
                    </div>
                    <div className="text-white/60 text-xs font-inter mt-1">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="relative hidden lg:flex items-center justify-center"
            >
              {/* Floating circles */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-4 left-10 w-[120px] h-[120px] rounded-full bg-green-primary/10"
              />
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute bottom-10 -left-6 w-[80px] h-[80px] rounded-full bg-green-primary/10"
              />
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                className="absolute top-20 right-0 w-[60px] h-[60px] rounded-full bg-green-primary/10"
              />
              <img
                src="/driver-illustration.jpg"
                alt="Delivery illustration"
                className="relative z-10 rounded-xl max-w-[90%] max-h-[450px] object-contain"
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
              Pourquoi Livrer avec Yamo ?
            </h2>
            <p className="text-text-secondary font-inter text-base">
              Des avantages con&ccedil;us pour votre r&eacute;ussite et votre libert&eacute;
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="bg-bg-secondary rounded-xl p-6 text-center hover:-translate-y-1 hover:bg-white hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all duration-250"
              >
                <div className="w-14 h-14 rounded-full bg-green-light flex items-center justify-center mx-auto mb-4">
                  <b.icon className="w-7 h-7 text-green-primary" />
                </div>
                <h3 className="font-poppins font-semibold text-text-primary text-lg mb-2">
                  {b.title}
                </h3>
                <p className="text-text-secondary font-inter text-sm leading-relaxed">
                  {b.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Earnings Calculator */}
      <section className="py-16 sm:py-20 bg-bg-secondary">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl lg:text-[48px] leading-tight text-center mb-10"
          >
            Calculez Vos Revenus Potentiels
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 max-w-[900px] mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left - Controls */}
              <div className="space-y-6">
                {/* Hours Slider */}
                <div>
                  <label className="font-inter font-medium text-text-primary text-sm mb-3 block">
                    Heures de livraison par semaine
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    value={hours}
                    onChange={(e) => setHours(parseInt(e.target.value))}
                    className="w-full h-2 bg-green-light rounded-full appearance-none cursor-pointer accent-green-primary"
                  />
                  <div className="flex justify-between text-xs text-text-muted font-inter mt-1">
                    <span>5h</span>
                    <span className="font-poppins font-bold text-green-primary text-2xl">{hours}h</span>
                    <span>60h</span>
                  </div>
                </div>

                {/* City Selector */}
                <div>
                  <label className="font-inter font-medium text-text-primary text-sm mb-2 block">
                    Ville
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-12 px-4 border border-border-custom rounded-lg font-inter text-text-primary bg-white outline-none focus:border-green-primary focus:ring-[3px] focus:ring-green-primary/15"
                  >
                    <option value="Douala">Douala</option>
                    <option value="Yaound&eacute;">Yaound&eacute;</option>
                    <option value="Bafoussam">Bafoussam</option>
                  </select>
                </div>
              </div>

              {/* Right - Earnings Display */}
              <div className="flex flex-col justify-center">
                <div className="text-center md:text-left">
                  <motion.div
                    key={weekly}
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="font-poppins font-extrabold text-green-primary text-4xl sm:text-5xl"
                  >
                    {weekly.toLocaleString()} FCFA
                  </motion.div>
                  <p className="text-text-secondary font-inter text-sm mt-1">
                    par semaine (estimation)
                  </p>
                  <p className="text-text-primary font-inter text-xl font-semibold mt-3">
                    ~{(monthly).toLocaleString()} FCFA / mois
                  </p>
                </div>
                <div className="mt-6 space-y-2 text-sm font-inter">
                  <div className="flex justify-between text-text-secondary">
                    <span>Livraisons : {hours}h &times; {hourlyRate} FCFA/h</span>
                    <span>{(hours * hourlyRate).toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>Primes de pointe :</span>
                    <span className="text-green-primary">+ {peakBonus.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>Pourboires estim&eacute;s :</span>
                    <span className="text-green-primary">+ {tips.toLocaleString()} FCFA</span>
                  </div>
                  <div className="border-t border-border-light pt-2 flex justify-between text-text-primary font-semibold">
                    <span>Total estim&eacute;</span>
                    <span>{weekly.toLocaleString()} FCFA</span>
                  </div>
                </div>
                <p className="text-text-muted text-xs font-inter mt-3">
                  *Estimation indicative. Les revenus r&eacute;els d&eacute;pendent de votre activit&eacute; et de votre zone.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl lg:text-[48px] leading-tight text-center mb-12"
          >
            Comment Commencer ?
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-[800px] mx-auto">
            {/* Requirements */}
            <motion.div
              initial={{ opacity: 0, x: -15 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="font-poppins font-semibold text-green-primary text-lg mb-4">
                Votre Profil
              </h3>
              <div className="space-y-3">
                {requirements.map((req, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.3 }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle className="w-5 h-5 text-green-primary shrink-0" />
                    <span className="text-text-primary font-inter text-[15px]">{req}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            {/* Equipment */}
            <motion.div
              initial={{ opacity: 0, x: 15 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="font-poppins font-semibold text-gold-accent text-lg mb-4">
                Notre &Eacute;quipement
              </h3>
              <div className="space-y-3">
                {equipment.map((eq, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.3 }}
                    className="flex items-center gap-3"
                  >
                    <eq.icon className="w-5 h-5 text-gold-accent shrink-0" />
                    <span className="text-text-primary font-inter text-[15px]">{eq.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Driver Testimonials */}
      <section className="py-16 sm:py-20 bg-bg-secondary">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl lg:text-[48px] leading-tight text-center mb-12"
          >
            Le Mot de Nos Livreurs
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {driverReviews.map((review, i) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="bg-white p-6 rounded-xl relative"
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

      {/* Registration Form */}
      <section id="register" className="py-16 sm:py-20 bg-white">
        <div className="max-w-[600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl text-center mb-8">
              Inscrivez-Vous comme Livreur
            </h2>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="font-inter font-medium text-text-primary text-sm mb-1.5 block">
                  Nom complet *
                </label>
                <input
                  type="text"
                  placeholder="Votre nom et pr&eacute;nom"
                  className="w-full h-12 px-4 border border-border-custom rounded-lg font-inter text-text-primary bg-white outline-none focus:border-green-primary focus:ring-[3px] focus:ring-green-primary/15 placeholder:text-text-muted"
                />
              </div>
              <div>
                <label className="font-inter font-medium text-text-primary text-sm mb-1.5 block">
                  T&eacute;l&eacute;phone *
                </label>
                <input
                  type="tel"
                  placeholder="+237 6XX XXX XXX"
                  className="w-full h-12 px-4 border border-border-custom rounded-lg font-inter text-text-primary bg-white outline-none focus:border-green-primary focus:ring-[3px] focus:ring-green-primary/15 placeholder:text-text-muted"
                />
              </div>
              <div>
                <label className="font-inter font-medium text-text-primary text-sm mb-1.5 block">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="votre@email.com"
                  className="w-full h-12 px-4 border border-border-custom rounded-lg font-inter text-text-primary bg-white outline-none focus:border-green-primary focus:ring-[3px] focus:ring-green-primary/15 placeholder:text-text-muted"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-inter font-medium text-text-primary text-sm mb-1.5 block">
                    Ville *
                  </label>
                  <select className="w-full h-12 px-4 border border-border-custom rounded-lg font-inter text-text-primary bg-white outline-none focus:border-green-primary focus:ring-[3px] focus:ring-green-primary/15">
                    <option value="">S&eacute;lectionnez</option>
                    <option value="douala">Douala</option>
                    <option value="yaounde">Yaound&eacute;</option>
                    <option value="bafoussam">Bafoussam</option>
                  </select>
                </div>
                <div>
                  <label className="font-inter font-medium text-text-primary text-sm mb-1.5 block">
                    Type de v&eacute;hicule *
                  </label>
                  <select className="w-full h-12 px-4 border border-border-custom rounded-lg font-inter text-text-primary bg-white outline-none focus:border-green-primary focus:ring-[3px] focus:ring-green-primary/15">
                    <option value="">S&eacute;lectionnez</option>
                    <option value="moto">Moto</option>
                    <option value="velo">V&eacute;lo</option>
                    <option value="voiture">Voiture</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-green-primary text-white font-inter font-semibold h-12 rounded-lg hover:bg-green-dark transition-colors mt-2"
              >
                S&apos;inscrire
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 bg-bg-secondary">
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
          <Accordion items={driverFAQ} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20 bg-green-primary">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="font-poppins font-bold text-white text-2xl sm:text-3xl lg:text-[48px] leading-tight mb-4"
          >
            Pr&ecirc;t &agrave; Rouler avec Yamo ?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="text-white/80 font-inter text-base mb-8"
          >
            L&apos;inscription prend moins de 10 minutes. Commencez &agrave; gagner d&egrave;s cette semaine.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <a
              href="#register"
              className="inline-flex items-center bg-white text-green-primary font-inter font-semibold text-sm h-12 px-8 rounded-lg hover:bg-green-light transition-colors"
            >
              S&apos;inscrire Maintenant
            </a>
            <p className="flex items-center justify-center gap-2 text-white/60 font-inter text-sm mt-4">
              <Phone className="w-4 h-4" />
              Questions ? Appelez-nous au +237 677 77 77 77
            </p>
          </motion.div>
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
