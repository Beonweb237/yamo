// ============================================================
// MiamExpress — Admin : Configuration Frais de Livraison
// ============================================================
import { useState, useEffect } from 'react';
import { DollarSign, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from "react-i18next";

const STORAGE_KEY = 'miam_delivery_fees';

interface FeeConfig {
  pricePerKm: number;
  minFee: number;
  maxFee: number;
  updatedAt?: string;
}

const DEFAULT_CONFIG: FeeConfig = { pricePerKm: 200, minFee: 500, maxFee: 3000 };

function readConfig(): FeeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}

function writeConfig(c: FeeConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...c, updatedAt: new Date().toISOString() }));
}

export default function AdminDeliveryFees() {
    const { t } = useTranslation();
  const [config, setConfig] = useState<FeeConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfig(readConfig());
    setLoading(false);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      writeConfig(config);
      setConfig(readConfig());
      toast.success('Configuration enregistrée !');
    } catch { toast.error('Erreur'); }
    finally { setSaving(false); }
  }

  // Exemples de calcul
  const examples = [0.5, 1.5, 3, 5, 8, 12];
  const computedFees = examples.map(km => ({
    km,
    fee: Math.max(config.minFee, Math.min(config.maxFee, Math.round((km * config.pricePerKm) / 100) * 100)),
  }));

  if (loading) return <div className="p-8 text-center text-text-muted">{t("Chargement...")}</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8">
      <PageHeader
        icon={DollarSign}
        title="Frais de livraison"
        subtitle="Définissez le tarif par kilomètre — arrondi automatique au multiple de 100 FCFA"
      />

      <form onSubmit={handleSave} className="bg-white border border-border-custom rounded-xl p-6 mb-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-inter font-medium text-text-primary mb-2">
              {t("Prix par km (FCFA)")}
            </label>
            <div className="relative">
              <input
                type="number"
                min={50} max={1000} step={50}
                value={config.pricePerKm}
                onChange={e => setConfig({ ...config, pricePerKm: parseInt(e.target.value) || 200 })}
                className="w-full bg-bg-secondary rounded-lg px-4 h-12 text-text-primary font-inter text-sm outline-none border border-border-custom focus:border-green-primary transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">{t("FCFA/km")}</span>
            </div>
            <p className="text-text-muted text-xs font-inter mt-1.5">{t("Recommandé : 200 FCFA/km")}</p>
          </div>

          <div>
            <label className="block text-sm font-inter font-medium text-text-primary mb-2">
              {t("Frais minimum")}
            </label>
            <div className="relative">
              <input
                type="number"
                min={100} max={5000} step={100}
                value={config.minFee}
                onChange={e => setConfig({ ...config, minFee: parseInt(e.target.value) || 500 })}
                className="w-full bg-bg-secondary rounded-lg px-4 h-12 text-text-primary font-inter text-sm outline-none border border-border-custom focus:border-green-primary transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">{t("FCFA")}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-inter font-medium text-text-primary mb-2">
              {t("Frais maximum (plafond)")}
            </label>
            <div className="relative">
              <input
                type="number"
                min={config.minFee} max={10000} step={100}
                value={config.maxFee}
                onChange={e => setConfig({ ...config, maxFee: parseInt(e.target.value) || 3000 })}
                className="w-full bg-bg-secondary rounded-lg px-4 h-12 text-text-primary font-inter text-sm outline-none border border-border-custom focus:border-green-primary transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">{t("FCFA")}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="bg-green-primary text-white font-inter font-medium text-sm px-6 h-11 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-50 flex items-center gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer la configuration'}
          </button>
          <button type="button" onClick={() => setConfig({ pricePerKm: 200, minFee: 500, maxFee: 3000 })}
            className="text-text-secondary font-inter text-sm px-4 h-11 rounded-lg hover:bg-bg-secondary transition-colors flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> {t("Réinitialiser")}
          </button>
        </div>
      </form>

      {/* Aperçu des frais */}
      <div className="bg-white border border-border-custom rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-bg-secondary border-b border-border-custom">
          <h2 className="font-inter font-semibold text-text-primary">{t("Aperçu — Grille tarifaire")}</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {computedFees.map(({ km, fee }) => (
              <div key={km} className="bg-bg-secondary rounded-lg p-3 text-center">
                <p className="text-text-muted text-xs font-inter mb-1">{km} {t("km")}</p>
                <p className="text-green-primary font-poppins font-bold text-lg">{fee.toLocaleString()} {t("FCFA")}</p>
              </div>
            ))}
          </div>
          <p className="text-text-muted text-xs font-inter mt-4 text-center">
            {t("💡 Les frais sont automatiquement arrondis au multiple de 100 FCFA le plus proche.\r\n            Minimum :")} {config.minFee} {t("FCFA · Maximum :")} {config.maxFee} {t("FCFA · Tarif :")} {config.pricePerKm} {t("FCFA/km")}
          </p>
        </div>
      </div>
    </div>
  );
}
