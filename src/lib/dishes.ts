// Regroupement des plats à travers les restaurants (utilisé par la page
// Explorer et par la fiche plat individuelle) — module partagé pour garder
// une seule source de vérité sur la normalisation des noms et le calcul
// des statistiques par plat.
import {
  restaurants as mockRestaurants,
  dishCatalog,
  type DishCatalogEntry,
  type MenuItem,
  type Restaurant,
} from '../data/mockData';

export interface EnrichedItem extends MenuItem {
  restaurantName: string;
  restaurantRating: number;
  restaurantCity: string;
  restaurantNeighborhood: string;
  restaurantDeliveryTime: string;
}

export interface DishGroup {
  key: string;
  displayName: string;
  canonicalDishId?: string;
  items: EnrichedItem[];
  minPrice: number;
  maxPrice: number;
  totalRestaurants: number;
  avgRating: number;
  tags: string[];
  bestImage: string;
}

/** Métadonnées des tags diététiques/régimes — labels seulement, les icônes restent côté page. */
export const DIETARY_TAG_META: { id: string; label: string }[] = [
  { id: 'sans-sucre', label: 'Sans sucre' },
  { id: 'diabetique', label: 'Diabétique' },
  { id: 'pauvre-en-sel', label: 'Pauvre en sel' },
  { id: 'vegetarien', label: 'Végétarien' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'halal', label: 'Halal' },
  { id: 'bio', label: 'Bio' },
  { id: 'riche-en-proteines', label: 'Protéiné' },
  { id: 'allege', label: 'Allégé' },
  { id: 'epice', label: 'Épicé' },
  { id: 'braise', label: 'Braisé' },
  { id: 'traditionnel', label: 'Traditionnel' },
  { id: 'sans-cube', label: 'Sans cube' },
  { id: 'fait-maison', label: 'Fait maison' },
  { id: 'sans-gluten', label: 'Sans gluten' },
  { id: 'cocktail', label: 'Cocktail' },
  { id: 'detox', label: 'Détox' },
  { id: 'presse-du-jour', label: 'Pressé du jour' },
];

function normalizeTag(tag: string): string {
  const normalized = tag
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const aliases: Record<string, string> = {
    diabetique: 'diabetique',
    vegetarien: 'vegetarien',
    protein: 'riche-en-proteines',
    proteine: 'riche-en-proteines',
    proteines: 'riche-en-proteines',
    'riche-en-proteine': 'riche-en-proteines',
    'riche-en-proteines': 'riche-en-proteines',
    epice: 'epice',
    epices: 'epice',
    traditionnel: 'traditionnel',
    traditionnelle: 'traditionnel',
  };

  return aliases[normalized] ?? normalized;
}

export function normalizeDishName(name: string): string {
  // \u0153/\u00e6 ne sont ni des diacritiques ni des [a-z] : sans translitt\u00e9ration ils
  // disparaissent (\u00ab b\u0153uf \u00bb \u2192 \u00ab buf \u00bb dans les slugs partag\u00e9s).
  return name.toLowerCase().replace(/\u0153/g, 'oe').replace(/\u00e6/g, 'ae').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** Variante historique (sans translitt\u00e9ration \u0153\u2192oe) \u2014 uniquement pour r\u00e9soudre
 * les anciens liens partag\u00e9s du type /article/boukarou-de-buf. */
export function legacyDishSlug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim().replace(/\s+/g, '-');
}

function catalogMatchesItem(catalogName: string, itemText: string): boolean {
  const name = normalizeDishName(catalogName);
  if (itemText === name || itemText.startsWith(`${name} `)) return true;
  if (name === 'poisson braise') return itemText.includes('poisson') && itemText.includes('braise');
  if (name === 'jus gingembre') return itemText.includes('jus') && itemText.includes('gingembre');
  if (name === 'jus bissap') return itemText.includes('jus') && itemText.includes('bissap');
  return false;
}

export function findDishCatalogEntry(item: MenuItem): DishCatalogEntry | undefined {
  if (item.catalogDishId) {
    const explicit = dishCatalog.find((dish) => dish.id === item.catalogDishId);
    if (explicit) return explicit;
  }

  const text = normalizeDishName(`${item.name} ${item.description}`);
  return dishCatalog.find((dish) => catalogMatchesItem(dish.name, text));
}

