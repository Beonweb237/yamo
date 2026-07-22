// ============================================================
// verify:loyalty — harnais du moteur MiamPoints (série LOY)
// ============================================================
// Exécute le VRAI moteur (src/lib/loyaltyCore.ts) contre un storage mémoire et
// vérifie earn/redeem/refund/expiration/idempotence.

import { createLoyaltyEngine, InsufficientLoyaltyError } from '../src/lib/loyaltyCore.ts';

const CONFIG = {
  EARN_RATE: 0.05,
  POINT_VALUE_FCFA: 1,
  MIN_REDEEM_POINTS: 500,
  MAX_REDEEM_RATE: 0.5,
  EXPIRY_MONTHS: 12,
};

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v) };
}

let failures = 0;
function check(label, fn) {
  try { fn(); console.log(`  PASS  ${label}`); }
  catch (err) { failures++; console.error(`  FAIL  ${label}\n        → ${err.message}`); }
}
function assertEq(actual, expected, what) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what} : attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`);
  }
}
function assertThrows(fn, ErrorClass, what) {
  try { fn(); } catch (err) { if (err instanceof ErrorClass) return; throw new Error(`${what} : mauvaise erreur (${err.name})`); }
  throw new Error(`${what} : aucune erreur levée`);
}

const C = 'client-test';
console.log('verify:loyalty — moteur MiamPoints\n');

check('earn : 5 % du sous-total, idempotent par commande', () => {
  const e = createLoyaltyEngine(memoryStorage(), CONFIG);
  e.earn(C, 'o1', 10000); // +500
  e.earn(C, 'o1', 10000); // rejoué : sans effet
  assertEq(e.getBalance(C).available, 500, 'solde après earn 10000');
  e.earn(C, 'o2', 6000); // +300
  assertEq(e.getBalance(C).available, 800, 'solde après 2e earn');
});

check('redeem : minimum, plafond 50 %, débit', () => {
  const e = createLoyaltyEngine(memoryStorage(), CONFIG);
  e.adminAdjust(C, 2000, 'admin', 'seed');
  assertThrows(() => e.redeem(C, 'oa', 400, 10000), InsufficientLoyaltyError, 'sous le minimum 500');
  assertThrows(() => e.redeem(C, 'ob', 6000, 10000), InsufficientLoyaltyError, 'au-delà du plafond 50% (5000)');
  e.redeem(C, 'oc', 1500, 10000); // OK : ≥500, ≤5000, ≤solde
  assertEq(e.getBalance(C).available, 500, 'solde après redeem 1500');
});

check('redeem : refusé si solde insuffisant', () => {
  const e = createLoyaltyEngine(memoryStorage(), CONFIG);
  e.adminAdjust(C, 600, 'admin', 'seed');
  assertThrows(() => e.redeem(C, 'od', 700, 10000), InsufficientLoyaltyError, 'redeem 700 sur 600');
  assertEq(e.getBalance(C).available, 600, 'solde inchangé');
});

check('refund : restitue les points d’une commande annulée (idempotent)', () => {
  const e = createLoyaltyEngine(memoryStorage(), CONFIG);
  e.adminAdjust(C, 2000, 'admin', 'seed');
  e.redeem(C, 'oe', 1000, 10000); // 1000
  assertEq(e.getBalance(C).available, 1000, 'après redeem');
  e.refundRedeem(C, 'oe');
  e.refundRedeem(C, 'oe'); // rejoué
  assertEq(e.getBalance(C).available, 2000, 'après refund');
});

check('expiration : solde expiré après 12 mois d’inactivité', () => {
  const e = createLoyaltyEngine(memoryStorage(), CONFIG);
  e.earn(C, 'of', 10000); // +500 (daté maintenant)
  const future = new Date();
  future.setMonth(future.getMonth() + 13);
  assertEq(e.getBalance(C, future).expired, true, 'expiré à +13 mois');
  assertEq(e.getBalance(C, future).available, 0, 'solde 0 si expiré');
  const soon = new Date();
  soon.setMonth(soon.getMonth() + 6);
  assertEq(e.getBalance(C, soon).available, 500, 'encore valide à +6 mois');
});

check('solde jamais négatif ; ajustement négatif borné', () => {
  const e = createLoyaltyEngine(memoryStorage(), CONFIG);
  e.adminAdjust(C, 500, 'admin', 'seed');
  assertThrows(() => e.adminAdjust(C, -800, 'admin', 'trop'), InsufficientLoyaltyError, 'ajustement -800 sur 500');
  assertEq(e.getBalance(C).available, 500, 'solde inchangé');
});

console.log(failures === 0 ? '\nTous les scénarios PASS.' : `\n${failures} scénario(s) FAIL.`);
process.exit(failures === 0 ? 0 : 1);
