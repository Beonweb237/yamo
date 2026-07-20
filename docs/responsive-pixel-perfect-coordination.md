# Coordination — Implémentation responsive pixel-perfect (série PIX)

> Ce document pilote l'exécution des prompts de `responsive-pixel-perfect-prompts.md`.
> Objectif : que n'importe quelle session Claude Code puisse reprendre le travail au bon
> endroit, avec les bonnes règles, et produire exactement le résultat attendu —
> un responsive professionnel sans imperfection, aux 6 breakpoints, sans casser l'existant.

---

## 1. Principes directeurs

1. **Le code fait foi, pas le brief.** Écarts déjà actés entre le brief d'audit et le code réel :
   - Titres en **Source Sans 3** (les classes `font-poppins`/`font-heading` sont des alias). Ne pas introduire Poppins.
   - `text-muted` = **#6B7280** (correctif contraste CONF-31). L'ancien #9CA3AF est interdit.
   - `success` = #10B981, `gold-light` = #FDF5E0, `green-dark` = #0E5C2C, `text-primary` = #1F2937.
   - Routes : fiche plat = `/article/:slug`, fiche resto = `/restaurant/:slug` (param `slug`, pas `id`).
   - Si un nouvel écart brief/code apparaît : le signaler dans le tracking, suivre le code.
2. **Squelette d'abord, pages ensuite, finesse à la fin.** L'ordre PIX-00→15 n'est pas
   négociable pour les fondations : PIX-01 (transverse) doit être vert avant toute page,
   PIX-14 (finesse) ne démarre qu'une fois toutes les pages saines. Entre PIX-02 et PIX-13,
   respecter au minimum le graphe de dépendances (§ 4).
3. **Un lot = un périmètre fermé.** On ne corrige pas un problème d'une autre page « en
   passant » : on le consigne dans le tracking avec sa sévérité, il sera traité dans son lot.
   Exception : une régression introduite par le lot courant se corrige immédiatement.
4. **Mesurer, pas estimer.** « Pixel-perfect » signifie : `scrollWidth` vérifié,
   `getBoundingClientRect()` sur les cibles tactiles, computed styles pour les polices,
   ratios de contraste calculés. Aucune correction « à l'œil ».
5. **Corriger petit.** Chaque fiche de correction = le plus petit diff Tailwind qui résout
   le problème mesuré. Pas de réécriture de composant, pas de refonte de structure JSX
   sauf si le débordement l'exige (et alors le dire dans la fiche).
6. **Rien ne disparaît en silence.** Un problème détecté est soit corrigé, soit consigné
   « reporté » avec justification. Une vérification non exécutée est déclarée comme telle.

## 2. Garde-fous absolus (hérités de CLAUDE.md — non négociables)

- Travailler depuis `app/`. Lire chaque fichier avant de l'éditer.
- Ne pas toucher : branches `if (isSupabaseConfigured)`, polling 5s (DriverDashboard,
  AdminDashboard), `tracking.ts` (simulation), logique de paiement/validation, auth, rôles.
- Pas de nouvelle librairie, pas de remplacement de composants shadcn/ui, pas de refonte.
- Pas de `alert()`/`prompt()` ; feedback via `toast` (sonner) ou `Dialog`.
- Ne pas modifier les tokens sauf contraste < 4.5:1 mesuré (et alors documenter le calcul).
- Aucune fonctionnalité, route ou état utilisateur supprimé.
- Pas de bouton/feature factice ajouté.
- `npm run build` vert après chaque lot ; zéro NOUVELLE erreur lint dans les fichiers touchés.

## 3. Protocole d'exécution d'un lot PIX-xx

Chaque lot suit exactement ces 8 étapes :

