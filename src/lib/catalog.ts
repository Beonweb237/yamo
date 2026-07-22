import { supabase, isSupabaseConfigured, isSupabaseAuthenticated } from './supabase';
import { trashItem } from './trash';
import {
  restaurants as mockRestaurants,
  menuItems as mockMenuItems,
  getMealCategoryImage,
  type Restaurant,
  type MenuItem,
} from '../data/mockData';
import {
  enrichRestaurantsWithReviewSummaries,
  fetchRestaurantReviews as fetchUnifiedRestaurantReviews,
  hasOrderReview,
  submitOrderReview,
  type Review,
} from './reviews';

// Maps a Supabase `restaurants` row (snake_case) to the app's Restaurant type.
import { parseCityFromAddress, parseNeighborhoodFromAddress } from '../data/locations';

function mapRestaurant(row: Record<string, unknown>): Restaurant {
  const address = row.address as string;
  const city = (row.city as string) || parseCityFromAddress(address);
  const neighborhood = (row.neighborhood as string) || parseNeighborhoodFromAddress(address, city);
  return {
    id: row.id as string,
    ownerId: (row.owner_id as string) ?? undefined,
    name: row.name as string,
    image: (row.image as string) || getMealCategoryImage(row.category as string),
    category: row.category as string,
    city,
    neighborhood,
    rating: Number(row.rating),
    reviewCount: row.review_count as number,
    deliveryTime: row.delivery_time as string,
    deliveryFee: row.delivery_fee as number,
    minOrder: row.min_order as number,
    priceRange: row.price_range as string,
    address,
    phone: row.phone as string,
    email: (row.email as string) ?? undefined,
    hours: row.hours as string,
    isOpen: row.is_open as boolean,
    tags: (row.tags as string[]) ?? [],
    isPremium: row.is_premium as boolean,
    description: row.description as string,
    commissionRate: row.commission_rate != null ? Number(row.commission_rate) : undefined,
    lat: row.lat != null ? Number(row.lat) : undefined,
    lng: row.lng != null ? Number(row.lng) : undefined,
    deliveryRadiusKm: row.delivery_radius_km != null ? Number(row.delivery_radius_km) : undefined,
  };
}

function mapMenuItem(row: Record<string, unknown>): MenuItem {
  const rawImage = row.image as string | null | undefined;
  return {
    id: row.id as string,
    restaurantId: row.restaurant_id as string,
    name: row.name as string,
    description: row.description as string,
    price: row.price as number,
    category: row.category as string,
    image: rawImage || getMealCategoryImage(row.category as string),
    isPopular: row.is_popular as boolean,
    isAvailable: row.is_available !== false,
    hasImage: Boolean(rawImage),
    dietaryTags: (row.dietary_tags as string[]) ?? undefined,
    catalogDishId: (row.catalog_dish_id as string) ?? undefined,
  };
}

const FEATURED_IMAGE_POOL = [
  '/resto-ndole.jpg',
  '/resto-pouletdg.jpg',
  '/resto-grill.jpg',
  '/resto-boulangerie.jpg',
  '/resto-seafood.jpg',
  '/menu-boukarou-boeuf.jpg',
  '/menu-suya-boeuf.jpg',
  '/menu-suya-poulet.jpg',
  '/menu-brochettes-boeuf.jpg',
  '/menu-poulet-braise.jpg',
  '/menu-poulet-dg-family.jpg',
  '/menu-eru.jpg',
  '/menu-koki.jpg',
  '/plat-rizpoisson.jpg',
  '/menu-poisson-braise.jpg',
  '/menu-crevettes-grillees.jpg',
  '/menu-homard-thermidor.jpg',
  '/menu-risotto-crevettes.jpg',
  '/menu-pizza-margherita.jpg',
  '/menu-pizza-royale.jpg',
  '/menu-pizza-suya.jpg',
  '/menu-pizza-poulet-dg.jpg',
  '/menu-pizza-mont-cameroun.jpg',
  '/menu-burger-mboa.jpg',
  '/menu-shawarma-poulet.jpg',
  '/drink-passion.jpg',
  '/drink-goyave.jpg',
  '/drink-smoothie-ananas-gingembre.jpg',
  '/drink-smoothie-baobab.jpg',
  '/menu-croissant.jpg',
  '/menu-omelette-complete.jpg',
  '/menu-bouillie-beignets.jpg',
  '/menu-gateau-chocolat.jpg',
  '/menu-mille-feuille.jpg',
] as const;

