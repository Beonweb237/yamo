import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Star, MapPin, Clock, Store, Flame, ChevronRight, ImageOff,
  Leaf, Beef, Wheat, Coffee, Apple,
} from 'lucide-react';
import { useRestaurants } from '../hooks/useCatalog';
import { menuItems as mockMenuItems } from '../data/mockData';
import {
  buildEnrichedItems,
  groupDishes,
  dishSlug,
  DIETARY_TAG_META,
  normalizeDishName,
} from '../lib/dishes';

const DIETARY_ICONS: Record<string, typeof Leaf> = {
  'sans-sucre': Coffee, diabetique: Apple, 'pauvre-en-sel': Wheat, vegetarien: Leaf,
  vegan: Leaf, halal: Flame, bio: Leaf, 'riche-en-proteines': Beef, allege: Wheat,
  epice: Flame, braise: Flame, traditionnel: Store, 'sans-cube': Coffee,
  'fait-maison': Star, 'sans-gluten': Wheat, cocktail: Coffee, detox: Apple,
  'presse-du-jour': Coffee,
};

const dietaryLabel = (id: string) => DIETARY_TAG_META.find((t) => t.id === id)?.label ?? id;

// Remonte intégralement (key={slug} ci-dessous) à chaque changement de plat :
// évite de réinitialiser galleryIndex via un effet et garantit un scroll en
// haut de page cohérent, sans état résiduel de la fiche précédente.
export default function DishDetail() {
  const { slug } = useParams<{ slug: string }>();
  return <DishDetailContent key={slug} slug={slug} />;
}

