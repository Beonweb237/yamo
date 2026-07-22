// Données « à compléter au lancement » — NE PAS SUPPRIMER les emplacements UI
// qui en dépendent : tant qu'une valeur est null/false, l'élément s'affiche en
// état « Bientôt disponible » ; renseigner la valeur ici le réactive partout.
// Registre de suivi : app/docs/prompt-master-coordination.md § « Données à
// compléter plus tard ».

/** Lien App Store de l'application mobile — À compléter au lancement de l'app. */
export const APP_STORE_URL: string | null = null;

/** Lien Google Play de l'application mobile — À compléter au lancement de l'app. */
export const PLAY_STORE_URL: string | null = null;

/** Paiement par carte bancaire — À activer quand la passerelle carte sera branchée. */
export const CARD_PAYMENT_AVAILABLE = false;

/**
 * Compte de commission restaurant + garantie client (série PTS).
 *
 * MODÈLE (depuis 21/07/2026) : le solde restaurant est un **porte-monnaie
 * prépayé en FCFA** (1 unité = 1 FCFA). MiamExpress prélève une **commission de
 * 15 % du sous-total nourriture** sur chaque commande livrée — réservée à
 * l'acceptation, débitée à la livraison, restituée si annulation sans faute.
 * (Auparavant : forfait de 3 points à 500 FCFA, qui ne valait 15 % qu'à 10 000
 * FCFA de panier.) Le calcul du 15 % fait foi CÔTÉ SERVEUR (points-routes.js) à
 * partir du sous-total validé au checkout — jamais confié au client.
 *
 * RÉFÉRENCE UNIQUE des règles métier — aucune de ces valeurs ne doit être codée
 * en dur ailleurs. Machine à états et invariants : app/docs/points-system-prompts.md §0.
 */
export const POINTS_CONFIG = {
  /** Le solde est libellé en FCFA : 1 unité de compte = 1 FCFA. */
  POINT_PRICE_FCFA: 1,
  /** Taux de commission MiamExpress sur le sous-total nourriture (hors livraison). */
  COMMISSION_RATE: 0.15,
  /** Pénalité conservée si annulation par faute du resto (FCFA, sur la réservation). */
  PENALTY_RESTAURANT_FAULT_FCFA: 500,
  /** Plancher de solde additionnel pour ACCEPTER (0 = couvrir juste la commission). */
  MIN_BALANCE_FLOOR_FCFA: 0,
  /** Recharge minimale (Mobile Money ou cash partenaire), en FCFA. */
  MIN_RECHARGE_FCFA: 5000,
  /** Seuil d'alerte « solde faible » côté resto (FCFA). */
  LOW_BALANCE_THRESHOLD_FCFA: 3000,
  /** Crédit offert à l'activation d'un resto (FCFA, 0 = désactivé). */
  WELCOME_BONUS_FCFA: 5000,
  /** Garantie client par commande (FCFA, montant fixe) — mécanisme SÉPARÉ de la commission. */
  GUARANTEE_AMOUNT_FCFA: 1000,
  /** 'deducted' : garantie déduite du total à la livraison (seul mode implémenté en v1). */
  GUARANTEE_MODE: 'deducted',
  /** Garantie confisquée : le livreur reçoit d'abord les frais de livraison, reliquat au resto. */
  GUARANTEE_FORFEIT_DRIVER_FIRST: true,
  /** Numéro de dépôt Mobile Money MiamExpress pour les recharges — À compléter au lancement. */
  RECHARGE_MOMO_NUMBER: null as string | null,
} as const;

/**
 * Commission MiamExpress (FCFA) due sur une commande, dérivée de son sous-total
 * nourriture. Arrondi au FCFA le plus proche. Source de vérité partagée par le
 * moteur mock et le serveur (qui applique la MÊME formule sur le sous-total en base).
 */
export function commissionForSubtotal(subtotalFcfa: number): number {
  return Math.round(Math.max(0, subtotalFcfa || 0) * POINTS_CONFIG.COMMISSION_RATE);
}

