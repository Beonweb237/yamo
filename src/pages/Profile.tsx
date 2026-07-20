import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, MapPin, Save, Trash2, Plus, LogOut, Shield, Camera, Globe, Navigation, Wallet, Heart, ShoppingBag, MessageCircle, Gauge, Package, UtensilsCrossed, Search, Edit2, ChevronRight, Award, Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Switch } from '../components/ui/switch';
import { fetchOrders, type Order } from '../lib/orders';
import { toast } from 'sonner';
import LazyDeliveryMap, { type MapPoint } from '../components/LazyDeliveryMap';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { trashItem } from '../lib/trash';
import { displayCameroonPhone, normalizeCameroonPhone } from '../lib/phone';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';

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
  const [expandedMapId, setExpandedMapId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [fullText, setFullText] = useState('');
  const [city, setCity] = useState('Douala');
  const [neighborhood, setNeighborhood] = useState('');
  const [landmark, setLandmark] = useState('');

  // C1: profile enrichment
  const [profileName, setProfileName] = useState(() => localStorage.getItem(PROFILE_NAME_KEY) ?? '');
  // Tant que l'utilisateur n'a rien saisi, on affiche le nom du compte
  // (registre) plutôt qu'un champ vide — dérivé, pas de setState en effet.
  const effectiveProfileName = profileName || user?.name || '';
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
      localStorage.setItem(PROFILE_NAME_KEY, effectiveProfileName);
      localStorage.setItem(PROFILE_LANG_KEY, profileLang);
      localStorage.setItem(PROFILE_WHATSAPP_KEY, whatsapp);
      if (effectiveProfileName.trim()) await updateProfileName(effectiveProfileName.trim());
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

  const [deleteTargetAddr, setDeleteTargetAddr] = useState<SavedAddress | null>(null);

  const handleDelete = (id: string) => {
    const addr = addresses.find((a) => a.id === id);
    if (!addr) return;
    trashItem(id, 'address', addr);
    const updated = addresses.filter((a) => a.id !== id);
    setAddresses(updated);
    writeAddresses(updated);
    toast.success('Adresse mise en corbeille', { description: 'Récupérable pendant 7 jours.' });
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

        {/* En-tête / Carte de Visite Premium */}
        <section className="bg-white rounded-2xl border border-border-custom p-6 mb-8 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-green-primary to-green-dark" />
          <div className="relative pt-6 flex flex-col sm:flex-row items-center sm:items-end gap-5">
            <div className="relative shrink-0">
              {profilePhoto ? (
                <img src={profilePhoto} alt="Photo" className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-white shadow-md bg-white" />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-green-light flex items-center justify-center border-4 border-white shadow-md">
                  <User className="w-10 h-10 text-green-primary" />
                </div>
              )}
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-white text-green-primary flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                aria-label="Changer la photo de profil"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </div>
            
            <div className="flex-1 text-center sm:text-left pb-2">
              <h2 className="font-poppins font-bold text-text-primary text-2xl">{effectiveProfileName || 'Mon Compte'}</h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1.5 text-sm font-inter text-text-secondary">
                <span className="flex items-center gap-1"><Shield className="w-4 h-4 text-green-primary" /> {roleLabels[user.role] ?? user.role}</span>
                <span className="text-border-custom">•</span>
                <span className="flex items-center gap-1">{user.phone}</span>
                {whatsapp && (
                  <>
                    <span className="text-border-custom">•</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4 text-[#25D366]" /> {displayCameroonPhone(whatsapp)}</span>
                  </>
                )}
              </div>
              {!user.isApproved && (
                <div className="mt-3 inline-flex">
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-gold-light text-amber-700 shadow-sm border border-gold-accent/20">Compte en attente de validation</span>
                </div>
              )}
            </div>
            
            <div className="pb-2">
              <Dialog>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-2 bg-bg-secondary text-text-primary font-inter font-medium px-4 py-2 rounded-lg hover:bg-border-light transition-colors text-sm shadow-sm">
                    <Edit2 className="w-4 h-4" />
                    Modifier
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Modifier mon profil</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-inter font-medium text-text-primary">Nom complet</label>
                      <input
                        type="text"
                        value={effectiveProfileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Votre nom complet"
                        className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted transition-all focus:border-green-primary focus:ring-2 focus:ring-green-primary/10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-inter font-medium text-text-primary">Langue préférée</label>
                      <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 transition-all focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10">
                        <Globe className="w-4 h-4 text-text-muted shrink-0" />
                        <select
                          value={profileLang}
                          onChange={(e) => setProfileLang(e.target.value)}
                          className="w-full bg-transparent text-text-primary font-inter text-sm outline-none cursor-pointer"
                        >
                          <option value="fr">Français</option>
                          <option value="en">English</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-inter font-medium text-text-primary">Numéro WhatsApp</label>
                      <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 transition-all focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10">
                        <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0" />
                        <span className="text-text-primary font-inter text-sm font-semibold shrink-0 select-none">+237</span>
                        <input
                          type="tel"
                          value={displayCameroonPhone(whatsapp)}
                          onChange={(e) => setWhatsapp(normalizeCameroonPhone(e.target.value))}
                          placeholder="6XX XX XX XX"
                          className="flex-1 min-w-0 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={saveProfile}
                      disabled={savingProfile}
                      className="bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-green-dark transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" /> {savingProfile ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
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

        {/* S5: Mon activité — historique de dépenses, plats/restaurants favoris */}
        {activityStats.orderCount > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4 px-1">
              <ShoppingBag className="w-5 h-5 text-green-primary" />
              <h2 className="font-poppins font-semibold text-text-primary text-lg">Mon Activité</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-2xl border border-border-custom p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
                  <Package className="w-24 h-24 text-green-primary" />
                </div>
                <p className="text-text-muted text-sm font-inter mb-1">Commandes livrées</p>
                <p className="font-poppins font-bold text-text-primary text-3xl">{activityStats.orderCount}</p>
              </div>
              <div className="bg-white rounded-2xl border border-border-custom p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
                  <Wallet className="w-24 h-24 text-green-primary" />
                </div>
                <p className="text-text-muted text-sm font-inter mb-1">Total dépensé</p>
                <p className="font-poppins font-bold text-green-primary text-2xl truncate" title={`${activityStats.totalSpent.toLocaleString()} FCFA`}>{activityStats.totalSpent.toLocaleString()} FCFA</p>
              </div>
            </div>
            
            {(activityStats.favoriteDish || activityStats.favoriteRestaurant) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activityStats.favoriteDish && (
                  <div className="bg-white rounded-2xl border border-border-custom p-4 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold-light flex items-center justify-center shrink-0">
                      <Award className="w-6 h-6 text-gold-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-text-muted text-xs font-inter mb-0.5">Plat préféré</p>
                      <p className="font-inter font-semibold text-text-primary text-sm truncate">{activityStats.favoriteDish.name}</p>
                      <p className="text-green-primary text-xs font-medium">{activityStats.favoriteDish.count} commande{activityStats.favoriteDish.count > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                )}
                {activityStats.favoriteRestaurant && (
                  <div className="bg-white rounded-2xl border border-border-custom p-4 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold-light flex items-center justify-center shrink-0">
                      <Store className="w-6 h-6 text-gold-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-text-muted text-xs font-inter mb-0.5">Restaurant favori</p>
                      <p className="font-inter font-semibold text-text-primary text-sm truncate">{activityStats.favoriteRestaurant.name}</p>
                      <p className="text-green-primary text-xs font-medium">{activityStats.favoriteRestaurant.count} commande{activityStats.favoriteRestaurant.count > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Accès rapides ── */}
        <section className="mb-8">
          <h2 className="font-poppins font-semibold text-text-primary text-sm uppercase tracking-wider text-text-muted mb-4 px-1">
            Raccourcis
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[
              { to: '/commandes', icon: Package, label: 'Mes commandes', desc: 'Historique et suivi' },
              { to: '/favoris', icon: Heart, label: 'Favoris', desc: 'Restos & plats' },
              { to: '/demandes/mes-demandes', icon: UtensilsCrossed, label: 'Mes demandes', desc: 'Commandes sur mesure' },
              { to: '/restaurants?mode=plats', icon: Search, label: 'Explorer', desc: 'Trouver un plat' },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white rounded-2xl border border-border-custom shadow-sm p-4 hover:border-green-primary hover:shadow-md hover:-translate-y-1 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-green-light flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <link.icon className="w-6 h-6 text-green-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-inter font-semibold text-text-primary text-sm sm:text-base group-hover:text-green-primary transition-colors flex items-center justify-between">
                    {link.label}
                    <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                  </p>
                  <p className="text-text-muted text-[11px] sm:text-xs font-inter truncate mt-0.5">{link.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Adresses de livraison — section unique : liste (la 1re est l'adresse
            par défaut), formulaire d'ajout et état vide avec avertissement. */}
        <section className="bg-white rounded-xl border border-border-custom p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-poppins font-semibold text-text-primary text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-primary" />
              Adresses de livraison
            </h2>
            {!showForm && addresses.length < MAX_ADDRESSES && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 text-green-primary font-inter font-medium text-sm min-h-11"
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
            <div className="text-center py-4">
              <p className="text-text-secondary font-inter text-sm mb-1">
                Aucune adresse enregistrée.
              </p>
              <p className="text-amber-700 bg-gold-light inline-block rounded-lg px-3 py-1.5 font-inter text-xs mb-4">
                Sans adresse, vous ne pourrez pas passer commande.
              </p>
              <div>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-green-dark transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter mon adresse
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr, addrIdx) => (
                <div key={addr.id} className="p-4 bg-white rounded-2xl border border-border-custom shadow-sm hover:border-green-primary transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-green-light flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="w-5 h-5 text-green-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {addr.label && (
                            <p className="font-inter font-semibold text-text-primary text-sm sm:text-base">{addr.label}</p>
                          )}
                          {addrIdx === 0 && (
                            <span className="text-[10px] font-inter font-medium text-green-primary bg-green-light px-2 py-0.5 rounded-full border border-green-primary/20">par défaut</span>
                          )}
                        </div>
                        <p className="text-text-secondary text-xs sm:text-sm font-inter mt-0.5">{addr.fullText}</p>
                        
                        {addr.lat != null && addr.lng != null && (
                          <button
                            onClick={() => setExpandedMapId(expandedMapId === addr.id ? null : addr.id)}
                            className="mt-2 flex items-center gap-1.5 text-green-primary text-xs font-inter font-medium hover:underline"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            {expandedMapId === addr.id ? 'Masquer la carte' : 'Voir sur la carte'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEdit(addr)}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:text-green-primary hover:bg-green-light transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTargetAddr(addr)}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {expandedMapId === addr.id && addr.lat != null && addr.lng != null && (
                    <div className="mt-4 rounded-xl overflow-hidden border border-border-custom">
                      <LazyDeliveryMap
                        height="140px"
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
        <section className="space-y-3 mb-8">
          <button
            onClick={() => { signOut(); navigate('/'); }}
            className="w-full bg-white rounded-2xl border border-border-custom p-4 text-center font-inter font-medium text-error hover:bg-error hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <LogOut className="w-5 h-5" />
            Se déconnecter
          </button>
        </section>
      </div>

      {/* ── Confirmation suppression adresse ── */}
      <AlertDialog open={!!deleteTargetAddr} onOpenChange={(open) => { if (!open) setDeleteTargetAddr(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette adresse ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'adresse <strong>{deleteTargetAddr?.label || deleteTargetAddr?.fullText}</strong> sera déplacée dans la corbeille pour 7 jours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTargetAddr) handleDelete(deleteTargetAddr.id);
                setDeleteTargetAddr(null);
              }}
              className="bg-error text-white hover:bg-error/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
