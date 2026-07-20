import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createFoodRequest, type DeliverySchedule } from '../lib/foodRequests';
import { CAMEROON_CITIES } from '../data/cities';
import { dishCatalog } from '../data/mockData';
import type { DishCatalogEntry } from '../data/mockData';
import PageHeader from '../components/PageHeader';
import { displayCameroonPhone, normalizeCameroonPhone } from '../lib/phone';
import {
  UtensilsCrossed, MapPin, Clock, ArrowLeft, Flame, Leaf, Heart, Apple, Wheat,
  Search, X, ChevronDown, Send, ShoppingBag, Pencil, Trash2, ChefHat, CheckCircle2, UserRound, Phone,
} from 'lucide-react';

const DIETARY_TAGS = [
  { id: 'diabetique', label: 'Diabétique', icon: Heart },
  { id: 'sans-sel', label: 'Sans sel', icon: Leaf },
  { id: 'halal', label: 'Halal', icon: Flame },
  { id: 'vegetarien', label: 'Végétarien', icon: Leaf },
  { id: 'sans-gluten', label: 'Sans gluten', icon: Wheat },
  { id: 'pauvre-en-gras', label: 'Pauvre en gras', icon: Apple },
  { id: 'riche-en-proteines', label: 'Riche en protéines', icon: UtensilsCrossed },
];

const FREQUENCES: { id: DeliverySchedule['frequence']; label: string }[] = [
  { id: 'unique', label: 'Une seule fois' },
  { id: 'quotidien', label: 'Tous les jours' },
  { id: 'hebdomadaire', label: 'Certains jours de la semaine' },
];

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const FORM_STORAGE_KEY = 'miam_draft_food_request';

interface DishItem { dishId?: string; dishName: string; quantity: number; notes: string; isCustom: boolean; }

