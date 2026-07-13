import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { submitApplication, type ApplicationType } from '../lib/applications';
import { activeCities, getNeighborhoods } from '../data/locations';

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
    setSubmitting(true);
    try {
      await submitApplication(user.id, {
        type,
        restaurantName: type === 'restaurant' ? restaurantName : undefined,
        city,
        address,
        contactPhone,
        notes,
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
      <div>
        <label className="block text-text-secondary font-inter text-sm mb-1.5">
          {type === 'restaurant' ? 'Adresse du restaurant' : 'Quartier / zone de livraison'}
        </label>
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