```
1. OUVRIR    Lire responsive-pixel-perfect-tracking.md → vérifier que les prérequis
             du lot sont "✅ terminé". Marquer le lot "🔄 en cours" + date.
2. LIRE      Lire intégralement les fichiers du périmètre AVANT le navigateur.
             Noter les zones à risque (sticky, overflow, grilles, textes dynamiques).
3. AUDITER   npm run dev + navigateur intégré. Dérouler la checklist du prompt aux
             6 breakpoints DANS L'ORDRE : 360×640 → 375×812 → 768×1024 → 1280×800
             → 1440×900 → 1920×1080. Mobile d'abord, toujours.
             Pour chaque anomalie : mesure chiffrée + capture + sévérité.
4. CONSIGNER Une fiche par problème dans le tracking (gabarit § 6), AVANT de corriger.
5. CORRIGER  Par ordre de sévérité : 🔴 puis 🟠 puis 🟡 (les 🟡 peuvent être reportés
             si risqués). Un problème = un edit ciblé. Re-tester le breakpoint concerné
             immédiatement après chaque edit.
6. VÉRIFIER  Re-dérouler la checklist complète du lot aux breakpoints touchés.
             Re-tester le PARCOURS de la page (pas seulement l'affichage).
             Vérifier l'absence de régression sur les composants transverses (navbar,
             bottomnav, sticky) qui apparaissent sur la page.
7. QUALITÉ   npm run build (doit passer). npm run lint sur les fichiers touchés,
             comparé au baseline PIX-00 : zéro nouvelle erreur.
8. CLÔTURER  Tracking : lot "✅ terminé", fiches marquées corrigé/reporté, captures
             avant/après référencées, sortie build collée. Résumé de clôture : ce qui
             a été corrigé, ce qui est reporté et pourquoi, ce qui n'a pas pu être vérifié.
```

**Interdiction de commencer le lot suivant si l'étape 7 ou 8 n'est pas faite.**

## 4. Graphe de dépendances et parallélisation

```
PIX-00 ─ PIX-01 ─┬─ PIX-02 ─ PIX-13
                 ├─ PIX-03 ─ PIX-04 ─┬─ PIX-05
                 │                   └─ PIX-06 ─ PIX-07
                 ├─ PIX-08
                 ├─ PIX-09
                 └─ PIX-10 ─┬─ PIX-11
                            └─ PIX-12
                                        (tous) ─ PIX-14 ─ PIX-15
```

- **Chemin critique produit** (à faire en premier) : 00 → 01 → 02 → 03 → 04 → 06.
- Branches parallélisables entre sessions : {08, 09}, {10→11, 10→12}, {05}, {07}, {13}.
- PIX-14 et PIX-15 sont strictement terminaux.

## 5. Échelle de sévérité

| Niveau | Définition | Traitement |
|---|---|---|
| 🔴 Bloquant | Scroll X de page, contenu/action inaccessible ou masqué (bouton payer sous la BottomNav, dialog coupé), texte illisible (contraste < 3:1), parcours cassé | Corrigé dans le lot, obligatoire |
| 🟠 Majeur | Cible tactile < 44px sur une action, chevauchement d'éléments, texte tronqué sans ellipsis, contraste 3–4.5:1, grille cassée à un breakpoint, CLS visible | Corrigé dans le lot, obligatoire |
| 🟡 Mineur | Incohérence d'espacement/arrondi/ombre, marge hors grille 16/24/32, wrap inélégant, micro-alignement | Corrigé si sans risque, sinon reporté avec justification |

## 6. Gabarit de fiche de correction

Toute anomalie est consignée sous ce format exact dans le tracking :

```markdown
### [PIX-xx-Nnn] Titre court du problème
- **Sévérité** : 🔴 / 🟠 / 🟡
- **Breakpoint(s)** : 360×640 (+ autres si applicable)
- **Page/URL** : /checkout
- **Constat mesuré** : scrollWidth 402px pour viewport 360px, causé par …
- **Fichier** : src/pages/Checkout.tsx:217
- **AVANT** :
  ```tsx
  <div className="flex gap-4 ...">
  ```
- **APRÈS** :
  ```tsx
  <div className="flex flex-wrap gap-2 sm:gap-4 ...">
  ```
- **Justification** : plus petit diff qui supprime le débordement ; wrap contrôlé sous 400px.
- **Statut** : ✅ corrigé / ⏸ reporté (raison) 
- **Vérifié après correction** : oui — scrollWidth 360px, parcours re-testé, build vert
```

Numérotation : `PIX-06-N03` = 3ᵉ problème du lot PIX-06. Jamais réutiliser un numéro.

## 7. Fichier de suivi — gabarit initial

Créer `app/docs/responsive-pixel-perfect-tracking.md` en PIX-00 avec cette structure :

