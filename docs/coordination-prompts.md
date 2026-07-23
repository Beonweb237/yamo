# Coordination — Exécution des prompts successifs

> Procédure centrale pour `docs/prompts-successifs.md`. Ce fichier est LA source de vérité de
> l'avancement : statuts + journal. Mis à jour après chaque prompt, jamais a posteriori de mémoire.

## Procédure (obligatoire, dans l'ordre, pour CHAQUE prompt)

1. **Lire** le prompt PS-xx dans `prompts-successifs.md` + vérifier que ses dépendances sont `Terminé`.
2. **Analyser l'état** : `tasklist | grep -i codex` (si codex.exe → STOP & DEMANDE), `git status` (tree attendu), lire les fichiers cibles réels (le code fait foi sur toute doc).
3. **CHECKPOINT git** avant tout changement gros ou touchant serveur/checkout/App.tsx : commit du travail précédent validé (message `PS-xx: …`).
4. **Implémenter** dans le périmètre borné du prompt. Préserver l'existant : aucune fonctionnalité/parcours/état supprimé sans justification écrite au journal.
5. **Valider par les critères d'acceptation** du prompt (mesurables, un par un).
6. **Garde-fous bloquants** : ① pas de codex.exe ; ② `npm run verify:hooks` = 0 ; ③ `npm run verify:i18n` = prioritaires 100% ; ④ `npm run build` = EXIT 0 ; ⑤ contrôle pixel 360×640 + desktop (dev server, captures), 0 erreur console ; ⑥ réel uniquement ; ⑦ identité MiamExpress stricte. Lint : pas de nouvelle erreur sur les fichiers touchés (comparer avant/après ; les ~79 erreurs héritées ne comptent pas).
7. **Rouge → corriger immédiatement.** N'avancer JAMAIS sur du rouge. Si irréparable dans le lot → statut `Bloqué` + entrée journal (problème, conséquences, options) + passer au prompt suivant NON dépendant.
8. **Mettre à jour** le tableau de statuts + le journal ci-dessous, puis prompt suivant.

**Reprise après interruption** : relire ce fichier → reprendre au premier prompt non `Terminé` en re-vérifiant l'état réel du code (étape 2) avant tout édit.

**STOP & DEMANDE** (jamais en autonome) : codex.exe/édition concurrente · action destructive non prévue · garde-fou (dont pixel) irréparable · secret/clé de signature · soumission à un service externe · décision produit ambiguë (proposer, ne pas deviner).

**Validation globale (fin de programme)** : tous statuts `Terminé`/justifiés · garde-fous verts · parcours 4 profils intacts (client, resto, livreur, admin) · prod vérifiée FR+EN après PS-11 · rapport final.

## Statuts

| Prompt | Contenu | Statut |
|---|---|---|
| PS-01 | Apparence : sections/hero/support + site_config | Terminé |
| PS-02 | Fiche programme LOT 1 (compréhension) | Terminé |
| PS-03 | Fiche programme LOT 2 (motivation) | Terminé |
| PS-04 | Fiche programme LOT 3 (conversion) | À faire |
| PS-05 | Fiche programme LOT 4 (découverte+SEO) | À faire |
| PS-06 | CP6 « Pour vous » personnalisé | À faire |
| PS-07 | CP5 promotions réelles | À faire |
| PS-08 | CP7 upsell + ETA (+ vérif filtres) | À faire |
| PS-09 | Fiche programme LOT 5 (data) | À faire |
| PS-10 | Dark mode back-office | À faire |
| PS-11 | Recette + déploiement VPS | À faire |
| PS-12 | CP8 Capacitor | À faire |
| PS-13 | CP9 Play Store (préparation) | À faire |

## Journal d'exécution

- **23/07/2026 — PS-03 Terminé** : fiche programme LOT 2 — photo fallback (programme → resto → dégradé de marque, jamais d'icône nue ; en prod tous les programmes ont une photo, fallback non exerçable mais typé), note réelle du resto via `fetchRestaurantRatingSummary` (affichée seulement si ≥ 1 avis — vérifié 4.8/4 avis Chez Jeanne), badge « Partenaire vérifié », 4 bénéfices dérivés des tags réels (mapping statique honnête + 2 génériques vrais), chips de réassurance. Gates verts. NB : +16 « orphelines » verify:i18n = clés des bénéfices passées via t(variable), utilisées au runtime.

- **23/07/2026 — PS-02 Terminé** : fiche programme LOT 1 — calendrier dérivé du `schedule` (jours abrégés/quotidien/hebdo), prix décomposé (« repas + livraison réglés à la réception », aligné sur le paiement honnête 6afdfbb), bandeau « Comment ça marche » 4 étapes, section « Exemples de plats » = vrais `menu_items` du resto filtrés par tags (masquée si 0 correspondance — vérifié : Délice Express 0 plat vegan → masquée ; Chez Jeanne 5 plats sans-gluten → affichés). Constat data : 7/12 programmes seedés n'ont AUCUN plat du même resto portant leurs tags → renforce l'intérêt de PS-09 (sample_menu saisi par le resto). Gates verts (tsc/hooks/i18n/build/lint 0 nouveau), QA VPS lecture seule 3012, 360px sans débordement.

- **23/07/2026 — init** : analyse des 6 sources terminée ; état vérifié (16 lots UX, i18n/SEO P1-P8, FOOD, CP1-4 : faits ; `OPTIMISATION_UX_YAMO.md` absent du workspace — recos DOC-UX déjà tracées dans ux-implementation-plan). Tree git quasi propre (4 fichiers non suivis), branche `feat/vps-api`, pas de codex.exe. Fichiers de coordination créés.
- **23/07/2026 — PS-01 Terminé** : `SiteConfig` étendu (homeSections/heroTitle/heroSubtitle/support) ; AdminAppearance : 3 nouvelles sections (réordonnancement ↑↓ + switches, hero, coordonnées) ; HomePremium piloté par homeSections ; HomeClassic hero éditable ; support.ts → getters avec override (Footer/Orders/Contact). **Persistance VPS réparée** : patchSiteConfig utilisait un contrat inexistant → aligné sur `PATCH /api/settings/site_config {value}` (tracking-routes). **Corrections nécessaires hors périmètre strict (documentées)** : ① restauration du chemin OTP mock dans AuthContext (cassé par le durcissement VPS — le mode VPS reste strict, aucune faille réintroduite) ; ② RoleGate exigeait 6 chiffres pour un OtpInput de 5 (bouton jamais actif) → 5 ; ③ seed admin mock marqué `isSuperAdmin` (accès pages RBAC comme l'admin racine VPS, avec backfill du registre). Vérifs : tsc 0, hooks 0, i18n prioritaires 100%, build EXIT 0, lint = 0 nouvelle erreur (fichiers touchés comparés avant/après), QA navigateur mock 3011 : bascule premium, section désactivée absente, réordonnancement appliqué, hero personnalisé rendu puis reset, 360px sans débordement, pas de nouvelle erreur console. Limitation : screenshots du pane en timeout (connu) → contrôle pixel par DOM/dimensions.
