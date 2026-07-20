import { isSupabaseConfigured } from './supabase';
import type { Order } from './orders';
import type { Application, ApplicationInput } from './applications';
import type { AdminRbacSummary } from './adminRbac';

const API_BASE: string = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'miamexpress_session';

export interface AdminCustomerRecord {
  id: string;
  phone: string;
  email?: string | null;
  name?: string | null;
  role: string;
  isApproved: boolean;
  isSuspended: boolean;
  suspensionReason?: string | null;
  city?: string | null;
  profilePhoto?: string;
  whatsapp?: string;
  savedAddresses: unknown[];
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  cancelledCount: number;
  orders: Order[];
}

export interface AdminCreateAccountInput extends ApplicationInput {
  name?: string;
  password?: string;
  neighborhood?: string;
  category?: string;
}

export interface AdminCreateAccountResult {
  user: Record<string, unknown>;
  application: Application;
  restaurant?: Record<string, unknown> | null;
  defaultPassword?: string;
}

function getToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw)?.access_token || null : null;
  } catch {
    return null;
  }
}

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur API (${res.status})`);
  return data as T;
}

function mapApplication(row: any): Application {
  return {
    id: String(row.id),
    applicantId: String(row.applicantId ?? row.applicant_id ?? ''),
    type: row.type,
    status: row.status,
    restaurantName: row.restaurantName ?? row.restaurant_name ?? undefined,
    restaurantSlug: row.restaurantSlug ?? row.restaurant_slug ?? undefined,
    city: row.city ?? undefined,
    address: row.address ?? undefined,
    contactPhone: row.contactPhone ?? row.contact_phone ?? undefined,
    notes: row.notes ?? undefined,
    restaurantId: row.restaurantId ?? row.restaurant_id ?? null,
    rejectionReason: row.rejectionReason ?? row.rejection_reason ?? undefined,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    applicantName: row.applicantName ?? row.applicant_name ?? undefined,
    applicantEmail: row.applicantEmail ?? row.applicant_email ?? row.email ?? undefined,
    serviceNeighborhoods: row.serviceNeighborhoods ?? row.service_neighborhoods ?? undefined,
  };
}

export async function fetchAdminCustomers(): Promise<AdminCustomerRecord[] | null> {
  if (!isSupabaseConfigured) return null;
  const payload = await apiJson<{ data: AdminCustomerRecord[] }>('/api/admin/customers');
  return payload.data ?? [];
}

export async function setAdminCustomerSuspended(id: string, isSuspended: boolean, reason?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  await apiJson(`/api/admin/customers/${encodeURIComponent(id)}/suspension`, {
    method: 'PATCH',
    body: JSON.stringify({ isSuspended, reason }),
  });
  return true;
}

export async function setAdminUserPassword(id: string, password: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  await apiJson(`/api/admin/users/${encodeURIComponent(id)}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  });
  return true;
}

export async function approveAdminApplication(id: string, restaurantId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  await apiJson(`/api/admin/applications/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ restaurantId: restaurantId || null }),
  });
  return true;
}

export async function rejectAdminApplication(id: string, reason?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  await apiJson(`/api/admin/applications/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return true;
}
export async function createAdminAccount(input: AdminCreateAccountInput): Promise<AdminCreateAccountResult | null> {
  if (!isSupabaseConfigured) return null;
  const payload = await apiJson<{ user: Record<string, unknown>; application: unknown; restaurant?: Record<string, unknown> | null; defaultPassword?: string }>('/api/admin/accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return {
    user: payload.user,
    application: mapApplication(payload.application),
    restaurant: payload.restaurant ?? null,
    defaultPassword: payload.defaultPassword,
  };
}
export async function fetchAdminRbacSummary(): Promise<AdminRbacSummary | null> {
  if (!isSupabaseConfigured) return null;
  const payload = await apiJson<{ data: AdminRbacSummary }>('/api/admin/rbac/summary');
  return payload.data;
}

export async function updateAdminUserRoles(
  userId: string,
  assignments: { roleCode: string; scopeType: string; scopeValue?: string | null }[],
  reason?: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  await apiJson(`/api/admin/rbac/users/${encodeURIComponent(userId)}/roles`, {
    method: 'PUT',
    body: JSON.stringify({ assignments, reason }),
  });
  return true;
}
