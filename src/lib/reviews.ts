import { authHeaders } from './authToken';
import { fetchAllOrders, type Order } from './orders';
import type { Restaurant } from '../data/mockData';

export type ReviewTargetType = 'restaurant' | 'driver' | 'dish';
export type ReviewStatus = 'published' | 'pending' | 'hidden';

// Réponse officielle du restaurant à un avis : une seule par avis, éditable,
// modérable indépendamment de l'avis (jamais de fil de discussion).
export interface OwnerReply {
  text: string;
  createdAt: string;
  updatedAt?: string | null;
  status: 'published' | 'hidden';
  moderationReason?: string | null;
}

// Signalement d'un avis par le restaurant (« demander une modération ») :
// un seul signalement actif par avis, traité par l'admin — soit en modérant
// l'avis (masquer/publier le clôt automatiquement), soit en le classant
// sans action.
export interface OwnerReport {
  reason: string;
  createdAt: string;
  status: 'open' | 'resolved';
}

export interface Review {
  id: string;
  orderId: string;
  customerId: string;
  targetType: ReviewTargetType;
  targetId: string;
  restaurantId: string;
  driverId?: string | null;
  dishId?: string | null;
  rating: number;
  comment?: string;
  tags: string[];
  authorName?: string | null;
  isVerifiedOrder: boolean;
  isTest: boolean;
  status: ReviewStatus;
  moderationReason?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  ownerReply?: OwnerReply | null;
  ownerReport?: OwnerReport | null;
}

export interface ReviewSummary {
  targetType: ReviewTargetType;
  targetId: string;
  ratingAvg: number;
  ratingWeighted: number;
  reviewCount: number;
  publishedCount: number;
  verifiedCount: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  updatedAt?: string | null;
}

export interface ReviewEligibility {
  orderId: string;
  canReviewRestaurant: boolean;
  canReviewDriver: boolean;
  canReviewDishes: boolean;
  reasons: string[];
  existingReviews: Review[];
}

export interface SubmitOrderReviewInput {
  targetType: ReviewTargetType;
  targetId?: string;
  dishId?: string;
  rating: number;
  comment?: string;
  tags?: string[];
  authorName?: string | null;
}

export interface RestaurantRatingFields {
  ratingWeighted?: number;
  ratingBreakdown?: ReviewSummary['breakdown'];
  verifiedReviewCount?: number;
  dynamicReviewCount?: number;
}

const USE_VPS_REVIEWS = import.meta.env.VITE_USE_VPS_API === 'true';
const API_BASE: string = import.meta.env.VITE_API_URL || '';

const LOCAL_REVIEWS_KEY = 'yamo_reviews_v1';
const LEGACY_RESTAURANT_REVIEWS_KEY = 'yamo_restaurant_reviews';
const LEGACY_DELIVERY_RATINGS_KEY = 'yamo_local_delivery_ratings';

const PRIOR_AVERAGE = 4.2;
const PRIOR_WEIGHT = 8;
const MAX_COMMENT_LENGTH = 500;
const MAX_TAGS = 6;
const MAX_TAG_LENGTH = 40;