const KNOWN_CATALOG_IMAGE_KEYS = new Set([
  ...FEATURED_IMAGE_POOL,
  '/cat-boissons.jpg',
  '/cat-camerounaise.jpg',
  '/cat-fastfood.jpg',
  '/cat-fruitsmer.jpg',
  '/cat-grillades.jpg',
  '/cat-patisseries.jpg',
  '/cat-petitdej.jpg',
  '/cat-pizza.jpg',
  '/plat-brochettes.jpg',
  '/plat-ndole.jpg',
  '/plat-pouletdg.jpg',
  '/plat-rizpoisson.jpg',
].map((image) => image.toLowerCase()));
function normalizeSearchText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function imageKey(image?: string | null): string {
  if (!image) return '';
  const clean = image.split('?')[0].split('#')[0].trim();
  try {
    return new URL(clean).pathname.toLowerCase();
  } catch {
    return clean.toLowerCase();
  }
}
function imageCandidatesForRestaurant(restaurant: Pick<Restaurant, 'name' | 'category' | 'tags'>): string[] {
  const text = normalizeSearchText(`${restaurant.name} ${restaurant.category} ${restaurant.tags.join(' ')}`);

  if (/pizza/.test(text)) return ['/menu-pizza-margherita.jpg', '/menu-pizza-royale.jpg', '/menu-pizza-suya.jpg', '/menu-pizza-poulet-dg.jpg', '/menu-pizza-mont-cameroun.jpg'];
  if (/boisson|juice|jus|smoothie|vitamin|fresh/.test(text)) return ['/drink-passion.jpg', '/drink-goyave.jpg', '/drink-smoothie-mangue-banane.jpg', '/drink-smoothie-ananas-gingembre.jpg', '/drink-smoothie-baobab.jpg'];
  if (/petit|brunch|morning|matin|omelette/.test(text)) return ['/menu-omelette-complete.jpg', '/menu-bouillie-beignets.jpg', '/menu-croissant.jpg', '/menu-pancakes.jpg'];
  if (/patisserie|boulangerie|cafe|delice|gateau/.test(text)) return ['/resto-boulangerie.jpg', '/menu-mille-feuille.jpg', '/menu-gateau-chocolat.jpg', '/menu-cupcake-passion.jpg'];
  if (/mer|seafood|poisson|crevette|homard|kribi|wouri/.test(text)) return ['/resto-seafood.jpg', '/menu-crevettes-grillees.jpg', '/menu-homard-thermidor.jpg', '/menu-risotto-crevettes.jpg', '/menu-poisson-braise.jpg'];
  if (/grill|braise|suya|boukarou|brochette|bucheron/.test(text)) return ['/resto-grill.jpg', '/menu-boukarou-boeuf.jpg', '/menu-suya-boeuf.jpg', '/menu-brochettes-boeuf.jpg', '/menu-poulet-braise.jpg'];
  if (/fast|burger|snack|shawarma/.test(text)) return ['/menu-burger-mboa.jpg', '/menu-burger-classic.jpg', '/menu-shawarma-poulet.jpg', '/cat-fastfood.jpg'];
  if (/poulet|dg/.test(text)) return ['/resto-pouletdg.jpg', '/plat-pouletdg.jpg', '/menu-poulet-dg-family.jpg'];

  return ['/resto-ndole.jpg', '/menu-eru.jpg', '/menu-koki.jpg', '/plat-rizpoisson.jpg'];
}

function shouldKeepFeaturedImage(current: string, candidates: string[], used: Set<string>): boolean {
  const currentKey = imageKey(current);
  if (!currentKey || used.has(currentKey)) return false;
  if (candidates.some((candidate) => imageKey(candidate) === currentKey)) return true;
  if (!KNOWN_CATALOG_IMAGE_KEYS.has(currentKey)) return true;
  return false;
}
function dedupeRestaurantImages(list: Restaurant[]): Restaurant[] {
  const used = new Set<string>();

  return list.map((restaurant, index) => {
    const current = restaurant.image || getMealCategoryImage(restaurant.category);
    const candidates = [...imageCandidatesForRestaurant(restaurant), ...FEATURED_IMAGE_POOL];

    if (current && shouldKeepFeaturedImage(current, candidates, used)) {
      used.add(imageKey(current));
      return current === restaurant.image ? restaurant : { ...restaurant, image: current };
    }

    const replacement = candidates.find((image) => !used.has(imageKey(image))) ?? candidates[index % candidates.length] ?? current;
    used.add(imageKey(replacement));
    return { ...restaurant, image: replacement };
  });
}
// Every function below transparently falls back to mockData when
// Supabase isn't configured, so the app works out of the box in dev.

