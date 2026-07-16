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
    hours: row.hours as string,
    isOpen: row.is_open as boolean,
    tags: (row.tags as string[]) ?? [],
    isPremium: row.is_premium as boolean,
    description: row.description as string,
    commissionRate: row.commission_rate != null ? Number(row.commission_rate) : undefined,
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
  if (!isSupabaseConfigured || !supabase) return enrichRestaurantsWithReviewSummaries(applyOverrides(mockRestaurants));

  const { data, error } = await supabase.from('restaurants').select('*');
  if (error || !data || data.length === 0) return enrichRestaurantsWithReviewSummaries(applyOverrides(mockRestaurants));
  return enrichRestaurantsWithReviewSummaries(data.map(mapRestaurant));
}

export async function fetchRestaurant(id: string): Promise<Restaurant | undefined> {
  if (!isSupabaseConfigured || !supabase) {
    const found = mockRestaurants.find((r) => r.id === id);
    return found ? (await enrichRestaurantsWithReviewSummaries(applyOverrides([found])))[0] : undefined;
  }

  const { data, error } = await supabase.from('restaurants').select('*').eq('id', id).maybeSingle();
  if (error || !data) {
    const found = mockRestaurants.find((r) => r.id === id);
    return found ? (await enrichRestaurantsWithReviewSummaries(applyOverrides([found])))[0] : undefined;
  }
  return (await enrichRestaurantsWithReviewSummaries([mapRestaurant(data)]))[0];
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
  return (await enrichRestaurantsWithReviewSummaries([mapRestaurant(data)]))[0];
}

export async function fetchRestaurantsByOwner(ownerId: string): Promise<Restaurant[]> {
  if (!isSupabaseConfigured || !supabase) {
    return enrichRestaurantsWithReviewSummaries(applyOverrides(mockRestaurants.slice(0, 1)));
  }

  const { data, error } = await supabase.from('restaurants').select('*').eq('owner_id', ownerId);
  if (error || !data) return [];
  return enrichRestaurantsWithReviewSummaries(data.map(mapRestaurant));
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
    const updateData: any = { ...data };
    if (data.deliveryTime !== undefined) updateData.delivery_time = data.deliveryTime;
    if (data.deliveryFee !== undefined) updateData.delivery_fee = data.deliveryFee;
    if (data.minOrder !== undefined) updateData.min_order = data.minOrder;
    if (data.priceRange !== undefined) updateData.price_range = data.priceRange;
    if (data.isOpen !== undefined) updateData.is_open = data.isOpen;
    if (data.isPremium !== undefined) updateData.is_premium = data.isPremium;
    if (data.reviewCount !== undefined) updateData.review_count = data.reviewCount;
    delete updateData.deliveryTime;
    delete updateData.deliveryFee;
    delete updateData.minOrder;
    delete updateData.priceRange;
    delete updateData.isOpen;
    delete updateData.isPremium;
    delete updateData.reviewCount;

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

  if (!isSupabaseConfigured || !supabase || isMockId) {
    const deleted = new Set(readDeletedMenuItemIds());
    const base = mockMenuItems.filter((m) => m.restaurantId === restaurantId);
    const added = readAddedMenuItems()[restaurantId] ?? [];
    const updated = readUpdatedMenuItems();
    return [...base, ...added]
      .filter((m) => !deleted.has(m.id))
      .map(m => updated[m.id] ? { ...m, ...updated[m.id] } : m)
      .filter((m) => options.includeUnavailable || m.isAvailable !== false);
  }

  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId);
  const visibleData = options.includeUnavailable ? data : data?.filter((row) => row.is_available !== false);
  if (error || !visibleData || visibleData.length === 0) {
    const deleted = new Set(readDeletedMenuItemIds());
    const base = mockMenuItems.filter((m) => m.restaurantId === restaurantId);
    const added = readAddedMenuItems()[restaurantId] ?? [];
    const updated = readUpdatedMenuItems();
    return [...base, ...added]
      .filter((m) => !deleted.has(m.id))
      .map(m => updated[m.id] ? { ...m, ...updated[m.id] } : m)
      .filter((m) => options.includeUnavailable || m.isAvailable !== false);
  }
  return visibleData.map(mapMenuItem);
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
    const updateData: any = { ...data };
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