const ALLOW_DEV_REVIEW_FALLBACK = !USE_VPS_REVIEWS && (import.meta.env.DEV || import.meta.env.VITE_FORCE_MOCK_AUTH === 'true' || import.meta.env.VITE_ENABLE_DEMO_DATA === 'true');
const LOCAL_DEMO_REVIEWS: Review[] = [
  {
    id: 'local-demo-review-chez-mama-1',
    orderId: 'local-demo-delivered-order-1',
    customerId: 'local-demo-customer-1',
    targetType: 'restaurant',
    targetId: '1',
    restaurantId: '1',
    driverId: null,
    dishId: null,
    rating: 5,
    comment: 'Commande livrée chaude, portions généreuses et emballage très soigné. Expérience premium du début à la fin.',
    tags: ['plats chauds', 'emballage soigné', 'rapide'],
    authorName: null,
    isVerifiedOrder: true,
    isTest: true,
    status: 'published',
    moderationReason: null,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: null,
  },
  {
    id: 'local-demo-review-chez-mama-2',
    orderId: 'local-demo-delivered-order-2',
    customerId: 'local-demo-customer-2',
    targetType: 'restaurant',
    targetId: '1',
    restaurantId: '1',
    driverId: null,
    dishId: null,
    rating: 5,
    comment: 'Le restaurant a respecté les indications et la qualité était constante. Je recommande sans hésitation.',
    tags: ['qualité constante', 'instructions respectées', 'savoureux'],
    authorName: null,
    isVerifiedOrder: true,
    isTest: true,
    status: 'published',
    moderationReason: null,
    createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
    updatedAt: null,
  },
  {
    id: 'local-demo-review-poulet-dg-1',
    orderId: 'local-demo-delivered-order-3',
    customerId: 'local-demo-customer-3',
    targetType: 'restaurant',
    targetId: '2',
    restaurantId: '2',
    driverId: null,
    dishId: null,
    rating: 4,
    comment: "Très bonne commande, livraison propre et service fluide. Une petite marge sur le délai, mais l'ensemble reste excellent.",
    tags: ['service fluide', 'bon goût', 'fiable'],
    authorName: null,
    isVerifiedOrder: true,
    isTest: true,
    status: 'published',
    moderationReason: null,
    createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    updatedAt: null,
  },
  {
    id: 'local-demo-review-bucheron-1',
    orderId: 'local-demo-delivered-order-4',
    customerId: 'local-demo-customer-4',
    targetType: 'restaurant',
    targetId: '3',
    restaurantId: '3',
    driverId: null,
    dishId: null,
    rating: 5,
    comment: "Présentation impeccable, plat bien assaisonné et suivi de commande rassurant. C'est exactement le niveau attendu.",
    tags: ['présentation', 'bien assaisonné', 'suivi clair'],
    authorName: null,
    isVerifiedOrder: true,
    isTest: true,
    status: 'published',
    moderationReason: null,
    createdAt: new Date(Date.now() - 27 * 60 * 60 * 1000).toISOString(),
    updatedAt: null,
  },
  {
    id: 'local-demo-review-seafood-1',
    orderId: 'local-demo-delivered-order-5',
    customerId: 'local-demo-customer-5',
    targetType: 'restaurant',
    targetId: '5',
    restaurantId: '5',
    driverId: null,
    dishId: null,
    rating: 4,
    comment: 'Bon rapport qualite prix et repas arrive dans un tres bon etat. Je commanderai encore chez ce restaurant.',
    tags: ['bon rapport qualite prix', 'repas intact', 'recommande'],
    authorName: null,
    isVerifiedOrder: true,
    isTest: true,
    status: 'published',
    moderationReason: null,
    createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    updatedAt: null,
  },
];
type ReviewApiRow = Partial<Review> & {
  order_id?: string;
  customer_id?: string;
  target_type?: ReviewTargetType;
  target_id?: string;
  restaurant_id?: string;
  driver_id?: string | null;
  dish_id?: string | null;
  author_name?: string | null;
  is_verified_order?: boolean;
  is_test?: boolean;
  moderation_reason?: string | null;
  created_at?: string;
  updated_at?: string | null;
  owner_reply?: unknown;
  owner_report?: unknown;
};

type OwnerReplyApiRow = {
  text?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string | null;
  updated_at?: string | null;
  status?: string;
  moderationReason?: string | null;
  moderation_reason?: string | null;
};

type ReviewSummaryApiRow = Partial<ReviewSummary> & {
  target_type?: ReviewTargetType;
  target_id?: string;
  rating_avg?: number;
  rating_weighted?: number;
  review_count?: number;
  published_count?: number;
  verified_count?: number;
  updated_at?: string | null;
};

type EligibilityApiPayload = {
  canReviewRestaurant?: boolean;
  canReviewDriver?: boolean;
  canReviewDishes?: boolean;
  reasons?: string[];
  existingReviews?: unknown[];
};

