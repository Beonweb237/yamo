import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createFoodRequest, type DeliverySchedule } from '../lib/foodRequests';
import { CAMEROON_CITIES } from '../data/cities';
import PageHeader from '../components/PageHeader';
import {
  UtensilsCrossed, MapPin, ArrowLeft, Send, CheckCircle2, ChevronDown,
} from 'lucide-react';
import { useTranslation } from "react-i18next";
import { useSeo } from '../hooks/useSeo';

const FORM_STORAGE_KEY = 'miam_draft_food_request';

function loadDraft() { try { const r = localStorage.getItem(FORM_STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveDraft(data: unknown) { localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data)); }
function clearDraft() { localStorage.removeItem(FORM_STORAGE_KEY); }

export default function FoodRequestCreate() {
    const { t } = useTranslation();
  useSeo({
    title: t('Demande de plat sur mesure'),
    description: t("Un plat introuvable au menu ? Décrivez-le : un restaurant partenaire MiamExpress le prépare et vous le livre à Douala ou Yaoundé."),
    path: '/demandes/nouvelle',
  });
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const draft = loadDraft();

  const [title, setTitle] = useState(draft?.title || '');
  const [description, setDescription] = useState(draft?.description || '');
  const [city, setCity] = useState(draft?.city || user?.city || '');
  const [budget, setBudget] = useState(draft?.budget || 5000);
  const [deliveryAddress, setDeliveryAddress] = useState(draft?.deliveryAddress || '');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => saveDraft({ title, description, city, budget, deliveryAddress }), 500);
    return () => clearTimeout(t);
  }, [title, description, city, budget, deliveryAddress]);
  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    if (user?.city && !city && !draft) setCity(user.city || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || title.trim().length < 3) { setError('Titre : 3 caractères minimum.'); return; }
    if (!description.trim() || description.trim().length < 10) { setError('Description : 10 caractères minimum.'); return; }
    if (!city) { setError('Sélectionnez votre ville.'); return; }
    if (budget < 500) { setError('Budget minimum : 500 FCFA.'); return; }

    setError('');
    setLoading(true);
    try {
      const deliverySchedule: DeliverySchedule = { frequence: 'unique' };
      await createFoodRequest(user.id, {
        title: title.trim(),
        description: description.trim(),
        city,
        budgetMin: Math.round(budget * 0.7),
        budgetMax: budget,
        dietaryTags: [],
        deliverySchedule,
        deliveryAddress: deliveryAddress.trim() || undefined,
      });
      clearDraft();
      setSuccess(true);
      setTimeout(() => navigate('/demandes/mes-demandes', { state: { justCreated: true } }), 1500);
    } catch {
      setError('Erreur lors de la création. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <p className="text-text-secondary font-inter text-sm">{t("Chargement...")}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/connexion" state={{ from: '/demandes/nouvelle' }} replace />;
  }

  if (success) {
    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <div className="w-full max-w-[480px] bg-white rounded-2xl border border-border-custom shadow-sm p-8 text-center my-12">
          <div className="w-16 h-16 rounded-2xl bg-green-light flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-green-primary" />
          </div>
          <h1 className="font-poppins font-bold text-text-primary text-2xl mb-2">{t("Demande publiée !")}</h1>
          <p className="text-text-secondary font-inter text-sm mb-2">
            {t("Les restaurants de")} {city} {t("peuvent maintenant vous contacter.")}
          </p>
          <p className="text-text-muted font-inter text-xs">{t("Redirection vers vos demandes...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary pb-16">
      <div className="max-w-[600px] mx-auto px-4 sm:px-6 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-inter text-text-muted mb-4">
          <Link to="/" className="hover:text-text-primary transition-colors">{t("Accueil")}</Link>
          <span>/</span>
          <Link to="/demandes/mes-demandes" className="hover:text-text-primary transition-colors">{t("Demandes")}</Link>
          <span>/</span>
          <span className="text-text-secondary font-medium">{t("Nouvelle")}</span>
        </div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-inter text-text-secondary hover:text-text-primary mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("Retour")}
        </button>

        <PageHeader
          icon={UtensilsCrossed}
          title="Demande sur mesure"
          subtitle="Dites ce que vous voulez, les restaurants de votre ville vous répondent"
        />

        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-8">
          {error && (
            <div className="mb-6 p-4 bg-error/5 border border-error/20 rounded-xl">
              <p className="text-sm font-inter text-error">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Titre */}
            <div>
              <label className="block text-sm font-inter font-semibold text-text-primary mb-1.5">
                {t("Que voulez-vous ?")} <span className="text-error">*</span>
              </label>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Repas diabétique pour la semaine"
                maxLength={100}
                className="w-full px-4 h-12 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm font-inter transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-inter font-semibold text-text-primary mb-1.5">
                {t("Décrivez votre besoin")} <span className="text-error">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Quel type de cuisine ? Quels plats ? Pour combien de personnes ? Régime particulier (diabétique, sans sel, halal…) ? Livraison à quel moment ? Pour vous ou quelqu'un d'autre ?"
                className="w-full px-4 py-3 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm font-inter transition-all resize-none"
              />
              <p className="text-xs font-inter text-text-muted mt-1">{description.length} {t("car. (min 10)")}</p>
            </div>

            {/* Ville */}
            <div>
              <label className="block text-sm font-inter font-semibold text-text-primary mb-1.5">
                <MapPin className="w-3.5 h-3.5 inline mr-1" />{t("Ville")} <span className="text-error">*</span>
              </label>
              <div className="relative">
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 h-12 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm font-inter transition-all appearance-none bg-white cursor-pointer"
                >
                  <option value="">{t("-- Sélectionnez --")}</option>
                  {CAMEROON_CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-inter font-semibold text-text-primary mb-1.5">
                {t("Budget maximum (FCFA)")}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBudget(Math.max(500, budget - 1000))}
                  className="px-3 h-10 bg-bg-secondary rounded-xl text-xs font-bold hover:bg-border-light transition-colors shrink-0"
                >
                  −1000
                </button>
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-inter text-text-muted">{t("FCFA")}</span>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(parseInt(e.target.value) || 0)}
                    className="w-full pl-16 pr-4 h-12 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm font-inter text-center font-semibold"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setBudget(budget + 1000)}
                  className="px-3 h-10 bg-bg-secondary rounded-xl text-xs font-bold hover:bg-border-light transition-colors shrink-0"
                >
                  +1000
                </button>
              </div>
            </div>

            {/* Adresse */}
            <div>
              <label className="block text-sm font-inter font-semibold text-text-primary mb-1.5">
                <MapPin className="w-3 h-3 inline mr-1" />{t("Adresse de livraison")}
                <span className="text-text-muted font-normal text-xs ml-1">{t("(optionnel)")}</span>
              </label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Quartier, rue, point de repère..."
                className="w-full px-4 h-12 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm font-inter transition-all"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] bg-green-primary text-white font-inter font-semibold rounded-xl transition-all hover:bg-green-dark disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {loading ? 'Publication...' : 'Publier ma demande'}
            </button>

            <p className="text-xs font-inter text-text-muted text-center">
              {t("Visible par les restaurants de")} {city || 'votre ville'} {t("pendant 48h. Brouillon sauvegardé automatiquement.")}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
