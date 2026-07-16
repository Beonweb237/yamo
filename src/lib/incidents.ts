// Incidents de livraison (CONF-18) — signalés par le livreur sur une course
// active, traités par l'admin (LOT-08). Mode mock : localStorage, même
// convention que les autres libs.
// Contrat VPS cible :
//   POST /api/incidents            body { orderId, type, note? }
//   GET  /api/admin/incidents
//   POST /api/admin/incidents/:id/resolve   body { resolutionNote? }

export type IncidentType = 'client_injoignable' | 'adresse_introuvable' | 'commande_incomplete';

export const INCIDENT_LABELS: Record<IncidentType, string> = {
  client_injoignable: 'Client injoignable',
  adresse_introuvable: 'Adresse introuvable',
  commande_incomplete: 'Commande incomplète au retrait',
};

export interface DeliveryIncident {
  id: string;
  orderId: string;
  driverId: string;
  type: IncidentType;
  note?: string;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
}

const STORAGE_KEY = 'yamo_incidents';

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
}): Promise<DeliveryIncident> {
  const incident: DeliveryIncident = {
    id: crypto.randomUUID(),
    orderId: params.orderId,
    driverId: params.driverId,
    type: params.type,
    note: params.note?.trim() || undefined,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  writeAll([incident, ...readAll()]);
  return incident;
}

/** Tous les incidents (admin), plus récents d'abord. */
export async function fetchAllIncidents(): Promise<DeliveryIncident[]> {
  return readAll();
}

/** Marque un incident comme résolu (admin). */
export async function resolveIncident(id: string, resolutionNote?: string): Promise<void> {
  const updated = readAll().map((i) =>
    i.id === id
      ? { ...i, status: 'resolved' as const, resolvedAt: new Date().toISOString(), resolutionNote: resolutionNote?.trim() || null }
      : i
  );
  writeAll(updated);
}
