// ============================================================
// verify:points — harnais du moteur de points (série PTS)
// ============================================================
// Exécute le VRAI moteur (src/lib/pointsCore.ts, importé tel quel grâce au
// type-stripping de Node ≥ 23.6) contre un storage en mémoire, et vérifie
// les invariants du §0 de points-system-prompts.md. Sortie : PASS/FAIL par
// scénario, code retour 1 si au moins un FAIL.

import { createPointsEngine, InsufficientPointsError, NoActiveHoldError } from '../src/lib/pointsCore.ts';

// Valeurs du §0 (indépendantes de launchConfig : on teste la MACHINE ;
// l'app, elle, lit POINTS_CONFIG — voir points.ts).
const CONFIG = {
  POINT_PRICE_FCFA: 500,
  ORDER_COST_POINTS: 3,
  PENALTY_RESTAURANT_FAULT_POINTS: 1,
  MIN_BALANCE_TO_ACCEPT_POINTS: 6,
  MIN_RECHARGE_POINTS: 10,
  WELCOME_BONUS_POINTS: 10,
};

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
console.log('verify:points — machine à états du ledger\n');

check('recharge → hold → consume : soldes exacts à chaque étape', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  const req = e.requestRecharge(R, 10, 'momo');
  assertEq(e.getBalance(R), { available: 0, held: 0 }, 'solde avant validation');
  e.decideRecharge(req.id, 'validate', 'admin-1');
  assertEq(e.getBalance(R), { available: 10, held: 0 }, 'solde après recharge');
  e.holdPoints(R, 'order-1');
  assertEq(e.getBalance(R), { available: 7, held: 3 }, 'solde après hold');
  e.settleHold(R, 'order-1', 'consume');
  assertEq(e.getBalance(R), { available: 7, held: 0 }, 'solde après consume');
  assertEq(e.hasActiveHold(R, 'order-1'), false, 'hold soldé');
});

check('hold refusé si solde insuffisant (jamais de solde négatif)', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.adminAdjust(R, 2, 'admin-1', 'seed test');
  assertThrows(() => e.holdPoints(R, 'order-x'), InsufficientPointsError, 'hold à 2 pts');
  assertEq(e.getBalance(R), { available: 2, held: 0 }, 'solde inchangé après refus');
});

check('release : annulation sans faute → tout restitué', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.adminAdjust(R, 10, 'admin-1', 'seed test');
  e.holdPoints(R, 'order-2');
  e.settleHold(R, 'order-2', 'release');
  assertEq(e.getBalance(R), { available: 10, held: 0 }, 'solde après release');
});

check('penalty : faute resto → 1 conservé, 2 restitués', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.adminAdjust(R, 10, 'admin-1', 'seed test');
  e.holdPoints(R, 'order-3');
  e.settleHold(R, 'order-3', 'penalty');
  assertEq(e.getBalance(R), { available: 9, held: 0 }, 'solde après pénalité');
});

check('convert_refund : arrondi au point supérieur, refus si caution insuffisante', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.adminAdjust(R, 3, 'admin-1', 'seed test');
  e.convertPointsToRefund(R, 'dispute-1', 1000); // ceil(1000/500) = 2
  assertEq(e.getBalance(R), { available: 1, held: 0 }, 'solde après conversion 1000 F');
  assertThrows(
    () => e.convertPointsToRefund(R, 'dispute-2', 700), // ceil = 2 > 1
    InsufficientPointsError,
    'conversion au-delà de la caution'
  );
  const e2 = createPointsEngine(memoryStorage(), CONFIG);
  e2.adminAdjust(R, 3, 'admin-1', 'seed');
  e2.convertPointsToRefund(R, 'dispute-3', 501); // ceil(501/500) = 2 (arrondi supérieur)
  assertEq(e2.getBalance(R), { available: 1, held: 0 }, 'arrondi supérieur 501 F → 2 pts');
});

check('ajustement admin négatif refusé si solde deviendrait négatif ; motif obligatoire', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.adminAdjust(R, 5, 'admin-1', 'seed test');
  assertThrows(() => e.adminAdjust(R, -8, 'admin-1', 'trop'), InsufficientPointsError, 'ajustement -8 sur 5');
  assertThrows(() => e.adminAdjust(R, -1, 'admin-1', '  '), Error, 'motif vide');
  assertEq(e.getBalance(R), { available: 5, held: 0 }, 'solde inchangé');
});

