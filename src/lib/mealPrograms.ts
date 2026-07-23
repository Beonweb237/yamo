// Module Alimentaire (série FOOD) — programmes repas. Mode VPS.
const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

// Modération : brouillon → (resto soumet) en_validation → (admin) validé/refusé
// → (resto) publié. L'admin peut ajuster mais ne publie jamais à la place du resto.
export type ProgramStatus = 'draft' | 'pending_review' | 'validated' | 'rejected' | 'published' | 'archived';
export interface ProgramSchedule { frequence?: 'quotidien' | 'hebdomadaire'; jours?: string[] }

/** Plat d'exemple choisi par le resto (LOT 5) — id du menu_item si connu. */
export interface SampleMenuEntry { id?: string; name: string; price?: number }

export interface MealProgram {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  targetAudience: string | null;
  dietaryTags: string[];
  durationWeeks: number;
  mealsCount: number;
  schedule: ProgramSchedule;
  priceFcfa: number;
  photoUrl: string | null;
  status: ProgramStatus;
  /** Modération : note de l'admin, motif de refus, indicateur d'ajustement admin. */
  reviewNote?: string | null;
  rejectionReason?: string | null;
  adjustedByAdmin?: boolean;
  reviewedAt?: string | null;
  /** LOT 5 : bénéfices saisis par le resto (sinon dérivés des tags côté fiche). */
  benefits?: string[] | null;
  /** LOT 5 : plats d'exemple choisis par le resto (sinon dérivés des tags). */
  sampleMenu?: SampleMenuEntry[] | null;
  restaurantName?: string;
  restaurantCity?: string;
  restaurantImage?: string | null;
  restaurantPhone?: string;
}

export interface MealProgramInput {
  restaurantId?: string;
  name: string; description?: string; targetAudience?: string;
  dietaryTags?: string[]; durationWeeks?: number; mealsCount?: number;
  schedule?: ProgramSchedule; priceFcfa?: number; photoUrl?: string | null;
  benefits?: string[]; sampleMenu?: SampleMenuEntry[] | null;
}

export class FoodUnavailableError extends Error {
  constructor() { super('Le module alimentaire nécessite le backend (mode VPS).'); this.name = 'FoodUnavailableError'; }
}

async function call<T>(path: string, init: RequestInit = {}, needAuth = true): Promise<T> {
  if (!USE_VPS) throw new FoodUnavailableError();
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(needAuth ? authHeader() : {}), ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur API (${res.status})`);
  return data as T;
}

export const fetchPrograms = (city?: string) =>
  call<MealProgram[]>(`/api/meal-programs${city ? `?city=${encodeURIComponent(city)}` : ''}`, {}, false);
export const fetchMyPrograms = () => call<MealProgram[]>('/api/meal-programs/mine');
export const fetchProgram = (id: string) => call<MealProgram>(`/api/meal-programs/${encodeURIComponent(id)}`, {}, false);
export const createProgram = (input: MealProgramInput) =>
  call<MealProgram>('/api/meal-programs', { method: 'POST', body: JSON.stringify(input) });
export const updateProgram = (id: string, input: MealProgramInput) =>
  call<MealProgram>(`/api/meal-programs/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) });
export const setProgramStatus = (id: string, status: 'published' | 'archived') =>
  call<MealProgram>(`/api/meal-programs/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ status }) });

/** Le restaurant soumet son programme à validation (brouillon/refusé → en validation). */
export const submitProgram = (id: string) =>
  call<MealProgram>(`/api/meal-programs/${encodeURIComponent(id)}/submit`, { method: 'POST' });

/** Admin : file des programmes à valider (+ compteurs). */
export const fetchProgramsForReview = (status?: ProgramStatus) =>
  call<{ programs: MealProgram[]; counts: Record<string, number> }>(
    `/api/admin/meal-programs${status ? `?status=${status}` : ''}`);

/** Admin : valider ou refuser (motif obligatoire au refus). Ne publie jamais. */
export const reviewProgram = (id: string, decision: 'validate' | 'reject', note?: string) =>
  call<MealProgram>(`/api/admin/meal-programs/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify({ decision, note }) });
