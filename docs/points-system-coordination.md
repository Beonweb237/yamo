# Coordination — Chantier système de points (série PTS)

> Pilote l'exécution des prompts de `points-system-prompts.md`. Objectif : n'importe
> quelle session Claude Code, sans avoir vu la conversation d'origine, peut exécuter,
> reprendre ou auditer le chantier avec pour seules sources CE document, le document
> de prompts et le dépôt.

---

## 1. Principes directeurs

1. **Le §0 du document de prompts est la loi produit.** Toute règle métier vient de
   `POINTS_CONFIG` (launchConfig.ts). Si un lot révèle qu'une valeur est mauvaise, on
   change la config et on le consigne — jamais de valeur en dur dans un composant.
2. **Le ledger est la seule vérité.** Aucun écran, aucune fonction ne stocke un solde :
   tout est dérivé. Toute anomalie de solde se débogue en lisant le ledger.
3. **Mock d'abord, mock comme spécification.** Tout se développe et se recette en mode
   mock (serveur SANS `VITE_USE_VPS_API` — attention, `app/.env.local` du poste le met
   à true : utiliser la config launch.json `yamo-web-mock`). Le comportement mock validé
   en PTS-07 EST la spécification que PTS-08 traduit côté serveur. **Aucune mutation
   vers la prod, jamais** ; le déploiement VPS est un acte manuel de l'utilisateur.
4. **Un lot = un périmètre fermé.** Un problème hors périmètre découvert en cours de
   lot → consigné au tracking (section Écarts), traité dans son lot. Exception : une
   régression introduite par le lot courant se corrige immédiatement.
5. **Rien de factice.** Phase 1 = validations humaines (resto confirme la garantie,
   admin valide les recharges) mais réelles et tracées. Tout ce que l'app affiche
   comme fait doit être fait ; ce qui est manuel hors app (reversements d'une garantie
   confisquée) est annoncé comme tel à l'écran.
6. **Rien ne disparaît en silence.** Problème détecté = corrigé ou consigné-justifié.
   Vérification non exécutée = déclarée dans le tracking.

## 2. Garde-fous absolus (hérités de CLAUDE.md + conventions du dépôt)

- Travailler depuis `app/`, lire chaque fichier avant de l'éditer, petits diffs.
- Double chemin des libs : `if (isSupabaseConfigured && supabase)` → adaptateur VPS,
  sinon mock/localStorage. Ne pas toucher aux branches existantes des autres libs.
- Ne pas casser : machine de statuts des commandes, transitions bornées par rôle,
  parcours des 4 profils, polling existant, deliveryCode, CustomerBlockedError.
- UI : tokens existants (vert #157F3D / or — texte or sur fond clair = `text-amber-700`),
  Dialog/toast (jamais alert/prompt), loading/empty/error, mobile 360 d'abord,
  cibles ≥ 44px, aucune nouvelle dépendance.
- Clés localStorage : uniquement `yamo_points_ledger` et `yamo_points_recharges`
  (déclarées dans CLAUDE.md en PTS-00). La garantie vit dans l'objet commande.
- `npm run build` vert et zéro NOUVELLE erreur lint à la fin de CHAQUE lot
  (baseline ~78 erreurs pré-existantes, comparer par fichier). Pas de `npm test` dans
  ce dépôt : le harnais du chantier est `npm run verify:points` + scénarios manuels.

## 3. Graphe de dépendances et chemin critique

```
PTS-00 ─ PTS-01 ─ PTS-02 ─┬─ PTS-03 ─┐
                          │          ├─ PTS-06 ─┐
                          └─ PTS-04 ─┤          ├─ PTS-07 ─ PTS-08
                                     └─ PTS-05 ─┘
```

- **Chemin critique** : 00 → 01 → 02 → 04 → 05 → 06 → 07 → 08.
- **Parallélisable** (sessions distinctes après PTS-02) : PTS-03 ∥ PTS-04.
  PTS-05 exige PTS-04 ; PTS-06 exige PTS-03 ET PTS-05.
- PTS-07 et PTS-08 sont strictement terminaux et séquentiels.
- Interdit de commencer un lot dont un prérequis n'est pas ✅ au tracking.

## 4. Protocole d'exécution d'un lot (8 étapes, aucune n'est optionnelle)

```
1. OUVRIR     Lire points-system-tracking.md → prérequis ✅ ? Marquer le lot
              « 🔄 en cours » + date. Relire le §0 (décisions produit).
2. LIRE       Lire intégralement les fichiers du périmètre du lot AVANT d'éditer.
              Vérifier que l'environnement est bien mock (isSupabaseConfigured===false).
3. IMPLÉMENTER Petits diffs ; règles métier lues depuis POINTS_CONFIG ; messages
              d'erreur en français actionnable ; écritures ledger idempotentes.
4. TESTER     Dérouler le SCÉNARIO DE SORTIE du lot au navigateur (360px puis
              desktop), comptes mock +237690000001..4. Lister les écritures ledger
              attendues vs constatées quand le lot touche aux points.
5. HARNAIS    npm run verify:points (dès PTS-01) → tous PASS.
6. QUALITÉ    npm run build → vert. npx eslint <fichiers touchés> → zéro nouvelle
              erreur vs baseline PTS-00.
7. NON-RÉGR.  Si le lot a touché orders.ts, RestaurantDashboard, Orders.tsx ou
              Checkout : re-dérouler le happy path SANS points d'avant-chantier
              (commande → acceptation → livraison, 4 profils concernés) et le
              parcours du lot PRÉCÉDENT de la série.
8. CLÔTURER   Tracking : « ✅ terminé », fichiers modifiés, sortie verify:points,
              écarts/reports, ce qui n'a pas pu être vérifié. Résumé de 5 lignes max.
```

## 5. Fichier de suivi — gabarit de `points-system-tracking.md` (créé en PTS-00)

```markdown
# Tracking — Système de points (série PTS)

## Décisions produit actées
(recopier le tableau §0 au démarrage ; toute modification ultérieure = ligne datée
« clé : ancienne → nouvelle valeur, raison »)

## État des lots
| Lot | Statut | Date | Fichiers touchés | verify:points | Build | Notes |
|-----|--------|------|------------------|---------------|-------|-------|
| PTS-00 | ⬜ | | | n/a | | |
| … PTS-01 → PTS-08 |
Statuts : ⬜ à faire / 🔄 en cours / ✅ terminé / ⛔ bloqué (motif obligatoire)

## Baseline (PTS-00)
- Build : (sortie) — Lint global : (total) + détail par fichier touché par le chantier

## Écarts découverts / problèmes reportés
(datés, avec fichier:ligne, sévérité, justification si reporté)

## Journal des scénarios de recette (PTS-07)
S1 nominal / S2 faute resto / S3 rejet abusif : déroulé, écritures ledger attendues
vs constatées, captures ou mesures DOM, PASS/FAIL.

## PTS-08 — Revue serveur + procédure de déploiement
(revue de chaque route contre les invariants ; procédure pas à pas NON exécutée)
```

Le tracking se met à jour **pendant** le lot (étapes 1, 4, 8), pas seulement à la fin :
c'est la mémoire inter-sessions du chantier.

## 6. Procédure de reprise (nouvelle session / interruption / contexte perdu)

1. Lire `points-system-tracking.md` → premier lot non ✅.
2. Lot « 🔄 en cours » trouvé : vérifier l'état RÉEL du code (le code fait foi, pas le
   tracking) — relire les fichiers listés, rejouer `npm run verify:points` et le
   scénario du lot ; reprendre à l'étape du protocole où ça casse.
