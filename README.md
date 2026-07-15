# MiamExpress — Livraison premium au Cameroun

React + TypeScript + Vite + Tailwind + shadcn/ui.

## Démarrer en local

```bash
npm install
npm run dev
```

Sans `.env` (fichier non versionné — une nouvelle machine ou un fresh clone n'en a pas), l'app
tourne entièrement sur des données mockées (`src/data/mockData.ts`) : catalogue restaurants/menus,
avis. Les commandes passées en checkout sont alors sauvegardées dans le `localStorage` du
navigateur (`yamo_local_orders`), et la connexion simulée (`yamo_local_user`) accepte n'importe
quel code de vérification. Cela permet de tester tout le tunnel client → panier → checkout →
suivi de commande sans backend.

Cette machine dispose déjà d'un `.env` pointant vers un vrai projet Supabase (voir section
suivante) — donc en local ici, l'app lit/écrit réellement dans Supabase, sauf pour la connexion
(OTP par SMS non configuré, voir plus bas).

## Backend Supabase — état actuel

Un projet Supabase réel (`yamo`, région `eu-west-3`) est déjà créé et branché :
migrations 0001 à 0007 appliquées, `.env` renseigné, restaurants/menus seedés depuis `mockData.ts`.
`npm run dev` utilise donc déjà Supabase pour le catalogue et les commandes.

**Ce qui manque encore pour que la connexion fonctionne en vrai** : aucun fournisseur SMS
n'est configuré côté Supabase Auth, donc l'envoi de code OTP par téléphone échouera tant que
ce n'est pas fait (Authentication → Providers → Phone, dans le dashboard Supabase — nécessite
un compte Twilio ou équivalent). Sans ça, tout ce qui suppose une connexion (checkout, dashboards)
ne fonctionnera pas avec ce projet Supabase branché.

### Recréer/retrouver la configuration depuis zéro

1. Projet Supabase : `supabase projects list` (CLI déjà authentifiée) pour retrouver le ref,
   ou [supabase.com](https://supabase.com) → dashboard
2. Migrations : `supabase link --project-ref <ref>` puis `supabase db push`
   (applique dans l'ordre toutes les migrations `supabase/migrations/0001_*.sql` à `0007_*.sql`)
3. Clés API : `supabase projects api-keys --project-ref <ref>` → mettre la clé `anon` dans `.env`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) et la clé `service_role` dans `.env.server`
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — jamais la service_role dans `.env` (préfixe `VITE_`
   = exposée au navigateur)
4. Seed : `npm run seed` (lit `src/data/mockData.ts`, insère dans `restaurants` / `menu_items`
   via `scripts/seed.mjs`)

### Rôles (client / restaurant / livreur / admin)

Le rôle est fixé à la première connexion d'un numéro (choix "Je suis..." sur `/connexion`)
et stocké dans `profiles.role`. Le rôle `admin` n'est volontairement pas sélectionnable
depuis l'interface — pour en créer un :

- **Avec Supabase** : `update profiles set role = 'admin' where phone = '+237...';`
- **Sans backend (mode démo)** : dans la console du navigateur,
  `localStorage.setItem('yamo_local_users', JSON.stringify({ '+237600000000': { id: 'local-+237600000000', phone: '+237600000000', role: 'admin', isApproved: true } }))`,
  puis se connecter avec ce numéro.

### Candidature & validation (restaurant / livreur)

Un compte `restaurant` ou `livreur` ne peut pas accéder à son dashboard tant qu'il n'est pas
`isApproved` (`profiles.is_approved`, table `applications`). Le flux :

1. Le compte candidate depuis la page Partenaires (`/partenaires`) ou Livreurs (`/livreurs`)
   — formulaire `ApplicationForm`, écrit dans la table `applications`.
2. Un admin ouvre `/admin`, voit la candidature dans "Candidatures en attente", et
   approuve (en liant éventuellement un restaurant existant) ou rejette.
3. Une fois approuvé, `profiles.is_approved = true` et l'accès au dashboard correspondant
   se débloque (`RoleGate` vérifie `user.isApproved`).

C'est volontairement minimal : l'admin peut lier un restaurant existant ou créer automatiquement une fiche restaurant fermée depuis la candidature. La vérification documentaire reste à durcir avant un vrai lancement.

## Où se trouve quoi

| Domaine | Fichiers |
|---|---|
| Client Supabase | `src/lib/supabase.ts` |
| Catalogue restaurants/menu (avec fallback mock) | `src/lib/catalog.ts`, `src/hooks/useCatalog.ts` |
| Auth téléphone + OTP | `src/contexts/AuthContext.tsx`, `src/pages/Login.tsx` |
| Panier | `src/contexts/CartContext.tsx` |
| Commandes (création + historique) | `src/lib/orders.ts`, `src/pages/Checkout.tsx`, `src/pages/Orders.tsx` |
| Espace restaurant | `src/pages/RestaurantDashboard.tsx` (`/partenaires/dashboard`) |
| Espace livreur | `src/pages/DriverDashboard.tsx` (`/livreurs/dashboard`) |
| Back-office admin | `src/pages/Admin.tsx` (`/admin`) |
| Rôles & accès | `src/contexts/AuthContext.tsx`, `src/components/RoleGate.tsx` |
| Candidatures & validation admin | `src/lib/applications.ts`, `src/components/ApplicationForm.tsx` |
| Schéma base de données | `supabase/migrations/0001_init.sql` … `0007_order_picked_up_status.sql` |
| Script de seed | `scripts/seed.mjs` (`npm run seed`) |

## Prochaines étapes (voir le plan complet)

- Intégration paiement réel MTN Mobile Money / Orange Money (actuellement seul
  "paiement à la livraison" fonctionne de bout en bout ; les options MoMo/Orange
  créent la commande mais ne déclenchent pas encore d'appel API de paiement)
- Suivi temps réel livreur (WebSocket / Supabase Realtime + carte GPS)
- Édition de plat (actuellement ajout/suppression seulement, pas de modification)
- Ajouter la vérification documentaire complète des candidatures restaurant/livreur

## Scripts

- `npm run dev` — serveur de développement
- `npm run seed` — seed catalogue restaurants/menus
- `npm run seed:test-profiles` — seed des profils complets de test en base Supabase
- `npm run build` — build de production (`tsc -b && vite build`)
- `npm run lint` — ESLint
- `npm run preview` — prévisualiser le build de production
