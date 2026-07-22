// Centre Financier (série FIN) — lib client. Mode VPS uniquement.
const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

export interface FinanceSummary {
  periodDays: number;
  money: { orders: number; gmv: number; subtotal: number; deliveryFees: number; commission: number };
  byMode: Record<string, { orders: number; gmv: number; commission: number }>;
  byPayment: Record<string, { orders: number; amount: number }>;
  driver: { earnings: number; payouts: number; net: number };
  restaurantWallets: { totalAvailable: number };
  cashInCirculation: number;
}

export interface DriverReconciliation {
  driverId: string; name: string | null; phone: string | null;
  orders: number; cashCollected: number; owedToPlatform: number; earningsToPay: number;
}

export class FinanceUnavailableError extends Error {
  constructor() { super('Le Centre Financier nécessite le backend (mode VPS).'); this.name = 'FinanceUnavailableError'; }
}

async function get<T>(path: string): Promise<T> {
  if (!USE_VPS) throw new FinanceUnavailableError();
  const res = await fetch(path, { headers: authHeader() });
  if (res.status === 403) throw new Error('Accès refusé (permission finance requise).');
  if (!res.ok) throw new Error('Impossible de charger les données financières.');
  return (await res.json()) as T;
}

export const fetchFinanceSummary = (periodDays = 30) =>
  get<FinanceSummary>(`/api/admin/finance?period=${periodDays}`);

export const fetchFinanceDrivers = (periodDays = 30) =>
  get<{ periodDays: number; drivers: DriverReconciliation[] }>(`/api/admin/finance/drivers?period=${periodDays}`);

export interface FinanceOrder {
  id: string; ref: string; date: string; status: string; mode: string; paymentMethod: string;
  restaurantName: string | null; driverName: string | null;
  subtotal: number; deliveryFee: number; total: number; commission: number;
}

export const fetchFinanceOrders = (periodDays = 30) =>
  get<{ periodDays: number; orders: FinanceOrder[] }>(`/api/admin/finance/orders?period=${periodDays}`);

/** Construit un CSV (séparateur ;) à partir des transactions et déclenche le téléchargement. */
export function exportFinanceCsv(orders: FinanceOrder[], periodDays: number): void {
  const headers = ['Reference', 'Date', 'Statut', 'Mode', 'Moyen', 'Restaurant', 'Livreur', 'Sous-total', 'Frais livraison', 'Total', 'Commission'];
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = orders.map((o) => [
    o.ref, new Date(o.date).toISOString().slice(0, 10), o.status, o.mode, o.paymentMethod,
    o.restaurantName || '', o.driverName || '', o.subtotal, o.deliveryFee, o.total, o.commission,
  ].map(esc).join(';'));
  const csv = '﻿' + [headers.join(';'), ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `miamexpress-finance-${periodDays}j-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
