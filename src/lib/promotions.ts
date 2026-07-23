// ═══════════════════════════════════════════════════════════════
// Promotions & codes promo (série PROMO — CP5)
// ═══════════════════════════════════════════════════════════════
// Double chemin habituel : VPS (/api/promotions/* + /api/admin/promotions)
// si VITE_USE_VPS_API, sinon registre localStorage `yamo_promotions` (dev).
// La même logique d'éligibilité sert au checkout mock (evaluatePromoLocal) ;
// en mode VPS, la remise fait foi côté serveur (/api/orders/validate).

const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';
const LS_KEY = 'yamo_promotions';

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

export type PromotionType = 'percent' | 'amount' | 'free_delivery';

export interface Promotion {
  id: string;
  code: string;
  title?: string | null;
  type: PromotionType;
  discountPercent?: number;
  discountAmount?: number;
  minSubtotal?: number;
  /** null/vide = tous les restaurants. */
  restaurantIds?: string[] | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
}

export interface PromotionInput {
  code: string;
  title?: string;
  type: PromotionType;
  discountPercent?: number;
  discountAmount?: number;
  minSubtotal?: number;
  restaurantIds?: string[] | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}

export interface PromoEvaluation {
  discount: number;
  freeDelivery: boolean;
  promo: Promotion | null;
  promoError: string | null;
}

// ─── Mock (localStorage) ───────────────────────────────────────

function readLocal(): Promotion[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function writeLocal(list: Promotion[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function isCurrentlyActive(p: Promotion, now = Date.now()): boolean {
  if (!p.isActive) return false;
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return false;
  if (p.endsAt && new Date(p.endsAt).getTime() < now) return false;
  return true;
}

/** Éligibilité + remise d'un code — mêmes règles que le serveur (mock only). */
export function evaluatePromoLocal(
  code: string,
  ctx: { restaurantId: string; subtotal: number },
): PromoEvaluation {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) return { discount: 0, freeDelivery: false, promo: null, promoError: null };
  const promo = readLocal().find((p) => p.code.toUpperCase() === cleaned) ?? null;
  if (!promo) return { discount: 0, freeDelivery: false, promo: null, promoError: 'Code promo inconnu.' };
  if (!promo.isActive) return { discount: 0, freeDelivery: false, promo: null, promoError: 'Ce code promo n’est plus actif.' };
  const now = Date.now();
  if (promo.startsAt && new Date(promo.startsAt).getTime() > now) {
    return { discount: 0, freeDelivery: false, promo: null, promoError: 'Ce code promo n’est pas encore valable.' };
  }
  if (promo.endsAt && new Date(promo.endsAt).getTime() < now) {
    return { discount: 0, freeDelivery: false, promo: null, promoError: 'Ce code promo a expiré.' };
  }
  const targets = (promo.restaurantIds ?? []).filter(Boolean);
  if (targets.length && !targets.includes(ctx.restaurantId)) {
    return { discount: 0, freeDelivery: false, promo: null, promoError: 'Ce code promo ne s’applique pas à ce restaurant.' };
  }
  const min = promo.minSubtotal ?? 0;
  if (ctx.subtotal < min) {
    return {
      discount: 0, freeDelivery: false, promo: null,
      promoError: `Ce code demande un minimum de ${min.toLocaleString()} FCFA d’articles.`,
    };
  }
  if (promo.type === 'free_delivery') return { discount: 0, freeDelivery: true, promo, promoError: null };
  const discount = Math.min(
    ctx.subtotal,
    promo.type === 'percent'
      ? Math.round(ctx.subtotal * (promo.discountPercent ?? 0) / 100)
      : (promo.discountAmount ?? 0),
  );
  if (discount <= 0) return { discount: 0, freeDelivery: false, promo: null, promoError: 'Ce code promo n’offre aucune remise ici.' };
  return { discount, freeDelivery: false, promo, promoError: null };
}

// ─── API publique ──────────────────────────────────────────────

/** Offres actives (affichage Home — masquer la section si liste vide). */
export async function fetchActivePromotions(): Promise<Promotion[]> {
  if (USE_VPS) {
    const res = await fetch('/api/promotions/active');
    if (!res.ok) throw new Error('Erreur chargement promotions');
    const rows = await res.json();
    return (rows as Promotion[]).map(normalizePromo);
  }
  return readLocal().filter((p) => isCurrentlyActive(p));
}

function normalizePromo(p: Promotion & { discountPercent?: unknown; discountAmount?: unknown }): Promotion {
  return {
    ...p,
    type: (['percent', 'amount', 'free_delivery'] as const).includes(p.type) ? p.type : 'percent',
    discountPercent: Number(p.discountPercent) || 0,
    discountAmount: Number(p.discountAmount) || 0,
    minSubtotal: Number(p.minSubtotal) || 0,
    isActive: p.isActive !== false,
  };
}

// ─── Admin ─────────────────────────────────────────────────────

export async function fetchAllPromotions(): Promise<Promotion[]> {
  if (USE_VPS) {
    const res = await fetch('/api/admin/promotions', { headers: authHeader() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || 'Erreur chargement promotions');
    return (data as Promotion[]).map(normalizePromo);
  }
  return readLocal();
}

export async function createPromotion(input: PromotionInput): Promise<Promotion> {
  if (USE_VPS) {
    const res = await fetch('/api/admin/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || 'Création impossible');
    return normalizePromo(data as Promotion);
  }
  const list = readLocal();
  const code = input.code.trim().toUpperCase();
  if (list.some((p) => p.code.toUpperCase() === code)) throw new Error('Ce code existe déjà.');
  const promo: Promotion = {
    id: `promo-${Date.now()}`,
    code,
    title: input.title?.trim() || null,
    type: input.type,
    discountPercent: input.discountPercent ?? 0,
    discountAmount: input.discountAmount ?? 0,
    minSubtotal: input.minSubtotal ?? 0,
    restaurantIds: input.restaurantIds?.length ? input.restaurantIds : null,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    isActive: input.isActive !== false,
  };
  writeLocal([promo, ...list]);
  return promo;
}

export async function updatePromotion(id: string, input: PromotionInput): Promise<Promotion> {
  if (USE_VPS) {
    const res = await fetch(`/api/admin/promotions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || 'Mise à jour impossible');
    return normalizePromo(data as Promotion);
  }
  const list = readLocal();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error('Promotion introuvable.');
  const updated: Promotion = {
    ...list[idx],
    ...input,
    code: input.code.trim().toUpperCase(),
    title: input.title?.trim() || null,
    restaurantIds: input.restaurantIds?.length ? input.restaurantIds : null,
    isActive: input.isActive !== false,
  };
  const next = [...list];
  next[idx] = updated;
  writeLocal(next);
  return updated;
}

export async function deletePromotion(id: string): Promise<void> {
  if (USE_VPS) {
    const res = await fetch(`/api/admin/promotions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || 'Suppression impossible');
    }
    return;
  }
  writeLocal(readLocal().filter((p) => p.id !== id));
}

/** Libellé court de l'avantage (affichage cartes/carrousel). */
export function promoBenefitLabel(p: Promotion): string {
  if (p.type === 'free_delivery') return 'Livraison offerte';
  if (p.type === 'percent') return `-${p.discountPercent ?? 0}%`;
  return `-${(p.discountAmount ?? 0).toLocaleString()} FCFA`;
}
