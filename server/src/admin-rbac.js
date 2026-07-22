const ADMIN_ROLES = [
  { code: 'super_admin', name: 'Super Admin', description: 'Acces total a la plateforme, aux roles et aux actions critiques.', level: 100 },
  { code: 'admin_general', name: 'Admin General', description: 'Pilotage operationnel global sans gestion des roles sensibles.', level: 90 },
  { code: 'city_manager', name: 'Responsable Ville', description: 'Gestion operationnelle limitee a une ou plusieurs villes.', level: 80 },
  { code: 'restaurant_manager', name: 'Gestion Restaurants', description: 'Onboarding, validation et suivi qualite des restaurants.', level: 70 },
  { code: 'courier_manager', name: 'Gestion Livreurs', description: 'Onboarding, validation et suivi qualite des livreurs.', level: 70 },
  { code: 'support_agent', name: 'Support Client', description: 'Assistance clients, commandes et litiges simples.', level: 60 },
  { code: 'dispatcher', name: 'Dispatcher Commandes', description: 'Pilotage temps reel des commandes et assignations livreurs.', level: 60 },
  { code: 'finance_manager', name: 'Finance / Comptabilite', description: 'Paiements, commissions, remboursements et exports financiers.', level: 75 },
  { code: 'quality_moderator', name: 'Moderation & Qualite', description: 'Avis, signalements, moderation et qualite de service.', level: 55 },
  { code: 'readonly_analyst', name: 'Analyste Lecture Seule', description: 'Reporting et observation sans modification.', level: 30 },
];

const PERMISSIONS = [
  ['dashboard.view', 'dashboard', 'Voir le tableau de bord admin', false],
  ['applications.view', 'applications', 'Voir les candidatures restaurants/livreurs', false],
  ['applications.approve', 'applications', 'Approuver une candidature', true],
  ['applications.reject', 'applications', 'Rejeter une candidature', true],
  ['restaurants.view', 'restaurants', 'Voir les restaurants', false],
  ['restaurants.create', 'restaurants', 'Creer un restaurant', true],
  ['restaurants.create_approved', 'restaurants', 'Creer et valider directement un restaurant', true],
  ['restaurants.update_profile', 'restaurants', 'Modifier le profil operationnel restaurant', true],
  ['restaurants.update_menu', 'restaurants', 'Modifier le catalogue/menu restaurant', true],
  ['restaurants.approve', 'restaurants', 'Valider un restaurant', true],
  ['restaurants.reject', 'restaurants', 'Rejeter un restaurant', true],
  ['restaurants.suspend', 'restaurants', 'Suspendre un restaurant', true],
  ['restaurants.reactivate', 'restaurants', 'Reactiver un restaurant', true],
  ['couriers.view', 'couriers', 'Voir les livreurs', false],
  ['couriers.create', 'couriers', 'Creer un livreur', true],
  ['couriers.create_approved', 'couriers', 'Creer et valider directement un livreur', true],
  ['couriers.update_profile', 'couriers', 'Modifier le profil operationnel livreur', true],
  ['couriers.approve', 'couriers', 'Valider un livreur', true],
  ['couriers.reject', 'couriers', 'Rejeter un livreur', true],
  ['couriers.suspend', 'couriers', 'Suspendre un livreur', true],
  ['couriers.reactivate', 'couriers', 'Reactiver un livreur', true],
  ['couriers.payouts.update', 'couriers', 'Traiter les demandes de virement livreur', true],
  ['customers.view', 'customers', 'Voir les clients', false],
  ['customers.view_new', 'customers', 'Voir les nouveaux clients', false],
  ['customers.update_profile', 'customers', 'Modifier les informations support client', true],
  ['customers.block', 'customers', 'Bloquer un client', true],
  ['customers.unblock', 'customers', 'Debloquer un client', true],
  ['orders.view', 'orders', 'Voir les commandes', false],
  ['orders.view_live', 'orders', 'Voir le flux temps reel des commandes', false],
  ['orders.assign_courier', 'orders', 'Assigner ou reassigner un livreur', true],
  ['orders.update_status', 'orders', 'Modifier un statut operationnel de commande', true],
  ['orders.cancel', 'orders', 'Annuler une commande', true],
  ['orders.disputes.resolve', 'orders', 'Traiter les litiges de commande', true],
  ['operations.view', 'operations', 'Acceder au Centre Operations (anomalies SLA)', false],
  ['operations.handle', 'operations', 'Tracer la prise en charge d\'une anomalie', true],
  ['reviews.view', 'reviews', 'Voir les avis et resumes', false],
  ['reviews.moderate', 'reviews', 'Moderation des avis', true],
  ['reviews.reply', 'reviews', 'Repondre ou moderer une reponse avis', true],
  ['reviews.recalculate', 'reviews', 'Recalculer les resumes avis depuis la base', true],
  ['finance.dashboard.view', 'finance', 'Voir les tableaux financiers', false],
  ['finance.refunds.approve', 'finance', 'Approuver un remboursement', true],
  ['finance.commissions.update', 'finance', 'Modifier les commissions', true],
  ['finance.payouts.update', 'finance', 'Traiter les paiements sortants', true],
  ['finance.export', 'finance', 'Exporter les donnees financieres', true],
  ['points.manage', 'points', 'Gerer cautions, points et recharges restaurants', true],
  ['zones.manage', 'zones', 'Gerer villes, quartiers et zones desactivees', true],
  ['delivery_fees.manage', 'delivery_fees', 'Gerer les frais de livraison', true],
  ['media.manage', 'media', 'Gerer la mediatheque', true],
  ['dishes.manage', 'dishes', 'Gerer le catalogue de plats', true],
  ['trash.manage', 'trash', 'Gerer la corbeille et restaurations', true],
  ['quotas.manage', 'quotas', 'Gerer les quotas de comptes', true],
  ['admin.roles.view', 'administration', 'Voir roles, permissions et affectations', false],
  ['admin.roles.update', 'administration', 'Modifier les roles administrateurs', true],
  ['admin.users.update', 'administration', 'Modifier des comptes utilisateurs depuis admin', true],
  ['admin.users.password', 'administration', 'Reinitialiser un mot de passe utilisateur', true],
  ['audit.view', 'audit', 'Voir les journaux audit', false],
  ['admin.delete', 'administration', 'Suppression definitive via API admin', true],
];

