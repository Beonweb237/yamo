// Module Alimentaire (série FOOD) — profil alimentaire client. Double chemin VPS/mock.
const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';
const LS_KEY = 'yamo_food_profile';

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

export type FoodObjective = 'perte_poids' | 'maintien' | 'prise_masse' | 'equilibre';

export interface FoodProfile {
  healthConditions: string[];
  preferences: string[];        // ids de DIETARY_TAG_META
  allergies: string;
  objective: FoodObjective | null;
  forbiddenFoods: string;
}

export const EMPTY_FOOD_PROFILE: FoodProfile = {
  healthConditions: [], preferences: [], allergies: '', objective: null, forbiddenFoods: '',
};

export const HEALTH_CONDITIONS: { id: string; label: string }[] = [
  { id: 'diabete', label: 'Diabète' },
  { id: 'hypertension', label: 'Hypertension' },
  { id: 'cholesterol', label: 'Cholestérol' },
  { id: 'intolerance_lactose', label: 'Intolérance au lactose' },
  { id: 'intolerance_gluten', label: 'Intolérance au gluten' },
];

export const FOOD_OBJECTIVES: { id: FoodObjective; label: string }[] = [
  { id: 'perte_poids', label: 'Perdre du poids' },
  { id: 'maintien', label: 'Maintenir mon poids' },
  { id: 'prise_masse', label: 'Prendre du muscle' },
  { id: 'equilibre', label: 'Alimentation équilibrée' },
];

/** Le profil alimentaire est-il renseigné (au moins un critère) ? */
export function hasFoodProfile(p: FoodProfile | null): boolean {
  return !!p && (p.healthConditions.length > 0 || p.preferences.length > 0
    || !!p.allergies?.trim() || !!p.objective || !!p.forbiddenFoods?.trim());
}

function fromRow(row: unknown): FoodProfile {
  const r = (row || {}) as Record<string, unknown>;
  return {
    healthConditions: Array.isArray(r.healthConditions) ? r.healthConditions as string[] : [],
    preferences: Array.isArray(r.preferences) ? r.preferences as string[] : [],
    allergies: (r.allergies as string) || '',
    objective: (r.objective as FoodObjective) || null,
    forbiddenFoods: (r.forbiddenFoods as string) || '',
  };
}

export async function fetchFoodProfile(): Promise<FoodProfile> {
  if (USE_VPS) {
    try {
      const res = await fetch('/api/food-profile', { headers: authHeader() });
      if (res.ok) {
        const j = await res.json();
        return j ? fromRow(j) : { ...EMPTY_FOOD_PROFILE };
      }
    } catch { /* repli local */ }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...EMPTY_FOOD_PROFILE, ...JSON.parse(raw) } : { ...EMPTY_FOOD_PROFILE };
  } catch { return { ...EMPTY_FOOD_PROFILE }; }
}

export async function saveFoodProfile(p: FoodProfile): Promise<void> {
  if (USE_VPS) {
    const res = await fetch('/api/food-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(p),
    });
    if (res.ok) { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* ignore */ } return; }
    throw new Error('Enregistrement du profil alimentaire impossible.');
  }
  localStorage.setItem(LS_KEY, JSON.stringify(p));
}
