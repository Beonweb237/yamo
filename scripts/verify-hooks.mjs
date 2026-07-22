#!/usr/bin/env node
// Garde-fou hooks : échoue s'il existe la moindre violation react-hooks/rules-of-hooks
// (hook appelé dans un callback / condition — la classe de bug qui crashe l'app
// « Invalid hook call », typiquement introduite par un wrap i18n naïf).
// Ignore les autres règles (set-state-in-effect, etc. = dette pré-existante connue).

import { execFileSync } from 'node:child_process';

let out = '';
try {
  out = execFileSync('npx', ['eslint', 'src', '-f', 'json'], {
    cwd: process.cwd(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32',
  });
} catch (e) {
  out = e.stdout || ''; // eslint sort en code 1 quand il y a des erreurs — on lit quand même le JSON
}

let report;
try { report = JSON.parse(out); }
catch { console.error('verify:hooks — impossible de parser la sortie ESLint'); process.exit(2); }

const RULE = 'react-hooks/rules-of-hooks';
const hits = [];
for (const f of report) {
  for (const m of f.messages) {
    if (m.ruleId === RULE) hits.push(`${f.filePath.replace(/.*[\\/]src[\\/]/, 'src/')}:${m.line}  ${m.message}`);
  }
}

if (hits.length === 0) {
  console.log('✅ verify:hooks — 0 violation react-hooks/rules-of-hooks.');
  process.exit(0);
}
console.log(`❌ verify:hooks — ${hits.length} violation(s) react-hooks/rules-of-hooks (risque de crash) :`);
for (const h of hits) console.log('  • ' + h);
process.exit(1);