// Dev mode has no writable restaurants table, so admin actions (e.g. toggling
// "ouvert/fermé") are kept as local overrides layered on top of mockData.
const LOCAL_OVERRIDES_KEY = 'yamo_restaurant_overrides';

type RestaurantOverrides = Record<string, Partial<Restaurant>>;

function readOverrides(): RestaurantOverrides {
  const raw = localStorage.getItem(LOCAL_OVERRIDES_KEY);
  return raw ? JSON.parse(raw) : {};
}

function applyOverrides(list: Restaurant[]): Restaurant[] {
  const overrides = readOverrides();
  return list.map((r) => (overrides[r.id] ? { ...r, ...overrides[r.id] } : r));
}

export async function fetchRestaurants(): Promise<Restaurant[]> {
  if (!isSupabaseConfigured || !supabase) return enrichRestaurantsWithReviewSummaries(dedupeRestaurantImages(applyOverrides(mockRestaurants)));

  const { data, error } = await supabase.from('restaurants').select('*');
  if (error || !data || data.length === 0) return [];
  return enrichRestaurantsWithReviewSummaries(dedupeRestaurantImages(data.map(mapRestaurant)));
}

export async function fetchRestaurant(id: string): Promise<Restaurant | undefined> {
  if (!isSupabaseConfigured || !supabase) {
    const found = mockRestaurants.find((r) => r.id === id);
    return found ? (await enrichRestaurantsWithReviewSummaries(dedupeRestaurantImages(applyOverrides([found]))))[0] : undefined;
  }

  const { data, error } = await supabase.from('restaurants').select('*').eq('id', id).maybeSingle();
  if (error || !data) return undefined;
  return (await enrichRestaurantsWithReviewSummaries(dedupeRestaurantImages([mapRestaurant(data)])))[0];
}

export async function fetchRestaurantByOwner(ownerId: string): Promise<Restaurant | undefined> {
  if (!isSupabaseConfigured || !supabase) {
    // LOT-14 : sans applyOverrides, les modifications du profil (horaires,
    // temps de livraison…) disparaissaient du dashboard au rechargement.
    return (await enrichRestaurantsWithReviewSummaries(applyOverrides(mockRestaurants.slice(0, 1))))[0];
  }

  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error || !data) return undefined;
  return (await enrichRestaurantsWithReviewSummaries(dedupeRestaurantImages([mapRestaurant(data)])))[0];
}

export async function fetchRestaurantsByOwner(ownerId: string): Promise<Restaurant[]> {
  if (!isSupabaseConfigured || !supabase) {
    return enrichRestaurantsWithReviewSummaries(applyOverrides(mockRestaurants.slice(0, 1)));
  }

  const { data, error } = await supabase.from('restaurants').select('*').eq('owner_id', ownerId);
  if (error || !data) return [];
  return enrichRestaurantsWithReviewSummaries(dedupeRestaurantImages(data.map(mapRestaurant)));
}

export async function updateRestaurantOpenStatus(id: string, isOpen: boolean): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { error } = await supabase.from('restaurants').update({ is_open: isOpen }).eq('id', id);
    if (error) throw error;
    return;
  }

  const overrides = readOverrides();
  overrides[id] = { ...overrides[id], isOpen };
  localStorage.setItem(LOCAL_OVERRIDES_KEY, JSON.stringify(overrides));
}

