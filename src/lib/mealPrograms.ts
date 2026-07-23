// Module Alimentaire (série FOOD) — programmes repas. Mode VPS.
const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

export type ProgramStatus = 'draft' | 'published' | 'archived';
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
export const setProgramStatus = (id: string, status: ProgramStatus) =>
  call<MealProgram>(`/api/meal-programs/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ status }) });
