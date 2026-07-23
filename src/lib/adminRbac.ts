import type { AuthUser } from '../contexts/AuthContext';

export type AdminRoleCode =
  | 'super_admin'
  | 'admin_general'
  | 'city_manager'
  | 'restaurant_manager'
  | 'courier_manager'
  | 'support_agent'
  | 'dispatcher'
  | 'finance_manager'
  | 'quality_moderator'
  | 'readonly_analyst';

export interface AdminScope {
  roleCode: AdminRoleCode | string;
  roleName?: string | null;
  scopeType: 'global' | 'city' | 'zone' | 'restaurant' | 'team' | string;
  scopeValue?: string | null;
}

export interface AdminRoleDefinition {
  code: AdminRoleCode | string;
  name: string;
  description?: string;
  level?: number;
}

export interface AdminPermissionDefinition {
  code: string;
  module: string;
  description?: string;
  isSensitive?: boolean;
}

export interface AdminUserRoleAssignment {
  assignmentId?: number;
  roleCode: AdminRoleCode | string;
  roleName?: string;
  scopeType: string;
  scopeValue?: string | null;
}

export interface AdminUserAccessRecord {
  id: string;
  phone: string;
  fullName?: string | null;
  city?: string | null;
  isSuspended?: boolean;
  createdAt?: string;
  roles: AdminUserRoleAssignment[];
}

export interface AdminAuditLogRecord {
  id: number;
  adminUserId?: string | null;
  adminName?: string | null;
  adminPhone?: string | null;
  adminRoleCodes?: string[];
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface AdminRbacSummary {
  roles: AdminRoleDefinition[];
  permissions: AdminPermissionDefinition[];
  rolePermissions: Record<string, string[]>;
  admins: AdminUserAccessRecord[];
  auditLogs: AdminAuditLogRecord[];
}

export const ADMIN_ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin_general: 'Admin General',
  city_manager: 'Responsable Ville',
  restaurant_manager: 'Gestion Restaurants',
  courier_manager: 'Gestion Livreurs',
  support_agent: 'Support Client',
  dispatcher: 'Dispatcher Commandes',
  finance_manager: 'Finance / Comptabilite',
  quality_moderator: 'Moderation & Qualite',
  readonly_analyst: 'Analyste Lecture Seule',
};

export const ADMIN_ROUTE_PERMISSIONS: Record<string, string> = {
  '/admin/dashboard': 'dashboard.view',
  '/admin/applications': 'applications.view',
  '/admin/orders': 'orders.view',
  '/admin/restaurants': 'restaurants.view',
  '/admin/drivers': 'couriers.view',
  '/admin/disputes': 'orders.disputes.resolve',
  '/admin/dishes': 'dishes.manage',
  '/admin/zones': 'zones.manage',
  '/admin/delivery-fees': 'delivery_fees.manage',
  '/admin/media': 'media.manage',
  '/admin/customers': 'customers.view',
  '/admin/points': 'points.manage',
  '/admin/reviews': 'reviews.view',
  '/admin/trash': 'trash.manage',
  '/admin/quotas': 'quotas.manage',
  '/admin/roles': 'admin.roles.view',
  '/admin/operations': 'operations.view',
  '/admin/kyc': 'kyc.view',
  '/admin/finance': 'finance.dashboard.view',
  '/admin/apparence': 'appearance.manage',
};

export function hasAdminPermission(user: AuthUser | null | undefined, permission?: string): boolean {
  if (!permission) return true;
  if (!user || user.role !== 'admin') return false;
  if (user.isSuperAdmin || user.adminRoleCode === 'super_admin' || user.adminRoleCodes?.includes('super_admin')) return true;
  return Boolean(user.adminPermissions?.includes(permission));
}

export function hasAnyAdminPermission(user: AuthUser | null | undefined, permissions: string[] = []): boolean {
  if (!permissions.length) return true;
  return permissions.some((permission) => hasAdminPermission(user, permission));
}

export function primaryAdminRoleLabel(user: AuthUser | null | undefined): string {
  if (!user || user.role !== 'admin') return 'Administrateur';
  return user.adminRoleName || ADMIN_ROLE_LABELS[user.adminRoleCode || ''] || 'Administrateur';
}

export function canAccessAdminPath(user: AuthUser | null | undefined, path: string): boolean {
  const permission = ADMIN_ROUTE_PERMISSIONS[path];
  return hasAdminPermission(user, permission);
}