const ALL_PERMISSION_CODES = PERMISSIONS.map(([code]) => code);

const ROLE_PERMISSIONS = {
  super_admin: ALL_PERMISSION_CODES,
  admin_general: ALL_PERMISSION_CODES.filter((code) => ![
    'admin.roles.update',
    'admin.delete',
  ].includes(code)),
  city_manager: [
    'dashboard.view', 'applications.view', 'applications.approve', 'applications.reject',
    'restaurants.view', 'restaurants.update_profile', 'restaurants.update_menu',
    'restaurants.approve', 'restaurants.reject', 'restaurants.suspend', 'restaurants.reactivate',
    'couriers.view', 'couriers.update_profile', 'couriers.approve', 'couriers.reject',
    'couriers.suspend', 'couriers.reactivate',
    'customers.view', 'customers.view_new', 'customers.update_profile', 'customers.block', 'customers.unblock',
    'orders.view', 'orders.view_live', 'orders.assign_courier', 'orders.update_status',
    'orders.cancel', 'orders.disputes.resolve', 'operations.view', 'operations.handle',
    'reviews.view', 'reviews.moderate', 'dishes.manage', 'media.manage', 'audit.view',
  ],
  restaurant_manager: [
    'dashboard.view', 'applications.view', 'applications.approve', 'applications.reject',
    'restaurants.view', 'restaurants.create', 'restaurants.create_approved',
    'restaurants.update_profile', 'restaurants.update_menu', 'restaurants.approve',
    'restaurants.reject', 'restaurants.suspend', 'restaurants.reactivate',
    'orders.view', 'reviews.view', 'dishes.manage', 'media.manage', 'audit.view',
  ],
  courier_manager: [
    'dashboard.view', 'applications.view', 'applications.approve', 'applications.reject',
    'couriers.view', 'couriers.create', 'couriers.create_approved', 'couriers.update_profile',
    'couriers.approve', 'couriers.reject', 'couriers.suspend', 'couriers.reactivate',
    'couriers.payouts.update', 'orders.view', 'orders.view_live', 'reviews.view', 'audit.view',
  ],
  support_agent: [
    'dashboard.view', 'customers.view', 'customers.view_new', 'customers.update_profile',
    'customers.block', 'customers.unblock', 'orders.view', 'orders.cancel',
    'orders.disputes.resolve', 'operations.view', 'reviews.view', 'restaurants.view', 'couriers.view',
  ],
  dispatcher: [
    'dashboard.view', 'orders.view', 'orders.view_live', 'orders.assign_courier',
    'orders.update_status', 'orders.cancel', 'orders.disputes.resolve',
    'operations.view', 'operations.handle',
    'couriers.view', 'customers.view', 'restaurants.view',
  ],
  finance_manager: [
    'dashboard.view', 'orders.view', 'customers.view', 'restaurants.view', 'couriers.view',
    'finance.dashboard.view', 'finance.refunds.approve', 'finance.commissions.update',
    'finance.payouts.update', 'finance.export', 'points.manage', 'delivery_fees.manage', 'audit.view',
  ],
  quality_moderator: [
    'dashboard.view', 'reviews.view', 'reviews.moderate', 'reviews.reply',
    'restaurants.view', 'couriers.view', 'customers.view', 'orders.view', 'audit.view',
  ],
  readonly_analyst: [
    'dashboard.view', 'applications.view', 'restaurants.view', 'couriers.view',
    'customers.view', 'customers.view_new', 'orders.view', 'reviews.view',
    'finance.dashboard.view',
  ],
};

