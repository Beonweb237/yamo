import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, HeartPulse, CalendarDays, Loader2, Check, Store, Wallet,
  UtensilsCrossed, CalendarCheck, Bike, PauseCircle, Star, BadgeCheck, ShieldCheck,
  MapPin, Phone, MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../hooks/useSeo';
import { useAuth } from '../contexts/AuthContext';
import { fetchProgram, fetchPrograms, type MealProgram, type ProgramSchedule } from '../lib/mealPrograms';
import { subscribeToProgram } from '../lib/subscriptions';
import { fetchMenuItems } from '../lib/catalog';
import { fetchRestaurantRatingSummary, type ReviewSummary } from '../lib/reviews';
import type { MenuItem } from '../data/mockData';
import { DIETARY_TAG_META } from '../lib/dishes';
import { phoneForWhatsapp, phoneForTel } from '../lib/phone';
import AppImage from '../components/AppImage';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';

const tagLabel = (id: string) => DIETARY_TAG_META.find((t) => t.id === id)?.label || id;

// Bénéfices DÉRIVÉS des tags réels du programme (aucune promesse inventée) +
// bénéfices génériques vrais pour tout abonnement (planification, livraison).
const TAG_BENEFITS: Record<string, string> = {
  'diabetique': 'Index glycémique maîtrisé',
  'sans-sucre': 'Sans sucre ajouté',
  'pauvre-en-sel': 'Peu de sel, adapté à la tension',
  'sans-gluten': 'Sans gluten, sans mauvaise surprise',
  'vegan': 'Zéro produit animal',
  'vegetarien': 'Sans viande, riche en légumes',
  'riche-en-proteines': 'Riche en protéines',
  'bio': 'Ingrédients bio sélectionnés',
  'halal': 'Cuisine halal',
  'fait-maison': 'Cuisine maison',
  'traditionnel': 'Recettes camerounaises authentiques',
  'sans-cube': 'Sans bouillon cube',
  'allege': 'Recettes allégées',
  'detox': 'Menus détox légers',
};

function deriveBenefits(tags: string[]): string[] {
  const fromTags = tags.map((t) => TAG_BENEFITS[t]).filter(Boolean).slice(0, 2);
  return [...fromTags, 'Zéro prise de tête : vos repas sont planifiés', 'Livré chaud chez vous'].slice(0, 4);
}

/** Libellé lisible du calendrier de livraison dérivé du schedule du programme. */
function scheduleLabel(s: ProgramSchedule | undefined, t: (k: string, o?: Record<string, unknown>) => string): string | null {
  if (!s) return null;
  const jours = (s.jours ?? []).filter(Boolean);
  if (jours.length) {
    const caps = jours.map((j) => j.charAt(0).toUpperCase() + j.slice(1, 3));
    return t('Livré : {{jours}}', { jours: caps.join(', ') });
  }
  if (s.frequence === 'quotidien') return t('Livré tous les jours');
  if (s.frequence === 'hebdomadaire') return t('Livraison hebdomadaire');
  return null;
}

interface SavedAddressLite { id?: string; label?: string; fullText?: string; full_text?: string }

