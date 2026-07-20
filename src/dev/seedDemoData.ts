// Seed de démonstration complet (DEV uniquement)
//
// Génère :
//   - 15 clients fictifs
//   - 8 livreurs (4 Douala, 4 Yaoundé) avec historiques variés
//   - ~100 commandes : statuts variés, personnalisées, pour autrui, etc.
//   - Avis restaurants + notes livraison (bons et mauvais)
//   - Scénarios : commandes réussies, annulées, rejetées, litiges
//
// Auto-exécuté en mode mock (VITE_USE_VPS_API !== 'true').
// Accessible via console : __yamoSeedDemo(), __yamoClearDemo()

import { restaurants, menuItems } from '../data/mockData';
import { SEED_PROFILES } from '../data/demoAccounts';

const PREFIX = 'seed-v2-';
const VERSION_KEY = 'yamo_demo_seed_version';
const VERSION = '3';

const ORDERS_KEY = 'yamo_local_orders';
const USERS_KEY = 'yamo_local_users';
const REVIEWS_KEY = 'yamo_reviews_v1';
const APPLICATIONS_KEY = 'yamo_local_applications';
const DELIVERY_RATINGS_KEY = 'yamo_local_delivery_ratings';

// ── 15 CLIENTS ──────────────────────────────────────────────

interface SeedClient {
  id: string; phone: string; name: string; city: string; neighborhood: string; landmark: string;
}

const CLIENTS: SeedClient[] = [
  { id: `${PREFIX}cl-1`, phone: '650000001', name: 'Marie Ngono', city: 'Yaoundé', neighborhood: 'Bastos', landmark: 'Face pharmacie Bastos' },
  { id: `${PREFIX}cl-2`, phone: '650000002', name: 'Jean-Paul Mbarga', city: 'Yaoundé', neighborhood: 'Mvan', landmark: 'Carrefour Mvan, immeuble bleu' },
  { id: `${PREFIX}cl-3`, phone: '650000003', name: 'Aïcha Bello', city: 'Douala', neighborhood: 'Akwa', landmark: 'Près du marché central' },
  { id: `${PREFIX}cl-4`, phone: '650000004', name: 'Serge Kamdem', city: 'Douala', neighborhood: 'Bonapriso', landmark: 'Rue des écoles, portail vert' },
  { id: `${PREFIX}cl-5`, phone: '650000005', name: 'Clarisse Etoundi', city: 'Yaoundé', neighborhood: 'Biyem-Assi', landmark: 'Derrière la station Total' },
  { id: `${PREFIX}cl-6`, phone: '650000006', name: 'Ibrahim Njoya', city: 'Douala', neighborhood: 'Makepe', landmark: 'Rond-point Maetur' },
  { id: `${PREFIX}cl-7`, phone: '650000007', name: 'Sandrine Fotso', city: 'Yaoundé', neighborhood: 'Essos', landmark: 'Entrée chapelle Essos' },
  { id: `${PREFIX}cl-8`, phone: '650000008', name: 'Patrick Abena', city: 'Douala', neighborhood: 'Deido', landmark: 'Face collège de Deido' },
  { id: `${PREFIX}cl-9`, phone: '650000009', name: 'Vanessa Moussa', city: 'Yaoundé', neighborhood: 'Mokolo', landmark: 'Immeuble en face du marché' },
  { id: `${PREFIX}cl-10`, phone: '650000010', name: 'Éric Tchamba', city: 'Douala', neighborhood: 'Bali', landmark: 'À côté boulangerie Saker' },
  { id: `${PREFIX}cl-11`, phone: '650000011', name: 'Rachel Toukam', city: 'Yaoundé', neighborhood: 'Nlongkak', landmark: 'Entrée Cité des Palmiers' },
  { id: `${PREFIX}cl-12`, phone: '650000012', name: 'Benoît Djomgoué', city: 'Douala', neighborhood: 'Logpom', landmark: 'Carrefour Logpom, pharmacie' },
  { id: `${PREFIX}cl-13`, phone: '650000013', name: 'Fadimatou Ousmane', city: 'Yaoundé', neighborhood: 'Elig-Essono', landmark: 'Près du centre commercial' },
  { id: `${PREFIX}cl-14`, phone: '650000014', name: 'Cédric Nkolo', city: 'Douala', neighborhood: 'New Bell', landmark: 'Marché New Bell, entrée sud' },
  { id: `${PREFIX}cl-15`, phone: '650000015', name: 'Amélie Sanga', city: 'Yaoundé', neighborhood: 'Odza', landmark: 'Face station Total Odza' },
];

