import { useState, useCallback, useMemo } from 'react';
import { Users, Search, Phone, MapPin, ShoppingBag, Ban, CheckCircle, X, ChevronRight, History, AlertTriangle } from 'lucide-react';
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

// ─── Helpers ─────────────────────────────────────────────

function fmt(amount: number): string { return `${amount.toLocaleString()} FCFA`; }

// ─── Types ───────────────────────────────────────────────

interface CustomerRecord {
  id: string;
  phone: string;
  name?: string;
  role: string;
  isApproved: boolean;
  isSuspended: boolean;
  suspensionReason?: string | null;
  city?: string | null;
  // Aggregated from orders
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  cancelledCount: number;
  orders: Order[];
}

// ─── Helpers ─────────────────────────────────────────────

const LOCAL_USERS_KEY = 'yamo_local_users';
const LOCAL_ORDERS_KEY = 'yamo_local_orders';

function readUsers(): Record<string, { id: string; phone: string; name?: string; role: string; isApproved: boolean; isSuspended: boolean; suspensionReason?: string | null; city?: string | null }> {
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

    return {
      id: u.id,
      phone: u.phone ?? '',
      name: u.name ?? undefined,
      role: u.role ?? 'client',
      isApproved: u.isApproved ?? true,
      isSuspended: u.isSuspended ?? false,
      suspensionReason: u.suspensionReason ?? null,
      city: u.city ?? null,
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
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [blockTarget, setBlockTarget] = useState<CustomerRecord | null>(null);

  const load = useCallback(async () => {
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

  // ── Helper: format last order ──────────────────────────

  const formatLastOrder = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  };

  // ── Status badge ───────────────────────────────────────

  const statusBadge = (c: CustomerRecord) => {
    if (c.isSuspended) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
          <Ban className="w-3 h-3" /> Bloqué
        </span>
      );
    }
    if (c.orderCount > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-primary border border-green-200">
          <CheckCircle className="w-3 h-3" /> Actif
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-text-muted border border-gray-200">
        Nouveau
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
        <Users className="w-6 h-6 text-green-primary" />Clients ({customers.length})
      </h1>

      {/* ── Stats cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { icon: Users, label: 'Total clients', value: stats.total, color: 'text-blue-600 bg-blue-50' },
          { icon: CheckCircle, label: 'Actifs', value: stats.active, color: 'text-green-primary bg-green-50' },
          { icon: Ban, label: 'Bloqués', value: stats.blocked, color: 'text-red-600 bg-red-50' },
          { icon: ShoppingBag, label: 'CA généré', value: fmt(stats.totalRevenue), color: 'text-gold-accent bg-gold-light' },
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
                      <ShoppingBag className="w-3 h-3" /> {c.orderCount} cmd
                      {c.orderCount > 0 && <> · {fmt(c.totalSpent)}</>}
                    </span>
                    {c.cancelledCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-red-500">
                        <AlertTriangle className="w-3 h-3" /> {c.cancelledCount} annulée{c.cancelledCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {c.lastOrderAt && (
                    <p className="text-xs text-text-muted font-inter mt-1">
                      Dernière commande : {formatLastOrder(c.lastOrderAt)}
                    </p>
                  )}
                  {c.isSuspended && c.suspensionReason && (
                    <p className="text-xs text-red-500 font-inter mt-0.5">Motif : {c.suspensionReason}</p>
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
                      <><CheckCircle className="w-3.5 h-3.5" /> Débloquer</>
                    ) : (
                      <><Ban className="w-3.5 h-3.5" /> Bloquer</>
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
            <AlertDialogCancel>Annuler</AlertDialogCancel>
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
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">Statut</span>
                  {statusBadge(selectedCustomer)}
                </div>
                {selectedCustomer.city && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted font-inter">Ville</span>
                    <span className="text-sm font-medium text-text-primary">{selectedCustomer.city}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">Total dépensé</span>
                  <span className="text-sm font-bold text-text-primary">{fmt(selectedCustomer.totalSpent)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">Commandes</span>
                  <span className="text-sm font-medium text-text-primary">
                    {selectedCustomer.orderCount} ({selectedCustomer.cancelledCount} annulée{selectedCustomer.cancelledCount > 1 ? 's' : ''})
                  </span>
                </div>
                {selectedCustomer.lastOrderAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted font-inter">Dernière commande</span>
                    <span className="text-sm font-medium text-text-primary">{formatLastOrder(selectedCustomer.lastOrderAt)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setBlockTarget(selectedCustomer)}
                  className={`flex-1 flex items-center justify-center gap-1.5 font-inter font-medium text-sm px-4 h-10 rounded-xl transition-colors ${selectedCustomer.isSuspended
                      ? 'bg-green-50 text-green-primary hover:bg-green-primary hover:text-white'
                      : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'
                    }`}
                >
                  {selectedCustomer.isSuspended ? <><CheckCircle className="w-4 h-4" /> Débloquer</> : <><Ban className="w-4 h-4" /> Bloquer</>}
                </button>
                {selectedCustomer.orderCount > 0 && (
                  <button
                    onClick={() => { setSelectedCustomer(null); navigate(`/admin/orders`); }}
                    className="flex-1 flex items-center justify-center gap-1.5 font-inter font-medium text-sm px-4 h-10 rounded-xl border border-border-custom hover:bg-bg-secondary transition-colors text-text-primary"
                  >
                    <History className="w-4 h-4" /> Voir toutes les commandes
                  </button>
                )}
              </div>

              {/* Order history */}
              <div>
                <h3 className="font-poppins font-semibold text-text-primary text-base mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-green-primary" />
                  Historique des commandes
                </h3>
                {selectedCustomer.orders.length === 0 ? (
                  <div className="bg-bg-secondary rounded-xl p-6 text-center">
                    <ShoppingBag className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
                    <p className="text-sm text-text-muted font-inter">Aucune commande</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.orders.map((order) => {
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
                            {order.restaurantName || 'Restaurant'} · {order.items.length} article{order.items.length > 1 ? 's' : ''}
                            {' · '}{paymentLabels[order.paymentMethod as string] || order.paymentMethod}
                          </div>
                          {order.cancellationReason && (
                            <p className="text-xs text-red-500 font-inter bg-red-50 rounded-lg px-2 py-1">
                              Annulée : {order.cancellationReason}
                              {order.cancelledBy && <> (par {order.cancelledBy === 'customer' ? 'client' : order.cancelledBy === 'restaurant' ? 'restaurant' : 'admin'})</>}
                            </p>
                          )}
                          {order.deliveredWithoutCode && (
                            <p className="text-xs text-amber-600 font-inter bg-amber-50 rounded-lg px-2 py-1">
                              ⚠️ Livrée sans code de confirmation
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
    </div>
  );
}
