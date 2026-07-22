import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, MapPin, Save, Trash2, Plus, LogOut, Shield, Camera, Globe, Navigation, Wallet, Heart, ShoppingBag, MessageCircle, Gauge, Package, UtensilsCrossed, Search, Edit2, ChevronRight, Award, Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Switch } from '../components/ui/switch';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../hooks/useSeo';
import { fetchOrders, type Order } from '../lib/orders';
import { getLoyaltyBalance, type LoyaltyBalance } from '../lib/loyalty';
import { LOYALTY_CONFIG } from '../data/launchConfig';
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
  const { t } = useTranslation();
  useSeo({ title: t('Mon profil'), noindex: true });
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

  // Série LOY — solde MiamPoints (fidélité client).
  const [loyalty, setLoyalty] = useState<LoyaltyBalance | null>(null);
  useEffect(() => {
    if (!user) return;
    getLoyaltyBalance(user.id).then(setLoyalty).catch(() => setLoyalty(null));
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
  // Dashboard tabs — hook maintenu AVANT tout return conditionnel (règle des hooks).
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'addresses' | 'preferences'>('dashboard');

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

  const tabs = [
    { id: 'dashboard' as const, label: t('Vue d\'ensemble'), icon: Gauge },
    { id: 'orders' as const, label: t('Commandes'), icon: Package },
    { id: 'addresses' as const, label: t('Adresses'), icon: MapPin },
    { id: 'preferences' as const, label: t('Préférences'), icon: Shield },
  ];

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <div className="max-w-[780px] mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ── Hero Header ── */}
        <div className="bg-white rounded-2xl border border-border-custom overflow-hidden shadow-sm mb-6 relative">
          {/* Gradient band */}
          <div className="h-20 sm:h-28 bg-gradient-to-r from-green-primary via-green-primary to-green-dark relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_70%)]" />
          </div>

          <div className="px-5 sm:px-7 pb-5 sm:pb-7">
            {/* Avatar row - overlaps gradient */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 sm:-mt-14 mb-4">
              <div className="relative shrink-0">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-[3px] border-white shadow-lg bg-white" />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-green-light to-green-primary/20 flex items-center justify-center border-[3px] border-white shadow-lg">
                    <User className="w-8 h-8 sm:w-10 sm:h-10 text-green-primary" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className="absolute -bottom-1 -right-1 min-w-9 min-h-9 sm:min-w-10 sm:min-h-10 rounded-full bg-white text-green-primary flex items-center justify-center shadow-md hover:scale-110 transition-transform border border-border-custom"
                  aria-label="Changer la photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </div>

              <div className="flex-1 min-w-0 pt-1 sm:pt-0">
                <h1 className="font-poppins font-bold text-text-primary text-xl sm:text-2xl truncate">
                  {effectiveProfileName || 'Mon Compte'}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-sm font-inter text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-green-primary" />
                    {roleLabels[user.role] ?? user.role}
                  </span>
                  <span className="text-border-custom hidden sm:inline">·</span>
                  <span className="hidden sm:inline truncate max-w-[140px]" title={user.phone}>{user.phone}</span>
                  {whatsapp && (
                    <>
                      <span className="text-border-custom hidden sm:inline">·</span>
                      <span className="flex items-center gap-1 text-xs">
                        <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                        {displayCameroonPhone(whatsapp)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="sm:self-start sm:pt-1">
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="flex items-center gap-2 bg-bg-secondary text-text-primary font-inter font-medium px-3.5 min-h-11 rounded-lg hover:bg-border-light transition-colors text-sm">
                      <Edit2 className="w-3.5 h-3.5" />
                      {t("Modifier")}
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("Modifier mon profil")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-inter font-medium text-text-primary">{t("Nom complet")}</label>
                        <input type="text" value={effectiveProfileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Votre nom complet" className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted transition-all focus:border-green-primary focus:ring-2 focus:ring-green-primary/10" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-inter font-medium text-text-primary">{t("Langue préférée")}</label>
                        <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 transition-all focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10">
                          <Globe className="w-4 h-4 text-text-muted shrink-0" />
                          <select value={profileLang} onChange={(e) => setProfileLang(e.target.value)} className="w-full bg-transparent text-text-primary font-inter text-sm outline-none cursor-pointer">
                            <option value="fr">{t("Français")}</option>
                            <option value="en">{t("English")}</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-inter font-medium text-text-primary">{t("Numéro WhatsApp")}</label>
                        <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 transition-all focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10">
                          <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0" />
                          <span className="text-text-primary font-inter text-sm font-semibold shrink-0 select-none">+237</span>
                          <input type="tel" value={displayCameroonPhone(whatsapp)} onChange={(e) => setWhatsapp(normalizeCameroonPhone(e.target.value))} placeholder="6XX XX XX XX" className="flex-1 min-w-0 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted" />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={saveProfile} disabled={savingProfile} className="bg-green-primary text-white font-inter font-medium text-sm px-5 min-h-11 rounded-lg hover:bg-green-dark transition-colors flex items-center gap-1.5 disabled:opacity-50">
                        <Save className="w-4 h-4" /> {savingProfile ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Quick stats badges row */}
            {!user.isApproved && (
              <div className="mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-gold-light text-amber-700 border border-gold-accent/20 shadow-sm">
                  <Shield className="w-3.5 h-3.5" />
                  {t("Compte en attente de validation")}
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs font-inter">
              {activityStats.orderCount > 0 && (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white text-green-primary font-semibold px-3 py-1.5 border border-green-primary/20 shadow-sm">
                    <Package className="w-3.5 h-3.5" />
                    {activityStats.orderCount} {t("commandes")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white text-green-primary font-semibold px-3 py-1.5 border border-green-primary/20 shadow-sm">
                    <Wallet className="w-3.5 h-3.5" />
                    {activityStats.totalSpent.toLocaleString()} FCFA
                  </span>
                </>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white text-text-secondary font-medium px-3 py-1.5 border border-border-custom shadow-sm">
                <MapPin className="w-3.5 h-3.5" />
                {addresses.length} {t("adresse" + (addresses.length > 1 ? 's' : ''))}
              </span>
            </div>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="bg-white rounded-xl border border-border-custom shadow-sm mb-6 overflow-hidden">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 px-2 sm:px-4 text-xs sm:text-sm font-inter font-medium transition-all relative ${isActive
                    ? 'text-green-primary'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-secondary'
                    }`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="truncate">{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-green-primary rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab Content ── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">

            {/* MiamPoints — fidélité client */}
            {loyalty !== null && (
              <div className="bg-gradient-to-br from-green-primary to-green-dark rounded-2xl p-5 shadow-sm text-white relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
                  <Award className="w-32 h-32" />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-5 h-5 text-gold-accent" />
                  <span className="font-inter font-semibold text-sm">{LOYALTY_CONFIG.UNIT_NAME}</span>
                </div>
                <p className="font-poppins font-bold text-4xl leading-none">
                  {loyalty.available.toLocaleString()}
                </p>
                <p className="text-white/80 font-inter text-xs mt-1.5">
                  {loyalty.available >= LOYALTY_CONFIG.MIN_REDEEM_POINTS
                    ? t("Utilisables en réduction à votre prochaine commande.")
                    : t("Gagnez 5 % de chaque commande livrée. Utilisables dès 500 points.")}
                </p>
              </div>
            )}

            {/* Big Stats Cards */}
            {activityStats.orderCount > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-border-custom p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                  <div className="absolute -right-6 -bottom-6 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                    <Package className="w-28 h-28 text-green-primary" />
                  </div>
                  <p className="text-text-muted text-xs font-inter mb-1.5 tracking-wide uppercase">{t("Commandes livrées")}</p>
                  <p className="font-poppins font-bold text-text-primary text-4xl sm:text-5xl">{activityStats.orderCount}</p>
                  <div className="mt-2 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-green-primary rounded-full" style={{ width: `${Math.min(100, activityStats.orderCount * 10)}%` }} />
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-border-custom p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                  <div className="absolute -right-6 -bottom-6 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                    <Wallet className="w-28 h-28 text-green-primary" />
                  </div>
                  <p className="text-text-muted text-xs font-inter mb-1.5 tracking-wide uppercase">{t("Total dépensé")}</p>
                  <p className="font-poppins font-bold text-green-primary text-2xl sm:text-3xl truncate" title={`${activityStats.totalSpent.toLocaleString()} FCFA`}>
                    {activityStats.totalSpent.toLocaleString()} <span className="text-base font-medium">{t("FCFA")}</span>
                  </p>
                  <div className="mt-2 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-gold-accent rounded-full" style={{ width: `${Math.min(100, activityStats.totalSpent / 500)}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Favorite Dish & Restaurant */}
            {(activityStats.favoriteDish || activityStats.favoriteRestaurant) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activityStats.favoriteDish && (
                  <div className="bg-white rounded-2xl border border-border-custom p-5 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-light to-amber-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Award className="w-7 h-7 text-gold-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-text-muted text-xs font-inter mb-0.5 tracking-wide uppercase">{t("Plat préféré")}</p>
                      <p className="font-inter font-semibold text-text-primary text-sm truncate">{activityStats.favoriteDish.name}</p>
                      <p className="text-green-primary text-xs font-medium mt-0.5">
                        {activityStats.favoriteDish.count}× {t("commandé")}
                      </p>
                    </div>
                  </div>
                )}
                {activityStats.favoriteRestaurant && (
                  <div className="bg-white rounded-2xl border border-border-custom p-5 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-light to-emerald-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Store className="w-7 h-7 text-green-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-text-muted text-xs font-inter mb-0.5 tracking-wide uppercase">{t("Restaurant favori")}</p>
                      <p className="font-inter font-semibold text-text-primary text-sm truncate">{activityStats.favoriteRestaurant.name}</p>
                      <p className="text-green-primary text-xs font-medium mt-0.5">
                        {activityStats.favoriteRestaurant.count}× {t("commandé")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {activityStats.orderCount === 0 && (
              <div className="bg-white rounded-2xl border border-border-custom p-8 sm:p-10 text-center shadow-sm">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-green-light flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="w-8 h-8 sm:w-10 sm:h-10 text-green-primary" />
                </div>
                <h3 className="font-poppins font-semibold text-text-primary text-lg mb-1">{t("Bienvenue sur MiamExpress !")}</h3>
                <p className="text-text-secondary text-sm font-inter mb-5 max-w-sm mx-auto">
                  {t("Passez votre première commande pour voir apparaître vos statistiques ici.")}
                </p>
                <Link to="/restaurants" className="inline-flex items-center gap-2 bg-green-primary text-white font-inter font-medium text-sm px-6 h-11 rounded-xl hover:bg-green-dark transition-all shadow-lg shadow-green-primary/20">
                  <Store className="w-4 h-4" />
                  {t("Découvrir les restaurants")}
                </Link>
              </div>
            )}

            {/* Quick Shortcuts */}
            <div>
              <h2 className="font-poppins font-semibold text-text-primary text-sm uppercase tracking-wider text-text-muted mb-3 px-1">
                {t("Accès rapides")}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { to: '/commandes', icon: Package, label: t('Mes commandes'), desc: t('Historique et suivi'), color: 'from-green-light to-emerald-50', iconColor: 'text-green-primary' },
                  { to: '/favoris', icon: Heart, label: t('Favoris'), desc: t('Restos & plats'), color: 'from-pink-50 to-rose-50', iconColor: 'text-rose-500' },
                  { to: '/demandes/mes-demandes', icon: UtensilsCrossed, label: t('Mes demandes'), desc: t('Commandes sur mesure'), color: 'from-gold-light to-amber-50', iconColor: 'text-gold-accent' },
                  { to: '/restaurants?mode=plats', icon: Search, label: t('Explorer'), desc: t('Trouver un plat'), color: 'from-blue-50 to-indigo-50', iconColor: 'text-blue-500' },
                ].map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="flex items-center gap-3 bg-white rounded-2xl border border-border-custom shadow-sm p-4 hover:border-green-primary hover:shadow-md hover:-translate-y-0.5 transition-all group"
                  >
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                      <link.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${link.iconColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-inter font-semibold text-text-primary text-sm group-hover:text-green-primary transition-colors flex items-center justify-between">
                        {link.label}
                        <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-all -mr-1" />
                      </p>
                      <p className="text-text-muted text-[11px] font-inter truncate mt-0.5">{link.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-4">
            {myOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-border-custom p-8 sm:p-10 text-center shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-green-light flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-green-primary" />
                </div>
                <h3 className="font-poppins font-semibold text-text-primary text-lg mb-1">{t("Aucune commande")}</h3>
                <p className="text-text-secondary text-sm font-inter mb-5">{t("Vos commandes apparaîtront ici une fois que vous aurez passé votre première commande.")}</p>
                <Link to="/restaurants" className="inline-flex items-center gap-2 bg-green-primary text-white font-inter font-medium text-sm px-6 h-11 rounded-xl hover:bg-green-dark transition-all shadow-lg shadow-green-primary/20">
                  <Store className="w-4 h-4" />
                  {t("Voir les restaurants")}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {myOrders.slice(0, 20).map((order) => (
                  <Link
                    key={order.id}
                    to={`/commandes#${order.id}`}
                    className="block bg-white rounded-2xl border border-border-custom p-4 shadow-sm hover:border-green-primary hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-green-light flex items-center justify-center shrink-0 mt-0.5">
                          <Package className="w-5 h-5 text-green-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-inter font-semibold text-text-primary text-sm truncate">
                            {order.restaurantName || t('Restaurant')}
                          </p>
                          <p className="text-text-muted text-xs font-inter mt-0.5">
                            {order.items?.length || 0} {t("article")}{(order.items?.length || 0) > 1 ? 's' : ''} · {order.total.toLocaleString()} FCFA
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${order.status === 'delivered' ? 'bg-green-light text-green-primary border-green-primary/20' :
                              order.status === 'cancelled' ? 'bg-error/5 text-error border-error/20' :
                                'bg-gold-light text-amber-700 border-gold-accent/20'
                              }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${order.status === 'delivered' ? 'bg-green-primary' :
                                order.status === 'cancelled' ? 'bg-error' : 'bg-gold-accent'
                                }`} />
                              {order.status === 'delivered' ? t('Livrée') :
                                order.status === 'cancelled' ? t('Annulée') :
                                  order.status === 'pending' ? t('En attente') :
                                    order.status === 'confirmed' ? t('Confirmée') :
                                      order.status === 'preparing' ? t('En préparation') :
                                        order.status === 'picked_up' ? t('En livraison') : order.status}
                            </span>
                            <span className="text-text-muted text-[11px] font-inter">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted mt-2 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                    </div>
                  </Link>
                ))}
                {myOrders.length > 20 && (
                  <Link to="/commandes" className="block text-center text-green-primary font-inter font-medium text-sm py-3 hover:underline">
                    {t("Voir toutes mes commandes")} ({myOrders.length})
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'addresses' && (
          <section className="bg-white rounded-2xl border border-border-custom overflow-hidden shadow-sm">
            <div className="p-5 sm:p-6 border-b border-border-custom">
              <div className="flex items-center justify-between">
                <h2 className="font-poppins font-semibold text-text-primary text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-primary" />
                  {t("Adresses de livraison")}
                </h2>
                {!showForm && addresses.length < MAX_ADDRESSES && (
                  <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-green-primary text-white font-inter font-medium text-sm px-4 min-h-11 rounded-xl hover:bg-green-dark transition-all shadow-sm">
                    <Plus className="w-4 h-4" />
                    {t("Ajouter")}
                  </button>
                )}
                {!showForm && addresses.length >= MAX_ADDRESSES && (
                  <p className="text-text-muted text-xs font-inter">{t("Maximum")} {MAX_ADDRESSES} {t("adresses")}</p>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {showForm && (
                <form onSubmit={handleSave} className="mb-6 p-5 bg-bg-secondary rounded-2xl border border-border-custom space-y-3">
                  <h3 className="font-inter font-semibold text-text-primary text-sm flex items-center gap-2">
                    {editingId ? (
                      <><Edit2 className="w-4 h-4 text-green-primary" /> {t("Modifier l'adresse")}</>
                    ) : (
                      <><Plus className="w-4 h-4 text-green-primary" /> {t("Nouvelle adresse")}</>
                    )}
                  </h3>
                  <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom (ex. Maison, Bureau)" className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted transition-all focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 hover:border-text-muted" />
                  <AddressAutocomplete
                    value={fullText}
                    onChange={(display, lat, lng) => {
                      setFullText(display);
                      if (lat != null && lng != null) setGeoCoords({ lat, lng });
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
                  <input type="text" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Point de repère (ex. Carrefour Bastos, face Orange)" className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted transition-all focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 hover:border-text-muted" />
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={!fullText} className="bg-green-primary text-white font-inter font-medium text-sm px-5 min-h-11 rounded-xl hover:bg-green-dark transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm">
                      <Save className="w-4 h-4" /> {t("Enregistrer")}
                    </button>
                    <button type="button" onClick={handleGeolocate} disabled={geoLoading} className="flex items-center gap-1.5 border border-border-custom text-text-secondary font-inter text-sm px-4 min-h-11 rounded-xl hover:bg-bg-secondary transition-colors disabled:opacity-50">
                      <Navigation className="w-4 h-4" />
                      {geoLoading ? 'Détection...' : 'Me géolocaliser'}
                    </button>
                    <button type="button" onClick={resetForm} className="text-text-secondary font-inter text-sm px-4 min-h-11 rounded-xl hover:bg-bg-secondary transition-colors">
                      {t("Annuler")}
                    </button>
                  </div>
                  {(geoCoords || showForm) && (
                    <div className="pt-1">
                      <p className="text-xs text-text-muted font-inter mb-1 flex items-center gap-1">
                        <Navigation className="w-3 h-3" />
                        {geoCoords ? t("Cliquez sur la carte pour ajuster la position") : t("Cliquez sur la carte pour placer votre adresse")}
                      </p>
                      <div className="rounded-xl overflow-hidden border border-border-custom">
                        <LazyDeliveryMap
                          height="180px"
                          scrollWheelZoom={false}
                          points={geoCoords
                            ? [{ lat: geoCoords.lat, lng: geoCoords.lng, label: label || 'Position', type: 'customer' }]
                            : [{ lat: city === 'Yaoundé' ? 3.8480 : 4.0511, lng: city === 'Yaoundé' ? 11.5021 : 9.7679, label: city, type: 'customer' }]
                          }
                          onMapClick={(lat, lng) => { setGeoCoords({ lat, lng }); toast.success('Position mise à jour'); }}
                        />
                      </div>
                    </div>
                  )}
                </form>
              )}

              {addresses.length === 0 && !showForm ? (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-2xl bg-green-light flex items-center justify-center mx-auto mb-3">
                    <MapPin className="w-7 h-7 text-green-primary" />
                  </div>
                  <p className="text-text-secondary font-inter text-sm mb-1">{t("Aucune adresse enregistrée.")}</p>
                  <p className="text-amber-700 bg-gold-light inline-block rounded-lg px-3 py-1.5 font-inter text-xs mb-4">{t("Sans adresse, vous ne pourrez pas passer commande.")}</p>
                  <div>
                    <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-xl hover:bg-green-dark transition-all shadow-sm">
                      <Plus className="w-4 h-4" />
                      {t("Ajouter mon adresse")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr, addrIdx) => (
                    <div key={addr.id} className="p-4 bg-white rounded-2xl border border-border-custom shadow-sm hover:border-green-primary transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${addrIdx === 0 ? 'bg-green-primary text-white' : 'bg-green-light text-green-primary'}`}>
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {addr.label && <p className="font-inter font-semibold text-text-primary text-sm">{addr.label}</p>}
                              {addrIdx === 0 && (
                                <span className="text-[10px] font-inter font-medium text-green-primary bg-green-light px-2 py-0.5 rounded-full border border-green-primary/20">{t("par défaut")}</span>
                              )}
                            </div>
                            <p className="text-text-secondary text-xs sm:text-sm font-inter mt-0.5">{addr.fullText}</p>
                            {addr.lat != null && addr.lng != null && (
                              <button onClick={() => setExpandedMapId(expandedMapId === addr.id ? null : addr.id)} className="mt-1.5 flex items-center gap-1 text-green-primary text-xs font-inter font-medium hover:underline">
                                <Navigation className="w-3 h-3" />
                                {expandedMapId === addr.id ? 'Masquer la carte' : 'Voir sur la carte'}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleEdit(addr)} className="w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-green-primary hover:bg-green-light transition-colors" title="Modifier">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTargetAddr(addr)} className="w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors" title="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {expandedMapId === addr.id && addr.lat != null && addr.lng != null && (
                        <div className="mt-4 rounded-xl overflow-hidden border border-border-custom">
                          <LazyDeliveryMap height="140px" scrollWheelZoom={false} points={[{ lat: addr.lat, lng: addr.lng, label: addr.label || addr.fullText, type: 'customer' } as MapPoint]} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-4">
            {/* Data Saver */}
            <div className="bg-white rounded-2xl border border-border-custom p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-light to-emerald-50 flex items-center justify-center shrink-0">
                    <Gauge className="w-5 h-5 text-green-primary" />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="data-saver-switch" className="block font-inter font-semibold text-text-primary text-sm cursor-pointer">
                      {t("Économie de données")}
                    </label>
                    <p className="text-text-secondary font-inter text-xs mt-0.5">
                      {t("Désactive les animations et diffère le chargement des images — recommandé en 3G ou forfait limité.")}
                    </p>
                  </div>
                </div>
                <Switch id="data-saver-switch" checked={dataSaver} onCheckedChange={(checked) => { setDataSaver(checked); toast.success(checked ? 'Économie de données activée' : 'Économie de données désactivée'); }} aria-label="Économie de données" />
              </div>
            </div>

            {/* Language & WhatsApp Quick Access */}
            <div className="bg-white rounded-2xl border border-border-custom p-5 sm:p-6 shadow-sm">
              <h3 className="font-inter font-semibold text-text-primary text-sm mb-4">{t("Préférences de communication")}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-text-muted" />
                    <span className="font-inter text-sm text-text-primary">{t("Langue")}</span>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-lg">
                    <button onClick={() => setProfileLang('fr')} className={`px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-all ${profileLang === 'fr' ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>FR</button>
                    <button onClick={() => setProfileLang('en')} className={`px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-all ${profileLang === 'en' ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>EN</button>
                  </div>
                </div>
                <div className="h-px bg-border-custom" />
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-[#25D366]" />
                    <div>
                      <span className="font-inter text-sm text-text-primary">{t("WhatsApp")}</span>
                      {whatsapp && <p className="text-text-muted text-xs">{displayCameroonPhone(whatsapp)}</p>}
                    </div>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="text-xs font-inter font-medium text-green-primary hover:underline">{t("Modifier")}</button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("Numéro WhatsApp")}</DialogTitle>
                      </DialogHeader>
                      <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12">
                        <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0" />
                        <span className="text-text-primary font-inter text-sm font-semibold shrink-0 select-none">+237</span>
                        <input type="tel" value={displayCameroonPhone(whatsapp)} onChange={(e) => setWhatsapp(normalizeCameroonPhone(e.target.value))} placeholder="6XX XX XX XX" className="flex-1 min-w-0 bg-transparent text-text-primary font-inter text-sm outline-none" />
                      </div>
                      <div className="flex justify-end">
                        <button onClick={() => { localStorage.setItem(PROFILE_WHATSAPP_KEY, whatsapp); toast.success('WhatsApp mis à jour'); }} className="bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-green-dark transition-colors">{t("Enregistrer")}</button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            {/* Logout */}
            <button onClick={() => { signOut(); navigate('/'); }} className="w-full bg-white rounded-2xl border border-border-custom p-4 text-center font-inter font-medium text-error hover:bg-error hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm group">
              <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {t("Se déconnecter")}
            </button>
          </div>
        )}

      </div>

      {/* ── Confirmation suppression adresse ── */}
      <AlertDialog open={!!deleteTargetAddr} onOpenChange={(open) => { if (!open) setDeleteTargetAddr(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Supprimer cette adresse ?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("L'adresse")} <strong>{deleteTargetAddr?.label || deleteTargetAddr?.fullText}</strong> {t("sera déplacée dans la corbeille pour 7 jours.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Annuler")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTargetAddr) handleDelete(deleteTargetAddr.id); setDeleteTargetAddr(null); }} className="bg-error text-white hover:bg-error/90">
              {t("Supprimer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
