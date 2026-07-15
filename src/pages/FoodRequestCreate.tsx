import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CAMEROON_CITIES } from '../data/cities';
import { dishCatalog } from '../data/mockData';
import type { DishCatalogEntry } from '../data/mockData';
import {
  UtensilsCrossed, MapPin, Clock, ArrowLeft, Flame, Leaf, Heart, Apple, Wheat,
  Search, Plus, X, ChevronDown, Send, ShoppingBag, Pencil, Trash2, ChefHat,
} from 'lucide-react';

const DIETARY_TAGS = [
  { id: 'diabetique', label: 'Diabétique', icon: Heart, color: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' },
  { id: 'sans-sel', label: 'Sans sel', icon: Leaf, color: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100' },
  { id: 'halal', label: 'Halal', icon: Flame, color: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' },
  { id: 'vegetarien', label: 'Végétarien', icon: Leaf, color: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' },
  { id: 'sans-gluten', label: 'Sans gluten', icon: Wheat, color: 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' },
  { id: 'pauvre-en-gras', label: 'Pauvre en gras', icon: Apple, color: 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100' },
  { id: 'riche-en-proteines', label: 'Riche en protéines', icon: UtensilsCrossed, color: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' },
];

const FREQUENCES = [
  { id: 'unique', label: 'Une seule fois' },
  { id: 'quotidien', label: 'Tous les jours' },
  { id: 'hebdomadaire', label: 'Certains jours de la semaine' },
];

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const FORM_STORAGE_KEY = 'miamexpress_draft_food_request';

interface DishItem { dishId?: string; dishName: string; quantity: number; notes: string; isCustom: boolean; }

function loadDraft() { try { const r = localStorage.getItem(FORM_STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveDraft(data: any) { localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data)); }
function clearDraft() { localStorage.removeItem(FORM_STORAGE_KEY); }

export default function FoodRequestCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const draft = loadDraft();

  const [form, setForm] = useState({
    title: draft?.title || '', description: draft?.description || '',
    city: draft?.city || user?.city || '', budgetMin: draft?.budgetMin || 2000,
    budgetMax: draft?.budgetMax || 5000, dietaryTags: (draft?.dietaryTags || []) as string[],
    preparationNotes: draft?.preparationNotes || '', deliveryAddress: draft?.deliveryAddress || '',
    frequence: draft?.frequence || 'unique', jours: (draft?.jours || []) as string[],
    dureeSemaines: draft?.dureeSemaines || 1,
  });

  const [dishes, setDishes] = useState<DishItem[]>(draft?.dishes || []);
  const [showDishSearch, setShowDishSearch] = useState(false);
  const [dishQuery, setDishQuery] = useState('');
  const [customDish, setCustomDish] = useState({ name: '', notes: '' });
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = setTimeout(() => saveDraft({ ...form, dishes }), 500); return () => clearTimeout(t); }, [form, dishes]);
  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => { if (user?.city && !form.city && !draft) setForm(f => ({ ...f, city: user.city || '' })); }, [user]);

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));
  const toggleTag = (id: string) => setForm(f => ({ ...f, dietaryTags: f.dietaryTags.includes(id) ? f.dietaryTags.filter(t => t !== id) : [...f.dietaryTags, id] }));
  const toggleJour = (j: string) => setForm(f => ({ ...f, jours: f.jours.includes(j) ? f.jours.filter(x => x !== j) : [...f.jours, j] }));

  const addCatalogDish = (dish: DishCatalogEntry) => { setDishes(d => [...d, { dishId: dish.id, dishName: dish.name, quantity: 1, notes: '', isCustom: false }]); setShowDishSearch(false); setDishQuery(''); };
  const addCustomDish = () => { if (!customDish.name.trim()) return; setDishes(d => [...d, { dishName: customDish.name.trim(), quantity: 1, notes: customDish.notes.trim(), isCustom: true }]); setCustomDish({ name: '', notes: '' }); };
  const removeDish = (i: number) => setDishes(d => d.filter((_, idx) => idx !== i));
  const updateDish = (i: number, fld: string, val: any) => setDishes(d => d.map((it, idx) => idx === i ? { ...it, [fld]: val } : it));

  const filteredDishes = dishQuery.trim() ? dishCatalog.filter(d => d.name.toLowerCase().includes(dishQuery.toLowerCase())).slice(0, 20) : dishCatalog.slice(0, 20);

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
    const ve = validate(); if (ve) { setError(ve); return; }
    setError(''); setLoading(true);
    try {
      const ds = form.frequence === 'unique' ? JSON.stringify({ frequence: 'unique' }) : JSON.stringify({ frequence: form.frequence, jours: form.jours, duree_semaines: form.dureeSemaines });
      let desc = form.description.trim();
      if (dishes.length > 0) { desc += '\n\n--- PLATS DEMANDÉS ---'; dishes.forEach(d => { desc += `\n• ${d.quantity}x ${d.dishName}${d.notes ? ` (Note: ${d.notes})` : ''}${d.isCustom ? ' [Perso]' : ''}`; }); }
      const { error: apiErr } = await supabase.from('food-requests').insert({
        title: form.title.trim(), description: desc, city: form.city, budget_min: form.budgetMin, budget_max: form.budgetMax,
        dietary_tags: form.dietaryTags, preparation_notes: form.preparationNotes.trim() || null,
        delivery_schedule: ds, delivery_address: form.deliveryAddress.trim() || null,
      });
      if (apiErr) throw apiErr;
      clearDraft(); setSuccess(true);
      setTimeout(() => navigate('/demandes/mes-demandes', { state: { justCreated: true } }), 1500);
    } catch (err: any) { setError(err.message || 'Erreur lors de la création'); } finally { setLoading(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] pt-8 pb-20"><div className="max-w-lg mx-auto px-4 sm:px-6 text-center"><div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10">
        <div className="w-16 h-16 rounded-2xl bg-[#FF6B35]/10 flex items-center justify-center mx-auto mb-6"><UtensilsCrossed size={32} className="text-[#FF6B35]" /></div>
        <h1 className="text-xl font-bold text-gray-900 mb-3">Connectez-vous pour continuer</h1>
        <p className="text-gray-500 text-sm mb-8">Pour publier une demande culinaire, vous devez avoir un compte client MiamExpress.</p>
        <div className="space-y-3">
          <Link to={`/connexion?returnUrl=${encodeURIComponent(location.pathname)}`} className="block w-full py-3 bg-[#FF6B35] text-white rounded-xl font-semibold hover:bg-[#E55A2B] transition-all shadow-lg shadow-[#FF6B35]/20">Se connecter</Link>
          <Link to={`/inscription?returnUrl=${encodeURIComponent(location.pathname)}`} className="block w-full py-3 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all">Créer un compte</Link>
        </div>
      </div></div></div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] pt-8 pb-20"><div className="max-w-lg mx-auto px-4 sm:px-6 text-center"><div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10">
        <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-6"><Send size={32} className="text-green-600" /></div>
        <h1 className="text-xl font-bold text-gray-900 mb-3">Demande publiée ! 🎉</h1>
        <p className="text-gray-500 text-sm mb-6">Les restaurants de {form.city} peuvent maintenant soumissionner. Vous serez notifié à chaque offre reçue.</p>
        <p className="text-xs text-gray-400">Redirection vers vos demandes...</p>
      </div></div></div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] pt-6 pb-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4"><Link to="/" className="hover:text-[#FF6B35]">Accueil</Link><span>/</span><Link to="/demandes/mes-demandes" className="hover:text-[#FF6B35]">Demandes</Link><span>/</span><span className="text-gray-600 font-medium">Nouvelle</span></div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"><ArrowLeft size={16} /> Retour</button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B35]/10 flex items-center justify-center shrink-0"><UtensilsCrossed size={20} className="text-[#FF6B35]" /></div>
            <div><h1 className="text-xl font-bold text-gray-900">🍽️ Demande sur mesure</h1><p className="text-sm text-gray-500">Décrivez votre besoin, les restaurants de votre ville vous feront des propositions</p></div>
          </div>

          {error && (<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"><X size={16} className="text-red-500 mt-0.5 shrink-0" /><p className="text-sm text-red-700">{error}</p></div>)}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Titre */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Titre <span className="text-red-400">*</span></label>
              <input ref={titleRef} type="text" value={form.title} onChange={e => update('title', e.target.value)} placeholder="Ex: Repas diabétique pour la semaine" maxLength={100} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20 outline-none text-sm transition-all" />
              <p className="text-xs text-gray-400 mt-1">{form.title.length}/100 — min 5 caractères</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description <span className="text-red-400">*</span></label>
              <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={4} placeholder="Décrivez ce que vous voulez : type de cuisine, quantités, fréquence, contraintes..." className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20 outline-none text-sm transition-all resize-none" />
              <p className="text-xs text-gray-400 mt-1">{form.description.length} caractères — min 20</p>
            </div>

            {/* Plats souhaités */}
            <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100">
              <div className="flex items-center justify-between mb-3"><label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><ShoppingBag size={14} /> Plats souhaités</label><span className="text-xs text-gray-400">Optionnel</span></div>
              {dishes.length > 0 && (
                <div className="space-y-2 mb-3">
                  {dishes.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-2.5 text-sm">
                      <span className="w-8 h-8 rounded-lg bg-[#FF6B35]/10 flex items-center justify-center text-xs font-bold text-[#FF6B35] shrink-0">{d.quantity}x</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">{d.isCustom && <Pencil size={10} className="text-gray-400 shrink-0" />}<span className="font-medium text-gray-800 truncate">{d.dishName}</span></div>
                        {d.notes && <p className="text-xs text-gray-500 truncate">Note : {d.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => updateDish(i, 'quantity', Math.max(1, d.quantity - 1))} className="p-1 text-gray-400 hover:text-gray-600">−</button>
                        <span className="text-xs font-medium w-5 text-center">{d.quantity}</span>
                        <button type="button" onClick={() => updateDish(i, 'quantity', d.quantity + 1)} className="p-1 text-gray-400 hover:text-gray-600">+</button>
                        <button type="button" onClick={() => removeDish(i)} className="p-1 text-gray-400 hover:text-red-500 ml-1"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowDishSearch(!showDishSearch)} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-[#FF6B35] hover:text-[#FF6B35] transition-all"><Search size={12} /> Chercher un plat</button>
                <button type="button" onClick={addCustomDish} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-[#FF6B35] hover:text-[#FF6B35] transition-all"><Pencil size={12} /> Plat personnalisé</button>
              </div>
              {showDishSearch && (
                <div className="mt-3 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                  <div className="p-3 border-b border-gray-100"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" value={dishQuery} onChange={e => setDishQuery(e.target.value)} placeholder="Rechercher un plat..." autoFocus className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#FF6B35]" /></div></div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredDishes.map(dish => (
                      <button key={dish.id} type="button" onClick={() => addCatalogDish(dish)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 text-left transition-colors border-b border-gray-50 last:border-0">
                        <ChefHat size={14} className="text-[#FF6B35] shrink-0" />
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{dish.name}</p><p className="text-xs text-gray-400">{dish.category}</p></div>
                        <span className="text-xs font-semibold text-gray-600 shrink-0">{dish.category}</span>
                      </button>
                    ))}
                    {filteredDishes.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun plat trouvé</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Ville */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2"><MapPin size={14} className="inline mr-1" />Ville <span className="text-red-400">*</span></label>
              <div className="relative">
                <select value={form.city} onChange={e => update('city', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20 outline-none text-sm transition-all appearance-none bg-white cursor-pointer">
                  <option value="">-- Sélectionnez votre ville --</option>
                  {CAMEROON_CITIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Budget <span className="text-red-400">*</span> <span className="text-gray-400 font-normal text-xs">(FCFA)</span></label>
              <div className="flex items-center gap-3">
                <div className="flex-1"><span className="text-xs text-gray-400 mb-1 block">Minimum</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => update('budgetMin', Math.max(500, form.budgetMin - 500))} className="px-2 py-1.5 bg-gray-100 rounded-lg text-xs font-bold hover:bg-gray-200">−500</button>
                    <input type="number" value={form.budgetMin} onChange={e => update('budgetMin', parseInt(e.target.value) || 0)} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:border-[#FF6B35] outline-none text-sm text-center font-semibold" />
                    <button type="button" onClick={() => update('budgetMin', form.budgetMin + 500)} className="px-2 py-1.5 bg-gray-100 rounded-lg text-xs font-bold hover:bg-gray-200">+500</button>
                  </div>
                </div>
                <span className="text-gray-300 mt-5 text-lg">–</span>
                <div className="flex-1"><span className="text-xs text-gray-400 mb-1 block">Maximum</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => update('budgetMax', Math.max(form.budgetMin, form.budgetMax - 500))} className="px-2 py-1.5 bg-gray-100 rounded-lg text-xs font-bold hover:bg-gray-200">−500</button>
                    <input type="number" value={form.budgetMax} onChange={e => update('budgetMax', parseInt(e.target.value) || 0)} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:border-[#FF6B35] outline-none text-sm text-center font-semibold" />
                    <button type="button" onClick={() => update('budgetMax', form.budgetMax + 500)} className="px-2 py-1.5 bg-gray-100 rounded-lg text-xs font-bold hover:bg-gray-200">+500</button>
                  </div>
                </div>
              </div>
              {form.budgetMax < form.budgetMin && <p className="text-xs text-red-500 mt-2">Le maximum doit être supérieur au minimum</p>}
            </div>

            {/* Régimes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Contraintes alimentaires</label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_TAGS.map(tag => {
                  const sel = form.dietaryTags.includes(tag.id); const Icon = tag.icon; return (
                    <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-all ${sel ? tag.color + ' border-current shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'}`}><Icon size={12} /> {tag.label}</button>
                  );
                })}
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Instructions de préparation <span className="text-gray-400 font-normal text-xs">(optionnel)</span></label>
              <textarea value={form.preparationNotes} onChange={e => update('preparationNotes', e.target.value)} rows={2} placeholder="Ex: Cuisson à la vapeur uniquement, pas d'huile..." className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20 outline-none text-sm transition-all resize-none" />
            </div>

            {/* Fréquence */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3"><Clock size={14} className="inline mr-1" />Fréquence</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {FREQUENCES.map(f => (<button key={f.id} type="button" onClick={() => update('frequence', f.id)} className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${form.frequence === f.id ? 'bg-[#FF6B35] text-white border-[#FF6B35]' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'}`}>{f.label}</button>))}
              </div>
              {form.frequence === 'hebdomadaire' && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                  <div className="flex flex-wrap gap-2">{JOURS.map(j => (<button key={j} type="button" onClick={() => toggleJour(j)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${form.jours.includes(j) ? 'bg-[#FF6B35] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}>{j}</button>))}</div>
                  <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Durée :</span><select value={form.dureeSemaines} onChange={e => update('dureeSemaines', parseInt(e.target.value))} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none bg-white">{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} semaine{n > 1 ? 's' : ''}</option>)}</select></div>
                </div>
              )}
            </div>

            {/* Adresse */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Adresse de livraison <span className="text-gray-400 font-normal text-xs">(optionnel)</span></label>
              <input type="text" value={form.deliveryAddress} onChange={e => update('deliveryAddress', e.target.value)} placeholder="Quartier, rue, point de repère..." className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20 outline-none text-sm transition-all" />
            </div>

            {/* Récapitulatif */}
            {form.title.trim().length >= 5 && form.city && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">📋 Récapitulatif</h3>
                <div className="space-y-1.5 text-sm text-gray-600">
                  <p><strong>{form.title}</strong></p>
                  <p className="text-xs text-gray-500 line-clamp-2">{form.description}</p>
                  {dishes.length > 0 && <p className="text-xs">🍽️ {dishes.length} plat(s) demandé(s)</p>}
                  <p>📍 {form.city} · 💰 {form.budgetMin.toLocaleString()} – {form.budgetMax.toLocaleString()} FCFA</p>
                  {form.dietaryTags.length > 0 && <div className="flex flex-wrap gap-1">{form.dietaryTags.map(t => <span key={t} className="px-1.5 py-0.5 bg-white rounded text-xs border">{t}</span>)}</div>}
                </div>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} className="w-full py-3.5 bg-[#FF6B35] hover:bg-[#E55A2B] disabled:bg-gray-300 text-white font-semibold rounded-xl transition-all shadow-lg shadow-[#FF6B35]/20 hover:shadow-xl hover:shadow-[#FF6B35]/25 flex items-center justify-center gap-2">
              {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={18} />}
              {loading ? 'Publication...' : 'Publier ma demande'}
            </button>
            <p className="text-xs text-gray-400 text-center">Votre demande sera visible par les restaurants de {form.city || 'votre ville'} pendant <strong>48h</strong>. Brouillon sauvegardé automatiquement.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
