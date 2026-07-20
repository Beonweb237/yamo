import { useState, useCallback, useMemo } from 'react';
import { Users, Search, Phone, MapPin, ShoppingBag, Ban, CheckCircle, X, ChevronRight, History, AlertTriangle, KeyRound, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import type { Order } from '../../lib/orders';
import { formatOrderTime } from '../../lib/orders';
import { usePolling } from '../../hooks/usePolling';
import { adminSetPassword, getUserEmail, ADMIN_DEFAULT_PASSWORD } from '../../contexts/AuthContext';
import {
  fetchAdminCustomers,
  setAdminCustomerSuspended,
  setAdminUserPassword,
  type AdminCustomerRecord,
} from '../../lib/admin';
import { useTranslation } from "react-i18next";

// ─── Helpers ─────────────────────────────────────────────

function fmt(amount: number): string { return `${amount.toLocaleString()} FCFA`; }

// ─── Types ───────────────────────────────────────────────

interface SavedAddress {
  id: string;
  label: string;
  city: string;
  neighborhood: string;
  landmark: string;
  fullText: string;
}

interface CustomerRecord extends Omit<AdminCustomerRecord, 'savedAddresses'> {
  savedAddresses: SavedAddress[];
}

// ─── Helpers ─────────────────────────────────────────────

const LOCAL_USERS_KEY = 'yamo_local_users';
const LOCAL_ORDERS_KEY = 'yamo_local_orders';

function readUsers(): Record<string, { id: string; phone: string; email?: string | null; name?: string; role: string; isApproved: boolean; isSuspended: boolean; suspensionReason?: string | null; city?: string | null }> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) ?? '{}');
  } catch { return {}; }
}

function readOrders(): Order[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) ?? '[]') as Order[];
  } catch { return []; }
}

function writeUsers(users: Record<string, unknown>) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function buildCustomers(users: Record<string, unknown>, orders: Order[]): CustomerRecord[] {
  const clientEntries = Object.values(users).filter((u: any) => u?.role === 'client' || u?.role?.toLowerCase?.() === 'client') as any[];

  // Group orders by customer phone
  const ordersByPhone: Record<string, Order[]> = {};
  for (const o of orders) {
    const phone = (o.contactPhone ?? '').replace(/\s/g, '');
    if (!phone) continue;
    if (!ordersByPhone[phone]) ordersByPhone[phone] = [];
    ordersByPhone[phone].push(o);
  }

  return clientEntries.map((u) => {
    const normalizedPhone = (u.phone ?? '').replace(/\s/g, '');
    const customerOrders = ordersByPhone[normalizedPhone] ?? [];

    // Also match by customerId
    const byId = orders.filter((o) => o.customerId === u.id && !customerOrders.includes(o));
    const allOrders = [...customerOrders, ...byId].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const deliveredOrders = allOrders.filter((o) => o.status === 'delivered');
    const totalSpent = deliveredOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);
    const cancelledCount = allOrders.filter((o) => o.status === 'cancelled').length;

    // Profile enrichment from localStorage
    const phoneKey = normalizedPhone;
    const photoKey = `yamo_profile_photo`;
    const allPhotos = JSON.parse(localStorage.getItem('yamo_profile_photo') ?? '{}');
    // La photo est stockée par clé de téléphone dans un objet global ou individuellement
    const profilePhoto = localStorage.getItem(`yamo_profile_photo_${phoneKey}`) || '';
    const whatsapp = localStorage.getItem(`yamo_profile_whatsapp_${phoneKey}`) || '';
    const savedAddresses: SavedAddress[] = (() => {
      try {
        return JSON.parse(localStorage.getItem('yamo_saved_addresses') ?? '[]');
      } catch { return []; }
    })();

    return {
      id: u.id,
      phone: u.phone ?? '',
      email: u.email ?? undefined,
      name: u.name ?? undefined,
      role: u.role ?? 'client',
      isApproved: u.isApproved ?? true,
      isSuspended: u.isSuspended ?? false,
      suspensionReason: u.suspensionReason ?? null,
      city: u.city ?? null,
      profilePhoto,
      whatsapp,
      savedAddresses,
      orderCount: allOrders.length,
      totalSpent,
      lastOrderAt: allOrders.length > 0 ? allOrders[0].createdAt : null,
      cancelledCount,
      orders: allOrders,
    };
  });
}

// ─── Component ───────────────────────────────────────────

