# Coordination du Prompt Master — protocole d'exécution et de vérification

Ce fichier pilote l'exécution de `prompt-master.md` (lots QA-A → QA-I, constats dans `audit-qualite-pages.md`). Il est **la source de vérité du suivi** : mettre à jour le tableau après chaque lot.

## Règles d'exécution

1. **Un lot = un changement isolé.** Ne jamais mélanger deux lots dans une même passe. Copier le prompt du lot tel quel (le préambule commun s'applique toujours).
2. **Ordre imposé** : A → B → C → D → E → F → G → H → I. Exceptions autorisées : D/E/F sont indépendants entre eux ; G doit précéder I ; H peut passer avant G.
3. **Porte de sortie d'un lot** (toutes obligatoires avant de le marquer ✅) :
   - `npm run lint` : zéro **nouvelle** erreur sur les fichiers touchés (comparer avant/après — ~79 erreurs pré-existantes assumées) ;
   - `npm run build` (tsc + vite) : succès ;
   - Vérification navigateur en **mode démo** (serveur `yamo-web-mock-3011`, seed auto v2) : le critère de vérification écrit dans le prompt du lot est constaté à l'écran, desktop 1280px ET mobile 360×640, sans débordement horizontal ni erreur console ;
   - Aucun parcours critique cassé : ajout panier → checkout, connexion des 4 rôles.
4. **En cas d'échec** : ne pas marquer le lot, consigner le blocage dans le tableau (colonne Notes), corriger dans la même passe si trivial, sinon ouvrir une passe dédiée. Ne jamais passer au lot suivant avec une porte rouge.
5. **Données de test** : toujours utiliser le seed (`__yamoSeedDemo()` pour réinjecter, `__yamoClearDemo()` pour purger). Comptes : client riche = +237650000001 (Marie Ngono, ~20 commandes) ; démo par rôle = +23769000000{1..6}, OTP = 6 chiffres quelconques.
6. **Interdits transverses** (rappel CLAUDE.md) : pas de refonte hors périmètre, pas de nouvelle dépendance, pas de fonctionnalité factice, pas de modification des branches `isSupabaseConfigured`, pas de `npm run deploy` sans demande explicite.
7. **Déploiement** : rien ne part en production depuis ces lots. Le déploiement VPS (build + `deploy.ps1` en terminal interactif) est une étape séparée, déclenchée par le propriétaire une fois QA-I ✅.

## Tableau de suivi

| Lot | Priorité | Constats | Statut | Lint | Build | Navigateur (2 tailles) | Notes |
|---|---|---|---|---|---|---|---|
| QA-A Contact réel | P0 | C1 | ✅ Validé (18/07/2026) | ✅ | ✅ | ✅ wa.me + mailto + bannière honnête vérifiés | Exécuté en même session que l'audit |
| QA-B Commandes lisibles | P0 | C2 | ✅ Validé (18/07/2026) | ✅ | ✅ | ✅ resto en titre, #Y-XXXX, stepper actifs seulement | |
| QA-C Honnêteté marketing | P0 | C3,C4,C7,C8,C14 | ✅ Validé (18/07/2026) | ✅ | ✅ | ✅ 4 pages, badges stores « Bientôt » conservés | Stores/carte pilotés par `launchConfig.ts` (règle « ne pas supprimer ») |
| QA-D Français (accents) | P1 | C5 | ✅ Validé (18/07/2026) | ✅ | ✅ | ✅ tags accentués + filtre Végétarien opérant (19→6) ; avis démo reviews.ts inclus | Clés de filtrage intactes (labels seuls) |
| QA-E Prix FCFA | P1 | C6 | ✅ Validé (18/07/2026) | ✅ | ✅ | ✅ ₣/₣₣/₣₣₣ affichés, zéro € | Donnée catalogue inchangée, conversion à l'affichage |
| QA-F Profil cohérent | P1 | C9 | ✅ Validé (18/07/2026) | ✅ | ✅ | ✅ nom pré-rempli, section adresse unique, icônes lucide, doublon retiré | « Resto préféré (1 cmd) » = artefact seed, calcul correct |
| QA-G Route /plat + slugs | P2 | C11 | ✅ Validé (18/07/2026) | ✅ | ✅ | ✅ /plat/boukarou-de-boeuf OK, ancien /article/…-buf redirige et résout | legacyDishSlug pour anciens liens |
| QA-H Données & libellés | P2 | C10,C12,C13 | ✅ Validé (18/07/2026) | ✅ | ✅ | ✅ Tendance 9/45 (20 %), onglet Nouveautés retiré, Nlongkak, libellés checkout | |
| QA-I Doc + QA finale | Gate | tous | ✅ Validé (18/07/2026) | ✅ | ✅ | ✅ 4 rôles de bout en bout sur état vierge + auto-seed ; 15 pages mobile 360px sans débordement ; console 0 erreur | CLAUDE.md synchronisé ; prêt pour déploiement |

Statuts : ⬜ À faire · 🔄 En cours · ✅ Validé · ❌ Bloqué (voir Notes)

## Checklist de non-régression (à dérouler à QA-I, et par sondage après chaque lot P0)

- [ ] Connexion par rôle : les 4 pages de connexion n'affichent que les comptes démo de leur rôle ; clic « remplir » + OTP fonctionne
- [ ] Client : Explorer (filtres diététiques opérants) → fiche plat → ajout panier → checkout jusqu'au récapitulatif → commandes → profil → favoris
- [ ] Restaurateur démo : dashboard Chez Mama, accepter/refuser une commande pending, onglets menu/profil/finances
- [ ] Livreur démo : gains, historique, course en cours
- [ ] Admin : customers (11 clients), orders (~205), reviews (~162, file signalés), applications (2 en attente), drivers (Paul K.)
- [ ] Restaurant detail : onglets Menu/À propos/Carte/Avis + pastilles catégories + carte Leaflet (tuiles, marqueur, Waze/GMaps sans doublon)
- [ ] Mobile 360×640 : zéro débordement horizontal sur les 14 pages client
- [ ] Console navigateur : zéro erreur sur tout le parcours
- [ ] `npm run lint` (pas de nouvelle erreur) et `npm run build` verts

## Données à compléter plus tard (registre — NE PAS SUPPRIMER les emplacements)

Règle : ces éléments restent visibles dans l'interface avec un état neutre (« Bientôt disponible », non cliquable) et leurs valeurs sont centralisées dans `src/data/launchConfig.ts`. Compléter la valeur = réactivation automatique, sans retoucher les pages.

| Donnée en attente | Emplacement UI | Constante `launchConfig.ts` | Statut |
|---|---|---|---|
| Lien App Store | Home § Application mobile | `APP_STORE_URL` | ⏳ En attente |
| Lien Google Play | Home § Application mobile | `PLAY_STORE_URL` | ⏳ En attente |
| Paiement par carte | Home étape 2, Checkout (mode futur) | `CARD_PAYMENT_AVAILABLE` | ⏳ En attente |
| Chiffres réels (restaurants, commandes, livreurs, villes) | Home, Restaurants, Partenaires, Livreurs | compteurs catalogue en attendant | ⏳ Stats VPS au lancement |
| Témoignages clients réels | Home | — (remplacement éditorial) | ⏳ Après lancement |
| Numéros support définitifs (WhatsApp, tel) | Contact, Footer | à centraliser si changement | ✅ Provisoires en place |

Toute nouvelle donnée « à compléter » découverte pendant un lot doit être ajoutée ici + dans `launchConfig.ts`, jamais supprimée.

## Après QA-I : mise en production (hors périmètre des lots)

1. Le propriétaire lance `npm run deploy` depuis un terminal interactif (jamais en arrière-plan — se bloque).
2. Vérification post-déploiement sur https://miamexpress.cm : pages de connexion filtrées par rôle, pages vitrines honnêtes, contact réel.
3. Le seed de démo côté VPS (10 clients / ~200 commandes / avis en Postgres) est un chantier séparé, à transposer depuis `src/dev/seedDemoData.ts` sur le modèle de `npm run seed:reviews` une fois l'accès SSH autorisé.