3. `npm run build` rouge en arrivant → réparer AVANT toute nouvelle édition (régression
   du lot précédent = priorité absolue).
4. Coller le prompt PTS-xx (avec son bloc de contexte commun) et exécuter.
5. Ne jamais « rattraper » deux lots dans une même passe : un lot, une clôture.

## 7. Règles de non-régression spécifiques au chantier

- **orders.ts est le fichier le plus sensible du dépôt** : chaque lot qui le modifie
  re-teste le happy path complet client→resto→livreur ET une annulation, en mock.
- Le stepper de statuts, les libellés et les transitions par rôle ne changent pas :
  la garantie est un sous-état de `confirmed`, les points sont invisibles du client.
- Un resto SANS merchantCode/assistanceWhatsapp doit pouvoir vendre exactement comme
  avant le chantier (garantie ignorée) — tester ce cas à chaque lot ≥ PTS-04.
- Les commandes créées AVANT le chantier (sans champ guarantee, sans hold) doivent
  s'afficher et se clôturer sans erreur (données historiques : champs optionnels,
  settleHold tolérant à l'absence de hold).
- Interdiction de retirer/renommer une clé localStorage existante ; les nouvelles
  écritures ne modifient jamais `yamo_local_orders` au-delà des champs ajoutés.

## 8. Definition of Done du chantier

- [ ] PTS-00 → PTS-08 tous ✅ au tracking, aucun ⛔ résiduel.
- [ ] `npm run verify:points` : tous PASS ; `npm run build` : vert ; lint global =
      baseline (zéro nouvelle erreur).
- [ ] **Recette E2E S1 (nominal)** rejouée en une seule traite et documentée :
      recharge validée → commande → acceptation (hold 3) → garantie payée + confirmée
      resto → préparation → livraison avec code → consume → ledger exact, solde exact,
      « reste à payer = total − garantie » affiché juste.
- [ ] **Recette S2 (faute resto)** : annulation resto → pénalité 1 pt, garantie
      remboursée par conversion de caution (écritures exactes au ledger).
- [ ] **Recette S3 (rejet abusif)** : litige → décision admin → garantie confisquée
      avec répartition livreur-d'abord affichée → récidive → client bloqué.
- [ ] Blocage d'acceptation vérifié : solde sous le seuil → voit mais n'accepte pas,
      CTA recharge ; les commandes déjà acceptées vont au bout.
- [ ] Admin : valider/rejeter une recharge, ajustement tracé, soldes et ledger
      consultables.
- [ ] Non-régression : happy path d'avant-chantier + 4 profils intacts ; commandes
      historiques sans garantie/hold intactes ; mobile 360 sans scroll X sur tous les
      écrans touchés (mesuré) ; zéro erreur console sur les 3 recettes.
- [ ] PTS-08 : migration + routes livrées et revues, procédure de déploiement écrite,
      RIEN exécuté contre la prod depuis le poste de dev.
- [ ] CLAUDE.md à jour (clés localStorage, nouvelle lib points.ts, script
      verify:points, route /admin/points).
```