check('idempotence : rejouer hold / settle / validation de recharge ne change rien', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  const req = e.requestRecharge(R, 10, 'cash_partner');
  e.decideRecharge(req.id, 'validate', 'admin-1');
  e.decideRecharge(req.id, 'validate', 'admin-1'); // rejoué
  assertEq(e.getBalance(R).available, 10, 'recharge validée deux fois');
  e.holdPoints(R, 'order-4');
  e.holdPoints(R, 'order-4'); // rejoué
  assertEq(e.getBalance(R), { available: 7, held: 3 }, 'hold rejoué');
  e.settleHold(R, 'order-4', 'release');
  e.settleHold(R, 'order-4', 'consume'); // rejoué avec un autre outcome : sans effet
  assertEq(e.getBalance(R), { available: 10, held: 0 }, 'settle rejoué');
  e.convertPointsToRefund(R, 'dispute-4', 500);
  e.convertPointsToRefund(R, 'dispute-4', 500); // rejoué
  assertEq(e.getBalance(R).available, 9, 'conversion rejouée');
});

check('bonus de bienvenue : une seule fois par restaurant', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.grantWelcomeBonus(R);
  e.grantWelcomeBonus(R);
  assertEq(e.getBalance(R), { available: 10, held: 0 }, 'bonus unique');
});

check('canAcceptOrder : seuil de caution appliqué (scénario PTS-02)', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  e.grantWelcomeBonus(R); // 10
  assertEq(e.canAcceptOrder(R), true, 'à 10 pts');
  e.holdPoints(R, 'o1'); // 7
  assertEq(e.canAcceptOrder(R), true, 'à 7 pts');
  e.holdPoints(R, 'o2'); // 4
  assertEq(e.canAcceptOrder(R), false, 'à 4 pts (< seuil 6) : blocage');
  e.settleHold(R, 'o1', 'consume');
  e.settleHold(R, 'o2', 'consume'); // les commandes en cours vont au bout
  assertEq(e.getBalance(R), { available: 4, held: 0 }, 'commandes en cours terminées');
});

check('settleHold sans hold actif → NoActiveHoldError', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  assertThrows(() => e.settleHold(R, 'order-jamais-vu', 'consume'), NoActiveHoldError, 'settle sans hold');
});

check('recharge : minimum imposé, rejet exige un motif', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  assertThrows(() => e.requestRecharge(R, 5, 'momo'), Error, 'recharge 5 < 10');
  const req = e.requestRecharge(R, 10, 'momo');
  assertThrows(() => e.decideRecharge(req.id, 'reject', 'admin-1'), Error, 'rejet sans motif');
  e.decideRecharge(req.id, 'reject', 'admin-1', 'référence introuvable');
  assertEq(e.getBalance(R).available, 0, 'rejet ne crédite pas');
});

check('promo_grant : dotation créditée, idempotente par campagne, nouvelle vague OK', () => {
  const e = createPointsEngine(memoryStorage(), CONFIG);
  const r1 = e.grantPromo(R, 10, 'lancement-2026', 'Points offerts', 'admin-1');
  assertEq(r1.alreadyGranted, false, 'première dotation');
  assertEq(e.getBalance(R), { available: 10, held: 0 }, 'solde après dotation');
  const r2 = e.grantPromo(R, 10, 'lancement-2026', 'Points offerts', 'admin-1');
  assertEq(r2.alreadyGranted, true, 'rejouée : déjà servie');
  assertEq(e.getBalance(R), { available: 10, held: 0 }, 'pas de double-crédit');
  e.grantPromo(R, 5, 'vague-2', 'Deuxième vague', 'admin-1');
  assertEq(e.getBalance(R), { available: 15, held: 0 }, 'nouvelle campagne créditée');
  assertThrows(() => e.grantPromo(R, 0, 'x', '', 'admin-1'), Error, 'points ≤ 0 refusés');
  assertThrows(() => e.grantPromo(R, 5, '  ', '', 'admin-1'), Error, 'campagne vide refusée');
});

console.log(failures === 0 ? '\nTous les scénarios PASS.' : `\n${failures} scénario(s) FAIL.`);
process.exit(failures === 0 ? 0 : 1);
