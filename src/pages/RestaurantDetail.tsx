import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  Clock,
  MapPin,
  Heart,
  ChevronDown,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Share2,
  Circle,
} from 'lucide-react';
import { restaurants, menuItems } from '../data/mockData';
import { useCart } from '../contexts/CartContext';
import type { MenuItem } from '../data/mockData';

const menuCategories = [
  'Populaires',
  'Entr\u00e9es',
  'Plats Principaux',
  'Grillades',
  'Accompagnements',
  'Boissons',
  'Desserts',
];

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const restaurant = restaurants.find((r) => r.id === id) || restaurants[0];
  const [activeTab, setActiveTab] = useState('Populaires');
  const [isFav, setIsFav] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const { items, addToCart, updateQuantity, totalItems, totalPrice } = useCart();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const filteredItems = useMemo(() => {
    const restoItems = menuItems.filter((m) => m.restaurantId === restaurant.id);
    if (activeTab === 'Populaires') {
      return restoItems.filter((m) => m.isPopular);
    }
    return restoItems.filter((m) => m.category === activeTab);
  }, [activeTab, restaurant.id]);

  const menuItemsByCategory = useMemo(() => {
    const restoItems = menuItems.filter((m) => m.restaurantId === restaurant.id);
    const groups: Record<string, MenuItem[]> = {};
    const cats = ['Plats Principaux', 'Grillades', 'Entr\u00e9es', 'Accompagnements', 'Boissons', 'Desserts'];
    cats.forEach((cat) => {
      const items = restoItems.filter((m) => m.category === cat);
      if (items.length) groups[cat] = items;
    });
    return groups;
  }, [restaurant.id]);

  const getItemQuantity = (itemId: string) => {
    const found = items.find((i) => i.item.id === itemId);
    return found ? found.quantity : 0;
  };

  // Rating breakdown data
  const ratingBreakdown = [
    { stars: 5, pct: 85, count: 198 },
    { stars: 4, pct: 10, count: 24 },
    { stars: 3, pct: 3, count: 8 },
    { stars: 2, pct: 1, count: 3 },
    { stars: 1, pct: 0.5, count: 1 },
  ];

  const reviewCards = [
    {
      name: 'Amandine K.',
      initial: 'A',
      rating: 5,
      date: 'il y a 2 semaines',
      comment: 'Le ndol\u00e9 est tout simplement divin ! La sauce est onctueuse et les crevettes sont fra\u00eeches. Livraison rapide et chaude.',
      order: 'Ndol\u00e9 avec B\u0153uf et Crevettes',
    },
    {
      name: 'Fran\u00e7ois M.',
      initial: 'F',
      rating: 5,
      date: 'il y a 3 semaines',
      comment: 'Le Poulet DG est incroyable, les plantains sont parfaitement croustillants. Mon restaurant pr\u00e9f\u00e9r\u00e9 sur Yamo !',
      order: 'Poulet DG Traditionnel',
    },
    {
      name: 'Grace T.',
      initial: 'G',
      rating: 4,
      date: 'il y a 1 mois',
      comment: 'Tr\u00e8s bonnes brochettes, bien \u00e9pic\u00e9es et juteuses. Un peu d\'attente mais \u00e7a vaut le coup.',
      order: 'Brochettes de B\u0153uf',
    },
  ];

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      {/* Cover Image */}
      <div className="relative h-[200px] sm:h-[280px] w-full overflow-hidden">
        <img
          src={restaurant.image}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />
      </div>

      {/* Restaurant Info Card */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] -mt-10 relative z-10 p-5 sm:p-6 mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl mb-1">
                {restaurant.name}
              </h1>
              <p className="text-text-secondary text-sm font-inter mb-3">
                {restaurant.tags.join(' \u2022 ')}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 text-gold-accent text-sm font-inter">
                  <Star className="w-4 h-4 fill-gold-accent" />
                  {restaurant.rating}
                  <span className="text-text-muted">({restaurant.reviewCount} avis)</span>
                </span>
                <span className="inline-flex items-center gap-1 text-text-secondary text-sm font-inter">
                  <Clock className="w-4 h-4" />
                  {restaurant.deliveryTime}
                </span>
                <span className="inline-flex items-center gap-1 bg-green-light text-green-primary text-xs font-inter px-2 py-0.5 rounded-full">
                  {restaurant.deliveryFee === 0 ? 'Livraison gratuite' : `${restaurant.deliveryFee} FCFA`}
                </span>
                <span className="inline-flex items-center gap-1 text-text-muted text-xs font-inter">
                  <MapPin className="w-3.5 h-3.5" />
                  1.2 km
                </span>
                <span className="inline-flex items-center gap-1 text-text-muted text-xs font-inter">
                  <Circle className="w-2 h-2 fill-success text-success" />
                  Ouvert jusqu&apos;&agrave; {restaurant.hours.split(' - ')[1]}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setIsFav(!isFav)}
                className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
              >
                <Heart className={`w-5 h-5 ${isFav ? 'fill-error text-error' : 'text-text-secondary'}`} />
              </button>
              <button className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors">
                <Share2 className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
          </div>
          <p className="text-text-secondary text-[15px] font-inter leading-relaxed mt-4 max-w-[700px]">
            {restaurant.description}
          </p>
        </motion.div>

        {/* Menu Tabs */}
        <div className="sticky top-[72px] z-30 bg-bg-secondary border-b border-border-custom mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-12 xl:px-12">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
            {menuCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`snap-start shrink-0 px-4 py-3 font-inter text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                  cat === activeTab
                    ? 'text-green-primary border-green-primary'
                    : 'text-text-secondary border-transparent hover:text-text-primary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-8 pb-16">
          {/* Menu Items */}
          <div className="flex-1">
            {activeTab === 'Populaires' ? (
              // Show popular items first, then other categories
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="font-poppins font-semibold text-text-primary text-xl">
                      Les Plus Populaires
                    </h2>
                    <div className="w-10 h-[3px] bg-green-primary rounded-full" />
                  </div>
                </motion.div>
                <div className="bg-white rounded-xl border border-border-custom overflow-hidden divide-y divide-border-light mb-8">
                  {filteredItems.map((item, i) => (
                    <MenuRow key={item.id} item={item} index={i} getQty={getItemQuantity} onAdd={addToCart} onUpdate={updateQuantity} />
                  ))}
                </div>
                {/* Other categories */}
                {Object.entries(menuItemsByCategory).map(([cat, items]) => (
                  <div key={cat} className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <h2 className="font-poppins font-semibold text-text-primary text-xl">
                        {cat}
                      </h2>
                      <div className="w-10 h-[3px] bg-green-primary rounded-full" />
                    </div>
                    <div className="bg-white rounded-xl border border-border-custom overflow-hidden divide-y divide-border-light">
                      {items.map((item, i) => (
                        <MenuRow key={item.id} item={item} index={i} getQty={getItemQuantity} onAdd={addToCart} onUpdate={updateQuantity} />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="font-poppins font-semibold text-text-primary text-xl">
                      {activeTab}
                    </h2>
                    <div className="w-10 h-[3px] bg-green-primary rounded-full" />
                  </div>
                </motion.div>
                <div className="bg-white rounded-xl border border-border-custom overflow-hidden divide-y divide-border-light">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item, i) => (
                      <MenuRow key={item.id} item={item} index={i} getQty={getItemQuantity} onAdd={addToCart} onUpdate={updateQuantity} />
                    ))
                  ) : (
                    <div className="p-8 text-center text-text-secondary font-inter">
                      Aucun plat dans cette cat&eacute;gorie pour le moment.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Cart Sidebar - Desktop */}
          <div className="hidden lg:block w-[380px] shrink-0">
            <div className="sticky top-[140px] bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-5">
              <CartContent items={items} totalItems={totalItems} totalPrice={totalPrice} onUpdate={updateQuantity} />
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <section className="pb-16">
          <div className="bg-white rounded-xl border border-border-custom p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Rating Summary */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="md:w-[280px] shrink-0"
              >
                <div className="flex items-end gap-2 mb-2">
                  <span className="font-poppins font-extrabold text-text-primary text-5xl">
                    {restaurant.rating}
                  </span>
                  <span className="text-text-secondary font-inter text-base mb-1">sur 5</span>
                </div>
                <div className="flex gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${
                        i < Math.floor(restaurant.rating)
                          ? 'fill-gold-accent text-gold-accent'
                          : i < restaurant.rating
                          ? 'fill-gold-accent/50 text-gold-accent'
                          : 'text-border-custom'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-text-muted text-sm font-inter mb-6">
                  Bas&eacute; sur {restaurant.reviewCount} avis
                </p>
                <div className="space-y-2">
                  {ratingBreakdown.map((rb) => (
                    <div key={rb.stars} className="flex items-center gap-2">
                      <span className="text-text-secondary text-xs font-inter w-6">{rb.stars}★</span>
                      <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gold-accent rounded-full"
                          style={{ width: `${rb.pct}%` }}
                        />
                      </div>
                      <span className="text-text-muted text-xs font-inter w-8 text-right">{rb.count}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Review List */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-poppins font-semibold text-text-primary text-lg">
                    Avis r&eacute;cents
                  </h3>
                  <button className="flex items-center gap-1 text-text-secondary text-sm font-inter hover:text-text-primary">
                    Plus r&eacute;cents
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-0 divide-y divide-border-light">
                  {reviewCards.map((review, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                      className="py-4"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-green-primary text-white flex items-center justify-center font-inter font-semibold text-sm">
                          {review.initial}
                        </div>
                        <div>
                          <span className="font-inter font-semibold text-text-primary text-sm">
                            {review.name}
                          </span>
                          <span className="text-text-muted text-xs font-inter ml-2">
                            {review.date}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-0.5 mb-2">
                        {Array.from({ length: review.rating }).map((_, j) => (
                          <Star key={j} className="w-3 h-3 fill-gold-accent text-gold-accent" />
                        ))}
                      </div>
                      <p className="text-text-primary text-[15px] font-inter leading-relaxed mb-2">
                        {review.comment}
                      </p>
                      <span className="inline-block bg-green-light text-green-primary text-xs font-inter font-medium px-2 py-0.5 rounded-full">
                        {review.order}
                      </span>
                    </motion.div>
                  ))}
                </div>
                <button className="w-full mt-4 py-3 border border-border-custom rounded-lg text-text-secondary font-inter text-sm font-medium hover:bg-bg-secondary transition-colors">
                  Voir plus d&apos;avis
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Similar Restaurants */}
        <section className="pb-16">
          <h2 className="font-poppins font-bold text-text-primary text-2xl mb-6">
            Vous Aimerez Aussi
          </h2>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4">
            {restaurants.filter((r) => r.id !== restaurant.id).slice(0, 4).map((resto) => (
              <Link
                key={resto.id}
                to={`/restaurant/${resto.id}`}
                className="snap-start shrink-0 w-[260px] bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={resto.image} alt={resto.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-4">
                  <h3 className="font-inter font-semibold text-text-primary text-sm mb-1">
                    {resto.name}
                  </h3>
                  <p className="text-text-secondary text-xs font-inter mb-2">
                    {resto.tags.join(' \u2022 ')}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 bg-gold-light text-gold-accent text-xs font-inter font-medium px-2 py-0.5 rounded-full">
                      <Star className="w-3 h-3 fill-gold-accent" />
                      {resto.rating}
                    </span>
                    <span className="text-text-secondary text-xs font-inter">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {resto.deliveryTime}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Mobile Cart Bar */}
      {totalItems > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-border-custom shadow-[0_-4px_16px_rgba(0,0,0,0.08)] z-40 px-4 flex items-center justify-between">
          <div>
            <span className="text-text-secondary font-inter text-sm">
              {totalItems} article{totalItems > 1 ? 's' : ''}
            </span>
            <span className="text-text-primary font-inter font-bold text-base ml-3">
              {totalPrice.toLocaleString()} FCFA
            </span>
          </div>
          <button
            onClick={() => setMobileCartOpen(true)}
            className="bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-full hover:bg-green-dark transition-colors"
          >
            Voir le panier &rarr;
          </button>
        </div>
      )}

      {/* Mobile Cart Sheet */}
      <AnimatePresence>
        {mobileCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 lg:hidden"
              onClick={() => setMobileCartOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: '20%' }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white rounded-t-2xl p-5 shadow-xl overflow-y-auto"
              style={{ maxHeight: '80vh' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-poppins font-semibold text-lg">Votre Commande</h3>
                <button onClick={() => setMobileCartOpen(false)}>
                  <ChevronDown className="w-6 h-6 text-text-secondary" />
                </button>
              </div>
              <CartContent items={items} totalItems={totalItems} totalPrice={totalPrice} onUpdate={updateQuantity} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Menu Row Component */
function MenuRow({
  item, index, getQty, onAdd, onUpdate,
}: {
  item: MenuItem;
  index: number;
  getQty: (id: string) => number;
  onAdd: (item: MenuItem) => void;
  onUpdate: (id: string, qty: number) => void;
}) {
  const qty = getQty(item.id);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="flex items-center gap-4 p-4 hover:bg-bg-secondary transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-inter font-semibold text-text-primary text-base truncate">
            {item.name}
          </h4>
          {item.isPopular && (
            <span className="shrink-0 bg-gold-light text-gold-accent text-[11px] font-inter font-semibold px-2 py-0.5 rounded-full">
              Populaire
            </span>
          )}
        </div>
        <p className="text-text-secondary text-sm font-inter line-clamp-2 mb-2 leading-relaxed">
          {item.description}
        </p>
        <span className="font-inter font-bold text-text-primary text-base">
          {item.price.toLocaleString()} FCFA
        </span>
      </div>
      <div className="shrink-0 relative">
        <img
          src={item.image}
          alt={item.name}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover"
        />
        {qty === 0 ? (
          <button
            onClick={() => onAdd(item)}
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-green-primary text-white flex items-center justify-center shadow-md hover:bg-green-dark hover:scale-110 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        ) : (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white rounded-full shadow-md border border-border-custom px-1 py-0.5">
            <button
              onClick={() => onUpdate(item.id, qty - 1)}
              className="w-6 h-6 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
            >
              {qty === 1 ? <Trash2 className="w-3 h-3 text-error" /> : <Minus className="w-3 h-3" />}
            </button>
            <span className="text-text-primary font-inter font-semibold text-xs w-4 text-center">{qty}</span>
            <button
              onClick={() => onAdd(item)}
              className="w-6 h-6 rounded-full bg-green-primary text-white flex items-center justify-center hover:bg-green-dark transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* Cart Content Component */
function CartContent({
  items, totalItems, totalPrice, onUpdate,
}: {
  items: { item: MenuItem; quantity: number }[];
  totalItems: number;
  totalPrice: number;
  onUpdate: (id: string, qty: number) => void;
}) {
  if (totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <ShoppingCart className="w-12 h-12 text-text-muted mb-3" />
        <p className="text-text-secondary font-inter font-medium text-base mb-1">
          Votre panier est vide
        </p>
        <p className="text-text-muted font-inter text-sm text-center">
          Ajoutez des plats d&eacute;licieux &agrave; votre commande
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-poppins font-semibold text-text-primary text-lg mb-4">
        Votre Commande
        <span className="ml-2 text-text-muted text-sm font-inter font-normal">
          ({totalItems} article{totalItems > 1 ? 's' : ''})
        </span>
      </h3>
      <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
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
                onClick={() => onUpdate(item.id, quantity - 1)}
                className="w-7 h-7 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
              >
                {quantity === 1 ? <Trash2 className="w-3 h-3 text-error" /> : <Minus className="w-3 h-3" />}
              </button>
              <span className="text-text-primary font-inter font-semibold text-sm w-5 text-center">
                {quantity}
              </span>
              <button
                onClick={() => onUpdate(item.id, quantity + 1)}
                className="w-7 h-7 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border-light pt-4 space-y-2">
        <div className="flex justify-between text-sm font-inter text-text-secondary">
          <span>Sous-total</span>
          <span>{totalPrice.toLocaleString()} FCFA</span>
        </div>
        <div className="flex justify-between text-sm font-inter">
          <span className="text-text-secondary">Livraison</span>
          <span className="text-success font-medium">Gratuit</span>
        </div>
        <div className="border-t border-border-light pt-2 flex justify-between font-inter">
          <span className="text-text-primary font-bold text-lg">Total</span>
          <span className="text-text-primary font-bold text-lg">{totalPrice.toLocaleString()} FCFA</span>
        </div>
      </div>
      <button className="w-full mt-4 bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors">
        Commander &mdash; {totalPrice.toLocaleString()} FCFA
      </button>
    </div>
  );
}