type LegacyRestaurantReviewRow = {
  id: string;
  orderId: string;
  restaurantId: string;
  customerId: string;
  rating: number;
  comment?: string;
  authorName?: string | null;
  createdAt: string;
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `review-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampRating(value: number): number {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) throw new Error('Note invalide.');
  if (rounded < 1 || rounded > 5) throw new Error('La note doit etre comprise entre 1 et 5.');
  return rounded;
}

function cleanComment(comment?: string): string | undefined {
  const clean = comment?.trim();
  if (!clean) return undefined;
  return clean.slice(0, MAX_COMMENT_LENGTH);
}

function cleanTags(tags?: string[]): string[] {
  if (!tags?.length) return [];
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]
    .slice(0, MAX_TAGS)
    .map((tag) => tag.slice(0, MAX_TAG_LENGTH));
}

function defaultAuthorName(authorName?: string | null): string | null {
  const explicit = authorName?.trim();
  if (explicit) return explicit;
  if (!storageAvailable()) return null;
  const raw = (localStorage.getItem('yamo_profile_name') ?? '').trim();
  if (!raw) return null;
  const parts = raw.split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1][0].toUpperCase()}.` : parts[0];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeStatus(value: unknown): ReviewStatus {
  return value === 'pending' || value === 'hidden' || value === 'published' ? value : 'published';
}

function normalizeOwnerReply(row: unknown): OwnerReply | null {
  if (!row || typeof row !== 'object') return null;
  const reply = row as OwnerReplyApiRow;
  const text = String(reply.text ?? '').trim();
  if (!text) return null;
  return {
    text: text.slice(0, MAX_COMMENT_LENGTH),
    createdAt: String(reply.createdAt ?? reply.created_at ?? new Date().toISOString()),
    updatedAt: (reply.updatedAt ?? reply.updated_at ?? null) as string | null,
    status: reply.status === 'hidden' ? 'hidden' : 'published',
    moderationReason: (reply.moderationReason ?? reply.moderation_reason ?? null) as string | null,
  };
}

function normalizeOwnerReport(row: unknown): OwnerReport | null {
  if (!row || typeof row !== 'object') return null;
  const report = row as { reason?: string; createdAt?: string; created_at?: string; status?: string };
  const reason = String(report.reason ?? '').trim();
  if (!reason) return null;
  return {
    reason: reason.slice(0, MAX_COMMENT_LENGTH),
    createdAt: String(report.createdAt ?? report.created_at ?? new Date().toISOString()),
    status: report.status === 'resolved' ? 'resolved' : 'open',
  };
}

function normalizeReview(row: ReviewApiRow): Review {
  return {
    id: String(row.id),
    orderId: String(row.orderId ?? row.order_id),
    customerId: String(row.customerId ?? row.customer_id),
    targetType: (row.targetType ?? row.target_type) as ReviewTargetType,
    targetId: String(row.targetId ?? row.target_id),
    restaurantId: String(row.restaurantId ?? row.restaurant_id),
    driverId: (row.driverId ?? row.driver_id ?? null) as string | null,
    dishId: (row.dishId ?? row.dish_id ?? null) as string | null,
    rating: clampRating(Number(row.rating)),
    comment: cleanComment(row.comment),
    tags: cleanTags(row.tags ?? []),
    authorName: (row.authorName ?? row.author_name ?? null) as string | null,
    isVerifiedOrder: Boolean(row.isVerifiedOrder ?? row.is_verified_order ?? true),
    isTest: Boolean(row.isTest ?? row.is_test ?? false),
    status: normalizeStatus(row.status),
    moderationReason: (row.moderationReason ?? row.moderation_reason ?? null) as string | null,
    createdAt: String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
    updatedAt: (row.updatedAt ?? row.updated_at ?? null) as string | null,
    ownerReply: normalizeOwnerReply(row.ownerReply ?? row.owner_reply),
    ownerReport: normalizeOwnerReport(row.ownerReport ?? row.owner_report),
  };
}

function normalizeReviewList(payload: unknown): Review[] {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { reviews?: unknown[] })?.reviews)
      ? (payload as { reviews: unknown[] }).reviews
      : Array.isArray((payload as { data?: unknown[] })?.data)
        ? (payload as { data: unknown[] }).data
        : [];
  return source.map(normalizeReview);
}

function normalizeSummary(row: ReviewSummaryApiRow | null | undefined, targetType: ReviewTargetType, targetId: string): ReviewSummary {
  const breakdown = row?.breakdown ?? {};
  return {
    targetType: (row?.targetType ?? row?.target_type ?? targetType) as ReviewTargetType,
    targetId: String(row?.targetId ?? row?.target_id ?? targetId),
    ratingAvg: round1(Number(row?.ratingAvg ?? row?.rating_avg ?? 0)),
    ratingWeighted: round1(Number(row?.ratingWeighted ?? row?.rating_weighted ?? 0)),
    reviewCount: Number(row?.reviewCount ?? row?.review_count ?? 0),
    publishedCount: Number(row?.publishedCount ?? row?.published_count ?? row?.reviewCount ?? row?.review_count ?? 0),
    verifiedCount: Number(row?.verifiedCount ?? row?.verified_count ?? 0),
    breakdown: {
      1: Number(breakdown[1] ?? breakdown['1'] ?? 0),
      2: Number(breakdown[2] ?? breakdown['2'] ?? 0),
      3: Number(breakdown[3] ?? breakdown['3'] ?? 0),
      4: Number(breakdown[4] ?? breakdown['4'] ?? 0),
      5: Number(breakdown[5] ?? breakdown['5'] ?? 0),
    },
    updatedAt: (row?.updatedAt ?? row?.updated_at ?? null) as string | null,
  };
}

function getPayloadData(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
      ...((init.headers as Record<string, string>) || {}),
    },
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`API avis indisponible (HTTP ${res.status}).`);
  }
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `API avis indisponible (HTTP ${res.status}).`);
  }
  return data as T;
}

function readStoredReviews(): Review[] {
  if (!storageAvailable()) return [];
  return safeParse<Review[]>(localStorage.getItem(LOCAL_REVIEWS_KEY), []).map(normalizeReview);
}

