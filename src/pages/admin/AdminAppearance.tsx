import { useRef, useState, type ChangeEvent } from 'react';
import { Check, Palette, Home as HomeIcon, Sparkles, Upload, RotateCcw, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSiteConfig } from '../../hooks/useSiteConfig';
import {
  setHomeTemplate, patchSiteConfig, DEFAULT_BRAND_COLORS, isHexColor,
  type HomeTemplate, type BrandColors,
} from '../../lib/siteConfig';
import { processFormImage } from '../../lib/media';

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
      note: t('En préparation — rend le template classique pour l’instant.'),
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
    </div>
  );
}