function DishDetailContent({ slug }: { slug?: string }) {
  const { restaurants } = useRestaurants();
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const allItems = useMemo(
    () => buildEnrichedItems(mockMenuItems, restaurants),
    [restaurants]
  );

  const dishGroups = useMemo(
    () => groupDishes(allItems.filter((i) => i.isAvailable !== false)),
    [allItems]
  );

  const dish = useMemo(
    () => dishGroups.find((g) => dishSlug(g.displayName) === slug),
    [dishGroups, slug]
  );

  const restaurantById = useMemo(
    () => new Map(restaurants.map((r) => [r.id, r])),
    [restaurants]
  );

  const galleryImages = useMemo(() => {
    if (!dish) return [];
    return [...new Set(dish.items.map((i) => i.image).filter(Boolean))].slice(0, 6);
  }, [dish]);

  const bestDescription = useMemo(() => {
    if (!dish) return '';
    return dish.items.reduce((longest, item) => (
      item.description.length > longest.length ? item.description : longest
    ), '');
  }, [dish]);

  const similarDishes = useMemo(() => {
    if (!dish) return [];
    const category = dish.items[0]?.category;
    return dishGroups
      .filter((g) => g.key !== dish.key && g.items[0]?.category === category)
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 4);
  }, [dish, dishGroups]);

  if (!dish) {
    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-text-secondary font-inter font-medium mb-3">
            Ce plat n'existe pas ou n'est plus disponible.
          </p>
          <Link to="/explorer" className="text-green-primary font-inter text-sm font-medium hover:underline">
            Retour à l'exploration des plats
          </Link>
        </div>
      </div>
    );
  }

  const isTrending = dish.items.some((i) => i.isPopular);
  const category = dish.items[0]?.category ?? '';
  const heroImage = galleryImages[galleryIndex] ?? dish.bestImage;

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-text-muted text-xs font-inter mb-4">
          <Link to="/" className="hover:text-text-primary transition-colors">Accueil</Link>
          <span className="mx-2">/</span>
          <Link to="/explorer" className="hover:text-text-primary transition-colors">Explorer</Link>
          <span className="mx-2">/</span>
          <span className="text-text-primary">{dish.displayName}</span>
        </div>

        <div className="bg-white rounded-2xl border border-border-custom shadow-sm overflow-hidden mb-6">
          <div className="relative aspect-[16/9] sm:aspect-[21/9] bg-bg-secondary">
            {heroImage ? (
              <img src={heroImage} alt={dish.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-10 h-10 text-text-muted" /></div>
            )}
            {isTrending && (
              <span className="absolute top-4 left-4 flex items-center gap-1 bg-gold-accent text-white text-xs font-inter font-bold px-3 py-1 rounded-full shadow-sm">
                <Flame className="w-3.5 h-3.5" />Tendance
              </span>
            )}
          </div>

          {galleryImages.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto scrollbar-hide border-b border-border-light">
              {galleryImages.map((img, i) => (
                <button
                  key={img + i}
                  onClick={() => setGalleryIndex(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === galleryIndex ? 'border-green-primary' : 'border-transparent'}`}
                >
                  <img src={img} alt={`${dish.displayName} ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="p-5 sm:p-6">
            <p className="text-text-secondary text-sm font-inter mb-1">{category}</p>
            <h1 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl mb-3">
              {dish.displayName}
            </h1>

            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm font-inter">
              <span className="inline-flex items-center gap-1 text-gold-accent font-semibold">
                <Star className="w-4 h-4 fill-gold-accent" />
                {dish.avgRating.toFixed(1)}
              </span>
              <span className="inline-flex items-center gap-1 text-text-secondary">
                <Store className="w-4 h-4" />
                {dish.totalRestaurants} restaurant{dish.totalRestaurants > 1 ? 's' : ''}
              </span>
            </div>

            {dish.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {dish.tags.map((tag) => {
                  const Icon = DIETARY_ICONS[tag] ?? Leaf;
                  return (
                    <span key={tag} className="inline-flex items-center gap-1.5 bg-green-light text-green-primary text-xs font-inter font-medium px-2.5 py-1 rounded-full">
                      <Icon className="w-3.5 h-3.5" />
                      {dietaryLabel(tag)}
                    </span>
                  );
                })}
              </div>
            )}

            {bestDescription && (
              <p className="text-text-secondary text-[15px] font-inter leading-relaxed max-w-[680px]">
                {bestDescription}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-border-custom p-4 text-center">
            <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide mb-1">À partir de</p>
            <p className="font-poppins font-bold text-text-primary text-lg">{dish.minPrice.toLocaleString()} FCFA</p>
          </div>
          <div className="bg-white rounded-xl border border-border-custom p-4 text-center">
            <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide mb-1">Jusqu'à</p>
            <p className="font-poppins font-bold text-text-primary text-lg">{dish.maxPrice.toLocaleString()} FCFA</p>
          </div>
          <div className="bg-white rounded-xl border border-border-custom p-4 text-center col-span-2 sm:col-span-1">
            <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide mb-1">Note moyenne</p>
            <p className="font-poppins font-bold text-text-primary text-lg">{dish.avgRating.toFixed(1)} / 5</p>
          </div>
        </div>

        <section className="bg-white rounded-2xl border border-border-custom shadow-sm overflow-hidden mb-8">
          <div className="px-5 sm:px-6 py-4 border-b border-border-light">
            <h2 className="font-poppins font-semibold text-text-primary text-lg">
              Disponible chez {dish.totalRestaurants} restaurant{dish.totalRestaurants > 1 ? 's' : ''}
            </h2>
            <p className="text-text-muted text-xs font-inter mt-0.5">Trié du moins cher au plus cher</p>
          </div>
          <div className="divide-y divide-border-light">
            {dish.items.map((item) => {
              const resto = restaurantById.get(item.restaurantId);
              const location = [resto?.neighborhood ?? item.restaurantNeighborhood, resto?.city ?? item.restaurantCity].filter(Boolean).join(', ');
              const deliveryTime = resto?.deliveryTime ?? item.restaurantDeliveryTime;
              const itemNameDiffers = normalizeDishName(item.name) !== normalizeDishName(dish.displayName);
              return (
                <Link
                  key={item.id}
                  to={`/restaurant/${item.restaurantId}`}
                  className="flex items-center gap-3 p-4 sm:p-5 hover:bg-bg-secondary transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-inter font-semibold text-text-primary text-sm">{item.restaurantName}</p>
                      <span className="flex items-center gap-0.5 text-xs text-gold-accent shrink-0">
                        <Star className="w-3 h-3 fill-gold-accent" />{item.restaurantRating}
                      </span>
                    </div>
                    {itemNameDiffers && (
                      <p className="text-text-muted text-xs font-inter mt-0.5 truncate">{item.name}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-text-muted text-xs font-inter">
                      {location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{location}
                        </span>
                      )}
                      {deliveryTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{deliveryTime}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-inter font-bold text-green-primary text-sm shrink-0">
                    {item.price.toLocaleString()} FCFA
                  </span>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-green-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>

        {similarDishes.length > 0 && (
          <section className="pb-12">
            <h2 className="font-poppins font-bold text-text-primary text-xl mb-4">
              Plats similaires
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {similarDishes.map((group) => (
                <Link
                  key={group.key}
                  to={`/plat/${dishSlug(group.displayName)}`}
                  className="group text-left bg-white rounded-xl border border-border-custom shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-bg-secondary">
                    {group.bestImage ? (
                      <img src={group.bestImage} alt={group.displayName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-5 h-5 text-text-muted" /></div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="font-inter font-semibold text-text-primary text-xs truncate">{group.displayName}</p>
                    <p className="text-green-primary font-inter font-bold text-xs mt-0.5">{group.minPrice.toLocaleString()} FCFA</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