function readLegacyRestaurantReviews(): Review[] {
  if (!storageAvailable()) return [];
  const legacy = safeParse<LegacyRestaurantReviewRow[]>(localStorage.getItem(LEGACY_RESTAURANT_REVIEWS_KEY), []);
  return legacy.map((row) => normalizeReview({
    id: row.id,
    orderId: row.orderId,
    customerId: row.customerId,
    targetType: 'restaurant',
    targetId: row.restaurantId,
    restaurantId: row.restaurantId,
    rating: row.rating,
    comment: row.comment,
    authorName: row.authorName ?? null,
    tags: [],
    isVerifiedOrder: true,
    isTest: true,
    status: 'published',
    createdAt: row.createdAt,
  }));
}

function readLegacyDeliveryReviews(): Review[] {
  if (!storageAvailable()) return [];
  const legacy = safeParse<Record<string, { rating: number; comment?: string }>>(
    localStorage.getItem(LEGACY_DELIVERY_RATINGS_KEY),
    {}
  );
  return Object.entries(legacy).map(([orderId, row]) => normalizeReview({
    id: `legacy-driver-${orderId}`,
    orderId,
    customerId: 'legacy',
    targetType: 'driver',
    targetId: `delivery-${orderId}`,
    restaurantId: 'legacy',
    rating: row.rating,
    comment: row.comment,
    tags: [],
    isVerifiedOrder: true,
    isTest: true,
    status: 'published',
    createdAt: new Date(0).toISOString(),
  }));
}

