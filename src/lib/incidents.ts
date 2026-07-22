// Incidents de livraison (CONF-18) — signalés par le livreur sur une course
// active, traités par l'admin (LOT-08). Mode mock : localStorage, même
// convention que les autres libs.
// Contrat VPS cible :
//   POST /api/incidents            body { orderId, type, note? }
//   GET  /api/admin/incidents
//   POST /api/admin/incidents/:id/resolve   body { resolutionNote? }

export type IncidentType =
  | 'client_injoignable'
  | 'adresse_introuvable'
  | 'commande_incomplete'
  // Série PTS : refus à la porte (signalé par le livreur) et non-conformité
  // (signalée par le client) — litiges arbitrés avec effet sur la garantie.
  | 'livraison_refusee'
  | 'commande_non_conforme';

export const INCIDENT_LABELS: Record<IncidentType, string> = {
  client_injoignable: 'Client injoignable',
  adresse_introuvable: 'Adresse introuvable',
  commande_incomplete: 'Commande incomplète au retrait',
  livraison_refusee: 'Livraison refusée par le client',
  commande_non_conforme: 'Commande non conforme (client)',
};

export interface DeliveryIncident {
  id: string;
  orderId: string;
  driverId: string;
  type: IncidentType;
  note?: string;
  /** Série PTS : auteur du signalement (absent = livreur, historique). */
  reportedBy?: 'driver' | 'customer';
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
}

const STORAGE_KEY = 'yamo_incidents';
const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

function readAll(): DeliveryIncident[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DeliveryIncident[]) : [];
  } catch {
    return [];
  }
}

function writeAll(incidents: DeliveryIncident[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
}

/** Signale un incident sur une course (livreur). */
export async function reportIncident(params: {
  orderId: string;
  driverId: string;
  type: IncidentType;
  note?: string;
  reportedBy?: 'driver' | 'customer';
}): Promise<DeliveryIncident> {
  // Mode VPS : l'incident vit en base (alimente le Centre Opérations, scénario 10).
  if (USE_VPS) {
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        orderId: params.orderId,
        type: params.type,
        note: params.note?.trim() || undefined,
        reportedBy: params.reportedBy ?? 'driver',
      }),
    });
    if (!res.ok) throw new Error('Impossible de signaler l\'incident.');
    const row = await res.json();
    return {
      id: String(row.id),
      orderId: String(row.orderId ?? params.orderId),
      driverId: String(row.driverId ?? params.driverId),
      type: (row.type ?? params.type) as IncidentType,
      note: row.note ?? undefined,
      reportedBy: (row.reportedBy ?? params.reportedBy ?? 'driver') as 'driver' | 'customer',
      status: 'open',
      createdAt: row.createdAt ?? new Date().toISOString(),
    };
  }
  const incident: DeliveryIncident = {
    id: crypto.randomUUID(),
    orderId: params.orderId,
    driverId: params.driverId,
    type: params.type,
    note: params.note?.trim() || undefined,
    reportedBy: params.reportedBy ?? 'driver',
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  writeAll([incident, ...readAll()]);
  return incident;
}

/** Tous les incidents (admin), plus récents d'abord. */
export async function fetchAllIncidents(): Promise<DeliveryIncident[]> {
  if (USE_VPS) {
    try {
      const res = await fetch('/api/admin/incidents', { headers: authHeader() });
      if (res.ok) return (await res.json()) as DeliveryIncident[];
    } catch { /* repli localStorage */ }
  }
  return readAll();
}

/** Marque un incident comme résolu (admin). */
export async function resolveIncident(id: string, resolutionNote?: string): Promise<void> {
  if (USE_VPS) {
    const res = await fetch(`/api/admin/incidents/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ resolutionNote: resolutionNote?.trim() || undefined }),
    });
    if (!res.ok) throw new Error('Impossible de résoudre l\'incident.');
    return;
  }
  const updated = readAll().map((i) =>
    i.id === id
      ? { ...i, status: 'resolved' as const, resolvedAt: new Date().toISOString(), resolutionNote: resolutionNote?.trim() || null }
      : i
  );
  writeAll(updated);
}