export async function updateRestaurantProfile(id: string, data: Partial<Omit<Restaurant, 'id'>>): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const updateData: Record<string, unknown> = { ...data };
    if (data.deliveryTime !== undefined) updateData.delivery_time = data.deliveryTime;
    if (data.deliveryFee !== undefined) updateData.delivery_fee = data.deliveryFee;
    if (data.minOrder !== undefined) updateData.min_order = data.minOrder;
    if (data.priceRange !== undefined) updateData.price_range = data.priceRange;
    if (data.isOpen !== undefined) updateData.is_open = data.isOpen;
    if (data.isPremium !== undefined) updateData.is_premium = data.isPremium;
    if (data.reviewCount !== undefined) updateData.review_count = data.reviewCount;
    if (data.deliveryRadiusKm !== undefined) updateData.delivery_radius_km = data.deliveryRadiusKm;
    delete updateData.deliveryTime;
    delete updateData.deliveryFee;
    delete updateData.minOrder;
    delete updateData.priceRange;
    delete updateData.isOpen;
    delete updateData.isPremium;
    delete updateData.reviewCount;
    delete updateData.deliveryRadiusKm;

    const { error } = await supabase.from('restaurants').update(updateData).eq('id', id);
    if (error) throw error;
    return;
  }

  const overrides = readOverrides();
  overrides[id] = { ...overrides[id], ...data };
  localStorage.setItem(LOCAL_OVERRIDES_KEY, JSON.stringify(overrides));
}

// Dev mode has no writable menu_items table either: extra dishes added from the
// restaurant dashboard are layered on top of mockData, and deletions are tracked
// as a blocklist of ids (works for both mock ids and locally-added ids).
const LOCAL_MENU_ADDED_KEY = 'yamo_menu_added';
const LOCAL_MENU_DELETED_KEY = 'yamo_menu_deleted';
const LOCAL_MENU_UPDATED_KEY = 'yamo_menu_updated';

function readAddedMenuItems(): Record<string, MenuItem[]> {
  const raw = localStorage.getItem(LOCAL_MENU_ADDED_KEY);
  return raw ? JSON.parse(raw) : {};
}

function readDeletedMenuItemIds(): string[] {
  const raw = localStorage.getItem(LOCAL_MENU_DELETED_KEY);
  return raw ? JSON.parse(raw) : [];
}

function readUpdatedMenuItems(): Record<string, Partial<MenuItem>> {
  const raw = localStorage.getItem(LOCAL_MENU_UPDATED_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function fetchMenuItems(restaurantId: string, options: { includeUnavailable?: boolean } = {}): Promise<MenuItem[]> {
  // Mock IDs are short strings like '1', '2' — UUIDs are 36 chars with dashes.
  // If the ID is a mock ID, skip Supabase to avoid 400 errors (UUID type mismatch).
  const isMockId = !restaurantId.includes('-') || restaurantId.length < 30;

  if (!isSupabaseConfigured || !supabase) {
    const deleted = new Set(readDeletedMenuItemIds());
    const base = mockMenuItems.filter((m) => m.restaurantId === restaurantId);
    const added = readAddedMenuItems()[restaurantId] ?? [];
    const updated = readUpdatedMenuItems();
    return [...base, ...added]
      .filter((m) => !deleted.has(m.id))
      .map(m => updated[m.id] ? { ...m, ...updated[m.id] } : m)
      .filter((m) => options.includeUnavailable || m.isAvailable !== false);
  }
  if (isMockId) return [];

  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId);
  const visibleData = options.includeUnavailable ? data : data?.filter((row) => row.is_available !== false);
  if (error || !visibleData || visibleData.length === 0) return [];
  return visibleData.map(mapMenuItem);
}

/**
 * Tous les plats disponibles du catalogue (vue « plats », recherche globale,
 * favoris, fiche plat). En mode VPS, récupère les vrais menu_items — jusqu'ici
 * ces vues utilisaient toujours mockMenuItems, ce qui affichait des plats
 * fictifs rattachés à des restaurants inexistants (profil vide, blocage
 * "démo" au checkout). En mode mock (dev), renvoie le catalogue local.
 */
export async function fetchAllMenuItems(): Promise<MenuItem[]> {
  if (!isSupabaseConfigured || !supabase) return mockMenuItems;
  const { data, error } = await supabase.from('menu_items').select('*').limit(2000);
  if (error || !data) return [];
  return data.filter((row) => row.is_available !== false).map(mapMenuItem);
}

export interface MenuItemInput {
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  isPopular?: boolean;
  isAvailable?: boolean;
  dietaryTags?: string[];
  catalogDishId?: string;
  /** Variantes (taille/portion) — price = surcoût par rapport au prix de base (CONF-14). */
  variants?: { name: string; price: number }[];
  /** Suppléments payants proposés avec le plat (CONF-14). */
  supplements?: { name: string; price: number }[];
}

export async function updateMenuItem(id: string, data: Partial<MenuItemInput>): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const updateData: Record<string, unknown> = { ...data };
    if (data.isPopular !== undefined) updateData.is_popular = data.isPopular;
    if (data.isAvailable !== undefined) updateData.is_available = data.isAvailable;
    if (data.dietaryTags !== undefined) updateData.dietary_tags = data.dietaryTags;
    if (data.catalogDishId !== undefined) updateData.catalog_dish_id = data.catalogDishId;
    if (data.restaurantId !== undefined) updateData.restaurant_id = data.restaurantId;
    delete updateData.isPopular;
    delete updateData.isAvailable;
    delete updateData.dietaryTags;
    delete updateData.catalogDishId;
    delete updateData.restaurantId;
    const { error } = await supabase.from('menu_items').update(updateData).eq('id', id);
    if (error) throw error;
    return;
  }

  const updated = readUpdatedMenuItems();
  updated[id] = { ...updated[id], ...data };
  localStorage.setItem(LOCAL_MENU_UPDATED_KEY, JSON.stringify(updated));
}

