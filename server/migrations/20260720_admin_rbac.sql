-- MiamExpress - Administration RBAC et audit
-- Date: 2026-07-20
-- Migration idempotente. Les definitions exactes roles/permissions sont aussi
-- synchronisees au demarrage API via server/src/admin-rbac.js.

CREATE TABLE IF NOT EXISTS admin_roles (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  code TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  description TEXT,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_code TEXT NOT NULL REFERENCES admin_roles(code) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES admin_permissions(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE IF NOT EXISTS admin_user_roles (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  role_code TEXT NOT NULL REFERENCES admin_roles(code) ON DELETE RESTRICT,
  scope_type TEXT NOT NULL DEFAULT 'global',
  scope_value TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, role_code, scope_type, scope_value)
);

CREATE INDEX IF NOT EXISTS admin_user_roles_user_idx
  ON admin_user_roles(admin_user_id);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id TEXT,
  admin_role_codes TEXT[] NOT NULL DEFAULT '{}',
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx
  ON admin_audit_logs(target_type, target_id);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx
  ON admin_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS admin_notes (
  id BIGSERIAL PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  note TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'internal',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

