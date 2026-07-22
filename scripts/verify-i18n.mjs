#!/usr/bin/env node
// Vérification i18n (FR -> EN). Détecte :
//  - clés t() non traduites en anglais (absentes de en.json OU valeur === clé)
//  - clés multi-lignes fragiles (contiennent un retour à la ligne)
//  - clés orphelines dans en.json (plus utilisées dans le code)
// Échoue (exit 1) si une PAGE PRIORITAIRE contient une clé non traduite.
//
// Usage : node scripts/verify-i18n.mjs [--all] [--json]
//   --all   liste toutes les clés non traduites (pas seulement le résumé)
//   --json  sortie JSON

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = join(__dirname, '..');
const SRC = join(APP, 'src');
const EN_PATH = join(SRC, 'i18n/locales/en.json');

const argv = process.argv.slice(2);
const SHOW_ALL = argv.includes('--all');
const AS_JSON = argv.includes('--json');

// Pages/composants à fort trafic qui DOIVENT être 100% traduits (gate dur).
const PRIORITY = [
  'pages/Home.tsx', 'components/Navbar.tsx', 'components/Footer.tsx',
  'components/MobileBottomNav.tsx', 'pages/Restaurants.tsx', 'pages/Login.tsx',
  'pages/Inscription.tsx', 'pages/Checkout.tsx', 'pages/Orders.tsx', 'pages/Profile.tsx',
];

// Chaînes identiques FR/EN légitimes (marque, devise, unités, lieux, sigles) — non comptées.
const IDENTITY = /^(FCFA|FCFA\.|MiamExpress|Yamo|OK|WhatsApp|MTN|MoMo|Orange Money|Douala|Yaoundé|Yaounde|Cameroun|GPS|SMS|OTP|Email|Premium|Restaurants|restaurant|Contact|Contact & support|Menu|Standard|Options|Description|Instructions|Configuration|Actions|Transactions|Documents|Zones|Pizza|Total|English|Maximum|Point|km|min|km\)|km · ~)$/;
// Chaînes exactes identiques FR/EN (marques, unités, fragments monétaires, adresses).
const IDENTITY_EXACT = new Set([
  'Local', 'Latitude', 'Longitude', 'Waze', 'Google Maps', 'Navigation', 'Message',
  'Top restaurants', 'FCFA/km', 'FCFA/h', 'FCFA)', 'FCFA).', 'FCFA ·', 'Desserts', 'Tags',
  'Date', 'Ledger', 'Ledger —', 'MTN MoMo', 'MiamExpress SARL', 'Rue des Palmiers, Bonapriso',
  'miamexpress.cm/restaurant/', '60h', 'km · 🕐 ~', '· Page', 'photos)', 'Min.', 'pts',
  'pts (', 'pts ·', 'points', 'points.', 'points ·', 'h &times;', '(WhatsApp)', 'document',
  'Restaurants (', 'Minimum', 'Restaurant', 'Points', 'Quotas', 'Finances', 'Support',
]);
const isIdentity = (k) =>
  /^[\s\p{P}\p{S}\d]+$/u.test(k) ||        // symboles/chiffres seuls
  k.trim().length <= 2 ||                    // 1-2 caractères
  /@/.test(k) ||                             // emails / handles
  /^https?:\/\//.test(k) ||                  // URLs
  IDENTITY.test(k) ||
  IDENTITY_EXACT.has(k) ||
  /^nav\.$/.test(k) ||
  /^[\p{Emoji}\s]+WhatsApp$/u.test(k);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== 'node_modules') walk(p, out); }
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

