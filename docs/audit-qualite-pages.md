# Audit qualité page par page — Yamo/MiamExpress

**Date** : 18/07/2026 · **Méthode** : parcours réel en navigateur (mode démo, serveur mock 3011, seed auto : 205 commandes, 162 avis, comptes démo par rôle), desktop 1280px + mobile 360×640, croisé avec `ux-audit-optimal.md`, `ux-implementation-plan.md` et `OPTIMISATION_UX_YAMO.md`.

**Grille** : ① Richesse contenu · ② Hiérarchie/structure · ③ Cohérence visuelle · ④ Images · ⑤ Vocabulaire/français · ⑥ États (loading/empty/error) · ⑦ Mobile 360px · ⑧ Alignement fonctionnel (pas de fantôme)

## Synthèse par page

| Page | ① | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | ⑧ | Verdict global |
|---|---|---|---|---|---|---|---|---|---|
| `/` Accueil | ✅ | ✅ | ✅ | ✅ | ❌ entité HTML | ✅ | ✅ | ❌ chiffres fictifs, « carte », stores | ⚠️ |
| `/restaurants` | ✅ | ✅ | ⚠️ € | ✅ | ✅ | ✅ | ✅ | ⚠️ « 500 restaurants » | ⚠️ |
| `/restaurants?mode=plats` | ✅ | ⚠️ badges | ✅ | ✅ | ❌ accents tags | ✅ | ✅ | ✅ | ⚠️ |
| `/restaurant/:id` | ✅ | ✅ (onglets refaits 18/07) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/article/:slug` | ✅ | ✅ | ✅ | ✅ | ⚠️ slug « buf » | ✅ | ✅ | ✅ | ✅ |
| `/checkout` | ✅ | ✅ | ✅ | ✅ | ⚠️ libellés | ✅ | ✅ | ✅ | ✅ |
| `/commandes` | ✅ | ❌ stepper répété, resto absent | ✅ | — | ⚠️ accents toasts | ✅ | ✅ | ⚠️ « temps réel » | ❌ |
| `/profil` | ✅ | ❌ double bloc adresse, 3× « Mes commandes » | ⚠️ emojis | — | ✅ | ✅ | ✅ | ⚠️ nom non repris | ⚠️ |
| `/favoris` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/partenaires` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ chiffres fictifs | ⚠️ |
| `/livreurs` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ chiffres fictifs | ⚠️ |
| `/contact` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ formulaire fantôme | ❌ |
| `/demandes/nouvelle` | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/demandes/mes-demandes` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auth (connexion/inscription) | ✅ refonte 18/07 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard restaurant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (seed) | ✅ |
| Dashboard livreur | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⚠️ distance approx. (dette connue) | ✅ |
| Admin (13 pages) | ✅ | ✅ | ✅ | — | ⚠️ accents AdminReviews | ✅ | ✅ | ✅ | ✅ |

**Points forts confirmés** : aucun débordement horizontal mobile sur les 14 pages client (chantier responsive tenu) ; zéro erreur console sur tout le parcours ; états loading/empty/error présents partout ; les pages vitrines et le checkout sont riches et bien hiérarchisés.

## Constats détaillés (numérotés — référencés par le prompt master)

### P0 — Critique (confiance utilisateur / fonctionnalité mensongère)

- **C1. Formulaire Contact fantôme** — `Contact.tsx:95-99` : `handleSubmit` affiche « envoyé » 5 s et n'envoie rien nulle part. Violation directe de la règle « toute fonctionnalité présentée comme réelle doit être réelle ». → Brancher réellement (WhatsApp pré-rempli avec les champs du formulaire, canal déjà présent sur la page ; mailto en secours), ou retirer le formulaire au profit des cartes de contact.
- **C2. `/commandes` illisible en historique multi-restaurants** — `Orders.tsx` : (a) **le nom du restaurant n'apparaît pas** sur les cartes (20 commandes, impossible de s'y retrouver) ; (b) le **stepper 5 étapes est répété in extenso sur chaque commande livrée** (bruit massif — le réserver aux commandes actives) ; (c) identifiant affiché « #seed-dem » / uuid tronqué → afficher un numéro court lisible et stable (ex. #YAM-4821 dérivé de l'id).
- **C3. Chiffres marketing fictifs présentés comme réels** — « Plus de 500 restaurants partenaires » (Home + `/restaurants`), « 50K+ commandes/mois », « 27 villes » (`Partenaires.tsx`), « 200+ livreurs actifs », « 50 000 FCFA+/semaine » (`Livreurs.tsx`), « +30 % de CA » — le catalogue réel compte ~25 restaurants. → Reformuler en promesses non chiffrées (« Des dizaines de restaurants à Douala et Yaoundé », « Rejoignez les premiers partenaires ») ou brancher les compteurs sur les données réelles.
- **C4. Entités HTML visibles à l'écran** — Home : « Suivez en Temps R&amp;eacute;el » (chaîne de données avec entité non décodée, rendue littéralement). Balayer toutes les chaînes de données (`Home.tsx`, `mockData.ts`, etc.) pour remplacer les entités par les caractères réels.

### P1 — Cohérence (langue, devise, structure)

- **C5. Accents manquants en série** — tags diététiques affichés sans accents : « Diabetique, Vegetarien, Proteine, Allege, Epice, Braise, Presse du jour » (`dishes.ts` / `DishResults.tsx` / `DishDetail.tsx`) ; toasts `Orders.tsx` (« Avis livraison enregistre. ») ; libellés `AdminReviews.tsx` (« Publies, Masques, Signales, verifiees, Commande verifiee »). Français incorrect visible partout dans Explorer.
- **C6. Gamme de prix en euros** — `/restaurants` affiche « € / €€ / €€€ » comme indicateur de gamme dans une app 100 % FCFA. → Remplacer par un indicateur neutre (₣, $, ou « Éco / Standard / Premium »).
- **C7. Mentions de paiement inexactes** — Home étape 2 : « payez … par Mobile Money ou carte » — aucun paiement carte n'existe (cash/MoMo/OM). → « Mobile Money ou espèces à la livraison ».
- **C8. Boutons App Store / Google Play morts** — Home section « Application mobile » : deux badges cliquables vers rien pour une app inexistante. → Remplacer par un bandeau honnête (« Bientôt disponible ») non cliquable, ou pointer vers le site (PWA retirée, cf. vite.config).
- **C9. `/profil` désordonné** — (a) le **nom du compte** (registre `yamo_local_users`) n'est pas repris dans le champ nom (champ vide pour un compte nommé) ; (b) **deux blocs adresse redondants** (« Adresse de livraison » + « Adresses enregistrées ») à fusionner ; (c) **3 accès « Mes commandes »** sur la même page ; (d) emojis (📦❤️🍽️🔍) comme icônes là où tout le site utilise lucide ; (e) « Restaurant préféré (1 commande) » — calcul à corriger (devrait être le resto le plus commandé).

### P2 — Polish (signal, données, libellés)

- **C10. Badges sans signal dans Explorer** — « Tendance » sur la quasi-totalité des plats et « Nouveautés (20) » = « Tous (20) » : un badge présent partout ne dit plus rien. → Critères réels (top X % des commandes seed) ou suppression.
- **C11. Slug plat mutilé** — `/article/boukarou-de-buf` : « bœuf » → « buf » (`dishes.ts` `dishSlug` ne translittère pas œ→oe). En profiter pour exécuter la décision déjà actée : route `/plat/:slug` + redirection 301 depuis `/article/:slug` (liens WhatsApp partagés à préserver). CLAUDE.md documente déjà `/plat/:slug`.
- **C12. Donnée géographique erronée** — quartier « Tokoin » (quartier de Lomé, Togo) attribué à Yaoundé dans `mockData.ts`. Remplacer par un vrai quartier de Yaoundé (ex. Mvog-Ada).
- **C13. Libellés checkout** — « Ville(restaurant) » (espace manquant + formulation obscure) ; phrase orpheline « Le code sera vérifié à la confirmation de la commande. » dans le récapitulatif sans contexte (code de quoi ?). Clarifier ou contextualiser.
- **C14. Témoignages fictifs Home** — 3 avis clients inventés présentés comme réels. Décision produit à trancher : les assumer comme illustration (risque de confiance) ou basculer sur de vrais avis seed vérifiés.

### Écarts documentation constatés (à corriger dans CLAUDE.md)

- CLAUDE.md documente la route `/plat/:slug` ; le code réel est `/article/:slug` (cf. C11).
- La dette « Messages rapides simulés (Je suis devant / Partager ma position) » listée dans CLAUDE.md **n'existe plus** dans `Orders.tsx` — dette déjà purgée, tableau à mettre à jour.
- `VITE_FORCE_MOCK_AUTH` documenté comme interrupteur actif : il n'est **lu nulle part** dans `src/` (seul `VITE_USE_VPS_API` compte).

## Plan d'implémentation (lots)

| Lot | Contenu | Constats | Fichiers principaux | Effort | Priorité |
|---|---|---|---|---|---|
| **QA-A** | Contact réel (WhatsApp pré-rempli + mailto) | C1 | `Contact.tsx` | S | P0 |
| **QA-B** | Refonte cartes `/commandes` | C2 | `Orders.tsx` | M | P0 |
| **QA-C** | Honnêteté marketing (chiffres, carte, stores, entités) | C3, C4, C7, C8, C14 | `Home.tsx`, `Restaurants.tsx`, `Partenaires.tsx`, `Livreurs.tsx` | M | P0 |
| **QA-D** | Français irréprochable (accents partout) | C5 | `dishes.ts`, `DishResults.tsx`, `Orders.tsx`, `AdminReviews.tsx` | S | P1 |
| **QA-E** | Gamme de prix FCFA | C6 | `Restaurants.tsx` (+ composant carte resto) | S | P1 |
| **QA-F** | Profil cohérent | C9 | `Profile.tsx` | M | P1 |
| **QA-G** | Route `/plat/:slug` + slug œ + redirection | C11 | `App.tsx`, `dishes.ts`, liens (`DishResults`, `DishDetail`, `Favorites`, `ActiveOperationsBar`) | M | P2 |
| **QA-H** | Divers données & libellés | C10, C12, C13 | `mockData.ts`, `Checkout.tsx`, `DishResults.tsx` | S | P2 |
| **QA-I** | Écarts CLAUDE.md + QA finale généralisée 4 rôles | doc + tout | `CLAUDE.md` + parcours complet | S | Gate finale |

Ordre recommandé : A → B → C → D → E → F → G → H → I. Chaque lot = un changement isolé, vérifié lint + build + navigateur mobile/desktop avant de passer au suivant (protocole : `prompt-master-coordination.md`).