function readLocalReviews(): Review[] {
  const merged = new Map<string, Review>();
  // Les avis démo sont réservés au dev : en build de production sans VPS,
  // aucun faux avis ne doit passer pour un avis réel.
  const demoReviews = ALLOW_DEV_REVIEW_FALLBACK ? LOCAL_DEMO_REVIEWS : [];
  for (const review of [...demoReviews, ...readLegacyRestaurantReviews(), ...readLegacyDeliveryReviews(), ...readStoredReviews()]) {
    const key = `${review.orderId}:${review.targetType}:${review.targetId}:${review.dishId ?? ''}`;
    merged.set(key, review);
  }
  return [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function writeLocalReviews(reviews: Review[]) {
  if (!storageAvailable()) return;
  localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(reviews));
}

function syncLegacyRestaurantReview(review: Review) {
  if (!storageAvailable() || review.targetType !== 'restaurant') return;
  const legacy = safeParse<LegacyRestaurantReviewRow[]>(localStorage.getItem(LEGACY_RESTAURANT_REVIEWS_KEY), []);
  const next = [
    {
      id: review.id,
      orderId: review.orderId,
      restaurantId: review.restaurantId,
      customerId: review.customerId,
      rating: review.rating,
      comment: review.comment,
      authorName: review.authorName,
      createdAt: review.createdAt,
    },
    ...legacy.filter((item) => item.orderId !== review.orderId),
  ];
  localStorage.setItem(LEGACY_RESTAURANT_REVIEWS_KEY, JSON.stringify(next));
}

function syncLegacyDriverReview(review: Review) {
  if (!storageAvailable() || review.targetType !== 'driver') return;
  const legacy = safeParse<Record<string, { rating: number; comment?: string }>>(
    localStorage.getItem(LEGACY_DELIVERY_RATINGS_KEY),
    {}
  );
  legacy[review.orderId] = { rating: review.rating, comment: review.comment ?? '' };
  localStorage.setItem(LEGACY_DELIVERY_RATINGS_KEY, JSON.stringify(legacy));
}

async function getDeliveredOrder(orderId: string, customerId?: string): Promise<Order> {
  const orders = await fetchAllOrders();
  const order = orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Commande introuvable.');
  if (customerId && order.customerId !== customerId) {
    throw new Error('Vous ne pouvez noter que vos propres commandes.');
  }
  if (order.status !== 'delivered') {
    throw new Error('Seules les commandes livrées peuvent être notées.');
  }
  return order;
}

function buildTarget(order: Order, input: SubmitOrderReviewInput): { targetId: string; dishId?: string | null } {
  if (input.targetType === 'restaurant') return { targetId: input.targetId || order.restaurantId };
  if (input.targetType === 'driver') return { targetId: input.targetId || order.driverId || `delivery-${order.id}` };
  const dishId = input.dishId || input.targetId;
  if (!dishId) throw new Error('Plat a noter manquant.');
  return { targetId: dishId, dishId };
}

function makeLocalReview(order: Order, input: SubmitOrderReviewInput, customerId?: string): Review {
  const target = buildTarget(order, input);
  const now = new Date().toISOString();
  return {
    id: randomId(),
    orderId: order.id,
    customerId: customerId || order.customerId,
    targetType: input.targetType,
    targetId: target.targetId,
    restaurantId: order.restaurantId,
    driverId: order.driverId ?? null,
    dishId: target.dishId ?? null,
    rating: clampRating(input.rating),
    comment: cleanComment(input.comment),
    tags: cleanTags(input.tags),
    authorName: defaultAuthorName(input.authorName),
    isVerifiedOrder: true,
    isTest: true,
    status: 'published',
    moderationReason: null,
    createdAt: now,
    updatedAt: now,
  };
}

function sameReviewIntent(a: Review, b: Review): boolean {
  return a.orderId === b.orderId
    && a.targetType === b.targetType
    && a.targetId === b.targetId
    && (a.dishId ?? null) === (b.dishId ?? null);
}

function computeSummary(targetType: ReviewTargetType, targetId: string, reviews: Review[]): ReviewSummary {
  const published = reviews.filter((review) =>
    review.targetType === targetType
    && review.targetId === targetId
    && review.status === 'published'
  );
  const reviewCount = published.length;
  const total = published.reduce((sum, review) => sum + review.rating, 0);
  const ratingAvg = reviewCount ? total / reviewCount : 0;
  const ratingWeighted = reviewCount
    ? ((ratingAvg * reviewCount) + (PRIOR_AVERAGE * PRIOR_WEIGHT)) / (reviewCount + PRIOR_WEIGHT)
    : 0;
  return {
    targetType,
    targetId,
    ratingAvg: round1(ratingAvg),
    ratingWeighted: round1(ratingWeighted),
    reviewCount,
    publishedCount: reviewCount,
    verifiedCount: published.filter((review) => review.isVerifiedOrder).length,
    breakdown: {
      1: published.filter((review) => review.rating === 1).length,
      2: published.filter((review) => review.rating === 2).length,
      3: published.filter((review) => review.rating === 3).length,
      4: published.filter((review) => review.rating === 4).length,
      5: published.filter((review) => review.rating === 5).length,
    },
    updatedAt: published[0]?.updatedAt ?? published[0]?.createdAt ?? null,
  };
}

export async function fetchReviewEligibility(orderId: string, customerId?: string): Promise<ReviewEligibility> {
  if (USE_VPS_REVIEWS) {
    try {
      const params = new URLSearchParams({ orderId });
      if (customerId) params.set('customerId', customerId);
      const payload = await apiJson<unknown>(`/api/reviews/eligibility?${params.toString()}`);
      const data = getPayloadData(payload) as EligibilityApiPayload;
      return {
        orderId,
        canReviewRestaurant: Boolean(data?.canReviewRestaurant),
        canReviewDriver: Boolean(data?.canReviewDriver),
        canReviewDishes: Boolean(data?.canReviewDishes),
        reasons: Array.isArray(data?.reasons) ? data.reasons : [],
        existingReviews: normalizeReviewList(data?.existingReviews ?? []),
      };
    } catch (error) {
      if (!ALLOW_DEV_REVIEW_FALLBACK) throw error;
    }
  }

  const reviews = readLocalReviews().filter((review) => review.orderId === orderId);
  try {
    await getDeliveredOrder(orderId, customerId);
    return {
      orderId,
      canReviewRestaurant: !reviews.some((review) => review.targetType === 'restaurant'),
      canReviewDriver: !reviews.some((review) => review.targetType === 'driver'),
      canReviewDishes: true,
      reasons: [],
      existingReviews: reviews,
    };
  } catch (err) {
    return {
      orderId,
      canReviewRestaurant: false,
      canReviewDriver: false,
      canReviewDishes: false,
      reasons: [(err as Error).message],
      existingReviews: reviews,
    };
  }
}
export async function submitOrderReview(
  orderId: string,
  input: SubmitOrderReviewInput,
  customerId?: string
): Promise<Review> {
  const normalized = {
    ...input,
    rating: clampRating(input.rating),
    comment: cleanComment(input.comment),
    tags: cleanTags(input.tags),
    authorName: defaultAuthorName(input.authorName),
  };

  if (USE_VPS_REVIEWS) {
    try {
      const payload = await apiJson<unknown>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ orderId, customerId, ...normalized }),
      });
      return normalizeReview(getPayloadData(payload));
    } catch (error) {
      if (!ALLOW_DEV_REVIEW_FALLBACK) throw error;
    }
  }

  const order = await getDeliveredOrder(orderId, customerId);
  const review = makeLocalReview(order, normalized, customerId);
  const stored = readStoredReviews();
  if (readLocalReviews().some((existing) => sameReviewIntent(existing, review))) {
    throw new Error('Vous avez déjà noté cet élément pour cette commande.');
  }
  writeLocalReviews([review, ...stored]);
  syncLegacyRestaurantReview(review);
  syncLegacyDriverReview(review);
  return review;
}
export async function fetchRestaurantReviews(
  restaurantId: string,
  options: { limit?: number; includeHidden?: boolean } = {}
): Promise<Review[]> {
  if (USE_VPS_REVIEWS) {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', String(options.limit));
      if (options.includeHidden) params.set('includeHidden', 'true');
      const qs = params.toString();
      const payload = await apiJson<unknown>(`/api/restaurants/${encodeURIComponent(restaurantId)}/reviews${qs ? `?${qs}` : ''}`);
      const apiReviews = normalizeReviewList(payload);
      if (apiReviews.length > 0 || !ALLOW_DEV_REVIEW_FALLBACK) return apiReviews;
    } catch (error) {
      if (!ALLOW_DEV_REVIEW_FALLBACK) throw error;
    }
  }

  return readLocalReviews()
    .filter((review) =>
      review.targetType === 'restaurant'
      && review.restaurantId === restaurantId
      && (options.includeHidden || review.status === 'published')
    )
    .slice(0, options.limit ?? 100);
}
export async function fetchRestaurantRatingSummary(restaurantId: string): Promise<ReviewSummary> {
  if (USE_VPS_REVIEWS) {
    try {
      const payload = await apiJson<unknown>(`/api/restaurants/${encodeURIComponent(restaurantId)}/reviews/summary`);
      const apiSummary = normalizeSummary(getPayloadData(payload), 'restaurant', restaurantId);
      if (apiSummary.reviewCount > 0 || !ALLOW_DEV_REVIEW_FALLBACK) return apiSummary;
    } catch (error) {
      if (!ALLOW_DEV_REVIEW_FALLBACK) throw error;
    }
  }
  return computeSummary('restaurant', restaurantId, readLocalReviews());
}
export async function fetchRestaurantRatingSummaries(restaurantIds: string[]): Promise<Record<string, ReviewSummary>> {
  const uniqueIds = [...new Set(restaurantIds)].filter(Boolean);
  if (uniqueIds.length === 0) return {};

  if (USE_VPS_REVIEWS) {
    try {
      const params = new URLSearchParams({ targetType: 'restaurant', targetIds: uniqueIds.join(',') });
      const payload = await apiJson<unknown>(`/api/reviews/summaries?${params.toString()}`);
      const rows = Array.isArray(getPayloadData(payload)) ? getPayloadData(payload) as ReviewSummaryApiRow[] : [];
      const apiSummaries = Object.fromEntries(rows.map((row) => {
        const targetId = String(row.targetId ?? row.target_id);
        return [targetId, normalizeSummary(row, 'restaurant', targetId)];
      }));
      if (!ALLOW_DEV_REVIEW_FALLBACK) return apiSummaries;

      const localReviews = readLocalReviews();
      const merged = { ...apiSummaries };
      for (const id of uniqueIds) {
        if (!merged[id] || merged[id].reviewCount === 0) {
          merged[id] = computeSummary('restaurant', id, localReviews);
        }
      }
      return merged;
    } catch (error) {
      if (!ALLOW_DEV_REVIEW_FALLBACK) throw error;
    }
  }

  const reviews = readLocalReviews();
  return Object.fromEntries(uniqueIds.map((id) => [id, computeSummary('restaurant', id, reviews)]));
}
export async function enrichRestaurantsWithReviewSummaries<T extends Restaurant>(
  restaurants: T[]
): Promise<(T & RestaurantRatingFields)[]> {
  try {
    const summaries = await fetchRestaurantRatingSummaries(restaurants.map((restaurant) => restaurant.id));
    return restaurants.map((restaurant) => {
      const summary = summaries[restaurant.id] ?? normalizeSummary(null, 'restaurant', restaurant.id);
      return {
        ...restaurant,
        rating: summary.ratingAvg,
        reviewCount: summary.reviewCount,
        ratingWeighted: summary.ratingWeighted,
        ratingBreakdown: summary.breakdown,
        verifiedReviewCount: summary.verifiedCount,
        dynamicReviewCount: summary.reviewCount,
      };
    });
  } catch {
    return restaurants.map((restaurant) => ({
      ...restaurant,
      rating: 0,
      ratingWeighted: 0,
      reviewCount: 0,
      dynamicReviewCount: 0,
      verifiedReviewCount: 0,
      ratingBreakdown: normalizeSummary(null, 'restaurant', restaurant.id).breakdown,
    }));
  }
}