/**
 * Programme de fidélité CLIENT « MiamPoints » (série LOY — 21/07/2026).
 * Boucle fermée : gagnés sur les commandes livrées, dépensés en réduction au
 * checkout. NON remboursables, NON convertibles en cash (aucun risque monnaie
 * électronique). 1 MiamPoint = 1 FCFA de réduction. Financé par MiamExpress :
 * à l'usage, le porte-monnaie du restaurant est crédité du montant utilisé (le
 * resto reste payé plein, la réduction est une dépense marketing plateforme).
 */
export const LOYALTY_CONFIG = {
  /** Nom affiché de l'unité de fidélité. */
  UNIT_NAME: 'MiamPoints',
  /** Part du sous-total nourriture gagnée en points sur une commande LIVRÉE. */
  EARN_RATE: 0.05,
  /** Valeur d'un point à l'usage : 1 point = 1 FCFA de réduction. */
  POINT_VALUE_FCFA: 1,
  /** Solde minimum pour pouvoir utiliser ses points au checkout. */
  MIN_REDEEM_POINTS: 500,
  /** Part maximale d'une commande payable en points (évite les commandes gratuites). */
  MAX_REDEEM_RATE: 0.5,
  /** Expiration des points après N mois d'INACTIVITÉ (0 = jamais). */
  EXPIRY_MONTHS: 12,
} as const;

/** Points MiamPoints gagnés sur une commande livrée, à partir de son sous-total. */
export function loyaltyEarnForSubtotal(subtotalFcfa: number): number {
  return Math.round(Math.max(0, subtotalFcfa || 0) * LOYALTY_CONFIG.EARN_RATE);
}

/** Réduction maximale (FCFA) applicable sur une commande via les points. */
export function loyaltyMaxRedeemForSubtotal(subtotalFcfa: number): number {
  return Math.floor(Math.max(0, subtotalFcfa || 0) * LOYALTY_CONFIG.MAX_REDEEM_RATE);
}

