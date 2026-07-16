import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, Upload, X, MapPin, Navigation, Loader2, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { submitApplication, type ApplicationType } from '../lib/applications';
import { activeCities, getNeighborhoods } from '../data/locations';
import { slugify } from '../lib/utils';

function FileUploadField({
  label,
  description,
  accept = 'image/*',
  value,
  onChange,
}: {
  label: string;
  description?: string;
  accept?: string;
  value: string | undefined;
  onChange: (base64: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label className="block text-text-secondary font-inter text-sm mb-1.5">{label}</label>
      {description && <p className="text-text-muted text-xs font-inter mb-2">{description}</p>}
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt={label} className="h-24 rounded-lg border border-border-custom object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-error text-white flex items-center justify-center hover:bg-error/80"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 border-2 border-dashed border-border-custom rounded-lg px-4 h-20 text-text-muted hover:text-text-secondary hover:border-text-muted transition-colors"
        >
          <Upload className="w-5 h-5" />
          <span className="font-inter text-sm">Cliquez pour téléverser</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
    </div>
  );
}

export default function ApplicationForm({ type }: { type: ApplicationType }) {
  const { user, refreshUser } = useAuth();
  const [restaurantName, setRestaurantName] = useState('');
  // Slug auto-généré depuis le nom, éditable avant soumission (définitif après)
  const suggestedSlug = useMemo(() => slugify(restaurantName), [restaurantName]);
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  // Mettre à jour le slug automatiquement tant que l'utilisateur ne l'a pas édité manuellement
  useEffect(() => {
    if (!slugManuallyEdited && suggestedSlug) {
      setSlug(suggestedSlug);
    }
  }, [suggestedSlug, slugManuallyEdited]);
  const [city, setCity] = useState('Douala');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // GPS coordinates (obligatoire pour restaurant)
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setError('Géolocalisation non supportée par votre navigateur.');
      return;
    }
    setGeoLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGeoLoading(false);
      },
      () => {
        setError('Géolocalisation refusée. Activez-la ou entrez les coordonnées manuellement.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Zone de service (livreur uniquement) — par défaut toute la ville ;
  // décocher permet de choisir des quartiers précis.
  const [serviceAllCity, _setServiceAllCity] = useState(true);
  const [serviceNeighborhoods, _setServiceNeighborhoods] = useState<string[]>([]);
  const toggleServiceNeighborhood = (n: string) => {
    _setServiceNeighborhoods((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  };

  // Document fields
  const [idDocument, setIdDocument] = useState('');
  const [businessReg, setBusinessReg] = useState('');
  const [licenseDocument, setLicenseDocument] = useState('');
  const [insuranceDocument, setInsuranceDocument] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [vehiclePhoto, setVehiclePhoto] = useState('');
  const [restaurantPhoto, setRestaurantPhoto] = useState('');

  const neighborhoods = getNeighborhoods(city);

  const expectedRole = type === 'restaurant' ? 'restaurant' : 'livreur';

  if (!user) {
    return (
      <div className="bg-white rounded-xl border border-border-custom p-6 text-center max-w-[520px] mx-auto">
        <p className="text-text-secondary font-inter text-sm mb-4">
          Connectez-vous (en choisissant le profil {type === 'restaurant' ? 'Restaurateur' : 'Livreur'}) pour envoyer votre candidature.
        </p>
        <Link
          to="/connexion"
          className="inline-block bg-green-primary text-white font-inter font-semibold px-6 h-11 leading-[44px] rounded-lg hover:bg-green-dark transition-colors"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (user.role !== expectedRole) {
    return (
      <div className="bg-white rounded-xl border border-border-custom p-6 text-center max-w-[520px] mx-auto">
        <p className="text-text-secondary font-inter text-sm">
          Ce compte est enregistré avec un autre profil. Connectez-vous avec un compte
          {type === 'restaurant' ? ' Restaurateur' : ' Livreur'} pour candidater ici.
        </p>
      </div>
    );
  }

  if (user.isApproved) {
    return (
      <div className="bg-white rounded-xl border border-border-custom p-6 text-center max-w-[520px] mx-auto">
        <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
        <p className="text-text-secondary font-inter text-sm">
          Votre compte est déjà approuvé.{' '}
          <Link to={type === 'restaurant' ? '/partenaires/dashboard' : '/livreurs/dashboard'} className="text-green-primary font-medium hover:underline">
            Accéder à votre espace
          </Link>
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-xl border border-border-custom p-6 text-center max-w-[520px] mx-auto">
        <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
        <p className="text-text-secondary font-inter text-sm">
          Candidature envoyée ! Notre équipe l&apos;examine et vous recevrez l&apos;accès à votre
          espace dès son approbation.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (type === 'livreur' && !serviceAllCity && serviceNeighborhoods.length === 0) {
      setError('Sélectionnez au moins un quartier, ou cochez "toute la ville".');
      return;
    }
    if (type === 'restaurant' && (lat === null || lng === null)) {
      setError('Les coordonnées GPS sont obligatoires. Cliquez sur "Me géolocaliser" depuis le lieu du restaurant.');
      return;
    }
    setSubmitting(true);
    try {
      await submitApplication(user.id, {
        type,
        restaurantName: type === 'restaurant' ? restaurantName : undefined,
        restaurantSlug: type === 'restaurant' ? (slug || suggestedSlug) : undefined,
        city,
        address,
        contactPhone,
        notes,
        serviceNeighborhoods: type === 'livreur' && !serviceAllCity ? serviceNeighborhoods : undefined,
        idDocument,
        businessReg: type === 'restaurant' ? businessReg : undefined,
        licenseDocument: type === 'livreur' ? licenseDocument : undefined,
        insuranceDocument: type === 'livreur' ? insuranceDocument : undefined,
        profilePhoto,
        vehiclePhoto: type === 'livreur' ? vehiclePhoto : undefined,
        restaurantPhoto: type === 'restaurant' ? restaurantPhoto : undefined,
        lat: type === 'restaurant' ? lat ?? undefined : undefined,
        lng: type === 'restaurant' ? lng ?? undefined : undefined,
      });
      await refreshUser();
      setSubmitted(true);
    } catch {
      setError("Impossible d'envoyer la candidature. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-border-custom shadow-sm p-6 sm:p-8 max-w-[560px] mx-auto space-y-5 text-left"
    >
      {/* ── En-tête ── */}
      <div className="pb-4 border-b border-border-light">
        <h2 className="font-poppins font-semibold text-text-primary text-lg">
          {type === 'restaurant' ? 'Candidature Restaurant' : 'Candidature Livreur'}
        </h2>
        <p className="text-text-muted text-xs font-inter mt-1">
          Remplissez tous les champs requis. Votre candidature sera examinée sous 48h.
        </p>
      </div>

      {type === 'restaurant' && (
        <div className="space-y-1.5">
          <label className="block text-text-primary font-inter text-sm font-semibold">
            Nom du restaurant <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            placeholder="Ex: Chez Mama, Le Bûcheron..."
            className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-sm placeholder:text-text-muted outline-none transition-all focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 hover:border-text-muted"
            required
          />
        </div>
      )}
      {type === 'restaurant' && suggestedSlug && (
        <div className="space-y-1.5">
          <label className="block text-text-primary font-inter text-sm font-semibold flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-green-primary" />
            Adresse web de votre restaurant
          </label>
          <div className="flex items-center gap-1 bg-white rounded-xl border border-border-custom px-4 h-12 transition-all focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10 hover:border-text-muted">
            <span className="text-text-muted text-xs font-inter shrink-0 select-none">miamexpress.cm/restaurant/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugManuallyEdited(true); }}
              className="flex-1 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
              placeholder={suggestedSlug}
            />
          </div>
          <p className="text-[10px] font-inter text-text-muted">
            Ce lien sera <strong className="text-text-primary">définitif</strong> après soumission. Pour le modifier, contactez le support.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-text-primary font-inter text-sm font-semibold">
            Ville <span className="text-error">*</span>
          </label>
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setAddress('');
              _setServiceNeighborhoods([]);
            }}
            className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-sm outline-none transition-all focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 hover:border-text-muted appearance-none cursor-pointer"
          >
            {activeCities.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-text-primary font-inter text-sm font-semibold">
            Téléphone <span className="text-error">*</span>
          </label>
          <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 transition-all focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10 hover:border-text-muted">
            <span className="text-text-primary font-inter text-sm font-semibold shrink-0 select-none">+237</span>
            <input
              type="tel"
              value={contactPhone.replace('+237 ', '')}
              onChange={(e) => setContactPhone('+237 ' + e.target.value.replace(/\s/g, ''))}
              placeholder="6XX XX XX XX"
              className="flex-1 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
              required
            />
          </div>
        </div>
      </div>
      {type === 'restaurant' ? (
        <>
          <div className="space-y-1.5">
            <label className="block text-text-primary font-inter text-sm font-semibold">
              Quartier du restaurant <span className="text-error">*</span>
            </label>
            <select
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-sm outline-none transition-all focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 hover:border-text-muted appearance-none cursor-pointer"
              required
            >
              <option value="">— Sélectionnez un quartier —</option>
              {neighborhoods.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {/* Coordonnées GPS obligatoires */}
          <div className="bg-bg-secondary rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-text-primary font-inter text-sm font-semibold">
                Coordonnées GPS <span className="text-error">*</span>
              </label>
              <p className="text-text-muted text-xs font-inter mt-0.5">
                Placez-vous devant le restaurant et utilisez la géolocalisation. Ces coordonnées servent au calcul des distances de livraison.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGeolocate}
              disabled={geoLoading}
              className="flex items-center gap-2 bg-green-primary text-white font-inter font-semibold text-sm px-5 h-11 rounded-xl hover:bg-green-dark transition-all disabled:opacity-60 active:scale-[0.98]"
            >
              {geoLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Détection en cours...</>
              ) : (
                <><Navigation className="w-4 h-4" /> Me géolocaliser</>
              )}
            </button>
            {(lat !== null && lng !== null) && (
              <p className="text-green-primary text-xs font-inter font-medium bg-green-light rounded-lg px-3 py-1.5 inline-block">
                ✅ {lat.toFixed(6)}, {lng.toFixed(6)}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-text-muted text-[11px] font-inter font-medium uppercase tracking-wider">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={lat ?? ''}
                  onChange={(e) => setLat(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Ex: 4.0511"
                  className="w-full bg-white rounded-lg border border-border-custom px-3 h-10 text-text-primary font-inter text-xs outline-none transition-all focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 placeholder:text-text-muted"
                />
              </div>
              <div className="space-y-1">
                <label className="text-text-muted text-[11px] font-inter font-medium uppercase tracking-wider">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={lng ?? ''}
                  onChange={(e) => setLng(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Ex: 9.7679"
                  className="w-full bg-white rounded-lg border border-border-custom px-3 h-10 text-text-primary font-inter text-xs outline-none transition-all focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 placeholder:text-text-muted"
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-bg-secondary rounded-xl p-4 space-y-3">
          <label className="block text-text-primary font-inter text-sm font-semibold">Zone de livraison</label>
          <p className="text-text-muted text-xs font-inter">
            Vous ne verrez que les commandes de restaurants situés dans votre ville, sur les quartiers que vous desservez.
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={serviceAllCity}
              onChange={(e) => {
                _setServiceAllCity(e.target.checked);
                if (e.target.checked) _setServiceNeighborhoods([]);
              }}
              className="w-4 h-4 accent-green-primary rounded"
            />
            <span className="text-sm font-inter font-medium text-text-primary">Je livre dans toute la ville de {city}</span>
          </label>
          {!serviceAllCity && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 bg-white rounded-xl border border-border-custom p-3 max-h-44 overflow-y-auto">
              {neighborhoods.map((n) => (
                <label key={n} className="flex items-center gap-1.5 text-xs font-inter text-text-secondary cursor-pointer hover:text-text-primary transition-colors py-0.5">
                  <input
                    type="checkbox"
                    checked={serviceNeighborhoods.includes(n)}
                    onChange={() => toggleServiceNeighborhood(n)}
                    className="w-3.5 h-3.5 accent-green-primary rounded"
                  />
                  {n}
                </label>
              ))}
            </div>
          )}
          {!serviceAllCity && serviceNeighborhoods.length === 0 && (
            <p className="text-error text-xs font-inter">Sélectionnez au moins un quartier, ou cochez "toute la ville".</p>
          )}
        </div>
      )}

      {/* ── Documents ── */}
      <div className="border-t border-border-light pt-5 space-y-4">
        <div>
          <p className="font-poppins font-semibold text-text-primary text-sm mb-1">
            📎 Documents requis
          </p>
          <p className="text-text-muted text-xs font-inter">
            {type === 'restaurant' ? 'Restaurateur' : 'Livreur'} — formats acceptés : JPG, PNG (max 5 Mo)
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileUploadField
            label="Pièce d'identité (CNI / Passeport)"
            description="Recto-verso lisible"
            value={idDocument}
            onChange={setIdDocument}
          />
          <FileUploadField
            label="Photo de profil"
            value={profilePhoto}
            onChange={setProfilePhoto}
          />
          {type === 'restaurant' ? (
            <>
              <FileUploadField
                label="Registre de commerce"
                value={businessReg}
                onChange={setBusinessReg}
              />
              <FileUploadField
                label="Photo du restaurant"
                description="Façade ou intérieur"
                value={restaurantPhoto}
                onChange={setRestaurantPhoto}
              />
            </>
          ) : (
            <>
              <FileUploadField
                label="Permis de conduire"
                value={licenseDocument}
                onChange={setLicenseDocument}
              />
              <FileUploadField
                label="Attestation d'assurance"
                value={insuranceDocument}
                onChange={setInsuranceDocument}
              />
              <FileUploadField
                label="Photo du véhicule / moto"
                value={vehiclePhoto}
                onChange={setVehiclePhoto}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Message optionnel ── */}
      <div className="space-y-1.5">
        <label className="block text-text-primary font-inter text-sm font-semibold">
          Message <span className="text-text-muted font-normal text-xs">(optionnel)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Une précision à apporter à votre candidature ?"
          className="w-full bg-white rounded-xl border border-border-custom px-4 py-3 text-text-primary font-inter text-sm outline-none resize-none transition-all focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 hover:border-text-muted placeholder:text-text-muted"
        />
      </div>

      {error && (
        <div className="p-3 bg-error/5 border border-error/20 rounded-xl flex items-start gap-2.5">
          <X className="w-4 h-4 text-error mt-0.5 shrink-0" />
          <p className="text-error text-sm font-inter">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-xl hover:bg-green-dark transition-all disabled:opacity-60 active:scale-[0.99] flex items-center justify-center gap-2"
      >
        {submitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours...</>
        ) : (
          'Envoyer ma candidature'
        )}
      </button>

      <p className="text-[11px] font-inter text-text-muted text-center">
        Votre candidature sera examinée par notre équipe. Vous recevrez une réponse sous 48h.
      </p>
    </form>
  );
}