export async function hasOrderReview(orderId: string, targetType?: ReviewTargetType): Promise<boolean> {
  if (USE_VPS_REVIEWS) {
    const eligibility = await fetchReviewEligibility(orderId);
    return eligibility.existingReviews.some((review) => !targetType || review.targetType === targetType);
  }
  return readLocalReviews().some((review) =>
    review.orderId === orderId
    && (!targetType || review.targetType === targetType)
  );
}

export async function fetchAdminReviews(filters: {
  targetType?: ReviewTargetType | 'all';
  status?: ReviewStatus | 'all';
  q?: string;
} = {}): Promise<Review[]> {
  if (USE_VPS_REVIEWS) {
    try {
      const params = new URLSearchParams();
      if (filters.targetType && filters.targetType !== 'all') params.set('targetType', filters.targetType);
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.q?.trim()) params.set('q', filters.q.trim());
      const qs = params.toString();
      const payload = await apiJson<unknown>(`/api/admin/reviews${qs ? `?${qs}` : ''}`);
      const apiReviews = normalizeReviewList(payload);
      if (apiReviews.length > 0 || !ALLOW_DEV_REVIEW_FALLBACK) return apiReviews;
    } catch (error) {
      if (!ALLOW_DEV_REVIEW_FALLBACK) throw error;
    }
  }

  const q = filters.q?.trim().toLowerCase() ?? '';
  return readLocalReviews().filter((review) => {
    if (filters.targetType && filters.targetType !== 'all' && review.targetType !== filters.targetType) return false;
    if (filters.status && filters.status !== 'all' && review.status !== filters.status) return false;
    if (!q) return true;
    return [
      review.comment,
      review.authorName,
      review.orderId,
      review.restaurantId,
      review.targetId,
      ...review.tags,
    ].some((value) => String(value ?? '').toLowerCase().includes(q));
  });
}
export async function moderateReview(
  reviewId: string,
  status: ReviewStatus,
  moderationReason?: string
): Promise<Review> {
  if (USE_VPS_REVIEWS) {
    try {
      const payload = await apiJson<unknown>(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, moderationReason: moderationReason?.trim() || null }),
      });
      return normalizeReview(getPayloadData(payload));
    } catch (error) {
      if (!ALLOW_DEV_REVIEW_FALLBACK) throw error;
    }
  }

  const updatedAt = new Date().toISOString();
  return updateStoredReview(reviewId, (review) => ({
    ...review,
    status,
    moderationReason: moderationReason?.trim() || null,
    updatedAt,
    // Modérer un avis signalé répond de fait au signalement : il est clos.
    ownerReport: review.ownerReport?.status === 'open'
      ? { ...review.ownerReport, status: 'resolved' }
      : review.ownerReport,
  }));
}