// ═══════════════════════════════════════════════════════════════
// Modèle de rémunération livreur (série DRV — 21/07/2026)
// ═══════════════════════════════════════════════════════════════
//
// RÉFÉRENCE UNIQUE des règles de rémunération livreur — aucune de
// ces valeurs ne doit être codée en dur ailleurs. Le calcul complet
// (base + distance + temps + surge + bonus volume + pourboire)
// est implémenté dans lib/distance.ts → calculateDriverEarnings().
//
// COMPARAISON INTERNATIONALE :
//   Uber Eats  : base ~2.50$ + 0.50$/km + 0.20$/min + surge + tips
//   DoorDash   : base ~2-10$ (garantie minimum) + tips
//   Glovo      : base ~2€ + 0.60€/km + surge + tips
//   Bolt Food  : base + distance + surge + tips
//   Jumia Food : flat fee per delivery (~500-1000 FCFA)
//
// MiamExpress adopte un modèle hybride adapté au marché camerounais :
//   - Tarif de base garanti (pickup) pour chaque course
//   - Composante distance transparente
//   - Composante temps d'attente (reconnue à l'international)
//   - Surge pricing aux heures de pointe (standard mondial)
//   - Pourboires 100% livreur (standard mondial)
//   - Bonus de volume hebdomadaire (rétention, standard émergent)
//   - Règlement automatique hebdomadaire (standard, remplace la demande manuelle)
export const DRIVER_PAY_CONFIG = {
  /** Tarif de base par course (prise en charge, peu importe la distance). */
  BASE_PICKUP_FEE_FCFA: 300,

  /** Tarif par kilomètre (FCFA/km). Appliqué à la distance resto→client. */
  PER_KM_RATE_FCFA: 200,

  /** Tarif par minute d'attente estimée au restaurant (FCFA/min).
   *  Compense le temps d'immobilisation du livreur. Basé sur 12 km/h
   *  en ville + 10 min de préparation inclus. */
  PER_MINUTE_RATE_FCFA: 15,

  /** Plancher de rémunération totale : le livreur ne peut pas gagner
   *  moins que ce montant par course, même si le calcul donne moins.
   *  La plateforme complète la différence. Standard Uber Eats/DoorDash. */
  MINIMUM_EARNINGS_PER_DELIVERY_FCFA: 700,

  /** Plafond de rémunération totale (hors surge et pourboire) : évite
   *  les courses anormalement chères sur longues distances. */
  MAXIMUM_EARNINGS_PER_DELIVERY_FCFA: 3000,

  // ── Surge pricing (heures de pointe) ──
  /** Heures de pointe définies par plage horaire (24h, heure de Douala).
   *  Chaque entrée = [début, fin, multiplicateur]. */
  SURGE_SCHEDULE: [
    { startHour: 11, endHour: 14, multiplier: 1.3 },  // Déjeuner : ×1.3
    { startHour: 18, endHour: 21, multiplier: 1.5 },  // Dîner : ×1.5
  ] as { startHour: number; endHour: number; multiplier: number }[],

  /** Le surge est affiché en badge or sur les UI concernées. */
  SURGE_BADGE_LABEL: '🔥 Pic de demande',

  // ── Pourboires ──
  /** Pourcentages de pourboire suggérés au checkout (du sous-total). */
  TIP_PERCENTAGES: [0, 5, 10, 15],

  /** Montants de pourboire fixes suggérés au checkout (FCFA). */
  TIP_FIXED_OPTIONS: [200, 500, 1000, 2000],

  /** 100% du pourboire va au livreur (standard international). */
  TIP_DRIVER_SHARE: 1.0,

  // ── Bonus de volume ──
  /** Bonus hebdomadaires selon le nombre de livraisons complétées.
   *  Cumulatif : atteindre le palier N donne le bonus du palier N
   *  (pas la somme de tous les paliers inférieurs). */
  VOLUME_BONUS_TIERS: [
    { minDeliveries: 20, bonusFcfa: 2000, label: '🥉 Bronze — 20+ courses' },
    { minDeliveries: 40, bonusFcfa: 5000, label: '🥈 Argent — 40+ courses' },
    { minDeliveries: 70, bonusFcfa: 10000, label: '🥇 Or — 70+ courses' },
    { minDeliveries: 100, bonusFcfa: 20000, label: '💎 Platine — 100+ courses' },
  ],

  // ── Règlement automatique ──
  /** Jour de la semaine pour le règlement automatique (0 = dimanche…6 = samedi).
   *  ISO 8601 : lundi = 1. Le règlement auto a lieu le LUNDI. */
  AUTO_SETTLEMENT_DAY: 1, // Lundi

  /** Seuil minimum pour déclencher un règlement automatique (FCFA).
   *  Si le solde est inférieur, il est reporté à la semaine suivante. */
  AUTO_SETTLEMENT_MINIMUM_FCFA: 2000,

  /** Frais de retrait instantané (optionnel, % du montant retiré).
   *  0 = retrait instantané gratuit (activable plus tard). */
  INSTANT_CASHOUT_FEE_PERCENT: 2,

  /** Seuil minimum pour un retrait instantané (FCFA). */
  INSTANT_CASHOUT_MINIMUM_FCFA: 1000,
} as const;

// ═══════════════════════════════════════════════════════════════
// Centre Opérations — seuils SLA (série OPS — 21/07/2026)
// ═══════════════════════════════════════════════════════════════
//
// RÉFÉRENCE UNIQUE des seuils de détection d'anomalie du tableau de bord
// « Centre Opérations ». Valeurs en MINUTES. Tous ajustables en base via
// app_settings.operations_thresholds (admin) — ce bloc est le DÉFAUT appliqué
// tant qu'aucune valeur n'est enregistrée. Le calcul des alertes fait foi
// CÔTÉ SERVEUR (operations-routes.js), qui applique ces mêmes seuils sur les
// horodatages en base. Le serveur détient un miroir de ces défauts (JS) ; toute
// modification ici doit être répercutée dans operations-routes.js DEFAULT_THRESHOLDS.
// Spec figée et 14 scénarios : app/docs/plan-ops-dashboard.md.
export const OPS_THRESHOLDS: Record<string, number> = {
  // ── Restaurant ──
  PENDING_UNCONFIRMED: 5,        // 🔴 en attente, non confirmée
  CONFIRMED_NOT_PREPARING: 6,    // 🟠 confirmée, prépa non lancée
  PREP_OVERDUE: 5,               // 🔴 dépasse estimated_ready_at de +N min
  READY_NO_DRIVER: 8,            // 🔴 prête sans livreur assigné
  GUARANTEE_UNCONFIRMED: 8,      // 🟠 garantie déclarée non validée
  // ── Livreur ──
  ASSIGNED_NO_PICKUP: 10,        // 🟠 assigné, pas encore récupéré
  PICKED_NOT_MOVING: 5,          // 🟠 récupérée, immobile
  DELIVERING_OVERDUE: 40,        // 🔴 trajet depuis picked_up (seuil fixe)
  GPS_SILENT: 6,                 // 🟠 pas de position ou position trop ancienne
  // ── Client / litige / catch-all ──
  CANCELLED_AFTER_PREP_WINDOW: 60, // fenêtre (min) où une annulation récente reste listée
  STUCK: 30,                     // 🔴 aucun changement de statut depuis N min
  LOOKBACK_HOURS: 24,            // fenêtre opérationnelle (H) — au-delà = donnée abandonnée
} as const;

