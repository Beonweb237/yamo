import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, Save, Users, KeyRound, Activity, MapPin, Lock, Eye } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader';
import { fetchAdminRbacSummary, updateAdminUserRoles } from '../../lib/admin';
import {
  ADMIN_ROLE_LABELS,
  type AdminRbacSummary,
  type AdminRoleDefinition,
  type AdminUserAccessRecord,
} from '../../lib/adminRbac';
import { useTranslation } from "react-i18next";

const scopeLabels: Record<string, string> = {
  global: 'Global',
  city: 'Ville',
  zone: 'Zone',
  restaurant: 'Restaurant',
  team: 'Equipe',
};

function roleLabel(role?: AdminRoleDefinition | null) {
  if (!role) return 'Role inconnu';
  return role.name || ADMIN_ROLE_LABELS[role.code] || role.code;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AdminRoles() {
    const { t } = useTranslation();
  const [summary, setSummary] = useState<AdminRbacSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState('support_agent');
  const [scopeType, setScopeType] = useState('global');
  const [scopeValue, setScopeValue] = useState('');
  const [reason, setReason] = useState('Mise a jour des privileges administrateur');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminRbacSummary();
      setSummary(data);
      const firstAdmin = data?.admins?.[0];
      if (!selectedAdminId && firstAdmin) setSelectedAdminId(firstAdmin.id);
    } catch (err) {
      toast.error((err as Error).message || 'Chargement RBAC impossible');
    } finally {
      setLoading(false);
    }
  }, [selectedAdminId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedAdmin = useMemo(
    () => summary?.admins.find((admin) => admin.id === selectedAdminId) ?? null,
    [summary, selectedAdminId]
  );

  useEffect(() => {
    if (!selectedAdmin?.roles?.length) return;
    const primary = selectedAdmin.roles[0];
    setRoleCode(primary.roleCode);
    setScopeType(primary.scopeType || 'global');
    setScopeValue(primary.scopeValue || '');
  }, [selectedAdmin]);

  const selectedRole = summary?.roles.find((role) => role.code === roleCode) ?? null;
  const selectedRolePermissions = summary?.rolePermissions?.[roleCode] ?? [];
  const permissionDetails = selectedRolePermissions
    .map((code) => summary?.permissions.find((permission) => permission.code === code))
    .filter(Boolean);

  const saveRole = async () => {
    if (!selectedAdmin) return;
    if (scopeType !== 'global' && !scopeValue.trim()) {
      toast.error('Précisez la ville, zone ou valeur du perimetre.');
      return;
    }
    setSaving(true);
    try {
      await updateAdminUserRoles(selectedAdmin.id, [{
        roleCode,
        scopeType,
        scopeValue: scopeType === 'global' ? null : scopeValue.trim(),
      }], reason.trim() || 'Mise a jour des roles admin');
      toast.success('Roles mis a jour');
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'Mise a jour impossible');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-text-secondary text-sm">{t("Chargement des roles...")}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-6 sm:p-8">
        <div className="bg-white border border-border-custom rounded-xl p-6">
          <h1 className="font-poppins font-bold text-text-primary text-xl mb-2">{t("RBAC indisponible")}</h1>
          <p className="text-text-secondary text-sm">{t("Cette page necessite l'API VPS.")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        icon={ShieldCheck}
        title="Rôles & accès"
        subtitle={`${summary.admins.length} administrateur${summary.admins.length > 1 ? 's' : ''} · ${summary.roles.length} profils`}
        action={
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-white text-sm font-inter bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2 backdrop-blur-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />{t("Actualiser")}
          </button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">
        <section className="bg-white rounded-xl border border-border-custom shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border-light flex items-center gap-2">
            <Users className="w-4 h-4 text-green-primary" />
            <h2 className="font-poppins font-semibold text-text-primary text-sm">{t("Administrateurs")}</h2>
          </div>
          <div className="divide-y divide-border-light">
            {summary.admins.map((admin) => {
              const active = selectedAdminId === admin.id;
              const primaryRole = admin.roles?.[0];
              return (
                <button
                  key={admin.id}
                  onClick={() => setSelectedAdminId(admin.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${active ? 'bg-green-light' : 'hover:bg-bg-secondary'}`}
                >
                  <p className="font-inter font-semibold text-text-primary text-sm">{admin.fullName || admin.phone}</p>
                  <p className="text-text-muted text-xs font-inter">{admin.phone}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-border-custom text-text-secondary">
                      {primaryRole?.roleName || ADMIN_ROLE_LABELS[primaryRole?.roleCode || ''] || 'Sans role'}
                    </span>
                    {primaryRole?.scopeType && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-border-custom text-text-muted">
                        {scopeLabels[primaryRole.scopeType] || primaryRole.scopeType}
                        {primaryRole.scopeValue ? `: ${primaryRole.scopeValue}` : ''}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="space-y-5">
          <section className="bg-white rounded-xl border border-border-custom shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="font-poppins font-bold text-text-primary text-lg">{t("Affectation du profil")}</h2>
                <p className="text-text-secondary text-sm font-inter">
                  {selectedAdmin ? `${selectedAdmin.fullName || selectedAdmin.phone} · ${selectedAdmin.phone}` : 'Selectionnez un administrateur'}
                </p>
              </div>
              <ShieldCheck className="w-5 h-5 text-green-primary shrink-0" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className="block text-text-muted text-xs font-inter mb-1">{t("Profil")}</span>
                <select
                  value={roleCode}
                  onChange={(e) => setRoleCode(e.target.value)}
                  className="w-full h-11 rounded-lg bg-bg-secondary px-3 text-sm text-text-primary outline-none"
                >
                  {summary.roles.map((role) => (
                    <option key={role.code} value={role.code}>{roleLabel(role)}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-text-muted text-xs font-inter mb-1">{t("Périmètre")}</span>
                <select
                  value={scopeType}
                  onChange={(e) => setScopeType(e.target.value)}
                  className="w-full h-11 rounded-lg bg-bg-secondary px-3 text-sm text-text-primary outline-none"
                >
                  {Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-text-muted text-xs font-inter mb-1">{t("Valeur")}</span>
                <input
                  value={scopeValue}
                  onChange={(e) => setScopeValue(e.target.value)}
                  disabled={scopeType === 'global'}
                  className="w-full h-11 rounded-lg bg-bg-secondary px-3 text-sm text-text-primary outline-none disabled:opacity-50"
                  placeholder={scopeType === 'city' ? 'Douala' : scopeType === 'zone' ? 'Bonamoussadi' : 'Global'}
                />
              </label>
            </div>

            <label className="block mt-3">
              <span className="block text-text-muted text-xs font-inter mb-1">{t("Motif d'audit")}</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-11 rounded-lg bg-bg-secondary px-3 text-sm text-text-primary outline-none"
              />
            </label>

            <div className="flex justify-end mt-4">
              <button
                onClick={saveRole}
                disabled={!selectedAdmin || saving}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-green-primary text-white text-sm font-inter font-medium hover:bg-green-dark disabled:opacity-60 transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-border-custom shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-green-primary" />
              <h2 className="font-poppins font-semibold text-text-primary text-sm">{t("Privileges du profil selectionne")}</h2>
            </div>
            <p className="text-text-secondary text-sm font-inter mb-4">{selectedRole?.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {permissionDetails.map((permission) => (
                <div key={permission!.code} className="flex items-start gap-2 rounded-lg border border-border-light px-3 py-2">
                  {permission!.isSensitive ? <Lock className="w-3.5 h-3.5 text-amber-700 mt-0.5" /> : <Eye className="w-3.5 h-3.5 text-text-muted mt-0.5" />}
                  <div>
                    <p className="text-xs font-inter font-semibold text-text-primary">{permission!.code}</p>
                    <p className="text-[11px] text-text-muted font-inter">{permission!.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-border-custom shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border-light flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-primary" />
              <h2 className="font-poppins font-semibold text-text-primary text-sm">{t("Derniers audits")}</h2>
            </div>
            <div className="divide-y divide-border-light">
              {summary.auditLogs.length === 0 ? (
                <p className="p-4 text-text-secondary text-sm">{t("Aucun audit accessible.")}</p>
              ) : summary.auditLogs.slice(0, 12).map((log) => (
                <div key={log.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-inter font-semibold text-text-primary text-sm">{log.action}</span>
                    <span className="text-[11px] bg-bg-secondary rounded-full px-2 py-0.5 text-text-muted">{log.targetType}</span>
                    {log.targetId && <span className="text-[11px] text-text-muted">#{String(log.targetId).slice(0, 8)}</span>}
                  </div>
                  <p className="text-xs text-text-secondary font-inter mt-1">
                    {log.adminName || log.adminPhone || 'Admin'} · {formatDate(log.createdAt)}
                  </p>
                  {log.reason && <p className="text-xs text-text-muted font-inter mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{log.reason}</p>}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