// Applique une mutation à un avis du stockage mock. Un avis démo ou hérité
// (clés legacy) absent de yamo_reviews_v1 est matérialisé avec la mutation —
// la version stockée prime ensuite sur la source dans le merge de
// readLocalReviews.
function updateStoredReview(reviewId: string, mutate: (review: Review) => Review): Review {
  const stored = readStoredReviews();
  let next: Review[];
  if (stored.some((review) => review.id === reviewId)) {
    next = stored.map((review) => (review.id === reviewId ? mutate(review) : review));
  } else {
    const source = readLocalReviews().find((review) => review.id === reviewId);
    if (!source) throw new Error('Avis introuvable.');
    next = [mutate(source), ...stored];
  }
  writeLocalReviews(next);
  const updated = readLocalReviews().find((review) => review.id === reviewId);
  if (!updated) throw new Error('Avis introuvable.');
  return updated;
}

/**
 * Réponse officielle du restaurant à un avis (création ou édition).
 * VPS : POST /api/reviews/:id/reply (le serveur vérifie que le token
 * appartient au restaurant cible) ; mock : mutation dans yamo_reviews_v1.
 */
export async function submitOwnerReply(reviewId: string, text: string): Promise<Review> {
  const clean = text.trim().slice(0, MAX_COMMENT_LENGTH);
  if (!clean) throw new Error('La réponse ne peut pas être vide.');

  if (USE_VPS_REVIEWS) {
    try {
      const payload = await apiJson<unknown>(`/api/reviews/${encodeURIComponent(reviewId)}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text: clean }),
      });
      return normalizeReview(getPayloadData(payload) as ReviewApiRow);
    } catch (error) {
      if (!ALLOW_DEV_REVIEW_FALLBACK) throw error;
    }
  }

  const now = new Date().toISOString();
  return updateStoredReview(reviewId, (review) => {
    if (review.status !== 'published') {
      throw new Error('Impossible de répondre à un avis non publié.');
    }
    return {
      ...review,
      // Une édition republie la réponse : le contenu est nouveau, la
      // modération précédente ne s'y applique plus.
      ownerReply: review.ownerReply
        ? { ...review.ownerReply, text: clean, updatedAt: now, status: 'published', moderationReason: null }
        : { text: clean, createdAt: now, updatedAt: null, status: 'published', moderationReason: null },
    };
  });
}

/** Suppression de la réponse par le restaurant. */
export async function deleteOwnerReply(reviewId: string): Promise<Review> {
  if (USE_VPS_REVIEWS) {
    try {
      const payload = await apiJson<unknown>(`/api/reviews/${encodeURIComponent(reviewId)}/reply`, {
        method: 'DELETE',
      });
      return normalizeReview(getPayloadData(payload) as ReviewApiRow);
    } catch (error) {
      if (!ALLOW_DEV_REVIEW_FALLBACK) throw error;
    }
  }
  return updateStoredReview(reviewId, (review) => ({ ...review, ownerReply: null }));
}

/**
 * Modération admin de la réponse restaurant — indépendante du statut de
 * l'avis (masquer une réponse agressive sans toucher l'avis client).
 */
export async function moderateOwnerReply(
  reviewId: string,
  status: OwnerReply['status'],
  moderationReason?: string
): Promise<Review> {
  if (USE_VPS_REVIEWS) {
    try {
      const payload = await apiJson<unknown>(`/api/admin/reviews/${encodeURIComponent(reviewId)}/reply`, {
        method: 'PATCH',
        body: JSON.stringify({ status, moderationReason: moderationReason?.trim() || null }),
      });
      return normalizeReview(getPayloadData(payload) as ReviewApiRow);
    } catch (error) {
      if (!ALLOW_DEV_REVIEW_FALLBACK) throw error;
    }
  }
  return updateStoredReview(reviewId, (review) => {
    if (!review.ownerReply) throw new Error('Aucune réponse à modérer sur cet avis.');
    return {
      ...review,
      ownerReply: {
        ...review.ownerReply,
        status,
        moderationReason: status === 'hidden' ? (moderationReason?.trim() || 'Masquée par la modération.') : null,
      },
    };
  });
}

/**
 * Signalement d'un avis par le restaurant — demande de modération avec motif
 * obligatoire. VPS : POST /api/reviews/:id/report ; mock : yamo_reviews_v1.
 */
export async function reportReview(reviewId: string, reason: string): Promise<Review> {
  const clean = reason.trim().slice(0, MAX_COMMENT_LENGTH);
  if (!clean) throw new Error('Le motif du signalement est obligatoire.');

  if (USE_VPS_REVIEWS) {
    try {
      const payload = await apiJson<unknown>(`/api/reviews/${encodeURIComponent(reviewId)}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason: clean }),
      });
      return normalizeReview(getPayloadData(payload) as ReviewApiRow);
    } catch (error) {
      if (!ALLOW_DEV_REVIEW_FALLBACK) throw error;
    }
  }

  return updateStoredReview(reviewId, (review) => {
    if (review.ownerReport?.status === 'open') {
      throw new Error('Cet avis est déjà signalé — la modération va le traiter.');
    }
    return {
      ...review,
      ownerReport: { reason: clean, createdAt: new Date().toISOString(), status: 'open' },
    };
  });
}

