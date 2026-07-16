# QA — LOT-12 : Confort & accessibilité transverses

> Date : 16/07/2026 · Périmètre : CONF-28 (onboarding), CONF-29 (indicateur réseau),
> CONF-30 (économie de données + reduced-motion), CONF-31 (contraste), CONF-32 (dark mode back-office).
> Référence : `ux-implementation-plan.md` §LOT-12.

## 1. Ce qui a été livré

| CONF | Livrable | Fichiers |
|---|---|---|
| CONF-28 | Onboarding 3 écrans, première visite uniquement, accueil uniquement (jamais sur lien profond), skippable à chaque écran, choix de ville → `/restaurants?ville=…`, jamais montré à un utilisateur déjà connecté | `OnboardingOverlay.tsx` (nouveau), `Layout.tsx` |
| CONF-29 | Bannière « Hors connexion » (`online`/`offline`), fixe sous le header (72 px client / 56 px back-office), `role="status" aria-live="assertive"`, toast « Connexion rétablie » au retour | `NetworkBanner.tsx` (nouveau), `Layout.tsx`, `BackOfficeLayout.tsx` |
| CONF-30 | `SettingsProvider` (`yamo_data_saver`) + `MotionConfig` framer-motion : `reducedMotion='always'` si activé, `'user'` sinon (respect de `prefers-reduced-motion` système par défaut) ; toggle « Économie de données » dans le profil ; `AppImage` passe en `loading="lazy" decoding="async"` par défaut (surchargeables via props pour une image LCP) | `SettingsContext.tsx` (nouveau), `main.tsx`, `Profile.tsx`, `AppImage.tsx` |
| CONF-31 | Tokens contraste : `text-muted` #9CA3AF (2,5:1 — échec AA) → #6B7280 (4,8:1) ; `text-secondary` #6B7280 → #4B5563 (7,5:1) pour préserver la hiérarchie visuelle. Appliqué dans `tailwind.config.js` **et** les variables CSS dupliquées d'`index.css`. Aucun `#9CA3AF` codé en dur restant dans `src/`. | `tailwind.config.js`, `src/index.css` |
| CONF-32 | **Reporté** (voir §4). Le volet « bip sonore livreur » de ce CONF était déjà livré au LOT-06. | — |

## 2. Vérifications navigateur (réelles, dev server port 3000)

| Test | Résultat |
|---|---|
| Première visite `/` (flag effacé, déconnecté) → overlay écran 1 « Vos plats préférés… » | ✅ |
| Continuer → écran 2 avec select ville (27 villes actives de `locations.ts`), bouton Retour présent | ✅ |
| Sélection « Yaoundé » → écran 3 → CTA « Voir les restaurants à Yaoundé » | ✅ |
| CTA final → redirection `/restaurants?ville=Yaound%C3%A9`, filtre ville appliqué, flag `yamo_onboarding_completed=true`, overlay disparu | ✅ |
| « Passer » (testé après reset du flag) → overlay fermé, flag posé, on reste sur `/` | ✅ |
| Utilisateur connecté (client seed) sur `/` → overlay absent | ✅ (garde `!user && !authLoading`) |
| `offline` sur page client → bannière rouge fixe `top:72px`, z-60, texte lisible | ✅ |
| `online` → bannière disparue + toast « Connexion rétablie » | ✅ |
| `offline` sur `/admin/dashboard` → bannière `top:56px` (sous la topbar back-office) | ✅ |
| Toggle « Économie de données » dans `/profil` → `data-state=checked`, `yamo_data_saver=true`, toast | ✅ |
| Images AppImage sur `/restaurants` → `loading="lazy"`, `decoding="async"` | ✅ |
| Couleurs calculées live : `.text-text-muted` → rgb(107,114,128), `.text-text-secondary` → rgb(75,85,99) | ✅ |
| Mobile 360×800 : overlay en bottom-sheet pleine largeur (360 px, ancré en bas), CTA 48 px, **aucun débordement horizontal** | ✅ |
| Aucun overlay d'erreur Vite, aucune erreur console liée au lot | ✅ |

## 3. Validation technique

- `npm run build` (`tsc -b` + vite) : ✅ 0 erreur TypeScript.
- Lint des fichiers touchés : `SettingsContext.tsx`, `NetworkBanner.tsx`, `OnboardingOverlay.tsx`, `Layout.tsx`, `main.tsx`, `AppImage.tsx` → **0 problème**. `BackOfficeLayout.tsx` et `Profile.tsx` conservent uniquement leurs erreurs pré-existantes de baseline (`react-hooks/set-state-in-effect` lignes 97 et 154, antérieures au lot). Zéro nouvelle erreur introduite.
- 1 anomalie détectée pendant l'implémentation et corrigée aussitôt : `react-refresh/only-export-components` sur le nouvel export `shouldShowOnboarding` → disable ciblé une ligne, même pattern que `CartContext.tsx`.

## 4. Écarts restants / décisions

1. **CONF-32 dark mode back-office : REPORTÉ.** Justification : les 3 dashboards + 10 pages admin utilisent massivement `bg-white`/couleurs claires codées en classe ; un dark mode honnête exige la détokenisation de ces fonds sur ~15 fichiers + une passe visuelle humaine (captures du pane indisponibles — limitation QA-07 documentée). Le critère du plan est « dark complet ou rien » : un dark partiel produirait des écrans illisibles. À traiter comme lot dédié après validation visuelle humaine du plan. Le composant demandé « préférence sonore livreur » du même CONF est en production depuis le LOT-06 (`yamo_driver_sound`).
2. **Images non-AppImage** : 12/42 images de `/restaurants` passent par `AppImage` ; les `<img>` bruts hérités (logos, icônes emoji, photos de `Home.tsx`…) ne sont pas convertis — hors périmètre LOT-12 (pas de refonte transverse), la plupart sont au-dessus de la ligne de flottaison de toute façon.
3. **Changement d'apparence global (CONF-31)** : l'assombrissement de `text-muted`/`text-secondary` touche toute l'app par construction. C'est le but (lisibilité au soleil), mais une validation visuelle humaine reste recommandée — la hiérarchie 3 niveaux (primary #111827 / secondary #4B5563 / muted #6B7280) est préservée.
4. Le mode data-saver coupe les animations framer-motion via `MotionConfig` ; les transitions CSS (`transition-colors`…) restent actives — coût réseau/CPU négligeable, non couvert volontairement.

## 5. Données de test

Nettoyées : `yamo_data_saver` retiré, session test déconnectée, viewport restauré. `yamo_onboarding_completed=true` laissé en place (comportement attendu d'un navigateur ayant déjà vu l'onboarding ; effacer la clé pour re-tester).

## Verdict

**LOT-12 conforme** (CONF-28/29/30/31 livrés et vérifiés en navigateur réel ; CONF-32 reporté avec justification). Aucune anomalie bloquante ou majeure ouverte.
