import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Save, Trash2, Plus, LogOut, Shield, Camera, Globe, Navigation, Wallet, Heart, ShoppingBag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchOrders, type Order } from '../lib/orders';
import { toast } from 'sonner';

interface SavedAddress {
  id: string;
  label: string;
  city: string;
  neighborhood: string;
  landmark: string;
  fullText: string;
  lat?: number;
  lng?: number;
}

const ADDRESSES_KEY = 'yamo_saved_addresses';
const PROFILE_NAME_KEY = 'yamo_profile_name';
const PROFILE_LANG_KEY = 'yamo_profile_lang';
const PROFILE_PHOTO_KEY = 'yamo_profile_photo';

function readAddresses(): SavedAddress[] {
  try {
    return JSON.parse(localStorage.getItem(ADDRESSES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeAddresses(addrs: SavedAddress[]) {
  localStorage.setItem(ADDRESSES_KEY, JSON.stringify(addrs));
}

export default function Profile() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [city, setCity] = useState('Douala');
  const [neighborhood, setNeighborhood] = useState('');
  const [landmark, setLandmark] = useState('');

  // C1: profile enrichment
  const [profileName, setProfileName] = useState(() => localStorage.getItem(PROFILE_NAME_KEY) ?? '');
  const [profileLang, setProfileLang] = useState(() => localStorage.getItem(PROFILE_LANG_KEY) ?? 'fr');
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem(PROFILE_PHOTO_KEY) ?? '');
  const photoRef = useRef<HTMLInputElement>(null);

  // C2: geolocation
  const [geoLoading, setGeoLoading] = useState(false);

  // S5: historique de dépenses + plats/restaurants favoris
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  useEffect(() => {
    if (!user) return;
    fetchOrders(user.id).then(setMyOrders);
  }, [user]);

  const activityStats = useMemo(() => {
    const delivered = myOrders.filter((o) => o.status === 'delivered');
    const totalSpent = delivered.reduce((sum, o) => sum + o.total, 0);

    const dishCounts: Record<string, number> = {};
    for (const o of delivered) {
      for (const item of o.items) {
        dishCounts[item.name] = (dishCounts[item.name] ?? 0) + item.quantity;
      }
    }
    const favoriteDish = Object.entries(dishCounts).sort((a, b) => b[1] - a[1])[0];

    const restaurantCounts: Record<string, number> = {};
    for (const o of delivered) {
      const name = o.restaurantName || 'Restaurant';
      restaurantCounts[name] = (restaurantCounts[name] ?? 0) + 1;
    }
    const favoriteRestaurant = Object.entries(restaurantCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      orderCount: delivered.length,
      totalSpent,
      favoriteDish: favoriteDish ? { name: favoriteDish[0], count: favoriteDish[1] } : null,
      favoriteRestaurant: favoriteRestaurant ? { name: favoriteRestaurant[0], count: favoriteRestaurant[1] } : null,
    };
  }, [myOrders]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setProfilePhoto(dataUrl);
      localStorage.setItem(PROFILE_PHOTO_KEY, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = () => {
    localStorage.setItem(PROFILE_NAME_KEY, profileName);
    localStorage.setItem(PROFILE_LANG_KEY, profileLang);
    toast.success('Profil mis à jour');
  };

  const handleGeolocate = () => {
    setGeoLoading(true);
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non supportée');
      setGeoLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => { setGeoLoading(false); toast.success('Position détectée — ajoutée à l\'adresse'); },
      () => { toast.error('Géolocalisation refusée'); setGeoLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/connexion', { state: { from: '/profil' } });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    setAddresses(readAddresses());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!neighborhood || !landmark) return;
    const fullText = `${neighborhood}, ${city} — ${landmark}`;
    let updated: SavedAddress[];
    if (editingId) {
      updated = addresses.map((a) =>
        a.id === editingId ? { ...a, label, city, neighborhood, landmark, fullText } : a
      );
    } else {
      const newAddr: SavedAddress = { id: crypto.randomUUID(), label, city, neighborhood, landmark, fullText };
      updated = [newAddr, ...addresses];
    }
    setAddresses(updated);
    writeAddresses(updated);
    resetForm();
  };

  const handleDelete = (id: string) => {
    const updated = addresses.filter((a) => a.id !== id);
    setAddresses(updated);
    writeAddresses(updated);
  };

  const handleEdit = (addr: SavedAddress) => {
    setLabel(addr.label);
    setCity(addr.city);
    setNeighborhood(addr.neighborhood);
    setLandmark(addr.landmark);
    setEditingId(addr.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setLabel('');
    setCity('Douala');
    setNeighborhood('');
    setLandmark('');
  };

  if (!user) return null;

  const roleLabels: Record<string, string> = {
    client: 'Client',
    restaurant: 'Restaurateur',
    livreur: 'Livreur',
    admin: 'Administrateur',
  };

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <div className="max-w-[640px] mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl mb-6">
          Mon Profil
        </h1>

        {/* Identity card */}
        <section className="bg-white rounded-xl border border-border-custom p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {/* Photo upload */}
            <div className="relative shrink-0">
              {profilePhoto ? (
                <img src={profilePhoto} alt="Photo" className="w-16 h-16 rounded-full object-cover border-2 border-green-primary" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-green-light flex items-center justify-center">
                  <User className="w-7 h-7 text-green-primary" />
                </div>
              )}
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-green-primary text-white flex items-center justify-center shadow"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </div>
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Votre nom complet"
                className="w-full bg-bg-secondary rounded-lg px-3 h-10 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
              />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-bg-secondary rounded-lg px-3 h-10">
                  <Globe className="w-4 h-4 text-text-muted" />
                  <select
                    value={profileLang}
                    onChange={(e) => setProfileLang(e.target.value)}
                    className="bg-transparent text-text-primary font-inter text-sm outline-none"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <span className="text-text-muted text-xs font-inter">{user.phone}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-secondary font-inter text-sm">
              {roleLabels[user.role] ?? user.role}
            </span>
            {!user.isApproved && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gold-light text-gold-accent">En attente</span>
            )}
          </div>
          <button onClick={saveProfile} className="mt-3 flex items-center gap-1.5 text-green-primary text-sm font-inter font-medium hover:underline">
            <Save className="w-3.5 h-3.5" /> Enregistrer le profil
          </button>
        </section>

        {/* S5: Mon activité — historique de dépenses, plats/restaurants favoris */}
        {activityStats.orderCount > 0 && (
          <section className="bg-white rounded-xl border border-border-custom p-5 sm:p-6 mb-6">
            <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-green-primary" />
              Mon activité
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-bg-secondary rounded-lg p-3 text-center">
                <p className="text-text-muted text-xs font-inter mb-0.5">Commandes livrées</p>
                <p className="font-poppins font-bold text-text-primary text-xl">{activityStats.orderCount}</p>
              </div>
              <div className="bg-bg-secondary rounded-lg p-3 text-center">
                <p className="text-text-muted text-xs font-inter mb-0.5 flex items-center justify-center gap-1">
                  <Wallet className="w-3 h-3" />Total dépensé
                </p>
                <p className="font-poppins font-bold text-green-primary text-xl">{activityStats.totalSpent.toLocaleString()} FCFA</p>
              </div>
            </div>
            {(activityStats.favoriteDish || activityStats.favoriteRestaurant) && (
              <div className="space-y-2">
                {activityStats.favoriteDish && (
                  <div className="flex items-center gap-2 text-sm font-inter">
                    <Heart className="w-4 h-4 text-error shrink-0" />
                    <span className="text-text-secondary">Plat préféré :</span>
                    <span className="font-medium text-text-primary">{activityStats.favoriteDish.name}</span>
                    <span className="text-text-muted text-xs">({activityStats.favoriteDish.count}×)</span>
                  </div>
                )}
                {activityStats.favoriteRestaurant && (
                  <div className="flex items-center gap-2 text-sm font-inter">
                    <Heart className="w-4 h-4 text-error shrink-0" />
                    <span className="text-text-secondary">Restaurant préféré :</span>
                    <span className="font-medium text-text-primary">{activityStats.favoriteRestaurant.name}</span>
                    <span className="text-text-muted text-xs">({activityStats.favoriteRestaurant.count} commande{activityStats.favoriteRestaurant.count > 1 ? 's' : ''})</span>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Saved addresses */}
        <section className="bg-white rounded-xl border border-border-custom p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-poppins font-semibold text-text-primary text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-primary" />
              Adresses enregistrées
            </h2>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 text-green-primary font-inter font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            )}
          </div>

          {showForm && (
            <form onSubmit={handleSave} className="mb-4 p-4 bg-bg-secondary rounded-lg space-y-3">
              <h3 className="font-inter font-semibold text-text-primary text-sm">
                {editingId ? 'Modifier l\'adresse' : 'Nouvelle adresse'}
              </h3>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Nom (ex. Maison, Bureau)"
                className="w-full bg-white rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="bg-white rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
                >
                  <option value="Douala">Douala</option>
                  <option value="Yaoundé">Yaoundé</option>
                </select>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Quartier"
                  className="bg-white rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                  required
                />
              </div>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Point de repère"
                className="w-full bg-white rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-green-dark transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> Enregistrer
                </button>
                <button
                  type="button"
                  onClick={handleGeolocate}
                  disabled={geoLoading}
                  className="flex items-center gap-1.5 border border-border-custom text-text-secondary font-inter text-sm px-4 h-10 rounded-lg hover:bg-bg-secondary transition-colors disabled:opacity-50"
                >
                  <Navigation className="w-4 h-4" />
                  {geoLoading ? 'Détection...' : 'Me géolocaliser'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-text-secondary font-inter text-sm px-4 h-10 rounded-lg hover:bg-border-light transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          {addresses.length === 0 && !showForm ? (
            <p className="text-text-secondary font-inter text-sm text-center py-4">
              Aucune adresse enregistrée. Ajoutez-en une pour vos prochaines commandes.
            </p>
          ) : (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <div key={addr.id} className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
                  <div>
                    {addr.label && (
                      <p className="font-inter font-semibold text-text-primary text-sm">{addr.label}</p>
                    )}
                    <p className="text-text-secondary text-xs font-inter">{addr.fullText}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(addr)}
                      className="text-xs font-inter font-medium text-text-secondary hover:text-green-primary px-2 py-1 transition-colors"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(addr.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Actions */}
        <section className="space-y-3">
          <button
            onClick={() => navigate('/commandes')}
            className="w-full bg-white rounded-xl border border-border-custom p-4 text-left font-inter font-medium text-text-primary hover:bg-bg-secondary transition-colors"
          >
            📦 Mes commandes
          </button>
          <button
            onClick={() => { signOut(); navigate('/'); }}
            className="w-full bg-white rounded-xl border border-border-custom p-4 text-left font-inter font-medium text-error hover:bg-error/5 transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </section>
      </div>
    </div>
  );
}
