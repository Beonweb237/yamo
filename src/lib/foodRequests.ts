// Demandes culinaires sur mesure — le client décrit un besoin, les restaurants
// de sa ville soumissionnent, il choisit une offre.
// Double chemin : VPS (/api/food-requests*) en prod, localStorage en mock.

const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';
function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

export interface FoodRequestBid {
  id: string;
  restaurantId: string;
  restaurantName: string;
  price: number;
  comment?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface DeliverySchedule {
  frequence: 'unique' | 'quotidien' | 'hebdomadaire';
  jours?: string[];
  dureeSemaines?: number;
}

export type FoodRequestStatus = 'open' | 'accepted' | 'expired' | 'cancelled';

export interface FoodRequestInput {
  title: string;
  description: string;
  city: string;
  budgetMin: number;
  budgetMax: number;
  dietaryTags: string[];
  preparationNotes?: string;
  deliverySchedule: DeliverySchedule;
  deliveryAddress?: string;
  /** Nombre de personnes / portions (glissé dans les notes serveur). */
  portions?: number;
  /** Occasion (glissée dans les notes serveur). */
  occasion?: string;
  /** Commande pour quelqu'un d'autre — nom du destinataire final */
  recipientName?: string;
  /** Commande pour quelqu'un d'autre — téléphone du destinataire final */
  recipientPhone?: string;
  /** Photo de référence du plat souhaité (URL /uploads ou data-URL). */
  photoUrl?: string;
}

export interface FoodRequest extends FoodRequestInput {
  id: string;
  customerId: string;
  status: FoodRequestStatus;
  bids: FoodRequestBid[];
  acceptedBidId: string | null;
  createdAt: string;
  expiresAt: string;
  /** Vue resto (/available) : nombre d'offres reçues + le resto courant a-t-il déjà soumissionné. */
  bidCount?: number;
  hasBid?: boolean;
  customerName?: string;
  customerPhone?: string;
}

const STORAGE_KEY = 'miam_food_requests';
const REQUEST_LIFETIME_HOURS = 48;

function readAll(): FoodRequest[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function writeAll(requests: FoodRequest[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(requests)); }
function withExpiryApplied(requests: FoodRequest[]): FoodRequest[] {
  const now = Date.now();
  return requests.map((r) => r.status === 'open' && new Date(r.expiresAt).getTime() < now ? { ...r, status: 'expired' as const } : r);
}

// Regroupe les infos qui n'ont pas de colonne serveur dédiée dans preparationNotes.
function packNotes(input: FoodRequestInput): string | undefined {
  const bits: string[] = [];
  if (input.preparationNotes?.trim()) bits.push(input.preparationNotes.trim());
  if (input.portions) bits.push(`Portions : ${input.portions}`);
  if (input.occasion?.trim()) bits.push(`Occasion : ${input.occasion.trim()}`);
  if (input.recipientName?.trim()) bits.push(`Destinataire : ${input.recipientName.trim()}${input.recipientPhone ? ` (${input.recipientPhone.trim()})` : ''}`);
  if (input.photoUrl) bits.push(`Photo : ${input.photoUrl}`);
  return bits.length ? bits.join(' · ') : undefined;
}

async function vps<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...authHeader(), ...(init.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur API (${res.status})`);
  return data as T;
}
const listOf = <T>(j: unknown): T[] => Array.isArray(j) ? j as T[] : ((j as { data?: T[] })?.data || []);

export async function createFoodRequest(customerId: string, input: FoodRequestInput): Promise<FoodRequest> {
  if (USE_VPS) {
    return vps<FoodRequest>('/api/food-requests', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title, description: input.description, city: input.city,
        budgetMin: input.budgetMin, budgetMax: input.budgetMax,
        dietaryTags: input.dietaryTags, preparationNotes: packNotes(input),
        deliverySchedule: input.deliverySchedule, deliveryAddress: input.deliveryAddress,
      }),
    });
  }
  const now = new Date();
  const request: FoodRequest = {
    ...input, id: crypto.randomUUID(), customerId, status: 'open', bids: [], acceptedBidId: null,
    createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + REQUEST_LIFETIME_HOURS * 3600000).toISOString(),
  };
  writeAll([request, ...readAll()]);
  return request;
}

export async function fetchMyFoodRequests(customerId: string): Promise<FoodRequest[]> {
  if (USE_VPS) {
    try { return listOf<FoodRequest>(await vps('/api/food-requests/mine')); } catch { return []; }
  }
  const requests = withExpiryApplied(readAll()); writeAll(requests);
  return requests.filter((r) => r.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Demandes ouvertes d'une ville — ce que voit un restaurant. En mode VPS, la
 *  ville est dérivée du restaurant du propriétaire quand `city` est omis. */
export async function fetchOpenFoodRequests(city?: string): Promise<FoodRequest[]> {
  if (USE_VPS) {
    const qs = city ? `?city=${encodeURIComponent(city)}` : '';
    try { return listOf<FoodRequest>(await vps(`/api/food-requests/available${qs}`)); } catch { return []; }
  }
  const requests = withExpiryApplied(readAll()); writeAll(requests);
  return requests.filter((r) => r.status === 'open' && (!city || r.city === city)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function submitBid(requestId: string, bid: Omit<FoodRequestBid, 'id' | 'status' | 'createdAt'>): Promise<void> {
  if (USE_VPS) {
    await vps(`/api/food-requests/${encodeURIComponent(requestId)}/bids`, { method: 'POST', body: JSON.stringify({ price: bid.price, comment: bid.comment }) });
    return;
  }
  const requests = readAll();
  const target = requests.find((r) => r.id === requestId);
  if (!target || target.status !== 'open') return;
  target.bids.push({ ...bid, id: crypto.randomUUID(), status: 'pending', createdAt: new Date().toISOString() });
  writeAll(requests);
}

/** Accepte une offre → l'attribution crée une vraie commande côté serveur.
 *  Renvoie l'id de la commande créée (pour rediriger vers le suivi). */
export async function acceptBid(requestId: string, bidId: string): Promise<{ orderId?: string }> {
  if (USE_VPS) {
    const res = await vps<{ orderId?: string }>(`/api/food-requests/${encodeURIComponent(requestId)}/accept/${encodeURIComponent(bidId)}`, { method: 'PATCH' });
    return { orderId: res?.orderId };
  }
  const requests = readAll();
  const target = requests.find((r) => r.id === requestId);
  if (!target) return {};
  target.bids = target.bids.map((b) => ({ ...b, status: b.id === bidId ? 'accepted' : b.status === 'pending' ? 'rejected' : b.status }));
  target.acceptedBidId = bidId; target.status = 'accepted';
  writeAll(requests);
  return {};
}

export async function cancelFoodRequest(requestId: string): Promise<void> {
  if (USE_VPS) {
    await vps(`/api/food-requests/${encodeURIComponent(requestId)}/cancel`, { method: 'PATCH' });
    return;
  }
  const requests = readAll();
  const target = requests.find((r) => r.id === requestId);
  if (!target) return;
  target.status = 'cancelled';
  writeAll(requests);
}
