import { supabase, isSupabaseConfigured, isSupabaseAuthenticated } from './supabase';

export type ApplicationType = 'restaurant' | 'livreur';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface ApplicationInput {
  type: ApplicationType;
  restaurantName?: string;
  /** Slug URL-friendly pour le restaurant (généré depuis le nom, éditable avant soumission). Définitif après soumission. */
  restaurantSlug?: string;
  city?: string;
  address?: string;
  contactPhone?: string;
  notes?: string;
  // Zones desservies (livreur only) — vide/absent = dessert toute la ville.
  serviceNeighborhoods?: string[];
  // Documents (base64 data URLs)
  idDocument?: string;        // CNI/passeport
  businessReg?: string;        // Registre de commerce (restaurant only)
  licenseDocument?: string;    // Permis de conduire (livreur only)
  insuranceDocument?: string;  // Assurance (livreur only)
  profilePhoto?: string;       // Photo de profil
  vehiclePhoto?: string;       // Photo du véhicule (livreur only)
  restaurantPhoto?: string;    // Photo du restaurant (restaurant only)
  lat?: number;                // Coordonnées GPS (obligatoire restaurant)
  lng?: number;                // Coordonnées GPS (obligatoire restaurant)
}

export interface Application extends ApplicationInput {
  id: string;
  applicantId: string;
  status: ApplicationStatus;
  restaurantId?: string | null;
  rejectionReason?: string;
  createdAt: string;
}

const LOCAL_APPLICATIONS_KEY = 'yamo_local_applications';
const LOCAL_USERS_KEY = 'yamo_local_users'; // shared with AuthContext

function readLocalApplications(): Application[] {
  const raw = localStorage.getItem(LOCAL_APPLICATIONS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function writeLocalApplications(apps: Application[]) {
  localStorage.setItem(LOCAL_APPLICATIONS_KEY, JSON.stringify(apps));
}

function mapApplicationRow(row: Record<string, unknown>): Application {
  return {
    id: row.id as string,
    applicantId: row.applicant_id as string,
    type: row.type as ApplicationType,
    status: row.status as ApplicationStatus,
    restaurantName: (row.restaurant_name as string) ?? undefined,
    city: (row.city as string) ?? undefined,
    address: (row.address as string) ?? undefined,
    contactPhone: (row.contact_phone as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    restaurantId: (row.restaurant_id as string) ?? null,
    rejectionReason: (row.rejection_reason as string) ?? undefined,
    idDocument: (row.id_document as string) ?? undefined,
    businessReg: (row.business_reg as string) ?? undefined,
    licenseDocument: (row.license_document as string) ?? undefined,
    insuranceDocument: (row.insurance_document as string) ?? undefined,
    profilePhoto: (row.profile_photo as string) ?? undefined,
    vehiclePhoto: (row.vehicle_photo as string) ?? undefined,
    restaurantPhoto: (row.restaurant_photo as string) ?? undefined,
    serviceNeighborhoods: (row.service_neighborhoods as string[]) ?? undefined,
    lat: (row.lat as number) ?? undefined,
    lng: (row.lng as number) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function submitApplication(applicantId: string, input: ApplicationInput): Promise<Application> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data, error } = await supabase
      .from('applications')
      .insert({
        applicant_id: applicantId,
        type: input.type,
        restaurant_name: input.restaurantName ?? null,
        city: input.city ?? null,
        address: input.address ?? null,
        contact_phone: input.contactPhone ?? null,
        notes: input.notes ?? null,
        id_document: input.idDocument ?? null,
        business_reg: input.businessReg ?? null,
        license_document: input.licenseDocument ?? null,
        insurance_document: input.insuranceDocument ?? null,
        profile_photo: input.profilePhoto ?? null,
        vehicle_photo: input.vehiclePhoto ?? null,
        restaurant_photo: input.restaurantPhoto ?? null,
        service_neighborhoods: input.serviceNeighborhoods?.length ? input.serviceNeighborhoods : null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
      })
      .select()
      .single();
    if (error || !data) throw error ?? new Error('Application submission failed');
    return mapApplicationRow(data);
  }

  const app: Application = {
    id: crypto.randomUUID(),
    applicantId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...input,
  };
  const apps = readLocalApplications();
  writeLocalApplications([app, ...apps]);
  return app;
}

export async function fetchMyApplications(applicantId: string): Promise<Application[]> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('applicant_id', applicantId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapApplicationRow);
  }
  return readLocalApplications().filter((a) => a.applicantId === applicantId);
}

export async function fetchAllApplications(): Promise<Application[]> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapApplicationRow);
  }
  return readLocalApplications();
}