export default function AdminCustomers() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [blockTarget, setBlockTarget] = useState<CustomerRecord | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<CustomerRecord | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    try {
      const apiCustomers = await fetchAdminCustomers();
      if (apiCustomers) {
        setCustomers(apiCustomers.map((c) => ({ ...c, savedAddresses: c.savedAddresses as SavedAddress[] })));
        return;
      }
    } catch (err) {
      console.warn('[admin-customers] API indisponible, repli localStorage', err);
    }
    const users = readUsers();
    const orders = readOrders();
    setCustomers(buildCustomers(users, orders));
  }, []);

  // LOT-16 : aligné sur le pattern LOT-11 (pause onglet masqué, tick au retour).
  usePolling(load, 30000);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      (c.name ?? '').toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.city ?? '').toLowerCase().includes(q)
    );
  }, [customers, query]);

  // ── Stats ──────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: customers.length,
    active: customers.filter((c) => !c.isSuspended).length,
    blocked: customers.filter((c) => c.isSuspended).length,
    withOrders: customers.filter((c) => c.orderCount > 0).length,
    totalRevenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
    totalOrders: customers.reduce((sum, c) => sum + c.orderCount, 0),
  }), [customers]);

  // ── Block / Unblock ────────────────────────────────────

  const applyBlock = async (customer: CustomerRecord, suspend: boolean) => {
    try {
      const updatedOnServer = await setAdminCustomerSuspended(customer.id, suspend, suspend ? 'Bloqué par admin' : undefined);
      if (updatedOnServer) {
        toast.success(suspend ? 'Client bloqué' : 'Client débloqué');
        await load();
        setBlockTarget(null);
        return;
      }
    } catch (err) {
      console.warn('[admin-customers] Suspension API impossible, repli localStorage', err);
    }

    const users = readUsers();
    const key = customer.phone.replace(/\s/g, '');
    if (users[key]) {
      users[key] = {
        ...users[key],
        isSuspended: suspend,
        suspensionReason: suspend ? 'Bloqué par admin' : null,
      };
      writeUsers(users);
      toast.success(suspend ? 'Client bloqué' : 'Client débloqué');
      load();
    }
    setBlockTarget(null);
  };

  // ── Set / Reset password ───────────────────────────────

  const applyPassword = async (customer: CustomerRecord) => {
    if (!newPassword || newPassword.length < 4) {
      toast.error('Le mot de passe doit contenir au moins 4 caractères.');
      return;
    }
    try {
      const updatedOnServer = await setAdminUserPassword(customer.id, newPassword);
      if (!updatedOnServer) adminSetPassword(customer.phone, newPassword);
    } catch (err) {
      console.warn('[admin-customers] Mot de passe API impossible, repli localStorage', err);
      adminSetPassword(customer.phone, newPassword);
    }
    toast.success(`Mot de passe défini pour ${customer.name || customer.phone}`);
    setPasswordTarget(null);
    setNewPassword('');
    setShowPassword(false);
  };

  // ── Helper: format last order ──────────────────────────

  const formatLastOrder = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  };

  // ── Status badge ───────────────────────────────────────

  const statusBadge = (c: CustomerRecord) => {
      const { t } = useTranslation();
    if (c.isSuspended) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
          <Ban className="w-3 h-3" /> {t("Bloqué")}
        </span>
      );
    }
    if (c.orderCount > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-primary border border-green-200">
          <CheckCircle className="w-3 h-3" /> {t("Actif")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-text-muted border border-gray-200">
        {t("Nouveau")}
      </span>
    );
  };

  // ── Order status labels ────────────────────────────────

  const orderStatusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700' },
    confirmed: { label: 'Confirmée', color: 'bg-blue-100 text-blue-700' },
    preparing: { label: 'En préparation', color: 'bg-indigo-100 text-indigo-700' },
    ready: { label: 'Prête', color: 'bg-emerald-100 text-emerald-700' },
    picked_up: { label: 'Récupérée', color: 'bg-teal-100 text-teal-700' },
    delivering: { label: 'En livraison', color: 'bg-purple-100 text-purple-700' },
    delivered: { label: 'Livrée', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-600' },
  };

  // ── Payment method labels ──────────────────────────────

  const paymentLabels: Record<string, string> = {
    cash: 'Espèces',
    mtn_momo: 'MTN MoMo',
    orange_money: 'Orange Money',
  };

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="font-poppins font-bold text-text-primary text-2xl mb-6 flex items-center gap-2">
        <Users className="w-6 h-6 text-green-primary" />{t("Clients (")}{customers.length})
      </h1>

      {/* ── Stats cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { icon: Users, label: 'Total clients', value: stats.total, color: 'text-blue-600 bg-blue-50' },
          { icon: CheckCircle, label: 'Actifs', value: stats.active, color: 'text-green-primary bg-green-50' },
          { icon: Ban, label: 'Bloqués', value: stats.blocked, color: 'text-red-600 bg-red-50' },
          { icon: ShoppingBag, label: 'CA généré', value: fmt(stats.totalRevenue), color: 'text-amber-700 bg-gold-light' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-border-custom p-4">
            <div className={`w-9 h-9 rounded-lg ${card.color} flex items-center justify-center mb-2`}>
              <card.icon className="w-4.5 h-4.5" />
            </div>
            <p className="text-2xl font-poppins font-bold text-text-primary">{card.value}</p>
            <p className="text-xs text-text-muted font-inter mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Clients avec commandes', value: `${stats.withOrders}/${stats.total}` },
          { label: 'Total commandes', value: stats.totalOrders },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border-custom px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-text-muted font-inter">{s.label}</span>
            <span className="font-poppins font-bold text-text-primary">{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── Search ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-white rounded-lg border border-border-custom px-3 h-11 mb-6 max-w-md">
        <Search className="w-4 h-4 text-text-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par nom, téléphone, ville..."
          className="flex-1 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
        />
      </div>

      {/* ── Customer list ────────────────────────────────── */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-xl border border-border-custom p-10 text-center">
          <Users className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-text-secondary text-sm font-inter">
            {customers.length === 0
              ? 'Aucun client enregistré. Les clients apparaîtront ici après leur première commande ou inscription.'
              : 'Aucun client ne correspond à cette recherche.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border-custom overflow-hidden">
          <div className="divide-y divide-border-light">
            {filteredCustomers.map((c) => (
              <div
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-bg-secondary transition-colors cursor-pointer"
                onClick={() => setSelectedCustomer(c)}
                role="button"
                tabIndex={0}
                aria-label={`Voir détails de ${c.name || c.phone}`}
                onKeyDown={(e) => { if (e.key === 'Enter') setSelectedCustomer(c); }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-inter font-semibold text-text-primary text-sm truncate">
                      {c.name || 'Sans nom'}
                    </p>
                    {statusBadge(c)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted font-inter">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {c.phone}
                    </span>
                    {c.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {c.city}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3" /> {c.orderCount} {t("cmd")}
                      {c.orderCount > 0 && <> · {fmt(c.totalSpent)}</>}
                    </span>
                    {c.cancelledCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-red-500">
                        <AlertTriangle className="w-3 h-3" /> {c.cancelledCount} {t("annulée")}{c.cancelledCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {c.lastOrderAt && (
                    <p className="text-xs text-text-muted font-inter mt-1">
                      {t("Dernière commande :")} {formatLastOrder(c.lastOrderAt)}
                    </p>
                  )}
                  {c.isSuspended && c.suspensionReason && (
                    <p className="text-xs text-red-500 font-inter mt-0.5">{t("Motif :")} {c.suspensionReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setBlockTarget(c); }}
                    className={`flex items-center gap-1 font-inter font-medium text-xs px-3 h-8 rounded-lg transition-colors ${c.isSuspended
                      ? 'bg-green-50 text-green-primary hover:bg-green-primary hover:text-white'
                      : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'
                      }`}
                    aria-label={c.isSuspended ? 'Débloquer le client' : 'Bloquer le client'}
                  >
                    {c.isSuspended ? (
                      <><CheckCircle className="w-3.5 h-3.5" /> {t("Débloquer")}</>
                    ) : (
                      <><Ban className="w-3.5 h-3.5" /> {t("Bloquer")}</>
                    )}
                  </button>
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Block/Unblock Dialog ─────────────────────────── */}
      <AlertDialog open={!!blockTarget} onOpenChange={(open) => { if (!open) setBlockTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blockTarget?.isSuspended ? 'Débloquer ce client ?' : 'Bloquer ce client ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockTarget?.isSuspended
                ? `${blockTarget?.name || blockTarget?.phone} pourra à nouveau passer commande.`
                : `${blockTarget?.name || blockTarget?.phone} ne pourra plus passer commande jusqu'à déblocage. Cette action est réversible.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Annuler")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blockTarget && applyBlock(blockTarget, !blockTarget.isSuspended)}
              className={blockTarget?.isSuspended ? 'bg-green-primary hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {blockTarget?.isSuspended ? 'Débloquer' : 'Bloquer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Customer detail sheet ────────────────────────── */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedCustomer(null)} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl animate-slide-in-right">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-border-custom px-5 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-poppins font-bold text-text-primary text-lg">{selectedCustomer.name || 'Client'}</h2>
                <p className="text-sm text-text-muted font-inter">{selectedCustomer.phone}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-bg-secondary transition-colors"
                aria-label="Fermer"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Customer info */}
              <div className="bg-bg-secondary rounded-xl p-4 space-y-3">
                {/* Profile photo */}
                {selectedCustomer.profilePhoto && (
                  <div className="flex justify-center mb-2">
                    <img
                      src={selectedCustomer.profilePhoto}
                      alt="Photo de profil"
                      className="w-16 h-16 rounded-full object-cover border-2 border-border-custom"
                    />
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Nom")}</span>
                  <span className="text-sm font-medium text-text-primary">{selectedCustomer.name || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Téléphone")}</span>
                  <span className="text-sm font-medium text-text-primary">{selectedCustomer.phone}</span>
                </div>
                {selectedCustomer.whatsapp && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted font-inter">{t("WhatsApp")}</span>
                    <span className="text-sm font-medium text-green-primary">{selectedCustomer.whatsapp}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Statut")}</span>
                  {statusBadge(selectedCustomer)}
                </div>
                {selectedCustomer.city && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted font-inter">{t("Ville")}</span>
                    <span className="text-sm font-medium text-text-primary">{selectedCustomer.city}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Total dépensé")}</span>
                  <span className="text-sm font-bold text-text-primary">{fmt(selectedCustomer.totalSpent)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Commandes")}</span>
                  <span className="text-sm font-medium text-text-primary">
                    {selectedCustomer.orderCount} ({selectedCustomer.cancelledCount} {t("annulée")}{selectedCustomer.cancelledCount > 1 ? 's' : ''})
                  </span>
                </div>
                {selectedCustomer.lastOrderAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted font-inter">{t("Dernière commande")}</span>
                    <span className="text-sm font-medium text-text-primary">{formatLastOrder(selectedCustomer.lastOrderAt)}</span>
                  </div>
                )}
              </div>

              {/* Credentials */}
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-2">
                <h3 className="font-inter font-semibold text-amber-800 text-sm flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" /> {t("Identifiants de connexion")}
                </h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-amber-700 font-inter">{t("Email")}</span>
                  <span className="text-sm font-mono font-medium text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">{selectedCustomer.email || getUserEmail(selectedCustomer.phone, selectedCustomer.name)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-amber-700 font-inter">{t("Téléphone")}</span>
                  <span className="text-sm font-mono font-medium text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">{selectedCustomer.phone}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-amber-700 font-inter">{t("Mot de passe")}</span>
                  <span className="text-sm font-mono font-bold text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">{ADMIN_DEFAULT_PASSWORD}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-amber-700 font-inter">{t("Code OTP")}</span>
                  <span className="text-sm font-mono font-bold text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">12345</span>
                </div>
                <p className="text-[11px] text-amber-600 font-inter mt-1">{t("Connexion : email ou téléphone + mot de passe")} {ADMIN_DEFAULT_PASSWORD}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setBlockTarget(selectedCustomer)}
                    className={`flex-1 flex items-center justify-center gap-1.5 font-inter font-medium text-sm px-4 h-10 rounded-xl transition-colors ${selectedCustomer.isSuspended
                      ? 'bg-green-50 text-green-primary hover:bg-green-primary hover:text-white'
                      : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'
                      }`}
                  >
                    {selectedCustomer.isSuspended ? <><CheckCircle className="w-4 h-4" /> {t("Débloquer")}</> : <><Ban className="w-4 h-4" /> {t("Bloquer")}</>}
                  </button>
                  {selectedCustomer.orderCount > 0 && (
                    <button
                      onClick={() => { setSelectedCustomer(null); navigate(`/admin/orders`); }}
                      className="flex-1 flex items-center justify-center gap-1.5 font-inter font-medium text-sm px-4 h-10 rounded-xl border border-border-custom hover:bg-bg-secondary transition-colors text-text-primary"
                    >
                      <History className="w-4 h-4" /> {t("Voir toutes les commandes")}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => { setNewPassword(''); setShowPassword(false); setPasswordTarget(selectedCustomer); }}
                  className="flex items-center justify-center gap-1.5 font-inter font-medium text-sm px-4 h-10 rounded-xl border border-border-custom hover:bg-bg-secondary transition-colors text-text-primary"
                >
                  <KeyRound className="w-4 h-4" /> {t("Réinitialiser le mot de passe")}
                </button>
              </div>

              {/* Saved addresses */}
              {selectedCustomer.savedAddresses.length > 0 && (
                <div>
                  <h3 className="font-poppins font-semibold text-text-primary text-base mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-primary" />
                    {t("Adresses enregistrées (")}{selectedCustomer.savedAddresses.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedCustomer.savedAddresses.map((addr) => (
                      <div key={addr.id} className="bg-bg-secondary rounded-xl p-3 text-sm">
                        <p className="font-inter font-semibold text-text-primary">{addr.label}</p>
                        <p className="text-text-muted text-xs font-inter">{addr.fullText}</p>
                        {addr.landmark && <p className="text-text-muted text-xs font-inter mt-0.5">{t("Repère :")} {addr.landmark}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order history */}
              <div>
                <h3 className="font-poppins font-semibold text-text-primary text-base mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-green-primary" />
                  {t("Historique des commandes")}
                </h3>
                {selectedCustomer.orders.length === 0 ? (
                  <div className="bg-bg-secondary rounded-xl p-6 text-center">
                    <ShoppingBag className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
                    <p className="text-sm text-text-muted font-inter">{t("Aucune commande")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.orders.map((order) => {
                        const { t } = useTranslation();
                      const st = orderStatusLabels[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600' };
                      return (
                        <div
                          key={order.id}
                          className="bg-bg-secondary rounded-xl p-3 space-y-2 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => { setSelectedCustomer(null); navigate(`/admin/orders`); }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-inter font-semibold text-text-primary text-sm">
                              {order.id.slice(0, 8)}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${st.color}`}>
                              {st.label}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-text-muted font-inter">
                            <span>{formatLastOrder(order.createdAt)} · {formatOrderTime(order.createdAt)}</span>
                            <span className="font-bold text-text-primary">{fmt(order.total)}</span>
                          </div>
                          <div className="text-xs text-text-muted font-inter">
                            {order.restaurantName || 'Restaurant'} · {order.items.length} {t("article")}{order.items.length > 1 ? 's' : ''}
                            {' · '}{paymentLabels[order.paymentMethod as string] || order.paymentMethod}
                          </div>
                          {order.cancellationReason && (
                            <p className="text-xs text-red-500 font-inter bg-red-50 rounded-lg px-2 py-1">
                              {t("Annulée :")} {order.cancellationReason}
                              {order.cancelledBy && <> {t("(par")} {order.cancelledBy === 'customer' ? 'client' : order.cancelledBy === 'restaurant' ? 'restaurant' : 'admin'})</>}
                            </p>
                          )}
                          {order.deliveredWithoutCode && (
                            <p className="text-xs text-amber-600 font-inter bg-amber-50 rounded-lg px-2 py-1">
                              {t("⚠️ Livrée sans code de confirmation")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Set password dialog ──────────────────────────── */}
      <AlertDialog open={!!passwordTarget} onOpenChange={(open) => { if (!open) { setPasswordTarget(null); setNewPassword(''); setShowPassword(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Définir un mot de passe")}</AlertDialogTitle>
            <AlertDialogDescription>
              {passwordTarget && (
                <>{t("Définir le mot de passe de")} <strong>{passwordTarget.name || passwordTarget.phone}</strong>{t(". L'utilisateur pourra se connecter avec son numéro de téléphone et ce mot de passe.")}</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe (min. 4 caractères)"
              autoFocus
              className="w-full bg-bg-secondary rounded-lg px-3 py-2.5 pr-10 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
              onKeyDown={(e) => { if (e.key === 'Enter' && passwordTarget) applyPassword(passwordTarget); }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary p-1"
              aria-label={showPassword ? 'Masquer' : 'Afficher'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Annuler")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => passwordTarget && applyPassword(passwordTarget)}
              disabled={!newPassword || newPassword.length < 4}
            >
              {t("Enregistrer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