function loadDraft() { try { const r = localStorage.getItem(FORM_STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveDraft(data: unknown) { localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data)); }
function clearDraft() { localStorage.removeItem(FORM_STORAGE_KEY); }

export default function FoodRequestCreate() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const draft = loadDraft();

  const [form, setForm] = useState({
    title: draft?.title || '', description: draft?.description || '',
    city: draft?.city || user?.city || '', budgetMin: draft?.budgetMin || 2000,
    budgetMax: draft?.budgetMax || 5000, dietaryTags: (draft?.dietaryTags || []) as string[],
    preparationNotes: draft?.preparationNotes || '', deliveryAddress: draft?.deliveryAddress || '',
    frequence: (draft?.frequence || 'unique') as DeliverySchedule['frequence'], jours: (draft?.jours || []) as string[],
    dureeSemaines: draft?.dureeSemaines || 1,
    // Commande pour quelqu'un d'autre
    recipientName: draft?.recipientName || '',
    recipientPhone: normalizeCameroonPhone(draft?.recipientPhone || ''),
  });

  const [dishes, setDishes] = useState<DishItem[]>(draft?.dishes || []);
  const [showDishSearch, setShowDishSearch] = useState(false);
  const [dishQuery, setDishQuery] = useState('');
  const [customDish, setCustomDish] = useState({ name: '', notes: '' });
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = setTimeout(() => saveDraft({ ...form, dishes }), 500); return () => clearTimeout(t); }, [form, dishes]);
  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => { if (user?.city && !form.city && !draft) setForm((f) => ({ ...f, city: user.city || '' })); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [field]: value }));
  const toggleTag = (id: string) => setForm((f) => ({ ...f, dietaryTags: f.dietaryTags.includes(id) ? f.dietaryTags.filter((t) => t !== id) : [...f.dietaryTags, id] }));
  const toggleJour = (j: string) => setForm((f) => ({ ...f, jours: f.jours.includes(j) ? f.jours.filter((x) => x !== j) : [...f.jours, j] }));

  const addCatalogDish = (dish: DishCatalogEntry) => { setDishes((d) => [...d, { dishId: dish.id, dishName: dish.name, quantity: 1, notes: '', isCustom: false }]); setShowDishSearch(false); setDishQuery(''); };
  const addCustomDish = () => { if (!customDish.name.trim()) return; setDishes((d) => [...d, { dishName: customDish.name.trim(), quantity: 1, notes: customDish.notes.trim(), isCustom: true }]); setCustomDish({ name: '', notes: '' }); };
  const removeDish = (i: number) => setDishes((d) => d.filter((_, idx) => idx !== i));
  const updateDishQty = (i: number, quantity: number) => setDishes((d) => d.map((it, idx) => (idx === i ? { ...it, quantity } : it)));

  const filteredDishes = dishQuery.trim() ? dishCatalog.filter((d) => d.name.toLowerCase().includes(dishQuery.toLowerCase())).slice(0, 20) : dishCatalog.slice(0, 20);

  const validate = (): string | null => {
    if (!user) return 'Connectez-vous pour publier une demande.';
    if (!form.title.trim() || form.title.trim().length < 5) return 'Titre : 5 caractères minimum.';
    if (!form.description.trim() || form.description.trim().length < 20) return 'Description : 20 caractères minimum.';
    if (!form.city) return 'Sélectionnez votre ville.';
    if (form.budgetMin < 500) return 'Budget minimum : 500 FCFA.';
    if (form.budgetMax < form.budgetMin) return 'Le budget max doit être supérieur au min.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ve = validate();
    if (ve) { setError(ve); return; }
    if (!user) return;
    setError('');
    setLoading(true);
    try {
      let description = form.description.trim();
      if (dishes.length > 0) {
        description += '\n\n--- PLATS DEMANDÉS ---';
        dishes.forEach((d) => {
          description += `\n• ${d.quantity}x ${d.dishName}${d.notes ? ` (Note: ${d.notes})` : ''}${d.isCustom ? ' [Perso]' : ''}`;
        });
      }
      const deliverySchedule: DeliverySchedule =
        form.frequence === 'unique'
          ? { frequence: 'unique' }
          : { frequence: form.frequence, jours: form.jours, dureeSemaines: form.dureeSemaines };

      await createFoodRequest(user.id, {
        title: form.title.trim(),
        description,
        city: form.city,
        budgetMin: form.budgetMin,
        budgetMax: form.budgetMax,
        dietaryTags: form.dietaryTags,
        preparationNotes: form.preparationNotes.trim() || undefined,
        deliverySchedule,
        deliveryAddress: form.deliveryAddress.trim() || undefined,
        recipientName: form.recipientName.trim() || undefined,
        recipientPhone: normalizeCameroonPhone(form.recipientPhone) || undefined,
      });
      clearDraft();
      setSuccess(true);
      setTimeout(() => navigate('/demandes/mes-demandes', { state: { justCreated: true } }), 1500);
    } catch {
      setError('Erreur lors de la création de la demande. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  // Attendre que la session finisse de se résoudre avant de décider — sinon un
  // utilisateur réellement connecté se fait renvoyer vers /connexion pendant
  // la brève fenêtre où `user` est encore null au premier rendu.
  if (authLoading) {
    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <p className="text-text-secondary font-inter text-sm">Chargement...</p>
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
          <h1 className="font-poppins font-bold text-text-primary text-2xl mb-2">Demande publiée !</h1>
          <p className="text-text-secondary font-inter text-sm mb-2">
            Les restaurants de {form.city} peuvent maintenant soumissionner. Vous serez notifié à chaque offre reçue.
          </p>
          <p className="text-text-muted font-inter text-xs">Redirection vers vos demandes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary pb-16">
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-2 text-xs font-inter text-text-muted mb-4">
          <Link to="/" className="hover:text-text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <Link to="/demandes/mes-demandes" className="hover:text-text-primary transition-colors">Demandes</Link>
          <span>/</span>
          <span className="text-text-secondary font-medium">Nouvelle</span>
        </div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-inter text-text-secondary hover:text-text-primary mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <PageHeader
          icon={UtensilsCrossed}
          title="Demande sur mesure"
          subtitle="Décrivez votre besoin, les restaurants de votre ville vous feront des propositions"
        />

        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-8">
          {error && (
            <div className="mb-6 p-4 bg-error/5 border border-error/20 rounded-xl flex items-start gap-3">
              <X className="w-4 h-4 text-error mt-0.5 shrink-0" />
              <p className="text-sm font-inter text-error">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Titre */}
            <div>
              <label className="block text-sm font-inter font-semibold text-text-primary mb-2">Titre <span className="text-error">*</span></label>
              <input
                ref={titleRef}
                type="text"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Ex: Repas diabétique pour la semaine"
                maxLength={100}
                className="w-full px-4 h-12 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm font-inter transition-all"
              />
              <p className="text-xs font-inter text-text-muted mt-1">{form.title.length}/100 — min 5 caractères</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-inter font-semibold text-text-primary mb-2">Description <span className="text-error">*</span></label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={4}
                placeholder="Décrivez ce que vous voulez : type de cuisine, quantités, fréquence, contraintes..."
                className="w-full px-4 py-3 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm font-inter transition-all resize-none"
              />
              <p className="text-xs font-inter text-text-muted mt-1">{form.description.length} caractères — min 20</p>
            </div>

            {/* Plats souhaités */}
            <div className="p-4 bg-gold-light/40 rounded-xl border border-gold-accent/20">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-inter font-semibold text-text-primary flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" /> Plats souhaités
                </label>
                <span className="text-xs font-inter text-text-muted">Optionnel</span>
              </div>
              {dishes.length > 0 && (
                <div className="space-y-2 mb-3">
                  {dishes.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white rounded-lg border border-border-custom p-2.5 text-sm font-inter">
                      <span className="w-8 h-8 rounded-lg bg-green-light flex items-center justify-center text-xs font-bold text-green-primary shrink-0">{d.quantity}x</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {d.isCustom && <Pencil className="w-2.5 h-2.5 text-text-muted shrink-0" />}
                          <span className="font-medium text-text-primary truncate">{d.dishName}</span>
                        </div>
                        {d.notes && <p className="text-xs text-text-muted truncate">Note : {d.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => updateDishQty(i, Math.max(1, d.quantity - 1))} className="p-1 text-text-muted hover:text-text-primary">−</button>
                        <span className="text-xs font-medium w-5 text-center">{d.quantity}</span>
                        <button type="button" onClick={() => updateDishQty(i, d.quantity + 1)} className="p-1 text-text-muted hover:text-text-primary">+</button>
                        <button type="button" onClick={() => removeDish(i)} className="p-1 text-text-muted hover:text-error ml-1"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowDishSearch(!showDishSearch)} className="flex items-center gap-1.5 px-3 h-9 bg-white border border-border-custom rounded-lg text-xs font-inter font-medium text-text-secondary hover:border-green-primary hover:text-green-primary transition-all">
                  <Search className="w-3 h-3" /> Chercher un plat
                </button>
                <button type="button" onClick={addCustomDish} className="flex items-center gap-1.5 px-3 h-9 bg-white border border-border-custom rounded-lg text-xs font-inter font-medium text-text-secondary hover:border-green-primary hover:text-green-primary transition-all">
                  <Pencil className="w-3 h-3" /> Plat personnalisé
                </button>
              </div>
              {showDishSearch && (
                <div className="mt-3 bg-white rounded-xl border border-border-custom shadow-lg overflow-hidden">
                  <div className="p-3 border-b border-border-light">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        value={dishQuery}
                        onChange={(e) => setDishQuery(e.target.value)}
                        placeholder="Rechercher un plat..."
                        autoFocus
                        className="w-full pl-9 pr-3 h-9 text-sm font-inter border border-border-custom rounded-lg outline-none focus:border-green-primary"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredDishes.map((dish) => (
                      <button key={dish.id} type="button" onClick={() => addCatalogDish(dish)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg-secondary text-left transition-colors border-b border-border-light last:border-0">
                        <ChefHat className="w-3.5 h-3.5 text-green-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-inter font-medium text-text-primary truncate">{dish.name}</p>
                        </div>
                        <span className="text-xs font-inter font-semibold text-text-muted shrink-0">{dish.category}</span>
                      </button>
                    ))}
                    {filteredDishes.length === 0 && <p className="text-sm font-inter text-text-muted text-center py-4">Aucun plat trouvé</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Ville */}
            <div>
              <label className="block text-sm font-inter font-semibold text-text-primary mb-2">
                <MapPin className="w-3.5 h-3.5 inline mr-1" />Ville <span className="text-error">*</span>
              </label>
              <div className="relative">
                <select
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  className="w-full px-4 h-12 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm font-inter transition-all appearance-none bg-white cursor-pointer"
                >
                  <option value="">-- Sélectionnez votre ville --</option>
                  {CAMEROON_CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-inter font-semibold text-text-primary mb-3">
                Budget <span className="text-error">*</span> <span className="text-text-muted font-normal text-xs">(FCFA)</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-inter text-text-muted mb-1 block">Minimum</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => update('budgetMin', Math.max(500, form.budgetMin - 500))} className="px-2 h-9 bg-bg-secondary rounded-lg text-xs font-bold hover:bg-border-light">−500</button>
                    <input type="number" value={form.budgetMin} onChange={(e) => update('budgetMin', parseInt(e.target.value) || 0)} className="flex-1 min-w-0 h-10 rounded-xl border border-border-custom focus:border-green-primary outline-none text-sm font-inter text-center font-semibold" />
                    <button type="button" onClick={() => update('budgetMin', form.budgetMin + 500)} className="px-2 h-9 bg-bg-secondary rounded-lg text-xs font-bold hover:bg-border-light">+500</button>
                  </div>
                </div>
                <span className="text-text-muted mt-5 text-lg">–</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-inter text-text-muted mb-1 block">Maximum</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => update('budgetMax', Math.max(form.budgetMin, form.budgetMax - 500))} className="px-2 h-9 bg-bg-secondary rounded-lg text-xs font-bold hover:bg-border-light">−500</button>
                    <input type="number" value={form.budgetMax} onChange={(e) => update('budgetMax', parseInt(e.target.value) || 0)} className="flex-1 min-w-0 h-10 rounded-xl border border-border-custom focus:border-green-primary outline-none text-sm font-inter text-center font-semibold" />
                    <button type="button" onClick={() => update('budgetMax', form.budgetMax + 500)} className="px-2 h-9 bg-bg-secondary rounded-lg text-xs font-bold hover:bg-border-light">+500</button>
                  </div>
                </div>
              </div>
              {form.budgetMax < form.budgetMin && <p className="text-xs font-inter text-error mt-2">Le maximum doit être supérieur au minimum</p>}
            </div>

            {/* Régimes */}
            <div>
              <label className="block text-sm font-inter font-semibold text-text-primary mb-3">Contraintes alimentaires</label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_TAGS.map((tag) => {
                  const sel = form.dietaryTags.includes(tag.id);
                  const Icon = tag.icon;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-inter font-medium border transition-all ${sel ? 'bg-green-light text-green-primary border-green-primary' : 'bg-bg-secondary text-text-secondary border-border-custom hover:border-text-muted'
                        }`}
                    >
                      <Icon className="w-3 h-3" /> {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-inter font-semibold text-text-primary mb-2">
                Instructions de préparation <span className="text-text-muted font-normal text-xs">(optionnel)</span>
              </label>
              <textarea
                value={form.preparationNotes}
                onChange={(e) => update('preparationNotes', e.target.value)}
                rows={2}
                placeholder="Ex: Cuisson à la vapeur uniquement, pas d'huile..."
                className="w-full px-4 py-3 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm font-inter transition-all resize-none"
              />
            </div>

            {/* Fréquence */}
            <div>
              <label className="block text-sm font-inter font-semibold text-text-primary mb-3">
                <Clock className="w-3.5 h-3.5 inline mr-1" />Fréquence
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {FREQUENCES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => update('frequence', f.id)}
                    className={`px-4 h-9 rounded-full text-sm font-inter font-medium border transition-all ${form.frequence === f.id ? 'bg-green-primary text-white border-green-primary' : 'bg-bg-secondary text-text-secondary border-border-custom hover:border-text-muted'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {form.frequence === 'hebdomadaire' && (
                <div className="space-y-3 p-4 bg-bg-secondary rounded-xl">
                  <div className="flex flex-wrap gap-2">
                    {JOURS.map((j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => toggleJour(j)}
                        className={`px-3 h-8 rounded-lg text-xs font-inter font-medium capitalize transition-all ${form.jours.includes(j) ? 'bg-green-primary text-white' : 'bg-white text-text-secondary border border-border-custom hover:border-text-muted'
                          }`}
                      >
                        {j}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-inter text-text-secondary">Durée :</span>
                    <select value={form.dureeSemaines} onChange={(e) => update('dureeSemaines', parseInt(e.target.value))} className="px-3 h-8 rounded-lg border border-border-custom text-xs font-inter outline-none bg-white">
                      {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} semaine{n > 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Destinataire (commande pour quelqu'un d'autre) */}
            <div className="p-4 bg-bg-secondary rounded-xl border border-border-custom">
              <div className="flex items-center gap-2 mb-1">
                <UserRound className="w-4 h-4 text-green-primary" />
                <label className="text-sm font-inter font-semibold text-text-primary">
                  Destinataire <span className="text-text-muted font-normal text-xs">(si c'est pour quelqu'un d'autre)</span>
                </label>
              </div>
              <p className="text-xs font-inter text-text-muted mb-4">
                Remplissez ces champs uniquement si la commande est destinée à une autre personne.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-inter font-medium text-text-secondary mb-1.5">
                    <UserRound className="w-3 h-3 inline mr-1" />Nom du destinataire
                  </label>
                  <input
                    type="text"
                    value={form.recipientName}
                    onChange={(e) => update('recipientName', e.target.value)}
                    placeholder="Ex: Marie Ngo"
                    className="w-full px-3 h-10 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm font-inter transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-inter font-medium text-text-secondary mb-1.5">
                    <Phone className="w-3 h-3 inline mr-1" />Téléphone du destinataire
                  </label>
                  <input
                    type="tel"
                    value={displayCameroonPhone(form.recipientPhone)}
                    onChange={(e) => update('recipientPhone', normalizeCameroonPhone(e.target.value))}
                    placeholder="Ex: 6XX XXX XXX"
                    className="w-full px-3 h-10 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm font-inter transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Adresse */}
            <div>
              <label className="block text-sm font-inter font-semibold text-text-primary mb-2">
                Adresse de livraison <span className="text-text-muted font-normal text-xs">(optionnel)</span>
              </label>
              <input
                type="text"
                value={form.deliveryAddress}
                onChange={(e) => update('deliveryAddress', e.target.value)}
                placeholder="Quartier, rue, point de repère..."
                className="w-full px-4 h-12 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm font-inter transition-all"
              />
            </div>

            {/* Récapitulatif */}
            {form.title.trim().length >= 5 && form.city && (
              <div className="p-4 bg-bg-secondary rounded-xl border border-border-custom">
                <h3 className="text-sm font-inter font-semibold text-text-primary mb-2">Récapitulatif</h3>
                <div className="space-y-1.5 text-sm font-inter text-text-secondary">
                  <p className="font-semibold text-text-primary">{form.title}</p>
                  <p className="text-xs text-text-muted line-clamp-2">{form.description}</p>
                  {dishes.length > 0 && <p className="text-xs">🍽️ {dishes.length} plat{dishes.length > 1 ? 's' : ''} demandé{dishes.length > 1 ? 's' : ''}</p>}
                  {form.recipientName && (
                    <p className="text-xs">👤 Pour : {form.recipientName}{form.recipientPhone ? ` · ${displayCameroonPhone(form.recipientPhone)}` : ''}</p>
                  )}
                  <p>📍 {form.city} · 💰 {form.budgetMin.toLocaleString()} – {form.budgetMax.toLocaleString()} FCFA</p>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] bg-green-primary text-white font-inter font-semibold rounded-xl transition-all hover:bg-green-dark disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? 'Publication...' : 'Publier ma demande'}
            </button>
            <p className="text-xs font-inter text-text-muted text-center">
              Votre demande sera visible par les restaurants de {form.city || 'votre ville'} pendant <strong>48h</strong>. Brouillon sauvegardé automatiquement.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