let schemaReady = false;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function adminRoleDefinitions() {
  return ADMIN_ROLES.map((role) => ({ ...role }));
}

export function adminPermissionDefinitions() {
  return PERMISSIONS.map(([code, module, description, isSensitive]) => ({
    code,
    module,
    description,
    isSensitive,
  }));
}

export function rolePermissionMap() {
  return Object.fromEntries(Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => [role, [...permissions]]));
}

export async function ensureAdminRbacSchema(pool) {
  if (schemaReady) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
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

      CREATE INDEX IF NOT EXISTS admin_user_roles_user_idx ON admin_user_roles(admin_user_id);

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

      CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx ON admin_audit_logs(target_type, target_id);
      CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs(created_at DESC);

      CREATE TABLE IF NOT EXISTS admin_notes (
        id BIGSERIAL PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        note TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'internal',
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    for (const role of ADMIN_ROLES) {
      await client.query(
        `INSERT INTO admin_roles (code, name, description, level, is_system, updated_at)
         VALUES ($1, $2, $3, $4, true, now())
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           level = EXCLUDED.level,
           updated_at = now()`,
        [role.code, role.name, role.description, role.level]
      );
    }

    for (const [code, module, description, isSensitive] of PERMISSIONS) {
      await client.query(
        `INSERT INTO admin_permissions (code, module, description, is_sensitive)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET
           module = EXCLUDED.module,
           description = EXCLUDED.description,
           is_sensitive = EXCLUDED.is_sensitive`,
        [code, module, description, isSensitive]
      );
    }

    await client.query('DELETE FROM admin_role_permissions WHERE role_code = ANY($1::text[])', [ADMIN_ROLES.map((r) => r.code)]);
    for (const [roleCode, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      for (const permissionCode of permissions) {
        await client.query(
          `INSERT INTO admin_role_permissions (role_code, permission_code)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [roleCode, permissionCode]
        );
      }
    }

    await client.query(`
      INSERT INTO admin_user_roles (admin_user_id, role_code, scope_type, scope_value, created_by)
      SELECT u.id::text, 'super_admin', 'global', NULL, 'bootstrap'
      FROM users u
      WHERE u.role = 'admin'
        AND NOT EXISTS (
          SELECT 1 FROM admin_user_roles aur WHERE aur.admin_user_id = u.id::text
        )
    `);

    await client.query('COMMIT');
    schemaReady = true;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function loadAdminAccess(pool, userId) {
  if (!userId) {
    return {
      isAdmin: false,
      isSuperAdmin: false,
      roleCodes: [],
      permissions: [],
      scopes: [],
      primaryRoleCode: null,
      primaryRoleName: null,
    };
  }

  await ensureAdminRbacSchema(pool);

  const { rows: [user] } = await pool.query('SELECT id, role FROM users WHERE id::text = $1 LIMIT 1', [String(userId)]);
  if (!user || user.role !== 'admin') {
    return {
      isAdmin: false,
      isSuperAdmin: false,
      roleCodes: [],
      permissions: [],
      scopes: [],
      primaryRoleCode: null,
      primaryRoleName: null,
    };
  }

  const { rows: roleRows } = await pool.query(
    `SELECT aur.id, aur.admin_user_id, aur.role_code, aur.scope_type, aur.scope_value,
            ar.name AS role_name, ar.level
     FROM admin_user_roles aur
     JOIN admin_roles ar ON ar.code = aur.role_code
     WHERE aur.admin_user_id = $1
     ORDER BY ar.level DESC, ar.name ASC`,
    [String(userId)]
  );

  const roleCodes = [...new Set(roleRows.map((row) => row.role_code))];
  const isSuperAdmin = roleCodes.includes('super_admin');
  const permissions = new Set();

  if (roleCodes.length) {
    const { rows: permissionRows } = await pool.query(
      `SELECT DISTINCT permission_code FROM admin_role_permissions WHERE role_code = ANY($1::text[])`,
      [roleCodes]
    );
    for (const row of permissionRows) permissions.add(row.permission_code);
  }

  if (isSuperAdmin) {
    for (const code of ALL_PERMISSION_CODES) permissions.add(code);
  }

  return {
    isAdmin: true,
    isSuperAdmin,
    roleCodes,
    permissions: [...permissions].sort(),
    scopes: roleRows.map((row) => ({
      roleCode: row.role_code,
      roleName: row.role_name,
      scopeType: row.scope_type,
      scopeValue: row.scope_value,
    })),
    primaryRoleCode: roleRows[0]?.role_code ?? null,
    primaryRoleName: roleRows[0]?.role_name ?? null,
  };
}

export function hasAdminAccessPermission(access, permission) {
  if (!permission) return true;
  if (!access?.isAdmin) return false;
  if (access.isSuperAdmin) return true;
  return asArray(access.permissions).includes(permission);
}

export async function listAdminUsers(pool) {
  await ensureAdminRbacSchema(pool);
  const { rows } = await pool.query(
    `SELECT
       u.id,
       u.phone,
       u.full_name,
       u.city,
       u.is_suspended,
       u.created_at,
       COALESCE(
         json_agg(json_build_object(
           'assignmentId', aur.id,
           'roleCode', aur.role_code,
           'roleName', ar.name,
           'scopeType', aur.scope_type,
           'scopeValue', aur.scope_value
         ) ORDER BY ar.level DESC, ar.name ASC) FILTER (WHERE aur.id IS NOT NULL),
         '[]'::json
       ) AS roles
     FROM users u
     LEFT JOIN admin_user_roles aur ON aur.admin_user_id = u.id::text
     LEFT JOIN admin_roles ar ON ar.code = aur.role_code
     WHERE u.role = 'admin'
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  );
  return rows;
}

export async function replaceAdminUserRoles(pool, { adminUserId, assignments, changedBy }) {
  await ensureAdminRbacSchema(pool);
  const cleanAssignments = asArray(assignments)
    .map((assignment) => ({
      roleCode: String(assignment.roleCode || '').trim(),
      scopeType: String(assignment.scopeType || 'global').trim() || 'global',
      scopeValue: assignment.scopeType === 'global' ? null : (String(assignment.scopeValue || '').trim() || null),
    }))
    .filter((assignment) => assignment.roleCode);

  if (!cleanAssignments.length) {
    const err = new Error('Au moins un role administrateur est requis.');
    err.status = 400;
    throw err;
  }

  const roleCodes = [...new Set(cleanAssignments.map((assignment) => assignment.roleCode))];
  const { rows: validRoles } = await pool.query('SELECT code FROM admin_roles WHERE code = ANY($1::text[])', [roleCodes]);
  const validSet = new Set(validRoles.map((row) => row.code));
  const invalid = roleCodes.filter((roleCode) => !validSet.has(roleCode));
  if (invalid.length) {
    const err = new Error(`Role invalide: ${invalid.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM admin_user_roles WHERE admin_user_id = $1', [String(adminUserId)]);
    for (const assignment of cleanAssignments) {
      await client.query(
        `INSERT INTO admin_user_roles (admin_user_id, role_code, scope_type, scope_value, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [String(adminUserId), assignment.roleCode, assignment.scopeType, assignment.scopeValue, changedBy ? String(changedBy) : null]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  return loadAdminAccess(pool, adminUserId);
}

export async function listAdminAuditLogs(pool, { limit = 100 } = {}) {
  await ensureAdminRbacSchema(pool);
  const safeLimit = Math.min(200, Math.max(1, parseInt(limit) || 100));
  const { rows } = await pool.query(
    `SELECT al.*, u.full_name AS admin_name, u.phone AS admin_phone
     FROM admin_audit_logs al
     LEFT JOIN users u ON u.id::text = al.admin_user_id
     ORDER BY al.created_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return rows;
}

export async function writeAdminAuditLog(pool, req, { action, targetType, targetId = null, oldValue = null, newValue = null, reason = null }) {
  try {
    await ensureAdminRbacSchema(pool);
    const adminAccess = req.adminAccess || (req.user?.role === 'admin' ? await loadAdminAccess(pool, req.user.sub) : null);
    await pool.query(
      `INSERT INTO admin_audit_logs (
         admin_user_id, admin_role_codes, action, target_type, target_id,
         old_value, new_value, reason, ip_address, user_agent
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        req.user?.sub ? String(req.user.sub) : null,
        asArray(adminAccess?.roleCodes),
        action,
        targetType,
        targetId == null ? null : String(targetId),
        oldValue == null ? null : JSON.stringify(oldValue),
        newValue == null ? null : JSON.stringify(newValue),
        reason || null,
        req.ip || req.headers['x-forwarded-for'] || null,
        req.headers['user-agent'] || null,
      ]
    );
  } catch (err) {
    console.warn('admin audit log skipped:', err.message);
  }
}
