#!/usr/bin/env node
// Automatisation Google Search Console — compte de service gsc-bot@miamexpress-seo.
// Sans dépendance : JWT RS256 via node:crypto + fetch natif.
//
// Usage :
//   node scripts/gsc.mjs get-token        → obtient le fichier de vérification (nom + contenu)
//   node scripts/gsc.mjs verify           → vérifie la propriété (le fichier doit être servi en prod)
//   node scripts/gsc.mjs add-owner <email>→ ajoute un co-propriétaire (visible dans l'UI GSC)
//   node scripts/gsc.mjs add-site         → ajoute la propriété dans Search Console
//   node scripts/gsc.mjs submit-sitemap   → soumet https://miamexpress.cm/sitemap.xml
//   node scripts/gsc.mjs status           → sites + sitemaps vus par le compte de service
//
// Clé : %USERPROFILE%\.gsc\miamexpress-seo-key.json (ou env GSC_KEY_FILE).
// JAMAIS committer la clé.
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SITE = 'https://miamexpress.cm/';
const SITEMAP = 'https://miamexpress.cm/sitemap.xml';
const KEY_FILE = process.env.GSC_KEY_FILE ?? join(homedir(), '.gsc', 'miamexpress-seo-key.json');
const SCOPES = 'https://www.googleapis.com/auth/siteverification https://www.googleapis.com/auth/webmasters';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

async function accessToken() {
  const key = JSON.parse(readFileSync(KEY_FILE, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: key.client_email, scope: SCOPES, aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(key.private_key))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token OAuth refusé : ' + JSON.stringify(data));
  return data.access_token;
}

async function api(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, data };
}

const site = { identifier: SITE, type: 'SITE' };
const cmd = process.argv[2];
const token = await accessToken();

if (cmd === 'get-token') {
  const r = await api('POST', 'https://www.googleapis.com/siteVerification/v1/token', token, {
    site, verificationMethod: 'FILE',
  });
  if (r.status !== 200) throw new Error(JSON.stringify(r));
  // r.data.token = "google-site-verification: googleXXXX.html"
  const fileName = r.data.token.split(':').pop().trim();
  console.log(JSON.stringify({ fileName, fileContent: r.data.token }, null, 2));
} else if (cmd === 'verify') {
  const r = await api('POST', 'https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=FILE', token, { site });
  console.log(r.status, JSON.stringify(r.data, null, 2));
} else if (cmd === 'add-owner') {
  const email = process.argv[3];
  if (!email) throw new Error('email requis');
  const id = encodeURIComponent(SITE);
  const cur = await api('GET', `https://www.googleapis.com/siteVerification/v1/webResource/${id}`, token);
  if (cur.status !== 200) throw new Error(JSON.stringify(cur));
  const owners = [...new Set([...(cur.data.owners ?? []), email])];
  const r = await api('PUT', `https://www.googleapis.com/siteVerification/v1/webResource/${id}`, token, { ...cur.data, owners });
  console.log(r.status, JSON.stringify(r.data, null, 2));
} else if (cmd === 'add-site') {
  const r = await api('PUT', `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}`, token);
  console.log(r.status, JSON.stringify(r.data));
} else if (cmd === 'submit-sitemap') {
  const r = await api('PUT', `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/sitemaps/${encodeURIComponent(SITEMAP)}`, token);
  console.log(r.status, JSON.stringify(r.data));
} else if (cmd === 'status') {
  const sites = await api('GET', 'https://www.googleapis.com/webmasters/v3/sites', token);
  const maps = await api('GET', `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/sitemaps`, token);
  console.log('sites:', JSON.stringify(sites.data, null, 2));
  console.log('sitemaps:', JSON.stringify(maps.data, null, 2));
} else {
  console.log('Commandes : get-token | verify | add-owner <email> | add-site | submit-sitemap | status');
  process.exit(1);
}