function isTraditionalDishText(text: string): boolean {
  const traditionalKeywords = [
    'traditionnel', 'traditionnelle', 'camerounais', 'camerounaise', 'ndole', 'eru', 'koki',
    'poulet dg', 'bobolo', 'alloco', 'bissap', 'folere', 'bouillie de mil', 'beignets haricot',
    'taro', 'achu', 'okok', 'mbongo', 'kondre', 'miondo', 'sanga', 'suya', 'boukarou',
  ];
  return traditionalKeywords.some((keyword) => text.includes(keyword));
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function hasAnimalProteinText(text: string): boolean {
  return includesAny(text, [
    'boeuf', 'poulet', 'poisson', 'crevette', 'crevettes', 'homard', 'viande', 'jambon',
    'pepperoni', 'saucisse', 'saucisses', 'steak', 'shawarma', 'suya', 'lait', 'fromage',
    'oeuf', 'oeufs', 'omelette',
  ]);
}

export function inferDietaryTags(item: MenuItem): string[] {
  const tags: string[] = [];
  const text = normalizeDishName(`${item.name} ${item.description} ${item.category}`);
  const nameAndCategory = normalizeDishName(`${item.name} ${item.category}`);
  const catalogEntry = findDishCatalogEntry(item);

  if (item.dietaryTags?.length) tags.push(...item.dietaryTags.map(normalizeTag));
  if (catalogEntry?.tags.length) tags.push(...catalogEntry.tags.map(normalizeTag));

  if (includesAny(text, ['sans sucre', 'sans sucre ajoute', 'zero sucre', 'non sucre', 'naturellement sans sucre', 'eau minerale'])) tags.push('sans-sucre');
  if (includesAny(text, ['diabetique', 'indice glycemique', 'glycemique bas', 'pauvre en glucides'])) tags.push('diabetique');
  if (includesAny(text, ['pauvre en sel', 'sel reduit', 'sans sel ajoute'])) tags.push('pauvre-en-sel');
  if (includesAny(text, ['bio', 'biologique'])) tags.push('bio');
  if (includesAny(text, ['sans gluten'])) tags.push('sans-gluten');
  if (includesAny(text, ['cocktail'])) tags.push('cocktail');
  if (includesAny(text, ['detox'])) tags.push('detox');
  if (includesAny(text, ['presse du jour', 'presse a la demande', 'presse a froid', 'jus frais presse'])) tags.push('presse-du-jour');
  if (includesAny(text, ['sans cube', 'sans bouillon'])) tags.push('sans-cube');

  const vegetarianSignal = includesAny(text, ['vegetarien', 'vegetarienne'])
    || (includesAny(nameAndCategory, ['salade', 'fruits', 'legumes']) && !hasAnimalProteinText(text));
  if (vegetarianSignal) tags.push('vegetarien');

  if (includesAny(nameAndCategory, ['salade', 'fruits']) || includesAny(text, ['allege', 'leger', 'legere', 'vapeur'])) tags.push('allege');
  if (includesAny(text, ['grillade', 'brochette', 'poulet', 'boeuf', 'poisson', 'crevette', 'crevettes', 'homard', 'viande', 'steak', 'oeuf', 'oeufs', 'omelette'])) tags.push('riche-en-proteines');
  if (includesAny(text, ['epice', 'piment'])) tags.push('epice');
  if (includesAny(text, ['braise', 'braisee', 'braisees'])) tags.push('braise');
  if (isTraditionalDishText(text)) tags.push('traditionnel');
  if (item.category === 'Grillades') tags.push('riche-en-proteines');

  return [...new Set(tags.map(normalizeTag))];
}
/** Slug URL-safe pour la route /plat/:slug — dérivé de normalizeDishName. */
export function dishSlug(name: string): string {
  return normalizeDishName(name).replace(/\s+/g, '-');
}

export function buildEnrichedItems(menuItems: MenuItem[], restaurants: Restaurant[]): EnrichedItem[] {
  const byId = new Map(restaurants.map((r) => [r.id, r] as const));
  const enriched: EnrichedItem[] = [];
  for (const item of menuItems) {
    // En mode VPS, `menuItems` et `restaurants` viennent tous deux du serveur
    // (mêmes UUID) ; en dev, tous deux du mock. Le repli mockRestaurants ne sert
    // qu'aux données locales. Un plat dont le restaurant est introuvable
    // (inexistant ou masqué car sans menu public) est EXCLU — pas de fiche
    // fantôme « Restaurant » menant à un profil vide.
    const resto = byId.get(item.restaurantId) ?? mockRestaurants.find((r) => r.id === item.restaurantId);
    if (!resto) continue;
    enriched.push({
      ...item,
      restaurantName: resto.name,
      restaurantRating: resto.rating ?? 0,
      restaurantCity: resto.city ?? '',
      restaurantNeighborhood: resto.neighborhood ?? '',
      restaurantDeliveryTime: resto.deliveryTime ?? '',
    });
  }
  return enriched;
}

export function groupDishes(items: EnrichedItem[]): DishGroup[] {
  const map = new Map<string, { catalogEntry?: DishCatalogEntry; items: EnrichedItem[] }>();
  for (const item of items) {
    const catalogEntry = findDishCatalogEntry(item);
    const key = catalogEntry ? normalizeDishName(catalogEntry.name) : normalizeDishName(item.name);
    if (!map.has(key)) map.set(key, { catalogEntry, items: [] });
    const group = map.get(key)!;
    if (!group.catalogEntry && catalogEntry) group.catalogEntry = catalogEntry;
    group.items.push(item);
  }

  return [...map.entries()].map(([key, group]) => {
    const groupItems = group.items;
    const prices = groupItems.map(i => i.price);
    const ratings = groupItems.map(i => i.restaurantRating);
    const allTags = [
      ...(group.catalogEntry?.tags ?? []),
      ...groupItems.flatMap(i => inferDietaryTags(i)),
    ].map(normalizeTag);
    const sortedForBest = [...groupItems].sort((a, b) => (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0));
    const bestItem = sortedForBest[0];
    const uniqueRestaurants = new Set(groupItems.map((item) => item.restaurantId));
    const bestImage = group.catalogEntry?.defaultImage
      ?? bestItem?.image
      ?? groupItems[0].image;

    return {
      key,
      displayName: group.catalogEntry?.name ?? groupItems[0].name,
      canonicalDishId: group.catalogEntry?.id,
      items: [...groupItems].sort((a, b) => a.price - b.price),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      totalRestaurants: uniqueRestaurants.size,
      avgRating: ratings.reduce((s, r) => s + r, 0) / ratings.length,
      tags: [...new Set(allTags)],
      bestImage,
    };
  });
}