export async function createMenuItem(input: MenuItemInput): Promise<MenuItem> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        restaurant_id: input.restaurantId,
        name: input.name,
        description: input.description,
        price: input.price,
        category: input.category,
        image: input.image ?? getMealCategoryImage(input.category),
        is_popular: input.isPopular ?? false,
        is_available: input.isAvailable ?? true,
        dietary_tags: input.dietaryTags ?? null,
        catalog_dish_id: input.catalogDishId ?? null,
      })
      .select()
      .single();
    if (error || !data) throw error ?? new Error('Menu item creation failed');
    return mapMenuItem(data);
  }

  const item: MenuItem = {
    id: crypto.randomUUID(),
    restaurantId: input.restaurantId,
    name: input.name,
    description: input.description,
    price: input.price,
    category: input.category,
    image: input.image ?? getMealCategoryImage(input.category),
    isPopular: input.isPopular ?? false,
    isAvailable: input.isAvailable ?? true,
    hasImage: Boolean(input.image),
    dietaryTags: input.dietaryTags,
    catalogDishId: input.catalogDishId,
    variants: input.variants,
    supplements: input.supplements,
  };
  const added = readAddedMenuItems();
  added[input.restaurantId] = [...(added[input.restaurantId] ?? []), item];
  localStorage.setItem(LOCAL_MENU_ADDED_KEY, JSON.stringify(added));
  return item;
}

export async function deleteMenuItem(id: string): Promise<void> {
  // Sauvegarde dans la corbeille avant suppression (7 jours de rétention)
  const item = mockMenuItems.find((mi) => mi.id === id);
  if (item) trashItem(id, 'menu_item', item);

  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) throw error;
    return;
  }

  const deleted = new Set(readDeletedMenuItemIds());
  deleted.add(id);
  localStorage.setItem(LOCAL_MENU_DELETED_KEY, JSON.stringify([...deleted]));
}

// ─────────────────────────────────────────────────────────────
// Restaurant reviews (client rates restaurant after delivery)
// -----------------------------------------------------------------------------
// Compatibility wrappers: the unified review engine lives in reviews.ts and is
// VPS-first (/api/reviews) with a localStorage fallback only when VPS mode is off.

export type RestaurantReview = Review;

export async function rateRestaurant(
  orderId: string,
  restaurantId: string,
  customerId: string,
  rating: number,
  comment?: string,
  authorName?: string
): Promise<RestaurantReview> {
  return submitOrderReview(orderId, {
    targetType: 'restaurant',
    targetId: restaurantId,
    rating,
    comment,
    authorName,
  }, customerId);
}

export async function fetchRestaurantReviews(restaurantId: string): Promise<RestaurantReview[]> {
  return fetchUnifiedRestaurantReviews(restaurantId);
}

export async function hasRestaurantReview(orderId: string): Promise<boolean> {
  return hasOrderReview(orderId, 'restaurant');
}