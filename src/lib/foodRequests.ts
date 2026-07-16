// Demandes culinaires sur mesure — le client décrit un besoin, les
// restaurants de sa ville soumissionnent, il choisit une offre.
// Mode 100% autonome (localStorage), même convention que applications.ts.

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
  /** Commande pour quelqu'un d'autre — nom du destinataire final */
  recipientName?: string;
  /** Commande pour quelqu'un d'autre — téléphone du destinataire final */
  recipientPhone?: string;
}

export interface FoodRequest extends FoodRequestInput {
  id: string;
  customerId: string;
  status: FoodRequestStatus;
  bids: FoodRequestBid[];
  acceptedBidId: string | null;
  createdAt: string;
  expiresAt: string;
}

const STORAGE_KEY = 'miam_food_requests';
const REQUEST_LIFETIME_HOURS = 48;

function readAll(): FoodRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(requests: FoodRequest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

/** Marque comme expirées les demandes "open" dont le délai est dépassé — recalculé à chaque lecture. */
function withExpiryApplied(requests: FoodRequest[]): FoodRequest[] {
  const now = Date.now();
  return requests.map((r) =>
    r.status === 'open' && new Date(r.expiresAt).getTime() < now
      ? { ...r, status: 'expired' as const }
      : r
  );
}

export async function createFoodRequest(customerId: string, input: FoodRequestInput): Promise<FoodRequest> {
  const now = new Date();
  const request: FoodRequest = {
    ...input,
    id: crypto.randomUUID(),
    customerId,
    status: 'open',
    bids: [],
    acceptedBidId: null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + REQUEST_LIFETIME_HOURS * 3600000).toISOString(),
  };
  const requests = readAll();
  writeAll([request, ...requests]);
  return request;
}

export async function fetchMyFoodRequests(customerId: string): Promise<FoodRequest[]> {
  const requests = withExpiryApplied(readAll());
  writeAll(requests);
  return requests
    .filter((r) => r.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Demandes ouvertes d'une ville donnée — ce que verrait un restaurant pour soumissionner. */
export async function fetchOpenFoodRequests(city: string): Promise<FoodRequest[]> {
  const requests = withExpiryApplied(readAll());
  writeAll(requests);
  return requests
    .filter((r) => r.status === 'open' && r.city === city)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function submitBid(
  requestId: string,
  bid: Omit<FoodRequestBid, 'id' | 'status' | 'createdAt'>
): Promise<void> {
  const requests = readAll();
  const target = requests.find((r) => r.id === requestId);
  if (!target || target.status !== 'open') return;
  target.bids.push({ ...bid, id: crypto.randomUUID(), status: 'pending', createdAt: new Date().toISOString() });
  writeAll(requests);
}

export async function acceptBid(requestId: string, bidId: string): Promise<void> {
  const requests = readAll();
  const target = requests.find((r) => r.id === requestId);
  if (!target) return;
  target.bids = target.bids.map((b) => ({
    ...b,
    status: b.id === bidId ? 'accepted' : b.status === 'pending' ? 'rejected' : b.status,
  }));
  target.acceptedBidId = bidId;
  target.status = 'accepted';
  writeAll(requests);
}

export async function cancelFoodRequest(requestId: string): Promise<void> {
  const requests = readAll();
  const target = requests.find((r) => r.id === requestId);
  if (!target) return;
  target.status = 'cancelled';
  writeAll(requests);
}
