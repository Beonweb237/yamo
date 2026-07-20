import { useState, useEffect } from 'react';
import { Users, Store, Bike, ShieldCheck, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { UserRole } from '../../contexts/AuthContext';
import {
  getQuotaConfig, setQuotaConfig, getUserCounts, checkQuota,
  QUOTA_ROLES, type QuotaConfig,
} from '../../lib/quotas';

const ROLE_ICONS: Record<string, typeof Users> = {
  client: Users,
  restaurant: Store,
  livreur: Bike,
  admin: ShieldCheck,
};

export default function AdminQuotas() {
  const [config, setConfig] = useState<QuotaConfig>(getQuotaConfig());
  const [counts, setCounts] = useState(getUserCounts());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<QuotaConfig>({ ...config });

  const refresh = () => {
    setConfig(getQuotaConfig());
    setCounts(getUserCounts());
  };

  useEffect(() => { refresh(); }, []);

  const handleSave = () => {
    // Validation: chaque quota doit être >= 1
    for (const [role, val] of Object.entries(draft)) {
      if (val < 1) {
        toast.error(`Le quota pour ${role} doit être au moins 1.`);
        return;
      }
    }
    setQuotaConfig(draft);
    setConfig({ ...draft });
    setEditing(false);
    toast.success('Quotas mis à jour');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="font-poppins font-bold text-text-primary text-2xl mb-6 flex items-center gap-2">
        <AlertTriangle className="w-6 h-6 text-amber-500" />Quotas des profils
      </h1>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800 font-inter">
        <strong>Fonctionnement :</strong> Une fois le quota atteint pour un type de profil,
        plus aucune inscription de ce type n'est acceptée. Les quotas évitent la création
        massive de profils lors des tests.
      </div>

      {/* Quota cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {QUOTA_ROLES.map(({ role, label, icon }) => {
          const Icon = ROLE_ICONS[role] ?? Users;
          const max = config[role as UserRole] ?? 0;
          const current = counts[role as UserRole] ?? 0;
          const pct = max > 0 ? Math.round((current / max) * 100) : 0;
          const isFull = current >= max;
          const isWarning = pct >= 80 && !isFull;

          return (
            <div key={role} className={`bg-white rounded-xl border-2 p-4 transition-colors ${isFull ? 'border-red-400 bg-red-50' : isWarning ? 'border-amber-400 bg-amber-50' : 'border-border-custom'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${isFull ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-green-primary'}`} />
                  <span className="font-inter font-semibold text-text-primary text-sm">{label}</span>
                </div>
                <span className="text-2xl">{icon}</span>
              </div>

              {/* Progress bar */}
              <div className="bg-gray-200 rounded-full h-2.5 mb-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-green-primary'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>

              <div className="flex justify-between items-center">
                <span className={`font-inter font-bold text-lg ${isFull ? 'text-red-600' : 'text-text-primary'}`}>
                  {current}<span className="text-text-muted font-normal text-sm">/{max}</span>
                </span>
                {isFull && (
                  <span className="text-[10px] font-inter font-semibold text-white bg-red-500 rounded-full px-2 py-0.5">
                    COMPLET
                  </span>
                )}
                {isWarning && !isFull && (
                  <span className="text-[10px] font-inter font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                    {100 - pct}% restant
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit button / form */}
      {!editing ? (
        <button
          onClick={() => { setDraft({ ...config }); setEditing(true); }}
          className="flex items-center gap-1.5 font-inter font-medium text-sm px-4 h-10 rounded-xl bg-green-primary text-white hover:bg-green-dark transition-colors"
        >
          <Save className="w-4 h-4" /> Modifier les quotas
        </button>
      ) : (
        <div className="bg-white rounded-xl border border-border-custom p-5 max-w-lg">
          <h3 className="font-inter font-semibold text-text-primary text-sm mb-4">Définir les quotas maximum</h3>
          <div className="space-y-3 mb-4">
            {QUOTA_ROLES.map(({ role, label, icon }) => (
              <div key={role} className="flex items-center gap-3">
                <span className="text-lg">{icon}</span>
                <label className="font-inter text-sm text-text-primary flex-1">{label}</label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={(draft as any)[role] ?? 0}
                  onChange={(e) => setDraft({ ...draft, [role]: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-20 bg-bg-secondary rounded-lg border border-border-custom px-3 h-9 text-text-primary font-inter text-sm text-center outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 font-inter font-medium text-sm px-4 h-10 rounded-xl bg-green-primary text-white hover:bg-green-dark transition-colors"
            >
              <Save className="w-4 h-4" /> Enregistrer
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 font-inter font-medium text-sm px-4 h-10 rounded-xl border border-border-custom hover:bg-bg-secondary transition-colors text-text-primary"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
