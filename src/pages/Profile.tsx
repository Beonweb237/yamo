import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, MapPin, Save, Trash2, Plus, LogOut, Shield, Camera, Globe, Navigation, Wallet, Heart, ShoppingBag, MessageCircle, Gauge } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Switch } from '../components/ui/switch';
import { fetchOrders, type Order } from '../lib/orders';
import { toast } from 'sonner';
import LazyDeliveryMap, { type MapPoint } from '../components/LazyDeliveryMap';
import AddressAutocomplete from '../components/AddressAutocomplete';

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
const PROFILE_WHATSAPP_KEY = 'yamo_profile_whatsapp';
const MAX_ADDRESSES = 5;

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
  const { user, loading: authLoading, signOut, updateProfileName } = useAuth();
  const { dataSaver, setDataSaver } = useSettings();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [fullText, setFullText] = useState('');
  const [city, setCity] = useState('Douala');
  const [neighborhood, setNeighborhood] = useState('');
  const [landmark, setLandmark] = useState('');

  // C1: profile enrichment
  const [profileName, setProfileName] = useState(() => localStorage.getItem(PROFILE_NAME_KEY) ?? '');
  const [profileLang, setProfileLang] = useState(() => localStorage.getItem(PROFILE_LANG_KEY) ?? 'fr');
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem(PROFILE_PHOTO_KEY) ?? '');
  const [whatsapp, setWhatsapp] = useState(() => localStorage.getItem(PROFILE_WHATSAPP_KEY) ?? '');
  const photoRef = useRef<HTMLInputElement>(null);

  // C2: geolocation
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);

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

  const [savingProfile, setSavingProfile] = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      localStorage.setItem(PROFILE_NAME_KEY, profileName);
      localStorage.setItem(PROFILE_LANG_KEY, profileLang);
      localStorage.setItem(PROFILE_WHATSAPP_KEY, whatsapp);
      if (profileName.trim()) await updateProfileName(profileName.trim());
      toast.success('Profil mis à jour');
    } catch {
      toast.error('Le nom a été enregistré localement, mais pas synchronisé au serveur.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGeolocate = () => {
    setGeoLoading(true);
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non supportée');
      setGeoLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGeoLoading(false);
        toast.success('Position détectée — sera enregistrée avec l\'adresse');
      },
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
    if (!fullText && !neighborhood) return;
    const addressFullText = fullText || `${neighborhood}, ${city} — ${landmark}`;
    let updated: SavedAddress[];
    if (editingId) {
      updated = addresses.map((a) =>
        a.id === editingId
          ? { ...a, label, city, neighborhood, landmark, fullText: addressFullText, lat: geoCoords?.lat ?? a.lat, lng: geoCoords?.lng ?? a.lng }
          : a
      );
    } else {
      if (addresses.length >= MAX_ADDRESSES) {
        toast.error(`Maximum ${MAX_ADDRESSES} adresses enregistrées. Supprimez-en une pour en ajouter une nouvelle.`);
        return;
      }
      const newAddr: SavedAddress = {
        id: crypto.randomUUID(), label, city, neighborhood, landmark, fullText: addressFullText,
        lat: geoCoords?.lat, lng: geoCoords?.lng,
      };
      updated = [newAddr, ...addresses];
    }
    setAddresses(updated);
    writeAddresses(updated);
    toast.success('Adresse enregistrée avec GPS ✅');
    resetForm();
  };

  const handleDelete = (id: string) => {
    const updated = addresses.filter((a) => a.id !== id);
    setAddresses(updated);
    writeAddresses(updated);
  };

  const handleEdit = (addr: SavedAddress) => {
    setLabel(addr.label);
    setFullText(addr.fullText);
    setCity(addr.city);
    setNeighborhood(addr.neighborhood);
    setLandmark(addr.landmark);
    setEditingId(addr.id);
    setGeoCoords(addr.lat != null && addr.lng != null ? { lat: addr.lat, lng: addr.lng } : null);
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setLabel('');
    setFullText('');
    setCity('Douala');
    setNeighborhood('');
    setLandmark('');
    setGeoCoords(null);
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
                className="w-full bg-white rounded-xl border border-border-custom px-4 h-11 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted transition-all focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 hover:border-text-muted"
              />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-11 transition-all focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10 hover:border-text-muted">
                  <Globe className="w-4 h-4 text-text-muted shrink-0" />
                  <select
                    value={profileLang}
                    onChange={(e) => setProfileLang(e.target.value)}
                    className="bg-transparent text-text-primary font-inter text-sm outline-none cursor-pointer"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <span className="text-text-muted text-xs font-inter">{user.phone}</span>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-11 transition-all focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10 hover:border-text-muted">
                <MessageCircle className="w-4 h-4 text-green-primary shrink-0" />
                <span className="text-text-primary font-inter text-sm font-semibold shrink-0 select-none">+237</span>
                <input
                  type="tel"
                  value={whatsapp.replace('+237 ', '')}
                  onChange={(e) => setWhatsapp('+237 ' + e.target.value.replace(/\s/g, ''))}
                  placeholder="6XX XX XX XX (WhatsApp)"
                  className="flex-1 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                />
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
          <button onClick={saveProfile} disabled={savingProfile} className="mt-3 flex items-center gap-1.5 text-green-primary text-sm font-inter font-semibold hover:underline disabled:opacity-60 transition-all">
            <Save className="w-3.5 h-3.5" /> {savingProfile ? 'Enregistrement...' : 'Enregistrer le profil'}
          </button>
        </section>

        {/* ── Préférences d'affichage (CONF-30) ── */}
        <section className="bg-white rounded-xl border border-border-custom p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-green-light flex items-center justify-center shrink-0">
                <Gauge className="w-5 h-5 text-green-primary" />
              </div>
              <div className="min-w-0">
                <label htmlFor="data-saver-switch" className="block font-inter font-semibold text-text-primary text-sm cursor-pointer">
                  Économie de données
                </label>
                <p className="text-text-secondary font-inter text-xs mt-0.5">
                  Désactive les animations et diffère le chargement des images — recommandé en 3G ou forfait limité.
                </p>
              </div>
            </div>
            <Switch
              id="data-saver-switch"
              checked={dataSaver}
              onCheckedChange={(checked) => {
                setDataSaver(checked);
                toast.success(checked ? 'Économie de données activée' : 'Économie de données désactivée');
              }}
              aria-label="Économie de données"
            />
          </div>
        </section>

        {/* ── Accès rapides ── */}
        <section className="mb-6">
          <h2 className="font-poppins font-semibold text-text-primary text-sm uppercase tracking-wider text-text-muted mb-3 px-1">
            Accès rapides
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: '/commandes', icon: '📦', label: 'Mes commandes', desc: 'Historique et suivi' },
              { to: '/favoris', icon: '❤️', label: 'Favoris', desc: 'Restos & plats sauvegardés' },
              { to: '/demandes/mes-demandes', icon: '🍽️', label: 'Demandes de plats', desc: 'Mes demandes sur mesure' },
              { to: '/restaurants?mode=plats', icon: '🔍', label: 'Explorer', desc: 'Trouver un plat' },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-3 bg-white rounded-2xl border border-border-custom shadow-sm p-4 hover:border-green-primary hover:shadow-md hover:-translate-y-0.5 transition-all group"
              >
                <span className="text-2xl shrink-0">{link.icon}</span>
                <div className="min-w-0">
                  <p className="font-inter font-semibold text-text-primary text-sm group-hover:text-green-primary transition-colors">
                    {link.label}
                  </p>
                  <p className="text-text-muted text-[11px] font-inter truncate">{link.desc}</p>
                </div>
              </Link>
            ))}
          </div>
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

        {/* Adresse de livraison par défaut */}
        {addresses.length === 0 && (
          <section className="bg-white rounded-xl border border-border-custom p-5 sm:p-6 mb-6 border-l-4 border-l-gold-accent">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-gold-accent" />
              <h2 className="font-poppins font-semibold text-text-primary text-lg">
                Adresse de livraison
              </h2>
            </div>
            <p className="text-text-secondary font-inter text-sm mb-4">
              Ajoutez votre adresse pour passer votre première commande. Sans adresse, vous ne pourrez pas commander.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-green-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ajouter mon adresse
            </button>
          </section>
        )}
        {addresses.length > 0 && (
          <section className="bg-white rounded-xl border border-border-custom p-5 sm:p-6 mb-6 border-l-4 border-l-green-primary">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-green-primary" />
              <h2 className="font-poppins font-semibold text-text-primary text-lg">
                Adresse de livraison
              </h2>
              <span className="text-xs font-inter text-text-muted bg-bg-secondary px-2 py-0.5 rounded-full">par défaut</span>
            </div>
            <p className="text-text-primary font-inter text-sm font-medium">{addresses[0].fullText}</p>
            {addresses[0].label && (
              <p className="text-text-muted text-xs font-inter mt-0.5">{addresses[0].label}</p>
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
            {!showForm && addresses.length < MAX_ADDRESSES && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 text-green-primary font-inter font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            )}
            {!showForm && addresses.length >= MAX_ADDRESSES && (
              <p className="text-text-muted text-xs font-inter">
                Maximum {MAX_ADDRESSES} adresses
              </p>
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
                className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted transition-all focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 hover:border-text-muted"
              />
              <AddressAutocomplete
                value={fullText}
                onChange={(display, lat, lng) => {
                  setFullText(display);
                  if (lat != null && lng != null) setGeoCoords({ lat, lng });
                  // Parse city from display: "Quartier, Ville — ..."
                  const parts = display.split(',');
                  if (parts.length >= 2) {
                    const cityPart = parts[1]?.trim().split('—')[0]?.trim() || '';
                    const cityGuess = cityPart || 'Douala';
                    setCity(cityGuess);
                    setNeighborhood(parts[0]?.trim() || display);
                  }
                }}
                onNavigate={(lat, lng) => setGeoCoords({ lat, lng })}
                placeholder="Quartier, rue, ville..."
              />
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Point de repère (ex. Carrefour Bastos, face Orange)"
                className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted transition-all focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 hover:border-text-muted"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!fullText}
                  className="bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-green-dark transition-colors flex items-center gap-1.5 disabled:opacity-50"
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
              {geoCoords && (
                <div className="pt-1">
                  <p className="text-xs text-text-muted font-inter mb-1">📍 Cliquez sur la carte pour ajuster la position</p>
                  <LazyDeliveryMap
                    height="180px"
                    scrollWheelZoom={false}
                    points={[{ lat: geoCoords.lat, lng: geoCoords.lng, label: label || 'Position détectée', type: 'customer' }]}
                    onMapClick={(lat, lng) => {
                      setGeoCoords({ lat, lng });
                      toast.success('Position mise à jour');
                    }}
                  />
                </div>
              )}
              {!geoCoords && showForm && (
                <div className="pt-1">
                  <p className="text-xs text-text-muted font-inter mb-1">📍 Cliquez sur la carte pour placer votre adresse</p>
                  <LazyDeliveryMap
                    height="180px"
                    scrollWheelZoom={false}
                    points={[{ lat: city === 'Yaoundé' ? 3.8480 : 4.0511, lng: city === 'Yaoundé' ? 11.5021 : 9.7679, label: city, type: 'customer' }]}
                    onMapClick={(lat, lng) => {
                      setGeoCoords({ lat, lng });
                      toast.success('Position placée ! Vous pouvez l\'ajuster en cliquant à nouveau');
                    }}
                  />
                </div>
              )}
            </form>
          )}

          {addresses.length === 0 && !showForm ? (
            <p className="text-text-secondary font-inter text-sm text-center py-4">
              Aucune adresse enregistrée. Ajoutez-en une pour vos prochaines commandes.
            </p>
          ) : (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <div key={addr.id} className="p-3 bg-bg-secondary rounded-lg">
                  <div className="flex items-center justify-between">
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
                  {addr.lat != null && addr.lng != null && (
                    <div className="mt-2">
                      <LazyDeliveryMap
                        height="120px"
                        scrollWheelZoom={false}
                        points={[{ lat: addr.lat, lng: addr.lng, label: addr.label || addr.fullText, type: 'customer' } as MapPoint]}
                      />
                    </div>
                  )}
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
