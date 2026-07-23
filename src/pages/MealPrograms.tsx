import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Search, CalendarDays, Utensils, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../hooks/useSeo';
import { fetchPrograms, type MealProgram } from '../lib/mealPrograms';
import { DIETARY_TAG_META } from '../lib/dishes';
import AppImage from '../components/AppImage';

const tagLabel = (id: string) => DIETARY_TAG_META.find((t) => t.id === id)?.label || id;

export default function MealPrograms() {
  const { t } = useTranslation();
  useSeo({ title: t('Programmes & abonnements repas'), description: t('Abonnez-vous à des programmes repas adaptés à votre santé et vos objectifs, livrés chaque jour.') });
  const [programs, setPrograms] = useState<MealProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchPrograms()
      .then((p) => { setPrograms(p); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, []);

  const tags = useMemo(() => {
    const s = new Set<string>();
    programs.forEach((p) => p.dietaryTags.forEach((x) => s.add(x)));
    return [...s];
  }, [programs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return programs.filter((p) => {
      if (tag && !p.dietaryTags.includes(tag)) return false;
      if (!q) return true;
      return [p.name, p.description, p.targetAudience, p.restaurantName].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [programs, query, tag]);

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-green-primary/10 grid place-items-center shrink-0"><HeartPulse className="w-6 h-6 text-green-primary" /></div>
          <div>
            <h1 className="font-poppins font-bold text-text-primary text-xl sm:text-2xl">{t('Programmes & abonnements')}</h1>
            <p className="text-text-muted text-xs sm:text-sm">{t('Des repas adaptés à votre santé, livrés régulièrement.')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 my-5">
          <div className="flex-1 min-w-[200px] h-11 rounded-xl border border-border-custom bg-white flex items-center gap-2 px-3">
            <Search className="w-4 h-4 text-text-muted shrink-0" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Rechercher un programme…')} className="flex-1 bg-transparent outline-none text-sm min-w-0" />
          </div>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <button onClick={() => setTag(null)} className={`text-xs font-medium px-3 h-8 rounded-full border ${!tag ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-text-secondary border-border-custom'}`}>{t('Tous')}</button>
            {tags.map((x) => (
              <button key={x} onClick={() => setTag(tag === x ? null : x)} className={`text-xs font-medium px-3 h-8 rounded-full border ${tag === x ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-text-secondary border-border-custom'}`}>{t(tagLabel(x))}</button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="h-64 bg-white rounded-2xl border border-border-custom animate-pulse" />)}</div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center text-text-muted">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border-custom p-10 text-center">
            <Utensils className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="font-poppins font-semibold text-text-primary">{t('Aucun programme pour l\'instant')}</p>
            <p className="text-text-muted text-sm">{t('Les restaurants publieront bientôt leurs programmes santé.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <Link key={p.id} to={`/programmes/${p.id}`} className="bg-white rounded-2xl border border-border-custom overflow-hidden hover:shadow-md transition-shadow group">
                <div className="h-36 bg-bg-secondary overflow-hidden">
                  {p.photoUrl ? <AppImage src={p.photoUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full grid place-items-center"><HeartPulse className="w-10 h-10 text-text-muted/40" /></div>}
                </div>
                <div className="p-4">
                  <p className="font-poppins font-semibold text-text-primary text-sm truncate">{p.name}</p>
                  <p className="text-text-muted text-xs truncate mb-2">{p.restaurantName}{p.restaurantCity ? ` · ${p.restaurantCity}` : ''}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {p.dietaryTags.slice(0, 3).map((x) => <span key={x} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-light text-green-primary">{t(tagLabel(x))}</span>)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{p.mealsCount} {t('repas')} · {p.durationWeeks} {t('sem.')}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-poppins font-bold text-green-primary">{p.priceFcfa.toLocaleString()} {t('FCFA')}</span>
                    <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-green-primary" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