```markdown
# Tracking — Responsive pixel-perfect (série PIX)

## État des lots
| Lot | Statut | Session/date | 🔴 | 🟠 | 🟡 | Reportés | Build |
|-----|--------|--------------|----|----|----|----------|-------|
| PIX-00 | ⬜ à faire | — | — | — | — | — | — |
| PIX-01 | ⬜ à faire | — | — | — | — | — | — |
| … (jusqu'à PIX-15) |

Statuts : ⬜ à faire / 🔄 en cours / ✅ terminé / ⛔ bloqué (dire pourquoi)

## Baseline (PIX-00)
- Build : (sortie)
- Lint : (erreurs par fichier — référence anti-régression)
- Données mock préparées : (détail)

## Pile z-index constatée (PIX-01)
(à remplir : navbar, bottomnav z-40, scrolltotop z-30, toaster, sticky bars, dialogs…)

## Fiches de correction
(fiches [PIX-xx-Nnn] au format § 6, groupées par lot)

## Problèmes reportés
(liste consolidée avec justifications)

## Écarts brief ↔ code constatés
- Fonts : Source Sans 3, pas Poppins (alias font-poppins)
- text-muted #6B7280 (CONF-31), success #10B981, gold-light #FDF5E0
- Route fiche plat : /article/:slug
- (compléter au fil de l'eau)

## Rapport final (PIX-15)
(tableau récapitulatif, parcours de non-régression, scroll-X par route, captures)
```

Ce fichier est **la mémoire inter-sessions** : il se met à jour à chaque étape du protocole
(§ 3), jamais en fin de lot seulement.

## 8. Procédure de reprise (nouvelle session / après interruption)

1. Lire `responsive-pixel-perfect-tracking.md` → identifier le premier lot non ✅.
2. Si un lot est 🔄 en cours : relire ses fiches, vérifier au navigateur l'état réel des
   corrections déjà notées ✅ (le code fait foi, pas le tracking), reprendre à l'étape
   du protocole où il s'est arrêté.
3. Vérifier `npm run build` avant toute nouvelle édition : si rouge, réparer d'abord
   (c'est une régression du lot précédent, prioritaire absolue).
4. Coller le prompt PIX-xx correspondant (avec son bloc de contexte commun) et exécuter.

## 9. Méthodes de mesure de référence

- **Scroll X** : dans la console du navigateur intégré,
  `document.documentElement.scrollWidth <= window.innerWidth` (et si faux, bisecter en
  ajoutant `outline: 1px solid red` par section pour trouver l'élément fautif).
- **Cible tactile** : `el.getBoundingClientRect()` — largeur ET hauteur ≥ 44 (48 pour les
  actions critiques : payer, accepter une course).
- **Police effective** : `getComputedStyle(el).fontFamily` — doit contenir 'Source Sans 3'
  (titres) ou 'Inter' (corps), pas un fallback seul.
- **Contraste** : calcul WCAG (luminance relative) entre couleur de texte et fond réel
  rendu (attention aux fonds d'image : mesurer sur la zone la plus claire).
- **CLS/images** : recharger la page en réseau throttlé et observer les sauts ;
  toute image de contenu doit avoir un conteneur à ratio fixe.
- **Breakpoints** : `resize_window` aux 6 tailles ; pour 1440×900 et 1920×1080, si l'outil
  plafonne, tester au moins que le container max-width centre le contenu sans étirement.

## 10. Définition de « terminé » (Definition of Done globale)

Le chantier est clos quand :
- [ ] Les 16 lots PIX-00→15 sont ✅ dans le tracking.
- [ ] Zéro fiche 🔴 ou 🟠 non corrigée ; tous les 🟡 reportés sont justifiés.
- [ ] `npm run build` passe ; zéro nouvelle erreur lint vs baseline.
- [ ] Zéro scroll X sur toutes les routes à 360×640 (liste vérifiée en PIX-15).
- [ ] Les 4 parcours de non-régression (client, resto, livreur, admin) passent à 360×640
      et 1280×800 sans erreur console.
- [ ] Aucune fonctionnalité, route ou état supprimé ; identité vert/or intacte.
- [ ] Rapport final rédigé dans le tracking avec les écarts brief/code actés.
```