/**
 * Classement d'un signalement par l'admin sans toucher à l'avis (« sans
 * action »). VPS : PATCH /api/admin/reviews/:id/report.
 */
export async function resolveReviewReport(reviewId: string): Promise<Review> {
  if (USE_VPS_REVIEWS) {
    try {
      const payload = await apiJson<unknown>(`/api/admin/reviews/${encodeURIComponent(reviewId)}/report`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved' }),
      });
      return normalizeReview(getPayloadData(payload) as ReviewApiRow);
    } catch (error) {
      if (!ALLOW_DEV_REVIEW_FALLBACK) throw error;
    }
  }
  return updateStoredReview(reviewId, (review) => {
    if (!review.ownerReport) throw new Error('Aucun signalement sur cet avis.');
    return { ...review, ownerReport: { ...review.ownerReport, status: 'resolved' } };
  });
}

// ─── Suivi « nouveaux avis » côté restaurateur ────────────────────────────
// Notification in-app sans infra externe : on mémorise localement la date du
// dernier passage du restaurateur sur ses avis, et le dashboard compare.

const REVIEWS_SEEN_KEY = 'yamo_resto_reviews_seen';

export function getRestaurantReviewsLastSeen(restaurantId: string): string | null {
  if (!storageAvailable()) return null;
  const map = safeParse<Record<string, string>>(localStorage.getItem(REVIEWS_SEEN_KEY), {});
  return map[restaurantId] ?? null;
}

export function markRestaurantReviewsSeen(restaurantId: string): void {
  if (!storageAvailable()) return;
  const map = safeParse<Record<string, string>>(localStorage.getItem(REVIEWS_SEEN_KEY), {});
  map[restaurantId] = new Date().toISOString();
  localStorage.setItem(REVIEWS_SEEN_KEY, JSON.stringify(map));
}

export function countUnseenReviews(restaurantId: string, reviews: Review[]): number {
  const lastSeen = getRestaurantReviewsLastSeen(restaurantId);
  // Premier passage : tout est « déjà vu » pour ne pas alerter sur l'historique.
  if (!lastSeen) return 0;
  return reviews.filter((review) => review.status === 'published' && review.createdAt > lastSeen).length;
}