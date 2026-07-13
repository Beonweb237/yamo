import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Bike, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { submitApplication, type ApplicationType } from '../lib/applications';

export default function Candidature() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState<ApplicationType>('restaurant');
  const [restaurantName, setRestaurantName] = useState('');
  const [city, setCity] = useState('Douala');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/connexion', { state: { from: '/candidature' } });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      setContactPhone(user.phone);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
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
      setSuccess(true);
    } catch {
      setError('Erreur lors de l\'envoi. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  const typeConfig = {
    restaurant: {
      icon: Store,
      title: 'Devenir Partenaire Restaurant',
      description: 'Rejoignez Yamo et développez votre activité de restauration.',
    },
    livreur: {
      icon: Bike,
      title: 'Devenir Livreur Yamo',
      description: 'Gagnez de l\'argent en livrant quand vous voulez.',
    },
  };

  const config = typeConfig[type];

  if (success) {
    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <div className="w-full max-w-[480px] bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-8 text-center my-12">
          <CheckCircle2 className="w-14 h-14 text-success mx-auto mb-4" />
          <h1 className="font-poppins font-bold text-text-primary text-2xl mb-2">
            Candidature envoyée !
          </h1>
          <p className="text-text-secondary font-inter text-sm mb-6">
            Votre candidature {type === 'restaurant' ? 'restaurant' : 'livreur'} est en cours d'examen.
            Notre équipe vous contactera sous 24-48h pour la suite.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-green-primary text-white font-inter font-semibold px-6 h-11 rounded-lg hover:bg-green-dark transition-colors"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <div className="max-w-[600px] mx-auto px-4 sm:px-6 py-10">
        {/* Type selector */}
        <div className="flex gap-1 bg-white rounded-lg border border-border-custom p-1 mb-6 w-fit">
          <button
            onClick={() => setType('restaurant')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-inter font-medium transition-colors ${type === 'restaurant'
                ? 'bg-green-primary text-white'
                : 'text-text-secondary hover:text-text-primary'
              }`}
          >
            <Store className="w-4 h-4" />
            Restaurant
          </button>
          <button
            onClick={() => setType('livreur')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-inter font-medium transition-colors ${type === 'livreur'
                ? 'bg-green-primary text-white'
                : 'text-text-secondary hover:text-text-primary'
              }`}
          >
            <Bike className="w-4 h-4" />
            Livreur
          </button>
        </div>

        <div className="bg-white rounded-xl border border-border-custom p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-green-light flex items-center justify-center">
              <config.icon className="w-5 h-5 text-green-primary" />
            </div>
            <div>
              <h1 className="font-poppins font-bold text-text-primary text-xl">{config.title}</h1>
              <p className="text-text-secondary text-sm font-inter">{config.description}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {type === 'restaurant' && (
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">
                  Nom du restaurant
                </label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Ex. Chez Mama"
                  className="w-full bg-bg-secondary rounded-lg px-3 h-12 text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">Ville</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-bg-secondary rounded-lg px-3 h-12 text-text-primary font-inter text-[15px] outline-none"
                >
                  <option value="Douala">Douala</option>
                  <option value="Yaoundé">Yaoundé</option>
                </select>
              </div>
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">
                  Adresse / Quartier
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex. Bonapriso"
                  className="w-full bg-bg-secondary rounded-lg px-3 h-12 text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Téléphone de contact
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+237 6XX XX XX XX"
                className="w-full bg-bg-secondary rounded-lg px-3 h-12 text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                required
              />
            </div>

            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Message (optionnel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  type === 'restaurant'
                    ? 'Décrivez votre restaurant, type de cuisine...'
                    : 'Décrivez votre expérience, moyen de transport...'
                }
                rows={3}
                className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted resize-none"
              />
            </div>

            {error && <p className="text-error text-sm font-inter">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Envoi...' : 'Envoyer ma candidature'}
            </button>

            <p className="text-text-muted text-xs font-inter text-center">
              Votre candidature sera examinée par notre équipe. Vous recevrez une réponse sous 24-48h.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
