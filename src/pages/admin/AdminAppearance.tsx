import { useRef, useState, type ChangeEvent } from 'react';
import {
  Check, Palette, Home as HomeIcon, Sparkles, Upload, RotateCcw, ImageIcon,
  ChevronUp, ChevronDown, LayoutList, Type, Headset,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSiteConfig } from '../../hooks/useSiteConfig';
import {
  setHomeTemplate, patchSiteConfig, DEFAULT_BRAND_COLORS, isHexColor,
  effectiveHomeSections,
  type HomeTemplate, type BrandColors, type HomeSectionId,
} from '../../lib/siteConfig';
import { processFormImage } from '../../lib/media';
import { Switch } from '../../components/ui/switch';
import { WHATSAPP_NUMBER, SUPPORT_PHONE } from '../../data/support';

interface TemplateOption {
  value: HomeTemplate;
  icon: typeof HomeIcon;
  title: string;
  description: string;
  note?: string;
}

export default function AdminAppearance() {
  const { t } = useTranslation();
  const config = useSiteConfig();
  const { homeTemplate, logoUrl } = config;
  const [saving, setSaving] = useState<HomeTemplate | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [colors, setColors] = useState<BrandColors>(config.brandColors ?? DEFAULT_BRAND_COLORS);
  const [savingColors, setSavingColors] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Hero + support : brouillons locaux synchronisés depuis la config chargée.
  const [hero, setHero] = useState({ title: config.heroTitle ?? '', subtitle: config.heroSubtitle ?? '' });
  const [support, setSupport] = useState({
    phone: config.support?.phone ?? '',
    whatsapp: config.support?.whatsapp ?? '',
    hours: config.support?.hours ?? '',
  });
  const [savingHero, setSavingHero] = useState(false);
  const [savingSupport, setSavingSupport] = useState(false);
  // Resynchronise les brouillons quand la config chargée change (pattern React
  // « adjusting state during render » — pas de setState dans un effet).
  const configSig = JSON.stringify([config.heroTitle, config.heroSubtitle, config.support]);
  const [seenSig, setSeenSig] = useState(configSig);
  if (configSig !== seenSig) {
    setSeenSig(configSig);
    setHero({ title: config.heroTitle ?? '', subtitle: config.heroSubtitle ?? '' });
    setSupport({
      phone: config.support?.phone ?? '',
      whatsapp: config.support?.whatsapp ?? '',
      hours: config.support?.hours ?? '',
    });
  }

  const sections = effectiveHomeSections(config);
  const sectionLabels: Record<HomeSectionId, string> = {
    categories: t('Catégories'),
    popular: t('Restaurants populaires'),
    recent_orders: t('Vos commandes récentes (reprise de commande)'),
    promos: t('Offres & promotions'),
  };

  const toggleSection = async (id: HomeSectionId, enabled: boolean) => {
    await patchSiteConfig({ homeSections: sections.map((s) => (s.id === id ? { ...s, enabled } : s)) });
  };

  const moveSection = async (id: HomeSectionId, dir: -1 | 1) => {
    const idx = sections.findIndex((s) => s.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[idx], next[target]] = [next[target], next[idx]];
    await patchSiteConfig({ homeSections: next });
  };

  const saveHero = async () => {
    setSavingHero(true);
    try {
      await patchSiteConfig({ heroTitle: hero.title.trim() || undefined, heroSubtitle: hero.subtitle.trim() || undefined });
      toast.success(t('Contenu du hero mis à jour.'));
    } finally { setSavingHero(false); }
  };

  const saveSupport = async () => {
    const digits = (v: string) => v.replace(/\D/g, '');
    const phone = digits(support.phone);
    const whatsapp = digits(support.whatsapp);
    if ((support.phone.trim() && (phone.length < 8 || phone.length > 15))
      || (support.whatsapp.trim() && (whatsapp.length < 8 || whatsapp.length > 15))) {
      toast.error(t('Numéro invalide (8 à 15 chiffres attendus).'));
      return;
    }
    setSavingSupport(true);
    try {
      await patchSiteConfig({
        support: {
          phone: phone || undefined,
          whatsapp: whatsapp || undefined,
          hours: support.hours.trim() || undefined,
        },
      });
      toast.success(t('Coordonnées support mises à jour.'));
    } finally { setSavingSupport(false); }
  };

  const options: TemplateOption[] = [
    {
      value: 'classic',
      icon: HomeIcon,
      title: t('Classique'),
      description: t('Le design actuel du site, tel que vos visiteurs le voient aujourd’hui.'),
    },
    {
      value: 'premium',
      icon: Sparkles,
      title: t('Premium'),
      description: t('La nouvelle expérience d’accueil (en-tête personnalisé, « Pour vous », offres, reprise de commande).'),
    },
  ];

  const choose = async (value: HomeTemplate) => {
    if (value === homeTemplate || saving) return;
    setSaving(value);
    try {
      await setHomeTemplate(value);
      toast.success(t('Template de l’accueil mis à jour.'));
    } catch {
      toast.error(t('Impossible d’enregistrer. Réessayez.'));
    } finally {
      setSaving(null);
    }
  };

  const onLogoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error(t('Choisissez un fichier image.')); return; }
    setUploadingLogo(true);
    try {
      const url = await processFormImage(file, 'branding');
      await patchSiteConfig({ logoUrl: url });
      toast.success(t('Logo mis à jour.'));
    } catch {
      toast.error(t('Échec de l’envoi du logo. Réessayez.'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const resetLogo = async () => {
    await patchSiteConfig({ logoUrl: undefined });
    toast.success(t('Logo réinitialisé.'));
  };

  const saveColors = async () => {
    if (!isHexColor(colors.green) || !isHexColor(colors.gold)) {
      toast.error(t('Couleur invalide (format #RRGGBB attendu).'));
      return;
    }
    setSavingColors(true);
    try {
      await patchSiteConfig({ brandColors: colors });
      toast.success(t('Couleurs de marque mises à jour.'));
    } finally {
      setSavingColors(false);
    }
  };

  const resetColors = async () => {
    setColors(DEFAULT_BRAND_COLORS);
    await patchSiteConfig({ brandColors: undefined });
    toast.success(t('Couleurs réinitialisées.'));
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <span className="w-10 h-10 rounded-xl bg-green-light flex items-center justify-center text-green-primary shrink-0">
          <Palette className="w-5 h-5" />
        </span>
        <div>
          <h1 className="font-poppins font-semibold text-text-primary text-xl">{t('Apparence')}</h1>
          <p className="text-text-secondary font-inter text-sm">{t('Personnalisez l’accueil et l’identité du site.')}</p>
        </div>
      </div>

      {/* Template Home */}
      <section className="mt-6">
        <h2 className="font-inter font-semibold text-text-primary text-sm mb-1">{t('Template de la page d’accueil')}</h2>
        <p className="text-text-muted font-inter text-xs mb-4">{t('Le changement s’applique immédiatement pour tous les visiteurs. Vous pouvez revenir en un clic.')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {options.map((opt) => {
            const active = opt.value === homeTemplate;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => choose(opt.value)}
                aria-pressed={active}
                disabled={saving !== null}
                className={`relative text-left rounded-xl border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-primary/40 ${active
                  ? 'border-green-primary bg-green-light/40'
                  : 'border-border-custom bg-white hover:border-text-muted'
                  } ${saving !== null && !active ? 'opacity-60' : ''}`}
              >
                {active && (
                  <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-green-primary text-white flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </span>
                )}
                <span className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${active ? 'bg-green-primary text-white' : 'bg-bg-secondary text-text-muted'}`}>
                  <opt.icon className="w-5 h-5" />
                </span>
                <p className="font-inter font-semibold text-text-primary text-sm">{opt.title}</p>
                <p className="text-text-secondary font-inter text-xs mt-1 leading-relaxed">{opt.description}</p>
                {opt.note && <p className="text-gold-accent font-inter text-[11px] mt-2 font-medium">{opt.note}</p>}
                {active && <span className="inline-block mt-3 text-green-primary font-inter text-[11px] font-semibold uppercase tracking-wide">{t('Actif')}</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* Logo */}
      <section className="mt-8 pt-6 border-t border-border-light">
        <h2 className="font-inter font-semibold text-text-primary text-sm mb-1">{t('Logo')}</h2>
        <p className="text-text-muted font-inter text-xs mb-4">{t('Image carrée recommandée (PNG transparent). Utilisée dans la barre de navigation.')}</p>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border border-border-custom bg-bg-secondary flex items-center justify-center overflow-hidden shrink-0">
            <img src={logoUrl || '/logo-icon.png'} alt={t('Logo actuel')} className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={onLogoFile} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingLogo}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-green-primary text-white font-inter text-sm font-medium hover:bg-green-dark transition-colors disabled:opacity-60"
            >
              <Upload className="w-4 h-4" />
              {uploadingLogo ? t('Envoi…') : t('Changer le logo')}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={resetLogo}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border-custom text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {t('Logo par défaut')}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Couleurs de marque */}
      <section className="mt-8 pt-6 border-t border-border-light">
        <h2 className="font-inter font-semibold text-text-primary text-sm mb-1">{t('Couleurs de marque')}</h2>
        <p className="text-text-muted font-inter text-xs mb-4">{t('Appliquées en direct sur tout le site. Gardez un bon contraste pour la lisibilité.')}</p>
        <div className="flex flex-wrap gap-5">
          {([['green', t('Vert primaire')], ['gold', t('Or accent')]] as const).map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <input
                type="color"
                value={isHexColor(colors[key]) ? colors[key] : DEFAULT_BRAND_COLORS[key]}
                onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value }))}
                aria-label={label}
                className="w-11 h-11 rounded-lg border border-border-custom cursor-pointer bg-white p-0.5"
              />
              <div>
                <p className="font-inter text-xs text-text-secondary">{label}</p>
                <input
                  type="text"
                  value={colors[key]}
                  onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value }))}
                  spellCheck={false}
                  className="w-24 h-8 px-2 mt-0.5 rounded-md border border-border-custom font-mono text-xs text-text-primary uppercase outline-none focus:border-green-primary"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={saveColors}
            disabled={savingColors}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-green-primary text-white font-inter text-sm font-medium hover:bg-green-dark transition-colors disabled:opacity-60"
          >
            <Check className="w-4 h-4" />
            {t('Appliquer les couleurs')}
          </button>
          <button
            type="button"
            onClick={resetColors}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border-custom text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            {t('Couleurs par défaut')}
          </button>
        </div>
        <p className="flex items-center gap-1.5 text-text-muted font-inter text-[11px] mt-3">
          <ImageIcon className="w-3.5 h-3.5" />
          {t('Astuce : conservez le vert et l’or de MiamExpress pour rester cohérent.')}
        </p>
      </section>

      {/* Sections de la Home Premium */}
      <section className="mt-8 pt-6 border-t border-border-light">
        <h2 className="flex items-center gap-2 font-inter font-semibold text-text-primary text-sm mb-1">
          <LayoutList className="w-4 h-4 text-green-primary" />
          {t('Sections de l’accueil (template Premium)')}
        </h2>
        <p className="text-text-muted font-inter text-xs mb-4">{t('Activez, désactivez et réordonnez les sections. Une section sans contenu réel reste masquée automatiquement.')}</p>
        <ul className="space-y-2">
          {sections.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border-custom bg-white px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveSection(s.id, -1)}
                  disabled={i === 0}
                  aria-label={t('Monter la section {{name}}', { name: sectionLabels[s.id] })}
                  className="w-6 h-5 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-secondary disabled:opacity-30 transition-colors"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(s.id, 1)}
                  disabled={i === sections.length - 1}
                  aria-label={t('Descendre la section {{name}}', { name: sectionLabels[s.id] })}
                  className="w-6 h-5 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-secondary disabled:opacity-30 transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-inter text-sm text-text-primary truncate">{sectionLabels[s.id]}</p>
                {s.id === 'promos' && (
                  <p className="text-text-muted font-inter text-[11px]">{t('Visible uniquement quand une promotion réelle est active.')}</p>
                )}
              </div>
              <Switch
                checked={s.enabled}
                onCheckedChange={(v) => toggleSection(s.id, v)}
                aria-label={t('Afficher la section {{name}}', { name: sectionLabels[s.id] })}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* Hero (accueil classique) */}
      <section className="mt-8 pt-6 border-t border-border-light">
        <h2 className="flex items-center gap-2 font-inter font-semibold text-text-primary text-sm mb-1">
          <Type className="w-4 h-4 text-green-primary" />
          {t('Contenu du hero (accueil classique)')}
        </h2>
        <p className="text-text-muted font-inter text-xs mb-4">{t('Laissez vide pour conserver les textes par défaut du site.')}</p>
        <div className="space-y-3 max-w-xl">
          <label className="block">
            <span className="block text-text-muted font-inter text-xs mb-1">{t('Titre')}</span>
            <input
              type="text"
              value={hero.title}
              onChange={(e) => setHero((h) => ({ ...h, title: e.target.value }))}
              placeholder={t('Découvrez les Meilleures Saveurs du Cameroun, Livrées Chez Vous')}
              maxLength={200}
              className="w-full h-10 px-3 rounded-lg border border-border-custom font-inter text-sm text-text-primary outline-none focus:border-green-primary"
            />
          </label>
          <label className="block">
            <span className="block text-text-muted font-inter text-xs mb-1">{t('Sous-titre')}</span>
            <textarea
              value={hero.subtitle}
              onChange={(e) => setHero((h) => ({ ...h, subtitle: e.target.value }))}
              placeholder={t('La meilleure sélection de restaurants et boutiques à Douala et Yaoundé. Rapide, fiable et toujours chaud.')}
              maxLength={300}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border-custom font-inter text-sm text-text-primary outline-none focus:border-green-primary resize-y"
            />
          </label>
          <button
            type="button"
            onClick={saveHero}
            disabled={savingHero}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-green-primary text-white font-inter text-sm font-medium hover:bg-green-dark transition-colors disabled:opacity-60"
          >
            <Check className="w-4 h-4" />
            {t('Enregistrer le hero')}
          </button>
        </div>
      </section>

      {/* Coordonnées support */}
      <section className="mt-8 pt-6 border-t border-border-light">
        <h2 className="flex items-center gap-2 font-inter font-semibold text-text-primary text-sm mb-1">
          <Headset className="w-4 h-4 text-green-primary" />
          {t('Coordonnées du support')}
        </h2>
        <p className="text-text-muted font-inter text-xs mb-4">{t('Utilisées par les boutons Appeler / WhatsApp du site. Laissez vide pour les valeurs par défaut.')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <label className="block">
            <span className="block text-text-muted font-inter text-xs mb-1">{t('Téléphone (appels)')}</span>
            <input
              type="tel"
              value={support.phone}
              onChange={(e) => setSupport((s) => ({ ...s, phone: e.target.value }))}
              placeholder={SUPPORT_PHONE}
              className="w-full h-10 px-3 rounded-lg border border-border-custom font-inter text-sm text-text-primary outline-none focus:border-green-primary"
            />
          </label>
          <label className="block">
            <span className="block text-text-muted font-inter text-xs mb-1">{t('WhatsApp (international, sans +)')}</span>
            <input
              type="tel"
              value={support.whatsapp}
              onChange={(e) => setSupport((s) => ({ ...s, whatsapp: e.target.value }))}
              placeholder={WHATSAPP_NUMBER}
              className="w-full h-10 px-3 rounded-lg border border-border-custom font-inter text-sm text-text-primary outline-none focus:border-green-primary"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-text-muted font-inter text-xs mb-1">{t('Horaires du support')}</span>
            <input
              type="text"
              value={support.hours}
              onChange={(e) => setSupport((s) => ({ ...s, hours: e.target.value }))}
              placeholder={t('8h – 22h, 7j/7')}
              maxLength={80}
              className="w-full h-10 px-3 rounded-lg border border-border-custom font-inter text-sm text-text-primary outline-none focus:border-green-primary"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={saveSupport}
          disabled={savingSupport}
          className="mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-green-primary text-white font-inter text-sm font-medium hover:bg-green-dark transition-colors disabled:opacity-60"
        >
          <Check className="w-4 h-4" />
          {t('Enregistrer les coordonnées')}
        </button>
      </section>
    </div>
  );
}
