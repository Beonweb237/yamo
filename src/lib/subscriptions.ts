// Module Alimentaire (série FOOD) — abonnements. Mode VPS.
const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'completed';

export interface Subscription {
  id: string;
  customerId: string;
  programId: string;
  restaurantId: string;
  status: SubscriptionStatus;
  startDate: string;
  nextDeliveryAt: string | null;
  cycleIndex: number;
  priceFcfa: number;
  programName?: string;
  programPhoto?: string | null;
  restaurantName?: string;
  customerName?: string;
  customerPhone?: string;
  deliveriesTotal?: number;
  deliveriesDone?: number;
  createdAt?: string;
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Actif', paused: 'En pause', cancelled: 'Annulé', completed: 'Terminé',
};

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!USE_VPS) throw new Error('Le module alimentaire nécessite le backend (mode VPS).');
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur API (${res.status})`);
  return data as T;
}

export const subscribeToProgram = (programId: string, startDate: string, addressId?: string, deliveryAddress?: string) =>
  call<Subscription & { plannedDeliveries: number }>('/api/subscriptions', {
    method: 'POST', body: JSON.stringify({ programId, startDate, addressId, deliveryAddress }),
  });
export const fetchMySubscriptions = () => call<Subscription[]>('/api/subscriptions/mine');
export const pauseSubscription = (id: string) => call<Subscription>(`/api/subscriptions/${encodeURIComponent(id)}/pause`, { method: 'POST' });
export const resumeSubscription = (id: string) => call<Subscription>(`/api/subscriptions/${encodeURIComponent(id)}/resume`, { method: 'POST' });
export const cancelSubscription = (id: string) => call<Subscription>(`/api/subscriptions/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
export const fetchAdminSubscriptions = () =>
  call<{ counts: Record<SubscriptionStatus, number>; subscriptions: Subscription[] }>('/api/admin/subscriptions');
