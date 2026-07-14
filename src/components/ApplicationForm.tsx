import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Upload, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { submitApplication, type ApplicationType } from '../lib/applications';
import { activeCities, getNeighborhoods } from '../data/locations';

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
      alert("L'image ne doit pas dépasser 5 Mo.");
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
  const [city, setCity] = useState('Douala');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

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
    setSubmitting(true);
    try {
      await submitApplication(user.id, {
        type,
        restaurantName: type === 'restaurant' ? restaurantName : undefined,
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
      className="bg-white rounded-xl border border-border-custom p-6 max-w-[520px] mx-auto space-y-4 text-left"
    >
      {type === 'restaurant' && (
        <div>
          <label className="block text-text-secondary font-inter text-sm mb-1.5">Nom du restaurant</label>
          <input
            type="text"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
            required
          />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-text-secondary font-inter text-sm mb-1.5">Ville</label>
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setAddress('');
              _setServiceNeighborhoods([]);
            }}
            className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
          >
            {activeCities.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-text-secondary font-inter text-sm mb-1.5">Téléphone</label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+237 6XX XX XX XX"
            className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
            required
          />
        </div>
      </div>
      {type === 'restaurant' ? (
        <div>
          <label className="block text-text-secondary font-inter text-sm mb-1.5">Adresse du restaurant</label>
          <select
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
            required
          >
            <option value="">Sélectionnez un quartier</option>
            {neighborhoods.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-text-secondary font-inter text-sm mb-1.5">Zone de livraison</label>
          <p className="text-text-muted text-xs font-inter mb-2">
            Un livreur ne voit et ne peut accepter que les commandes de restaurants situés dans sa ville, sur les
            quartiers qu'il dessert.
          </p>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={serviceAllCity}
              onChange={(e) => {
                _setServiceAllCity(e.target.checked);
                if (e.target.checked) _setServiceNeighborhoods([]);
              }}
              className="w-4 h-4 accent-green-primary"
            />
            <span className="text-sm font-inter text-text-primary">Je livre dans toute la ville de {city}</span>
          </label>
          {!serviceAllCity && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-bg-secondary rounded-lg p-3 max-h-44 overflow-y-auto">
              {neighborhoods.map((n) => (
                <label key={n} className="flex items-center gap-1.5 text-xs font-inter text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={serviceNeighborhoods.includes(n)}
                    onChange={() => toggleServiceNeighborhood(n)}
                    className="w-3.5 h-3.5 accent-green-primary"
                  />
                  {n}
                </label>
              ))}
            </div>
          )}
          {!serviceAllCity && serviceNeighborhoods.length === 0 && (
            <p className="text-error text-xs font-inter mt-1.5">Sélectionnez au moins un quartier, ou cochez "toute la ville".</p>
          )}
        </div>
      )}

      {/* Documents */}
      <div className="border-t border-border-light pt-4">
        <p className="font-inter font-medium text-text-primary text-sm mb-3">
          📎 Documents requis ({type === 'restaurant' ? 'Restaurateur' : 'Livreur'})
        </p>
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

      <div>
        <label className="block text-text-secondary font-inter text-sm mb-1.5">
          Message (optionnel)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none"
        />
      </div>
      {error && <p className="text-error text-sm font-inter">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
      >
        {submitting ? 'Envoi...' : 'Envoyer ma candidature'}
      </button>
    </form>
  );
}