/** Gravité par code d'alerte (miroir serveur). 'critical' 🔴 / 'warning' 🟠. */
export const OPS_SEVERITY: Record<string, 'critical' | 'warning'> = {
  PENDING_UNCONFIRMED: 'critical',
  CONFIRMED_NOT_PREPARING: 'warning',
  PREP_OVERDUE: 'critical',
  READY_NO_DRIVER: 'critical',
  GUARANTEE_UNCONFIRMED: 'warning',
  ASSIGNED_NO_PICKUP: 'warning',
  PICKED_NOT_MOVING: 'warning',
  DELIVERING_OVERDUE: 'critical',
  GPS_SILENT: 'warning',
  INCIDENT: 'critical',
  CANCELLED_AFTER_PREP: 'warning',
  GUARANTEE_DISPUTE: 'critical',
  STUCK: 'critical',
} as const;

/**
 * Calcule la rémunération totale estimée pour une course (FCFA).
 * Utilisé pour l'affichage côté livreur AVANT acceptation.
 * N'inclut PAS le pourboire (inconnu à ce stade) ni le bonus volume.
 */
export function estimateDriverEarnings(distanceKm: number, waitMinutes: number = 10): {
  basePickup: number;
  distancePay: number;
  waitPay: number;
  surgeMultiplier: number;
  surgeBonus: number;
  subtotal: number;
  guaranteed: number;
  final: number;
  surgeActive: boolean;
} {
  const { BASE_PICKUP_FEE_FCFA, PER_KM_RATE_FCFA, PER_MINUTE_RATE_FCFA,
    MINIMUM_EARNINGS_PER_DELIVERY_FCFA, MAXIMUM_EARNINGS_PER_DELIVERY_FCFA,
    SURGE_SCHEDULE } = DRIVER_PAY_CONFIG;

  const basePickup = BASE_PICKUP_FEE_FCFA;
  const distancePay = Math.round(Math.max(0, distanceKm) * PER_KM_RATE_FCFA);
  const waitPay = Math.round(Math.max(0, waitMinutes) * PER_MINUTE_RATE_FCFA);

  // Surge : vérifier si on est dans une plage de pointe
  const now = new Date();
  const currentHour = now.getHours();
  const activeSurge = SURGE_SCHEDULE.find(s => currentHour >= s.startHour && currentHour < s.endHour);
  const surgeMultiplier = activeSurge?.multiplier ?? 1.0;
  const surgeActive = surgeMultiplier > 1.0;

  const subtotal = basePickup + distancePay + waitPay;
  const surgeBonus = surgeActive ? Math.round(subtotal * (surgeMultiplier - 1)) : 0;
  const beforeGuarantee = subtotal + surgeBonus;
  const guaranteed = Math.max(beforeGuarantee, MINIMUM_EARNINGS_PER_DELIVERY_FCFA);
  const final = Math.min(guaranteed, MAXIMUM_EARNINGS_PER_DELIVERY_FCFA);

  return { basePickup, distancePay, waitPay, surgeMultiplier, surgeBonus, subtotal, guaranteed, final, surgeActive };
}
