import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin,
  Search,
  Star,
  Clock,
  ArrowRight,
  Check,
  Quote,
} from 'lucide-react';
import { cuisineCategories, customerReviews } from '../data/mockData';
import { matchLocationQuery } from '../data/locations';
import { useRestaurants } from '../hooks/useCatalog';
import AppImage from '../components/AppImage';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function Home() {
  const { restaurants } = useRestaurants();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleExplore = () => {
    const match = matchLocationQuery(searchValue);
    const params = new URLSearchParams();
    if (searchValue.trim()) params.set('q', searchValue.trim());
    if (match.city) params.set('ville', match.city);
    if (match.neighborhood) params.set('quartier', match.neighborhood);
    navigate(`/restaurants${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <div className="pt-0">
      {/* Hero Section */}
      <section className="relative min-h-[100dvh] flex items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <img
            src="/hero-bg.jpg"
            alt="Cameroonian food spread"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'data:image/svg+xml,' +
                encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect fill="#1a1a1a" width="100%" height="100%"/><text x="50%" y="50%" fill="#2d6a4f" font-size="48" text-anchor="middle" dominant-baseline="middle" font-family="Arial">Yamo</text></svg>'
                );
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[rgba(26,26,26,0.92)] via-[rgba(26,26,26,0.7)] to-[rgba(26,26,26,0.2)]" />
        </div>

        <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 w-full py-20 pt-28">
          <div className="max-w-[580px]">
            {/* Overline */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="inline-block mb-5"
            >
              <span className="inline-flex items-center px-3 py-1.5 border border-gold-accent rounded-full text-gold-accent text-xs font-inter font-semibold tracking-normal uppercase">
                Livraison de repas au Cameroun
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="font-poppins font-semibold text-white text-[38px]/[1.15] sm:text-[46px]/[1.13] lg:text-[52px]/[1.12] tracking-normal mb-5 max-w-[620px]"
            >
              D&eacute;couvrez les Meilleures Saveurs du Cameroun, Livr&eacute;es Chez Vous
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="text-white/75 font-inter text-base sm:text-lg leading-relaxed mb-8 max-w-[520px]"
            >
              Dans les grandes villes du Cameroun, de la cuisine camerounaise authentique aux saveurs internationales &mdash; commandez en quelques clics et savourez sans attendre.
            </motion.p>

            {/* Search Bar */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 1.1 }}
              className="bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.15)] p-2 flex items-center gap-2 max-w-[520px]"
            >
              <div className="flex items-center gap-2 flex-1 px-3">
                <MapPin className="w-5 h-5 text-green-primary shrink-0" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Entrez votre ville ou quartier..."
                  className="flex-1 text-text-primary font-inter text-base bg-transparent outline-none placeholder:text-text-muted h-11"
                />
              </div>
              <button
                type="button"
                onClick={handleExplore}
                className="shrink-0 bg-green-primary text-white font-inter font-medium text-sm px-5 h-11 rounded-lg hover:bg-green-dark transition-colors flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Explorer</span>
              </button>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 1.3 }}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-6 text-white/60 text-[13px] font-inter"
            >
              <span>Plus de 500 restaurants partenaires</span>
              <span>&bull;</span>
              <span>Livraison en 30 min</span>
              <span>&bull;</span>
              <span>Paiement s&eacute;curis&eacute;</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Cuisine Categories */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10"
          >
            <h2 className="font-poppins font-semibold text-text-primary text-2xl sm:text-3xl lg:text-[38px]/[1.18] tracking-normal mb-3">
              Explorez par Type de Cuisine
            </h2>
            <p className="text-text-secondary font-inter text-base">
              Des saveurs locales aux d&eacute;couvertes internationales
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 sm:grid sm:grid-cols-4 lg:grid-cols-8"
          >
            {cuisineCategories.map((cat) => (
              <motion.div
                key={cat.id}
                variants={{
                  hidden: { opacity: 0, y: 30, scale: 0.95 },
                  visible: { opacity: 1, y: 0, scale: 1 },
                }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center gap-3 min-w-[72px] cursor-pointer group shrink-0"
              >
                <Link
                  to={`/restaurants?category=${encodeURIComponent(cat.name)}`}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full overflow-hidden shadow-md group-hover:shadow-lg transition-shadow">
                    <AppImage
                      src={cat.image}
                      alt={cat.name}
                      fallbackLabel={cat.name}
                      className="w-full h-full object-cover group-hover:scale-[1.08] transition-transform duration-200"
                    />
                  </div>
                  <span className="text-text-primary font-inter text-sm font-medium group-hover:text-green-primary transition-colors text-center leading-tight">
                    {cat.name}
                  </span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Popular Restaurants */}
      <section className="py-16 sm:py-20 bg-bg-secondary">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-baseline justify-between mb-10"
          >
            <h2 className="font-poppins font-semibold text-text-primary text-2xl sm:text-3xl lg:text-[38px]/[1.18] tracking-normal">
              Restaurants Populaires
            </h2>
            <Link
              to="/restaurants"
              className="hidden sm:flex items-center gap-1 text-green-primary font-inter text-sm font-medium hover:underline"
            >
              Explorer tous les restaurants
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {restaurants.slice(0, 4).map((resto) => (
              <motion.div
                key={resto.id}
                variants={{
                  hidden: { opacity: 0, y: 40 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to={`/restaurant/${resto.id}`}
                  className="block bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)] hover:-translate-y-1 transition-all duration-250"
                >
                  <div className="aspect-[16/10] overflow-hidden relative">
                    <AppImage
                      src={resto.image}
                      alt={resto.name}
                      fallbackLabel={resto.name}
                      className="w-full h-full object-cover hover:scale-[1.05] transition-transform duration-400"
                    />
                    {resto.isPremium && (
                      <span className="absolute top-0 left-0 bg-green-primary text-white text-xs font-inter font-semibold px-3 py-1.5 rounded-br-lg">
                        -20%
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-inter font-semibold text-text-primary text-base mb-1">
                      {resto.name}
                    </h3>
                    <p className="text-text-secondary text-xs font-inter mb-3">
                      {resto.tags.join(' \u2022 ')}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1 bg-gold-light text-gold-accent text-xs font-inter font-medium px-2 py-0.5 rounded-full">
                        <Star className="w-3 h-3 fill-gold-accent" />
                        {resto.rating}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-bg-secondary text-text-secondary text-xs font-inter px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" />
                        {resto.deliveryTime}
                      </span>
                      <span className="text-text-secondary text-xs font-inter">
                        {resto.deliveryFee === 0 ? 'Gratuit' : `${resto.deliveryFee} FCFA`}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="font-poppins font-semibold text-text-primary text-2xl sm:text-3xl lg:text-[38px]/[1.18] tracking-normal mb-3">
              Commandez en 3 &Eacute;tapes Simples
            </h2>
            <p className="text-text-secondary font-inter text-base">
              Une exp&eacute;rience fluide, de la d&eacute;couverte &agrave; la d&eacute;gustation
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Dotted connector line - desktop only */}
            <div className="hidden md:block absolute top-7 left-[20%] right-[20%] border-t-2 border-dashed border-border-custom" />

            {[
              {
                num: '1',
                icon: Search,
                title: 'Explorez les Menus',
                desc: 'Parcourez des centaines de restaurants et de plats pr&egrave;s de chez vous. Filtrez par cuisine, prix, et temps de livraison.',
              },
              {
                num: '2',
                icon: ShoppingCart2,
                title: 'Passez Votre Commande',
                desc: 'Ajoutez vos plats pr&eacute;f&eacute;r&eacute;s au panier, personnalisez vos options, et payez en toute s&eacute;curit&eacute; par Mobile Money ou carte.',
              },
              {
                num: '3',
                icon: MapPin,
                title: 'Suivez en Temps R&eacute;el',
                desc: 'Suivez votre livraison du restaurant &agrave; votre porte. D&eacute;gustez vos saveurs pr&eacute;f&eacute;r&eacute;es au chaud et &agrave; temps.',
              },
            ].map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.15,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="flex flex-col items-center text-center relative z-10"
              >
                <motion.div
                  initial={{ scale: 0.8 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.15 + 0.2 }}
                  className="w-14 h-14 rounded-full bg-green-primary text-white flex items-center justify-center font-poppins font-bold text-2xl mb-4"
                >
                  {step.num}
                </motion.div>
                <step.icon className="w-8 h-8 text-green-primary mb-3" />
                <h4 className="font-poppins font-semibold text-text-primary text-lg mb-2">
                  {step.title}
                </h4>
                <p className="text-text-secondary font-inter text-sm leading-relaxed max-w-[320px]"
                  dangerouslySetInnerHTML={{ __html: step.desc }}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* App Download CTA */}
      <section className="py-16 sm:py-20 bg-bg-dark overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 text-center lg:text-left"
            >
              <span className="text-gold-accent text-xs font-inter font-semibold tracking-normal uppercase">
                Application Mobile
              </span>
              <h2 className="font-poppins font-semibold text-white text-2xl sm:text-3xl lg:text-[38px]/[1.18] tracking-normal mt-3 mb-4">
                Commandez O&ugrave; Que Vous Soyez
              </h2>
              <p className="text-white/70 font-inter text-base leading-relaxed max-w-[480px] mx-auto lg:mx-0 mb-6">
                T&eacute;l&eacute;chargez l&apos;application Yamo pour une exp&eacute;rience encore plus rapide. Recevez des notifications en temps r&eacute;el, sauvegardez vos adresses favorites, et profitez d&apos;offres exclusives.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
                <button className="flex items-center justify-center gap-2 bg-white text-text-primary font-inter font-medium text-sm px-6 h-12 rounded-lg hover:bg-green-light transition-colors">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  App Store
                </button>
                <button className="flex items-center justify-center gap-2 bg-white text-text-primary font-inter font-medium text-sm px-6 h-12 rounded-lg hover:bg-green-light transition-colors">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    <path d="M3 20.5v-17c0-.83.67-1.5 1.5-1.5.28 0 .55.08.78.23l15 8.5c.46.26.74.75.74 1.27s-.28 1.01-.74 1.27l-15 8.5c-.23.15-.5.23-.78.23-.83 0-1.5-.67-1.5-1.5z" />
                  </svg>
                  Google Play
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                {[
                  { icon: Check, text: 'Commandes illimit&eacute;es' },
                  { icon: MapPin, text: 'Suivi GPS en temps r&eacute;el' },
                  { icon: Star, text: 'Offres exclusives' },
                ].map((feat, i) => (
                  <span key={i} className="inline-flex items-center gap-2 text-white/70 font-inter text-sm">
                    <feat.icon className="w-4 h-4 text-gold-accent" />
                    <span dangerouslySetInnerHTML={{ __html: feat.text }} />
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Right - Phone Mockup */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex justify-center relative"
            >
              <div className="absolute w-[300px] h-[300px] rounded-full bg-green-primary/20 blur-3xl" />
              <img
                src="/app-preview.png"
                alt="App preview"
                className="relative z-10 max-h-[500px] object-contain drop-shadow-2xl animate-float"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 sm:py-20 bg-bg-secondary">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="font-poppins font-semibold text-text-primary text-2xl sm:text-3xl lg:text-[38px]/[1.18] tracking-normal mb-3">
              Ils Nous Font Confiance
            </h2>
            <p className="text-text-secondary font-inter text-base">
              Des milliers de clients satisfaits &agrave; travers le Cameroun
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {customerReviews.map((review) => (
              <motion.div
                key={review.id}
                variants={{
                  hidden: { opacity: 0, y: 40 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="bg-white p-6 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] relative hover:shadow-lg transition-shadow"
              >
                <Quote className="absolute top-4 right-4 w-12 h-12 text-green-light -z-0" />
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <img
                    src={review.avatar}
                    alt={review.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-green-primary"
                  />
                  <div>
                    <h4 className="font-inter font-semibold text-text-primary text-sm">
                      {review.name}
                    </h4>
                    <p className="text-text-secondary text-xs font-inter">
                      {review.location}
                    </p>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-3 relative z-10">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-gold-accent text-gold-accent" />
                  ))}
                </div>
                <p className="text-text-primary font-inter text-sm italic leading-relaxed relative z-10">
                  &ldquo;{review.comment}&rdquo;
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </div>
  );
}

// Local icon component for shopping cart in How It Works
function ShoppingCart2(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

