// ═══════════════════════════════════════════════════════════════
// Gestion KYC (série KYC) — lib client
// ═══════════════════════════════════════════════════════════════
// Le « dossier KYC » = la ligne applications (relie user + restaurant). Chaque
// pièce (kyc_documents) porte son URL ET son verdict (validation pièce par pièce).
// Documents uploadés via processFormImage (/api/media). Mode VPS uniquement.

const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

export type ProfileType = 'restaurant' | 'livreur';
export type KycDossierStatus = 'incomplet' | 'a_verifier' | 'verifie' | 'rejete';
export type KycDocStatus = 'pending' | 'approved' | 'rejected';

// Pièces attendues par type (miroir de kyc-routes.js DOC_KEYS).
export const KYC_DOC_KEYS: Record<ProfileType, string[]> = {
  restaurant: ['id_document', 'business_reg', 'restaurant_photo', 'profile_photo'],
  livreur: ['id_document', 'license_document', 'insurance_document', 'profile_photo', 'vehicle_photo'],
};

// Pièces obligatoires (les autres sont recommandées mais facultatives).
export const KYC_DOC_REQUIRED: Record<ProfileType, string[]> = {
  restaurant: ['id_document', 'business_reg'],
  livreur: ['id_document', 'license_document'],
};

export const KYC_DOC_LABELS: Record<string, string> = {
  id_document: "Pièce d'identité (CNI/passeport)",
  business_reg: 'Registre de commerce',
  license_document: 'Permis de conduire',
  insurance_document: 'Assurance',
  profile_photo: 'Photo de profil',
  vehicle_photo: 'Photo du véhicule',
  restaurant_photo: "Photo de l'établissement",
};

export const KYC_STATUS_LABELS: Record<KycDossierStatus, string> = {
  incomplet: 'Incomplet',
  a_verifier: 'À vérifier',
  verifie: 'Vérifié',
  rejete: 'Rejeté',
};

export interface KycDocument {
  id: string;
  applicationId: string;
  docKey: string;
  url: string;
  status: KycDocStatus;
  note?: string | null;
  uploadedAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export interface KycListItem {
  applicationId: string;
  type: ProfileType;
  kycStatus: KycDossierStatus;
  name: string | null;
  restaurantName: string | null;
  phone: string | null;
  city: string | null;
  neighborhood: string | null;
  photoUrl: string | null;
  userId: string | null;
  restaurantId: string | null;
  docsTotal: number;
  docsApproved: number;
  docsRejected: number;
  docsPending: number;
  createdAt: string;
}

export interface KycListResponse {
  counts: Record<KycDossierStatus, number>;
  dossiers: KycListItem[];
}

export interface KycDossier {
  applicationId: string;
  type: ProfileType;
  kycStatus: KycDossierStatus;
  expectedDocKeys: string[];
  name: string | null;
  restaurantName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  category: string | null;
  serviceNeighborhoods: string[] | null;
  photoUrl: string | null;
  notes: string | null;
  userId: string | null;
  restaurantId: string | null;
  documents: KycDocument[];
}

export class KycUnavailableError extends Error {
  constructor() {
    super('La gestion KYC nécessite le backend (mode VPS).');
    this.name = 'KycUnavailableError';
  }
}

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!USE_VPS) throw new KycUnavailableError();
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 403) throw new Error('Accès refusé (permission KYC requise).');
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur API (${res.status})`);
  return data as T;
}

export function fetchKycList(): Promise<KycListResponse> {
  return json<KycListResponse>('/api/admin/kyc');
}

export function fetchKycDossier(applicationId: string): Promise<KycDossier> {
  return json<KycDossier>(`/api/admin/kyc/${encodeURIComponent(applicationId)}`);
}

/** Attache/remplace une pièce (URL déjà obtenue via processFormImage). */
export function attachKycDocument(applicationId: string, docKey: string, url: string): Promise<KycDocument> {
  return json<KycDocument>(`/api/admin/kyc/${encodeURIComponent(applicationId)}/documents`, {
    method: 'POST',
    body: JSON.stringify({ docKey, url }),
  });
}

export function deleteKycDocument(applicationId: string, docKey: string): Promise<void> {
  return json(`/api/admin/kyc/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(docKey)}`, { method: 'DELETE' })
    .then(() => undefined);
}

export function reviewKycDocument(applicationId: string, docKey: string, status: KycDocStatus, note?: string): Promise<KycDocument> {
  return json<KycDocument>(`/api/admin/kyc/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(docKey)}/review`, {
    method: 'POST',
    body: JSON.stringify({ status, note: note || undefined }),
  });
}

export function setKycDossierStatus(applicationId: string, status: KycDossierStatus): Promise<unknown> {
  return json(`/api/admin/kyc/${encodeURIComponent(applicationId)}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

/** Édition profil livreur (nom, tel, ville, quartiers). Resto → updateRestaurantProfile. */
export function updateUserProfile(userId: string, patch: {
  fullName?: string; phone?: string; city?: string; serviceNeighborhoods?: string[];
}): Promise<unknown> {
  return json(`/api/admin/users/${encodeURIComponent(userId)}/profile`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