// ── 8 DRIVERS (4 Douala, 4 Yaoundé) ─────────────────────────

interface SeedDriver {
  id: string; phone: string; name: string; city: string; neighborhoods: string[];
  activityLevel: number;
}

const DRIVERS: SeedDriver[] = [
  { id: `${PREFIX}drv-1`, phone: '670000001', name: 'Paul Kamga', city: 'Douala', neighborhoods: ['Akwa', 'Bonapriso', 'Deido'], activityLevel: 2.0 },
  { id: `${PREFIX}drv-2`, phone: '670000002', name: 'Hervé Mpondo', city: 'Douala', neighborhoods: ['Makepe', 'Bali', 'Logpom'], activityLevel: 1.5 },
  { id: `${PREFIX}drv-3`, phone: '670000003', name: 'Sylvain Ebongue', city: 'Douala', neighborhoods: ['Bonanjo', 'New Bell', 'Pk8'], activityLevel: 0.8 },
  { id: `${PREFIX}drv-4`, phone: '670000004', name: 'Alain Tchinda', city: 'Douala', neighborhoods: ['Akwa', 'Bonapriso', 'Deido'], activityLevel: 0.3 },
  { id: `${PREFIX}drv-5`, phone: '670000005', name: 'Brice Onana', city: 'Yaoundé', neighborhoods: ['Bastos', 'Omnisport', 'Mvan'], activityLevel: 1.8 },
  { id: `${PREFIX}drv-6`, phone: '670000006', name: 'Christophe Eyia', city: 'Yaoundé', neighborhoods: ['Mokolo', 'Biyem-Assi', 'Essos'], activityLevel: 1.2 },
  { id: `${PREFIX}drv-7`, phone: '670000007', name: 'Lionel Ngane', city: 'Yaoundé', neighborhoods: ['Nlongkak', 'Elig-Essono', 'Odza'], activityLevel: 0.6 },
  { id: `${PREFIX}drv-8`, phone: '670000008', name: 'Moïse Simo', city: 'Yaoundé', neighborhoods: ['Bastos', 'Mokolo', 'Melen'], activityLevel: 0.2 },
];

// ── COMMENTAIRES ────────────────────────────────────────────

const COMMENTS: Record<number, string[]> = {
  5: [
    'Excellent ! Le ndolé était encore chaud à la livraison, portions généreuses.',
    'Toujours aussi bon, troisième commande et jamais déçu. Bravo à toute l\'équipe.',
    'Parfait du début à la fin. Livraison rapide et plat délicieux.',
    'Le goût est authentique comme à la maison. Emballage propre.',
  ],
  4: [
    'Très bon repas, juste un petit retard sur l\'heure annoncée.',
    'Bonne qualité dans l\'ensemble, le plat était savoureux.',
    'Bon rapport qualité-prix, je recommanderai.',
  ],
  3: [
    'Correct sans plus. Les portions ont diminué par rapport à la dernière commande.',
    'Plat bon mais tiède à l\'arrivée.',
    'Moyen : retard important mais le repas était correct.',
  ],
  2: [
    'Déçu : il manquait des éléments de la commande.',
    'Plat froid à la livraison, livreur peu professionnel.',
  ],
  1: [
    'Très mauvaise expérience : commande erronée, personne ne répond.',
    'Plus d\'1h30 d\'attente pour un plat immangeable.',
    'Commande annulée sans explication par le restaurant.',
  ],
};

const RATING_POOL = [5, 5, 5, 4, 4, 4, 3, 3, 2, 2, 1, 1];
const MAX_REVIEWS_PER_RESTAURANT = 12;