function markLocalUserApproved(applicantId: string, zone?: { city?: string; serviceNeighborhoods?: string[] }) {
  const raw = localStorage.getItem(LOCAL_USERS_KEY);
  const registry = raw ? JSON.parse(raw) : {};
  for (const phone of Object.keys(registry)) {
    if (registry[phone].id === applicantId) {
      registry[phone].isApproved = true;
      if (zone) {
        registry[phone].city = zone.city ?? null;
        registry[phone].serviceNeighborhoods = zone.serviceNeighborhoods?.length ? zone.serviceNeighborhoods : null;
      }
    }
  }
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(registry));
}

function restaurantAddress(app: Pick<Application, 'address' | 'city'>) {
  return [app.address, app.city].filter(Boolean).join(', ') || 'Adresse à compléter';
}

export async function approveApplication(id: string, restaurantId?: string): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    // NB: `applications.service_neighborhoods` was added by a migration that
    // was never applied to the live schema — requesting it here would fail
    // the whole select with a hard "column does not exist" error (unlike a
    // plain `select('*')`, PostgREST rejects the entire query when an
    // explicitly named column is missing). Omitted; see profiles update below.
    const { data: app, error: fetchError } = await supabase
      .from('applications')
      .select('applicant_id, type, restaurant_name, city, address, contact_phone, notes')
      .eq('id', id)
      .single();
    if (fetchError || !app) throw fetchError ?? new Error('Application not found');

    let assignedRestaurantId = restaurantId ?? null;

    if (app.type === 'restaurant') {
      if (assignedRestaurantId) {
        const { error: restaurantError } = await supabase
          .from('restaurants')
          .update({ owner_id: app.applicant_id })
          .eq('id', assignedRestaurantId);
        if (restaurantError) throw restaurantError;
      } else {
        const { data: restaurant, error: restaurantError } = await supabase
          .from('restaurants')
          .insert({
            owner_id: app.applicant_id,
            name: app.restaurant_name || 'Restaurant sans nom',
            image: '/partner-kitchen.jpg',
            category: 'Camerounaise',
            rating: 0,
            review_count: 0,
            delivery_time: '30-45 min',
            delivery_fee: 0,
            min_order: 0,
            price_range: '$$',
            address: restaurantAddress(app),
            phone: app.contact_phone ?? null,
            hours: '08:00 - 22:00',
            is_open: false,
            is_premium: false,
            tags: app.city ? [app.city] : [],
            description: app.notes || 'Restaurant partenaire MiamExpress. Informations à compléter.',
          })
          .select('id')
          .single();
        if (restaurantError || !restaurant) throw restaurantError ?? new Error('Restaurant creation failed');
        assignedRestaurantId = restaurant.id;
      }
    }

    // Livreur : la ville/zones de la candidature deviennent la zone de service —
    // c'est ce qui borne les livraisons visibles/acceptables pour ce compte
    // (voir fetchAvailableDeliveries + trigger deliveries_check_driver_zone).
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        is_approved: true,
        ...(app.type === 'livreur' ? { city: app.city ?? null } : {}),
      })
      .eq('id', app.applicant_id);
    if (profileError) {
      // PGRST204 = PostgREST's schema cache doesn't know about this column
      // yet (stale cache after a migration was applied directly, outside the
      // CLI's tracked flow) — not a real absence. Retry without `city` so
      // approval itself isn't blocked; the driver just won't have a
      // pre-filled service zone until the cache catches up.
      if (profileError.code === 'PGRST204' && app.type === 'livreur') {
        const { error: retryError } = await supabase
          .from('profiles')
          .update({ is_approved: true })
          .eq('id', app.applicant_id);
        if (retryError) throw retryError;
      } else {
        throw profileError;
      }
    }

    const { error: appError } = await supabase
      .from('applications')
      .update({ status: 'approved', restaurant_id: assignedRestaurantId, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (appError) throw appError;
    return;
  }

  const apps = readLocalApplications();
  const target = apps.find((a) => a.id === id);
  if (!target) return;
  markLocalUserApproved(
    target.applicantId,
    target.type === 'livreur' ? { city: target.city, serviceNeighborhoods: target.serviceNeighborhoods } : undefined
  );
  writeLocalApplications(
    apps.map((a) => (a.id === id ? { ...a, status: 'approved' as const, restaurantId: restaurantId ?? null } : a))
  );
}

export async function rejectApplication(id: string, reason?: string): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { error } = await supabase
      .from('applications')
      .update({ status: 'rejected', rejection_reason: reason ?? null, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return;
  }

  const apps = readLocalApplications();
  writeLocalApplications(apps.map((a) => (a.id === id ? { ...a, status: 'rejected' as const, rejectionReason: reason } : a)));
}