function readSavedAddresses(): SavedAddressLite[] {
  try {
    const raw = localStorage.getItem('yamo_saved_addresses');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

const addressText = (a: SavedAddressLite) => a.fullText || a.full_text || a.label || '';

function savedAddress(): string {
  const a = readSavedAddresses()[0];
  return a ? addressText(a) : '';
}

export default function MealProgramDetail() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [p, setP] = useState<MealProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [address, setAddress] = useState(savedAddress);
  const [subscribing, setSubscribing] = useState(false);
  // Exemples de plats RÉELS : menu du resto filtré par les tags du programme.
  const [sampleItems, setSampleItems] = useState<MenuItem[]>([]);
  // Preuve sociale : note réelle du restaurant (masquée si aucun avis).
  const [rating, setRating] = useState<ReviewSummary | null>(null);
  const [savedAddresses] = useState<SavedAddressLite[]>(readSavedAddresses);
  // Découverte : autres programmes (même resto d'abord), max 4, masqué si vide.
  const [related, setRelated] = useState<MealProgram[]>([]);
  // CTA sticky mobile : visible seulement quand le formulaire est hors écran.
  const subscribeRef = useRef<HTMLDivElement | null>(null);
  const [formVisible, setFormVisible] = useState(true);

  useEffect(() => {
    const el = subscribeRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [p]);
  useSeo({ title: p ? p.name : t('Programme repas'), noindex: false });

  useEffect(() => { fetchProgram(id).then(setP).catch(() => setP(null)).finally(() => setLoading(false)); }, [id]);
  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  useEffect(() => {
    if (!p?.restaurantId) return; // pas de programme → section jamais rendue
    let alive = true;
    fetchMenuItems(p.restaurantId)
      .then((items) => {
        if (!alive) return;
        const tags = p.dietaryTags ?? [];
        const matching = tags.length
          ? items.filter((it) => (it.dietaryTags ?? []).some((tg) => tags.includes(tg)))
          : items;
        setSampleItems(matching.slice(0, 6));
      })
      .catch(() => { /* section simplement masquée */ });
    fetchRestaurantRatingSummary(p.restaurantId)
      .then((s) => { if (alive && s.reviewCount > 0) setRating(s); })
      .catch(() => { /* note simplement masquée */ });
    fetchPrograms()
      .then((list) => {
        if (!alive) return;
        const others = list.filter((x) => x.id !== p.id && x.status === 'published');
        const sameResto = others.filter((x) => x.restaurantId === p.restaurantId);
        const rest = others.filter((x) => x.restaurantId !== p.restaurantId);
        setRelated([...sameResto, ...rest].slice(0, 4));
      })
      .catch(() => { /* section simplement masquée */ });
    return () => { alive = false; };
  }, [p]);

  // SEO : meta description riche + JSON-LD Product/Offer (retiré au démontage).
  useEffect(() => {
    if (!p) return;
    const desc = `${p.name} — ${p.mealsCount} repas sur ${p.durationWeeks} semaines par ${p.restaurantName ?? 'un restaurant partenaire'}${p.restaurantCity ? ` à ${p.restaurantCity}` : ''}. ${p.priceFcfa.toLocaleString()} FCFA / cycle, payé repas par repas à la livraison.`;
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content') ?? null;
    meta?.setAttribute('content', desc);
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-meal-program', p.id);
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: p.description || desc,
      ...(p.photoUrl || p.restaurantImage ? { image: p.photoUrl || p.restaurantImage } : {}),
      brand: { '@type': 'Organization', name: p.restaurantName ?? 'MiamExpress' },
      offers: {
        '@type': 'Offer',
        price: p.priceFcfa,
        priceCurrency: 'XAF',
        availability: 'https://schema.org/InStock',
      },
    });
    document.head.appendChild(script);
    return () => {
      script.remove();
      if (prevDesc !== null) meta?.setAttribute('content', prevDesc);
    };
  }, [p]);

  const subscribe = async () => {
    if (!user) { navigate('/connexion'); return; }
    if (!address.trim()) { toast.error(t('Indiquez une adresse de livraison.')); return; }
    setSubscribing(true);
    try {
      const sub = await subscribeToProgram(id, startDate, undefined, address.trim());
      toast.success(t('Abonnement créé — {{n}} livraisons planifiées.', { n: sub.plannedDeliveries }));
      navigate('/abonnements');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Souscription impossible'));
    } finally { setSubscribing(false); }
  };

  if (loading) return <div className="pt-[72px] min-h-screen bg-bg-secondary grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-green-primary" /></div>;
  if (!p) return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary text-center p-10">
      <p className="font-poppins font-semibold text-text-primary mb-3">{t('Programme introuvable')}</p>
      <Link to="/programmes" className="text-green-primary font-medium">{t('Voir les programmes')}</Link>
    </div>
  );

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-6">
        <Link to="/programmes" className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm mb-4"><ArrowLeft className="w-4 h-4" />{t('Tous les programmes')}</Link>

        <div className="bg-white rounded-2xl border border-border-custom overflow-hidden mb-4">
          <div className="h-48 bg-bg-secondary">
            {(p.photoUrl || p.restaurantImage) ? (
              // Photo du programme, sinon photo du restaurant — jamais l'icône nue.
              <AppImage src={p.photoUrl || p.restaurantImage || ''} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center bg-gradient-to-br from-green-primary to-green-dark">
                <HeartPulse className="w-12 h-12 text-white/70" />
              </div>
            )}
          </div>
          <div className="p-5">
            <h1 className="font-poppins font-bold text-text-primary text-xl">{p.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <Link
                to={`/restaurant/${p.restaurantId}`}
                className="text-text-muted text-sm inline-flex items-center gap-1.5 hover:text-green-primary transition-colors underline-offset-2 hover:underline"
              >
                <Store className="w-4 h-4" />{p.restaurantName}{p.restaurantCity ? ` · ${p.restaurantCity}` : ''}
              </Link>
              {rating && (
                <span className="inline-flex items-center gap-1 text-sm text-text-primary font-medium">
                  <Star className="w-4 h-4 fill-gold-accent text-gold-accent" />
                  {rating.ratingAvg.toFixed(1)}
                  <span className="text-text-muted font-normal">({rating.reviewCount} {t('avis')})</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-green-primary font-medium">
                <BadgeCheck className="w-4 h-4" />{t('Partenaire vérifié')}
              </span>
            </div>
            {p.targetAudience && <p className="text-text-secondary text-sm mt-2">{t('Pour')} : {p.targetAudience}</p>}
            {p.description && <p className="text-text-secondary text-sm mt-2 whitespace-pre-line">{p.description}</p>}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {p.dietaryTags.map((x) => <span key={x} className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-green-light text-green-primary">{t(tagLabel(x))}</span>)}
            </div>
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-text-muted">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{p.mealsCount} {t('repas')} · {p.durationWeeks} {t('semaines')}</span>
              {scheduleLabel(p.schedule, t) && (
                <span className="inline-flex items-center gap-1.5"><CalendarCheck className="w-4 h-4" />{scheduleLabel(p.schedule, t)}</span>
              )}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-3">
              <span className="font-poppins font-bold text-green-primary text-lg">{p.priceFcfa.toLocaleString()} {t('FCFA')} <span className="text-text-muted font-normal text-xs">/ {t('cycle')}</span></span>
              <span className="text-text-muted text-xs">{t('soit ~')}{Math.round(p.priceFcfa / Math.max(1, p.mealsCount)).toLocaleString()} {t('FCFA / repas')}</span>
              <span className="text-text-muted text-xs">· {t('repas + livraison réglés à la réception')}</span>
            </div>

            {/* Bénéfices dérivés des tags réels du programme */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-4">
              {deriveBenefits(p.dietaryTags).map((b) => (
                <li key={b} className="flex items-center gap-2 text-text-secondary text-sm">
                  <Check className="w-4 h-4 text-green-primary shrink-0" />{t(b)}
                </li>
              ))}
            </ul>

            {/* Réassurance */}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {[t('Annulez à tout moment'), t('Pause possible'), t('Paiement à la livraison'), t('Livraison suivie')].map((chip) => (
                <span key={chip} className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-bg-secondary text-text-secondary border border-border-custom">
                  <ShieldCheck className="w-3 h-3 text-green-primary" />{chip}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Comment ça marche */}
        <div className="bg-white rounded-2xl border border-border-custom p-5 mb-4">
          <h2 className="font-poppins font-semibold text-text-primary text-base mb-4">{t('Comment ça marche')}</h2>
          <ol className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: CalendarDays, label: t('Choisissez votre date de début') },
              { icon: UtensilsCrossed, label: t('Le restaurant prépare vos repas') },
              { icon: Bike, label: t('Livraison selon le calendrier du programme') },
              { icon: PauseCircle, label: t('Pause ou annulation à tout moment') },
            ].map((step, i) => (
              <li key={i} className="flex flex-col items-start gap-2">
                <span className="w-9 h-9 rounded-xl bg-green-light text-green-primary grid place-items-center shrink-0">
                  <step.icon className="w-[18px] h-[18px]" />
                </span>
                <span className="text-text-secondary text-xs leading-relaxed"><span className="font-semibold text-text-primary">{i + 1}.</span> {step.label}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Exemples de plats — vrais plats du menu, tagués comme le programme */}
        {sampleItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-border-custom p-5 mb-4">
            <h2 className="font-poppins font-semibold text-text-primary text-base mb-1">{t('Exemples de plats de ce programme')}</h2>
            <p className="text-text-muted text-xs mb-4">{t('Plats réels du menu de {{name}} correspondant à ce programme.', { name: p.restaurantName ?? t('ce restaurant') })}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sampleItems.map((it) => (
                <div key={it.id} className="rounded-xl border border-border-custom overflow-hidden bg-white">
                  <div className="h-20 sm:h-24 bg-bg-secondary">
                    <AppImage src={it.image} alt={it.name} fallbackLabel={it.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2.5">
                    <p className="font-inter font-medium text-text-primary text-xs truncate">{it.name}</p>
                    <p className="text-text-muted text-[11px] mt-0.5">{it.price.toLocaleString()} {t('FCFA')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contacter le restaurant */}
        {p.restaurantPhone && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-text-muted text-xs">{t('Une question sur ce programme ?')}</span>
            <a
              href={`https://wa.me/${phoneForWhatsapp(p.restaurantPhone)}?text=${encodeURIComponent(t('Bonjour, j\'ai une question sur le programme « {{name}} » sur MiamExpress.', { name: p.name }))}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-green-primary/30 text-green-primary font-inter text-xs font-medium hover:bg-green-light transition-colors"
            >
              <MessageCircle className="w-4 h-4" />{t('WhatsApp du restaurant')}
            </a>
            <a
              href={`tel:${phoneForTel(p.restaurantPhone)}`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border-custom text-text-secondary font-inter text-xs font-medium hover:bg-bg-secondary transition-colors"
            >
              <Phone className="w-4 h-4" />{t('Appeler')}
            </a>
          </div>
        )}

        {/* Souscrire */}
        <div ref={subscribeRef} className="bg-white rounded-2xl border border-border-custom p-5">
          <h2 className="font-poppins font-semibold text-text-primary text-base mb-3">{t('Souscrire à ce programme')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <label className="block">
              <span className="block text-text-muted text-xs mb-1">{t('Date de début')}</span>
              <input type="date" value={startDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-sm outline-none border border-transparent focus:border-green-primary/40" />
            </label>
            <div>
              <span className="block text-text-muted text-xs mb-1">{t('Adresse de livraison')}</span>
              {savedAddresses.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {savedAddresses.slice(0, 3).map((a, i) => {
                    const txt = addressText(a);
                    if (!txt) return null;
                    const active = txt === address;
                    return (
                      <button
                        key={a.id ?? i}
                        type="button"
                        onClick={() => setAddress(txt)}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1 max-w-full px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${active
                          ? 'bg-green-light text-green-primary border-green-primary/30'
                          : 'bg-bg-secondary text-text-secondary border-border-custom hover:border-text-muted'}`}
                      >
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{a.label || txt}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <AddressAutocomplete
                value={address}
                onChange={(v) => setAddress(v)}
                placeholder={t('Quartier, point de repère…')}
              />
            </div>
          </div>

          {/* Récapitulatif de souscription */}
          <div className="bg-bg-secondary rounded-xl p-3.5 mb-4">
            <p className="font-inter font-semibold text-text-primary text-xs mb-1.5">{t('Votre abonnement')}</p>
            <p className="text-text-secondary text-xs leading-relaxed">
              {p.mealsCount} {t('repas')} · {p.durationWeeks} {t('semaines')}
              {scheduleLabel(p.schedule, t) ? <> · {scheduleLabel(p.schedule, t)}</> : null}
              {' '}· {t('démarre le')} <strong className="text-text-primary">{new Date(`${startDate}T00:00:00`).toLocaleDateString()}</strong>
              {' '}· {t('total du cycle')} <strong className="text-green-primary">{p.priceFcfa.toLocaleString()} {t('FCFA')}</strong> <span className="text-text-muted">({t('réglé repas par repas à la livraison')})</span>
            </p>
          </div>

          <div className="flex items-start gap-2.5 bg-green-light/60 border border-green-primary/15 rounded-xl p-3 mb-4">
            <Wallet className="w-4 h-4 text-green-primary shrink-0 mt-0.5" />
            <p className="text-text-secondary text-xs leading-relaxed">{t('Paiement à la livraison : vous réglez chaque repas à sa réception, rien n\'est prélevé à l\'avance. Repas livrés selon le calendrier ; pause ou annulation possible à tout moment.')}</p>
          </div>
          <button onClick={subscribe} disabled={subscribing} className="inline-flex items-center justify-center gap-1.5 h-11 px-6 rounded-xl bg-green-primary text-white font-inter font-medium text-sm hover:bg-green-dark transition-colors disabled:opacity-60">
            {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{t('Souscrire')}
          </button>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-2xl border border-border-custom p-5 mt-4">
          <h2 className="font-poppins font-semibold text-text-primary text-base mb-1">{t('Questions fréquentes')}</h2>
          <Accordion type="single" collapsible className="w-full">
            {[
              { q: t('Comment se passe le paiement ?'), a: t('Vous payez chaque repas à sa réception (espèces ou Mobile Money selon le restaurant). Rien n\'est prélevé à l\'avance.') },
              { q: t('Puis-je mettre mon abonnement en pause ?'), a: t('Oui, à tout moment depuis « Mes abonnements ». Les livraisons reprennent quand vous relancez le programme.') },
              { q: t('Quels jours suis-je livré ?'), a: t('Selon le calendrier du programme affiché plus haut. La date de début est celle que vous choisissez à la souscription.') },
              { q: t('Comment annuler ?'), a: t('Depuis « Mes abonnements », en un clic. Les repas déjà livrés sont dus, rien d\'autre.') },
            ].map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-sm font-inter text-text-primary text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-text-secondary text-sm leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Autres programmes */}
        {related.length > 0 && (
          <div className="mt-4">
            <h2 className="font-poppins font-semibold text-text-primary text-base mb-3">{t('Autres programmes à découvrir')}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {related.map((r) => (
                <Link key={r.id} to={`/programmes/${r.id}`} className="rounded-2xl bg-white border border-border-custom overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow">
                  <div className="h-20 bg-bg-secondary">
                    {(r.photoUrl || r.restaurantImage) ? (
                      <AppImage src={r.photoUrl || r.restaurantImage || ''} alt={r.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center bg-gradient-to-br from-green-primary to-green-dark">
                        <HeartPulse className="w-6 h-6 text-white/70" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="font-inter font-semibold text-text-primary text-xs truncate">{r.name}</p>
                    <p className="text-text-muted text-[11px] truncate mt-0.5">{r.restaurantName}</p>
                    <p className="text-green-primary text-[11px] font-medium mt-1">{r.priceFcfa.toLocaleString()} {t('FCFA')} / {t('cycle')}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA sticky mobile — visible quand le formulaire est hors écran */}
      {!formVisible && (
        <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-white border-t border-border-custom px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <button
            type="button"
            onClick={() => subscribeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="w-full h-11 rounded-xl bg-green-primary text-white font-inter font-semibold text-sm hover:bg-green-dark transition-colors"
          >
            {t('Souscrire')} · {p.priceFcfa.toLocaleString()} {t('FCFA')}
          </button>
        </div>
      )}
    </div>
  );
}