// Capture t("KEY") / t('KEY') + le caractère suivant (, ) +) pour distinguer
// clé simple / avec défaut / concaténation dynamique.
const RE = /[^\w.]t\(\s*(['"])((?:\\.|(?!\1).)*?)\1\s*([,)+])/g;

function decodeKey(raw) {
  // Le littéral source peut contenir des échappements (\n, \r, \", \\, \').
  // Décodage manuel : JSON.parse cassait les clés contenant déjà \" (double échappement).
  return raw.replace(/\\(.)/g, (_, c) => ({ n: '\n', r: '\r', t: '\t' }[c] ?? c));
}

const files = walk(SRC);
const usage = new Map(); // key -> Set(relFiles)
for (const f of files) {
  const rel = relative(SRC, f).replace(/\\/g, '/');
  const s = readFileSync(f, 'utf8');
  let m;
  while ((m = RE.exec(s))) {
    const follow = m[3];
    if (follow === '+') continue; // t('prefix' + x) — clé dynamique, ignorée
    const key = decodeKey(m[2]);
    if (!key || !/[a-zA-ZÀ-ÿ]/.test(key)) continue; // pas de lettre = symbole
    if (!usage.has(key)) usage.set(key, new Set());
    usage.get(key).add(rel);
  }
}

const en = JSON.parse(readFileSync(EN_PATH, 'utf8'));
const flat = {};
(function w(o) { for (const k in o) { const v = o[k]; if (v && typeof v === 'object') w(v); else flat[k] = v; } })(en);

const untranslated = []; // {key, files}
const brittle = [];
for (const [key, fileset] of usage) {
  if (/[\r\n]/.test(key)) brittle.push({ key, files: [...fileset] });
  if (isIdentity(key)) continue;
  const v = flat[key];
  if (v === undefined || v === key) untranslated.push({ key, files: [...fileset] });
}

// Orphelines : clés de en.json jamais utilisées (hors clés dynamiques nav.*).
const used = new Set(usage.keys());
const orphans = Object.keys(flat).filter(
  (k) => !used.has(k) && !k.startsWith('nav.') && /[a-zA-ZÀ-ÿ]/.test(k)
);

// Violations gate : clé non traduite utilisée dans une page prioritaire.
const gate = untranslated.filter((u) => u.files.some((f) => PRIORITY.includes(f)));

if (AS_JSON) {
  console.log(JSON.stringify({ untranslated, brittle, orphans, gate }, null, 2));
  process.exit(gate.length ? 1 : 0);
}

const pct = usage.size ? Math.round((1 - untranslated.length / usage.size) * 100) : 100;
console.log('── Vérification i18n (FR → EN) ──');
console.log(`  Clés t() uniques dans le code : ${usage.size}`);
console.log(`  Traduites en EN              : ${usage.size - untranslated.length} (${pct}%)`);
console.log(`  ⚠ Non traduites (FR en EN)   : ${untranslated.length}`);
console.log(`  ⚠ Multi-lignes fragiles      : ${brittle.length}`);
console.log(`  ℹ Orphelines dans en.json    : ${orphans.length}`);

if (brittle.length) {
  console.log('\n  Clés multi-lignes fragiles (à refactorer — éviter le JSX multi-ligne dans t()) :');
  for (const b of brittle.slice(0, 20)) console.log('   • ' + JSON.stringify(b.key.slice(0, 60)) + '…  [' + b.files.join(', ') + ']');
}

if (SHOW_ALL && untranslated.length) {
  console.log('\n  Toutes les clés non traduites :');
  const byFile = {};
  for (const u of untranslated) for (const f of u.files) (byFile[f] ||= []).push(u.key);
  for (const f of Object.keys(byFile).sort()) {
    console.log(`\n   ${f} (${byFile[f].length}) :`);
    for (const k of byFile[f]) console.log('     - ' + JSON.stringify(k));
  }
}

if (gate.length) {
  console.log(`\n❌ ÉCHEC : ${gate.length} clé(s) non traduite(s) dans des pages PRIORITAIRES :`);
  for (const g of gate.slice(0, 40)) console.log('   - ' + JSON.stringify(g.key) + '  [' + g.files.filter((f) => PRIORITY.includes(f)).join(', ') + ']');
  process.exit(1);
}
console.log('\n✅ Pages prioritaires : 100% traduites.');