// ── UTILITAIRES ─────────────────────────────────────────────

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function makeRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function anonymize(name: string): string {
  const p = name.split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[1][0].toUpperCase()}.` : p[0];
}

function pick<T>(rng: () => number, list: T[]): T {
  return list[Math.floor(rng() * list.length)];
}

// ── SEED PRINCIPAL ──────────────────────────────────────────

export function seedDemoData(): string {
  const rng = makeRng(20260720);
  const now = Date.now();
  const day = 86400000;
  const minute = 60000;

  const seedableRestaurants = restaurants.filter(r =>
    menuItems.some(item => item.restaurantId === r.id)
  );

  // Nettoyage des données seed précédentes
  const cleanArray = <T>(key: string): T[] => {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((x: any) => !x?.id?.startsWith(PREFIX)) as T[];
      return [];
    } catch { return []; }
  };

  // ── 1. CLIENTS (15) + DRIVERS (8) ──
  const users = safeParse<Record<string, any>>(localStorage.getItem(USERS_KEY), {});
  for (const p of SEED_PROFILES) {
    const key = p.phone.replace(/\s/g, '');
    if (!users[key]) users[key] = p;
  }
  for (const c of CLIENTS) {
    users[c.phone] = { id: c.id, phone: c.phone, role: 'client', isApproved: true, isSuspended: false, city: c.city, name: c.name };
  }
  for (const d of DRIVERS) {
    users[d.phone] = { id: d.id, phone: d.phone, role: 'livreur', isApproved: true, isSuspended: false, city: d.city, name: d.name };
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // ── 2. APPLICATIONS (8 livreurs) ──
  const apps = cleanArray<any>(APPLICATIONS_KEY);
  for (const d of DRIVERS) {
    apps.push({
      id: `${PREFIX}app-${d.id}`, applicantId: d.id, type: 'livreur', status: 'approved',
      applicantName: d.name, city: d.city, serviceNeighborhoods: d.neighborhoods,
      contactPhone: d.phone, address: `${d.neighborhoods[0]}, ${d.city}`,
      createdAt: new Date(now - 180 * day).toISOString(),
    });
  }
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(apps));

  // ── 3. COMMANDES (~100) ──
  const orders: any[] = cleanArray<any>(ORDERS_KEY);
  const reviews: any[] = cleanArray<any>(REVIEWS_KEY);
  const delRatings: any[] = cleanArray<any>(DELIVERY_RATINGS_KEY);
  let orderCounter = 0;
  let reviewCounter = 0;
  const reviewsPerResto: Record<string, number> = {};

  const buildItems = (restoId: string, personalized = false) => {
    const items = menuItems.filter(i => i.restaurantId === restoId);
    if (!items.length) return null;
    const chosen = [pick(rng, items)];
    if (rng() > 0.5) chosen.push(pick(rng, items));
    return chosen.map(item => ({
      name: personalized && item.variants?.length
        ? `${item.name} (${pick(rng, item.variants).name})`
        : item.name,
      price: item.price,
      quantity: 1 + Math.floor(rng() * 2),
      baseItemId: item.id,
    }));
  };

  const addReview = (orderId: string, clientId: string, restoId: string, rating: number, createdAt: string, clientName: string, forceBad = false) => {
    if ((reviewsPerResto[restoId] ?? 0) >= MAX_REVIEWS_PER_RESTAURANT) return;
    reviewsPerResto[restoId] = (reviewsPerResto[restoId] ?? 0) + 1;
    reviewCounter++;
    const withComment = forceBad || rng() > 0.1;
    const isBad = rating <= 2;
    const ownerReply = withComment && ((isBad && rng() > 0.4) || (rating === 5 && rng() > 0.6))
      ? {
        text: isBad
          ? 'Nous sommes désolés pour cette expérience. Contactez-nous pour que nous corrigions cela.'
          : 'Merci pour votre confiance ! À très bientôt.',
        createdAt: new Date(new Date(createdAt).getTime() + 6 * 60 * minute).toISOString(),
        updatedAt: null, status: 'published', moderationReason: null,
      }
      : null;
    const ownerReport = withComment && isBad && !ownerReply && rng() > 0.5
      ? { reason: 'Nous contestons cet avis qui ne correspond pas à notre service.', createdAt: new Date(new Date(createdAt).getTime() + 2 * 60 * minute).toISOString(), status: 'open' }
      : null;
    reviews.push({
      id: `${PREFIX}rev-${reviewCounter}`, orderId, customerId: clientId,
      targetType: 'restaurant', targetId: restoId, restaurantId: restoId,
      driverId: null, dishId: null, rating,
      comment: withComment ? (forceBad
        ? pick(rng, ['Commande jamais reçue, remboursement exigé.', 'Service inexistant.', 'Arnaque !'])
        : pick(rng, COMMENTS[rating])
      ) : undefined,
      tags: withComment ? (rating >= 4 ? pick(rng, [['rapide', 'chaud'], ['emballage soigné'], ['livreur courtois']]) : pick(rng, [['en retard'], ['plat froid'], ['commande incomplète']])) : [],
      authorName: anonymize(clientName), isVerifiedOrder: true, isTest: true, status: 'published',
      moderationReason: null,
      createdAt: new Date(new Date(createdAt).getTime() + 90 * minute).toISOString(),
      updatedAt: null, ownerReply, ownerReport,
    });
  };

  // Distribution des statuts : livrées majoritaires + variété
  const pickStatus = () => {
    const r = rng() * 100;
    if (r < 60) return 'delivered';
    if (r < 72) return 'cancelled';
    if (r < 77) return 'pending';
    if (r < 82) return 'confirmed';
    if (r < 87) return 'preparing';
    if (r < 92) return 'ready';
    if (r < 97) return 'delivering';
    return 'picked_up';
  };

  for (const client of CLIENTS) {
    const count = 5 + Math.floor(rng() * 4); // ~100 total
    for (let i = 0; i < count; i++) {
      const resto = pick(rng, seedableRestaurants);
      const personalized = rng() < 0.15;
      const forOther = rng() < 0.15;
      const items = buildItems(resto.id, personalized);
      if (!items) continue;

      orderCounter++;
      const orderId = `${PREFIX}ord-${orderCounter}`;
      const daysAgo = Math.floor(rng() * 60);
      const hoursAgo = Math.floor(rng() * 12);
      const createdAt = new Date(now - daysAgo * day - hoursAgo * 60 * minute);
      const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
      const deliveryFee = resto.deliveryFee ?? 500;
      const status = pickStatus();

      const cityDrivers = DRIVERS.filter(d => d.city === client.city);
      let driverId: string | null = null;
      if ((status === 'delivered' || status === 'delivering' || status === 'picked_up') && cityDrivers.length && rng() > 0.2) {
        driverId = pick(rng, cityDrivers).id;
      }

      orders.push({
        id: orderId,
        customerId: client.id,
        restaurantId: resto.id,
        restaurantName: resto.name,
        contactPhone: client.phone,
        ...(forOther ? {
          recipient: {
            name: pick(rng, ['Grand-mère Jeanne', 'Tante Suzanne', 'Frère Michel', 'Cousine Esther', 'Voisin Thomas']),
            phone: pick(rng, ['690000020', '690000021', '690000022']),
            contactInstructions: pick(rng, ['Appeler avant de livrer', 'Laisser au gardien', 'Sonner 2 fois', '']),
          }
        } : {}),
        items,
        subtotal, deliveryFee,
        total: subtotal + deliveryFee,
        paymentMethod: pick(rng, ['cash', 'cash', 'mtn_momo', 'orange_money']),
        address: { city: client.city, neighborhood: client.neighborhood, landmark: client.landmark, fullText: `${client.neighborhood}, ${client.landmark}, ${client.city}` },
        status,
        createdAt: createdAt.toISOString(),
        updatedAt: new Date(createdAt.getTime() + 45 * minute).toISOString(),
        confirmedAt: status !== 'pending' ? new Date(createdAt.getTime() + 3 * minute).toISOString() : null,
        preparationEtaMinutes: status !== 'pending' ? 20 + Math.floor(rng() * 15) : null,
        readyAt: (status === 'ready' || status === 'delivering' || status === 'delivered' || status === 'picked_up') ? new Date(createdAt.getTime() + 25 * minute).toISOString() : null,
        driverId,
        deliveryCode: (status === 'delivered' || status === 'delivering') ? `${1000 + Math.floor(rng() * 9000)}` : null,
        cancellationReason: status === 'cancelled' ? pick(rng, ['Annulé par le client (délai trop long)', 'Restaurant fermé', 'Produit indisponible', 'Litige - annulation admin']) : null,
        cancelledBy: status === 'cancelled' ? pick(rng, ['customer', 'restaurant', 'admin']) : null,
      });

      // Avis pour livrées
      if (status === 'delivered' && rng() > 0.25) {
        addReview(orderId, client.id, resto.id, pick(rng, RATING_POOL), createdAt.toISOString(), client.name);
      }
      // Avis négatif forcé pour annulations
      if (status === 'cancelled' && rng() > 0.6) {
        addReview(orderId, client.id, resto.id, 1, createdAt.toISOString(), client.name, true);
      }

      // Note livraison
      if ((status === 'delivered' || status === 'picked_up') && driverId && rng() > 0.3) {
        const delRating = 1 + Math.floor(rng() * 5);
        delRatings.push({
          id: `${PREFIX}del-${orderCounter}`, driverId, customerId: client.id, orderId,
          rating: delRating,
          comment: delRating >= 4
            ? pick(rng, ['Livreur très professionnel', 'Rapide et souriant', 'Service impeccable'])
            : (delRating <= 2 ? pick(rng, ['Livreur impoli', 'En retard sans excuse', 'A appelé 3 fois pour l\'adresse']) : 'Correct'),
          createdAt: new Date(createdAt.getTime() + 95 * minute).toISOString(),
        });
      }
    }
  }

  // ── 4. COMMANDES ACTIVES DU JOUR ──
  const activeOrders = [
    { status: 'pending', ago: 8, ri: 0 },
    { status: 'pending', ago: 18, ri: 7 },
    { status: 'confirmed', ago: 28, ri: 1 },
    { status: 'preparing', ago: 38, ri: 0 },
    { status: 'ready', ago: 50, ri: 2 },
    { status: 'delivering', ago: 15, ri: 1, driver: DRIVERS[0].id },
    { status: 'delivering', ago: 25, ri: 8, driver: DRIVERS[4].id },
    { status: 'pending', ago: 5, ri: 13 },
    { status: 'preparing', ago: 20, ri: 11 },
  ];
  for (const act of activeOrders) {
    const resto = seedableRestaurants[act.ri % seedableRestaurants.length];
    const client = pick(rng, CLIENTS);
    const items = buildItems(resto.id);
    if (!items) continue;
    orderCounter++;
    const createdAt = new Date(now - act.ago * minute);
    const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
    orders.push({
      id: `${PREFIX}ord-${orderCounter}`, customerId: client.id,
      restaurantId: resto.id, restaurantName: resto.name, contactPhone: client.phone,
      items, subtotal, deliveryFee: resto.deliveryFee ?? 500,
      total: subtotal + (resto.deliveryFee ?? 500),
      paymentMethod: 'cash',
      address: { city: client.city, neighborhood: client.neighborhood, landmark: client.landmark, fullText: `${client.neighborhood}, ${client.landmark}, ${client.city}` },
      status: act.status,
      createdAt: createdAt.toISOString(),
      updatedAt: new Date(now - Math.max(1, act.ago - 5) * minute).toISOString(),
      confirmedAt: act.status !== 'pending' ? new Date(createdAt.getTime() + 3 * minute).toISOString() : null,
      preparationEtaMinutes: act.status !== 'pending' ? 25 : null,
      readyAt: (act.status === 'ready' || act.status === 'delivering') ? new Date(createdAt.getTime() + 22 * minute).toISOString() : null,
      driverId: (act as any).driver ?? null,
      deliveryCode: (act as any).driver ? `${1000 + Math.floor(rng() * 9000)}` : null,
    });
  }

  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
  localStorage.setItem(DELIVERY_RATINGS_KEY, JSON.stringify(delRatings));
  localStorage.setItem(VERSION_KEY, VERSION);

  const msg = `✅ Seed v${VERSION} : ${CLIENTS.length} clients, ${DRIVERS.length} livreurs, ${orderCounter} commandes, ${reviewCounter} avis, ${delRatings.length} notes livraison.`;
  console.info(msg);
  return msg;
}

export function clearDemoData(): string {
  [USERS_KEY, ORDERS_KEY, REVIEWS_KEY, APPLICATIONS_KEY, DELIVERY_RATINGS_KEY].forEach(key => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localStorage.setItem(key, JSON.stringify(parsed.filter((x: any) => !x?.id?.startsWith(PREFIX))));
      } else if (typeof parsed === 'object' && parsed !== null) {
        for (const k of Object.keys(parsed)) {
          if ((parsed as any)[k]?.id?.startsWith(PREFIX)) delete (parsed as any)[k];
        }
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    } catch { /* ignore */ }
  });
  const users = safeParse<Record<string, any>>(localStorage.getItem(USERS_KEY), {});
  for (const d of DRIVERS) { if (users[d.phone]?.id?.startsWith(PREFIX)) delete users[d.phone]; }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.removeItem(VERSION_KEY);
  return '🧹 Seed v3 retiré. Rechargez la page.';
}

export function autoSeedDemoData() {
  if (import.meta.env.VITE_USE_VPS_API === 'true') return;
  if (localStorage.getItem(VERSION_KEY) === VERSION) return;
  seedDemoData();
}

declare global {
  interface Window {
    __yamoSeedDemo?: () => string;
    __yamoClearDemo?: () => string;
  }
}
window.__yamoSeedDemo = seedDemoData;
window.__yamoClearDemo = clearDemoData;
autoSeedDemoData();
