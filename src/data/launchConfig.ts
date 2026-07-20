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
 * Système de points restaurant + garantie client (série PTS).
 * RÉFÉRENCE UNIQUE des règles métier — aucune de ces valeurs ne doit être codée
 * en dur ailleurs. Machine à états et invariants : app/docs/points-system-prompts.md §0.
 */
export const POINTS_CONFIG = {
  /** Prix de vente d'un point (FCFA). */
  POINT_PRICE_FCFA: 500,
  /** Coût restaurant d'une commande livrée (barème fixe v1). */
  ORDER_COST_POINTS: 3,
  /** Pénalité si annulation par faute du resto (sur le hold : 1 consommé, 2 restitués). */
  PENALTY_RESTAURANT_FAULT_POINTS: 1,
  /** Solde minimum pour pouvoir ACCEPTER une nouvelle commande (rôle de caution). */
  MIN_BALANCE_TO_ACCEPT_POINTS: 6,
  /** Recharge minimale (Mobile Money ou cash partenaire). */
  MIN_RECHARGE_POINTS: 10,
  /** Seuil d'alerte « solde faible » côté resto. */
  LOW_BALANCE_THRESHOLD_POINTS: 6,
  /** Points offerts à l'activation d'un resto (0 = désactivé). */
  WELCOME_BONUS_POINTS: 10,
  /** Garantie client par commande (FCFA, montant fixe). */
  GUARANTEE_AMOUNT_FCFA: 1000,
  /** 'deducted' : garantie déduite du total à la livraison (seul mode implémenté en v1). */
  GUARANTEE_MODE: 'deducted',
  /** Garantie confisquée : le livreur reçoit d'abord les frais de livraison, reliquat au resto. */
  GUARANTEE_FORFEIT_DRIVER_FIRST: true,
  /** Numéro de dépôt Mobile Money MiamExpress pour les recharges — À compléter au lancement. */
  RECHARGE_MOMO_NUMBER: null as string | null,
} as const;
