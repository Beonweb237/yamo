import { useState, useMemo } from 'react';
import { Search, Plus, X, Pencil, Trash2, ChefHat } from 'lucide-react';
import { dishCatalog, type DishCatalogEntry } from '../../data/mockData';
import { ALL_DIETARY_TAGS } from '../../pages/RestaurantDashboard';
import { useTranslation } from "react-i18next";

function readCatalog(): DishCatalogEntry[] {
  const stored = localStorage.getItem('yamo_admin_dish_catalog');
  return stored ? JSON.parse(stored) : dishCatalog;
}

function writeCatalog(entries: DishCatalogEntry[]) {
  localStorage.setItem('yamo_admin_dish_catalog', JSON.stringify(entries));
}

export default function AdminDishCatalog() {
    const { t } = useTranslation();
  const [catalog, setCatalog] = useState<DishCatalogEntry[]>(readCatalog);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Plats Principaux');
  const [image, setImage] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [description, setDescription] = useState('');

  const categories = [...new Set(catalog.map(e => e.category))];

  const filtered = useMemo(() => {
    if (!query.trim()) return catalog;
    const q = query.toLowerCase();
    return catalog.filter(e => e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || e.tags.some(t => t.includes(q)));
  }, [catalog, query]);

  const resetForm = () => {
    setShowForm(false); setEditingId(null);
    setName(''); setCategory('Plats Principaux'); setImage('');
    setSelectedTags([]); setDescription('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !image) return;
    const now = new Date().toISOString();
    if (editingId) {
      setCatalog(prev => {
        const updated = prev.map(e => e.id === editingId ? { ...e, name, category, defaultImage: image, tags: selectedTags, description, approvedAt: now } : e);
        writeCatalog(updated);
        return updated;
      });
    } else {
      const entry: DishCatalogEntry = { id: 'dc' + Date.now(), name, category, defaultImage: image, tags: selectedTags, description, approvedAt: now };
      setCatalog(prev => { const u = [entry, ...prev]; writeCatalog(u); return u; });
    }
    resetForm();
  };

  const handleEdit = (entry: DishCatalogEntry) => {
    setName(entry.name); setCategory(entry.category); setImage(entry.defaultImage);
    setSelectedTags(entry.tags); setDescription(entry.description);
    setEditingId(entry.id); setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setCatalog(prev => { const u = prev.filter(e => e.id !== id); writeCatalog(u); return u; });
  };

  const toggleTag = (tag: string) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-poppins font-bold text-text-primary text-2xl flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-green-primary" />{t("Catalogue Plats")}
        </h1>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-green-primary text-white font-inter font-medium text-sm px-4 h-10 rounded-lg hover:bg-green-dark transition-colors">
          <Plus className="w-4 h-4" />{t("Nouveau plat type")}
        </button>
      </div>

      <p className="text-text-secondary text-sm font-inter mb-6">
        {t("Gérez le catalogue central des plats. Les images définies ici sont utilisées pour la recherche globale. Les restaurants peuvent utiliser ces plats comme référence ou soumettre de nouveaux plats.")}
      </p>

      <div className="flex items-center gap-2 bg-white rounded-lg border border-border-custom px-3 h-11 mb-4 max-w-md">
        <Search className="w-4 h-4 text-text-muted shrink-0" />
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un plat..." className="flex-1 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted" />
      </div>

      <div className="bg-white rounded-xl border border-border-custom overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-text-secondary text-sm">{t("Aucun plat trouvé.")}</div>
        ) : (
          <div className="divide-y divide-border-light">
            {filtered.map(entry => (
              <div key={entry.id} className="p-4 flex items-center gap-4">
                <img src={entry.defaultImage} alt={entry.name} className="w-14 h-14 rounded-lg object-cover border border-border-light shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="flex-1 min-w-0">
                  <p className="font-inter font-semibold text-text-primary text-sm">{entry.name}</p>
                  <p className="text-text-muted text-xs font-inter truncate">{entry.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {entry.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-inter font-medium px-1.5 py-0.5 rounded bg-bg-secondary text-text-secondary">{tag}</span>
                    ))}
                    <span className="text-[10px] font-inter text-text-muted px-1.5 py-0.5">{entry.category}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleEdit(entry)} className="w-8 h-8 rounded-lg hover:bg-bg-secondary flex items-center justify-center text-text-secondary"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(entry.id)} className="w-8 h-8 rounded-lg hover:bg-error/10 flex items-center justify-center text-text-muted hover:text-error"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetForm}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-poppins font-bold text-text-primary text-lg">{editingId ? 'Modifier le plat type' : 'Nouveau plat type'}</h3>
                <button type="button" onClick={resetForm} className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-bg-secondary"><X className="w-4 h-4" /></button>
              </div>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nom du plat" className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none" required />
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="Plats Principaux">{t("Plats Principaux")}</option>
                <option value="Grillades">{t("Grillades")}</option>
                <option value="Entrées">{t("Entrées")}</option>
                <option value="Boissons">{t("Boissons")}</option>
                <option value="Desserts">{t("Desserts")}</option>
                <option value="Pizza">{t("Pizza")}</option>
                <option value="Petit-Déjeuner">{t("Petit-Déjeuner")}</option>
              </select>
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">{t("Image par défaut (URL)")}</label>
                <div className="flex items-center gap-2">
                  <input type="text" value={image} onChange={e => setImage(e.target.value)} placeholder="/plat-ndole.jpg" className="flex-1 bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none" required />
                  {image && <img src={image} alt="" className="w-11 h-11 rounded-lg object-cover border shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                </div>
              </div>
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">{t("Tags")}</label>
                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                  {ALL_DIETARY_TAGS.map(tag => {
                    const active = selectedTags.includes(tag);
                    return (
                      <button key={tag} type="button" onClick={() => toggleTag(tag)}
                        className={`shrink-0 h-8 px-2.5 rounded-full text-[11px] font-inter font-semibold border transition-colors ${active ? 'bg-green-primary text-white border-green-primary' : 'bg-white border-border-custom text-text-secondary hover:text-text-primary'}`}>{tag}</button>
                    );
                  })}
                </div>
              </div>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description du plat" rows={3} className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none" />
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 bg-green-primary text-white font-inter font-semibold text-sm h-11 rounded-lg hover:bg-green-dark transition-colors">{editingId ? 'Enregistrer' : 'Ajouter au catalogue'}</button>
                <button type="button" onClick={resetForm} className="text-text-secondary font-inter text-sm px-4 h-11 rounded-lg hover:bg-bg-secondary transition-colors">{t("Annuler")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
