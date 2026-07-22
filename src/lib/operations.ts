// ═══════════════════════════════════════════════════════════════
// Centre Opérations (série OPS) — lib client
// ═══════════════════════════════════════════════════════════════
// Tour de contrôle des commandes en état anormal. Le CALCUL des alertes fait
// foi côté serveur (operations-routes.js) ; ce module ne fait que :
//   - lire/écrire les SEUILS (app_settings.operations_thresholds) ;
//   - récupérer la liste d'alertes (GET /api/admin/operations) ;
//   - tracer « pris en charge » et signaler/lever un incident.
// Spec figée + 14 scénarios : app/docs/plan-ops-dashboard.md.

import { OPS_THRESHOLDS } from '../data/launchConfig';

const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

export type OpsSeverity = 'critical' | 'warning';

export interface OpsAlertCode {
  code: string;
  label: string;
  severity: OpsSeverity;
  minutes: number;
}

export interface OpsAlert {
  orderId: string;
  ref: string;
  status: string;
  restaurantId: string | null;
  restaurantName: string | null;
  restaurantPhone: string | null;
  customerName: string | null;
  customerPhone: string | null;
  neighborhood: string | null;
  city: string | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  total: number;
  waitingMinutes: number;
  hasLiveGps: boolean;
  codes: OpsAlertCode[];
  topSeverity: OpsSeverity;
  handledBy: string | null;
  handledByName: string | null;
  handledAt: string | null;
  handledNote: string | null;
}

export interface OpsSnapshot {
  generatedAt: string;
  counts: { critical: number; warning: number; handled: number };
  thresholds: Record<string, number>;
  alerts: OpsAlert[];
}

/** Seuils effectifs = défauts fusionnés avec app_settings.operations_thresholds. */
export async function fetchOpsThresholds(): Promise<Record<string, number>> {
  if (USE_VPS) {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const s = await res.json();
        const t = (s?.operations_thresholds ?? {}) as Record<string, number>;
        return { ...OPS_THRESHOLDS, ...t };
      }
    } catch { /* repli défaut */ }
  }
  return { ...OPS_THRESHOLDS };
}

/** Enregistre les seuils (admin). Le serveur les applique au calcul des alertes. */
export async function saveOpsThresholds(thresholds: Record<string, number>): Promise<void> {
  if (USE_VPS) {
    await fetch('/api/settings/operations_thresholds', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ value: thresholds }),
    });
  }
}

/** Erreur métier : le Centre Opérations n'existe qu'en mode VPS (données serveur). */
export class OperationsUnavailableError extends Error {
  constructor() {
    super("Le Centre Opérations nécessite le backend (mode VPS).");
    this.name = 'OperationsUnavailableError';
  }
}

/**
 * Récupère le cliché courant des alertes (admin/dispatcher).
 * Uniquement en mode VPS : le calcul fait foi côté serveur sur les vraies
 * commandes — pas de simulation mock (aucune anomalie inventée).
 */
export async function fetchOperations(): Promise<OpsSnapshot> {
  if (!USE_VPS) throw new OperationsUnavailableError();
  const res = await fetch('/api/admin/operations', { headers: authHeader() });
  if (res.status === 403) throw new Error('Accès refusé (permission operations.view requise).');
  if (!res.ok) throw new Error('Impossible de charger le Centre Opérations.');
  return (await res.json()) as OpsSnapshot;
}

/** Trace « pris en charge » une commande en anomalie (dispatcher). */
export async function handleOrder(orderId: string, note?: string): Promise<void> {
  if (!USE_VPS) throw new OperationsUnavailableError();
  const res = await fetch(`/api/admin/operations/${encodeURIComponent(orderId)}/handle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ note: note || undefined }),
  });
  if (!res.ok) throw new Error('Impossible de tracer la prise en charge.');
}

/** Annule la prise en charge (rouvre l'alerte comme non traitée). */
export async function unhandleOrder(orderId: string): Promise<void> {
  if (!USE_VPS) throw new OperationsUnavailableError();
  const res = await fetch(`/api/admin/operations/${encodeURIComponent(orderId)}/handle`, {
    method: 'DELETE',
    headers: authHeader(),
  });
  if (!res.ok) throw new Error('Impossible d\'annuler la prise en charge.');
}
