// ============================================================
// verify:points — harnais du moteur de compte restaurant (série PTS)
// ============================================================
// Exécute le VRAI moteur (src/lib/pointsCore.ts, importé tel quel grâce au
// type-stripping de Node ≥ 23.6) contre un storage en mémoire, et vérifie les
// invariants du §0 de points-system-prompts.md. Sortie : PASS/FAIL par scénario,
// code retour 1 si au moins un FAIL.
//
// MODÈLE (21/07/2026) : solde en FCFA (1 unité = 1 FCFA). Le coût d'une commande
// est la COMMISSION passée en paramètre au hold (15 % du sous-total, calculée par
// l'appelant). On teste ici la MACHINE avec des montants de commission explicites.

import { createPointsEngine, InsufficientPointsError, NoActiveHoldError } from '../src/lib/pointsCore.ts';

// Valeurs de test (indépendantes de launchConfig : on teste la MACHINE ;
// l'app, elle, lit POINTS_CONFIG — voir points.ts).
const CONFIG = {
  POINT_PRICE_FCFA: 1,
  PENALTY_RESTAURANT_FAULT_FCFA: 500,
  MIN_BALANCE_FLOOR_FCFA: 0,
  MIN_RECHARGE_FCFA: 5000,
  WELCOME_BONUS_FCFA: 5000,
};

// Commission d'une commande type (15 % d'un panier de 10 000 FCFA).
const COMMISSION = 1500;

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

let failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log(`  PASS  ${label}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL  ${label}\n        → ${err.message}`);
  }
}
function assertEq(actual, expected, what) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what} : attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`);
  }
}
function assertThrows(fn, ErrorClass, what) {
  try {
    fn();
  } catch (err) {
    if (err instanceof ErrorClass) return;
    throw new Error(`${what} : mauvaise erreur (${err.name}: ${err.message})`);
  }
  throw new Error(`${what} : aucune erreur levée`);
}

const R = 'resto-test';
console.log('verify:points — machine à états du ledger (FCFA)\n');

check('recharge → hold (commission) → consume : soldes exacts à chaque étape', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  const req = e.requestRecharge(R, 10000, 'momo');
  assertEq(e.getBalance(R), { available: 0, held: 0 }, 'solde avant validation');
  e.decideRecharge(req.id, 'validate', 'admin-1');
  assertEq(e.getBalance(R), { available: 10000, held: 0 }, 'solde après recharge');
  e.holdPoints(R, 'order-1', COMMISSION);
  assertEq(e.getBalance(R), { available: 8500, held: 1500 }, 'solde après réservation commission');
  e.settleHold(R, 'order-1', 'consume');
  assertEq(e.getBalance(R), { available: 8500, held: 0 }, 'solde après consume');
  assertEq(e.hasActiveHold(R, 'order-1'), false, 'hold soldé');
});

check('hold refusé si solde insuffisant (jamais de solde négatif)', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.adminAdjust(R, 1000, 'admin-1', 'seed test');
  assertThrows(() => e.holdPoints(R, 'order-x', COMMISSION), InsufficientPointsError, 'hold 1500 sur 1000');
  assertEq(e.getBalance(R), { available: 1000, held: 0 }, 'solde inchangé après refus');
});

check('release : annulation sans faute → tout restitué', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.adminAdjust(R, 10000, 'admin-1', 'seed test');
  e.holdPoints(R, 'order-2', COMMISSION);
  e.settleHold(R, 'order-2', 'release');
  assertEq(e.getBalance(R), { available: 10000, held: 0 }, 'solde après release');
});

check('penalty : faute resto → 500 FCFA conservés, reliquat restitué', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.adminAdjust(R, 10000, 'admin-1', 'seed test');
  e.holdPoints(R, 'order-3', COMMISSION);
  e.settleHold(R, 'order-3', 'penalty');
  assertEq(e.getBalance(R), { available: 9500, held: 0 }, 'solde après pénalité (−500)');
});

check('convert_refund : prélèvement FCFA sur caution, refus si insuffisant', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.adminAdjust(R, 3000, 'admin-1', 'seed test');
  e.convertPointsToRefund(R, 'dispute-1', 1000);
  assertEq(e.getBalance(R), { available: 2000, held: 0 }, 'solde après remboursement 1000 F');
  assertThrows(
    () => e.convertPointsToRefund(R, 'dispute-2', 2500),
    InsufficientPointsError,
    'remboursement au-delà de la caution'
  );
});

check('ajustement admin négatif refusé si solde deviendrait négatif ; motif obligatoire', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.adminAdjust(R, 5000, 'admin-1', 'seed test');
  assertThrows(() => e.adminAdjust(R, -8000, 'admin-1', 'trop'), InsufficientPointsError, 'ajustement -8000 sur 5000');
  assertThrows(() => e.adminAdjust(R, -1000, 'admin-1', '  '), Error, 'motif vide');
  assertEq(e.getBalance(R), { available: 5000, held: 0 }, 'solde inchangé');
});

check('idempotence : rejouer hold / settle / validation de recharge ne change rien', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  const req = e.requestRecharge(R, 10000, 'cash_partner');
  e.decideRecharge(req.id, 'validate', 'admin-1');
  e.decideRecharge(req.id, 'validate', 'admin-1'); // rejoué
  assertEq(e.getBalance(R).available, 10000, 'recharge validée deux fois');
  e.holdPoints(R, 'order-4', COMMISSION);
  e.holdPoints(R, 'order-4', COMMISSION); // rejoué
  assertEq(e.getBalance(R), { available: 8500, held: 1500 }, 'hold rejoué');
  e.settleHold(R, 'order-4', 'release');
  e.settleHold(R, 'order-4', 'consume'); // rejoué avec un autre outcome : sans effet
  assertEq(e.getBalance(R), { available: 10000, held: 0 }, 'settle rejoué');
  e.convertPointsToRefund(R, 'dispute-4', 500);
  e.convertPointsToRefund(R, 'dispute-4', 500); // rejoué
  assertEq(e.getBalance(R).available, 9500, 'conversion rejouée');
});

check('crédit de bienvenue : une seule fois par restaurant', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.grantWelcomeBonus(R);
  e.grantWelcomeBonus(R);
  assertEq(e.getBalance(R), { available: 5000, held: 0 }, 'bonus unique');
});

check('canAcceptOrder : le solde doit couvrir la commission de LA commande', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.grantWelcomeBonus(R); // 5000
  assertEq(e.canAcceptOrder(R, COMMISSION), true, 'à 5000 F, commande 1500');
  e.holdPoints(R, 'o1', COMMISSION); // 3500
  e.holdPoints(R, 'o2', COMMISSION); // 2000
  assertEq(e.canAcceptOrder(R, 2500), false, 'à 2000 F, grosse commande 2500 : blocage');
  assertEq(e.canAcceptOrder(R, COMMISSION), true, 'à 2000 F, commande 1500 : OK');
  e.settleHold(R, 'o1', 'consume');
  e.settleHold(R, 'o2', 'consume');
  assertEq(e.getBalance(R), { available: 2000, held: 0 }, 'commandes en cours terminées');
});

check('settleHold sans hold actif → NoActiveHoldError', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  assertThrows(() => e.settleHold(R, 'order-jamais-vu', 'consume'), NoActiveHoldError, 'settle sans hold');
});

check('recharge : minimum imposé, rejet exige un motif', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  assertThrows(() => e.requestRecharge(R, 1000, 'momo'), Error, 'recharge 1000 < 5000');
  const req = e.requestRecharge(R, 5000, 'momo');
  assertThrows(() => e.decideRecharge(req.id, 'reject', 'admin-1'), Error, 'rejet sans motif');
  e.decideRecharge(req.id, 'reject', 'admin-1', 'référence introuvable');
  assertEq(e.getBalance(R).available, 0, 'rejet ne crédite pas');
});

check('promo_grant : dotation créditée, idempotente par campagne, nouvelle vague OK', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  const r1 = e.grantPromo(R, 5000, 'lancement-2026', 'Crédit offert', 'admin-1');
  assertEq(r1.alreadyGranted, false, 'première dotation');
  assertEq(e.getBalance(R), { available: 5000, held: 0 }, 'solde après dotation');
  const r2 = e.grantPromo(R, 5000, 'lancement-2026', 'Crédit offert', 'admin-1');
  assertEq(r2.alreadyGranted, true, 'rejouée : déjà servie');
  assertEq(e.getBalance(R), { available: 5000, held: 0 }, 'pas de double-crédit');
  e.grantPromo(R, 3000, 'vague-2', 'Deuxième vague', 'admin-1');
  assertEq(e.getBalance(R), { available: 8000, held: 0 }, 'nouvelle campagne créditée');
  assertThrows(() => e.grantPromo(R, 0, 'x', '', 'admin-1'), Error, 'montant ≤ 0 refusé');
  assertThrows(() => e.grantPromo(R, 5000, '  ', '', 'admin-1'), Error, 'campagne vide refusée');
});

console.log(failures === 0 ? '\nTous les scénarios PASS.' : `\n${failures} scénario(s) FAIL.`);
process.exit(failures === 0 ? 0 : 1);
