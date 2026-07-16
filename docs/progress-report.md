# Rapport de progression — Plan UX MiamExpress

> Démarrage du plan : 16/07/2026 · Ordre d'exécution : §E de `ux-implementation-plan.md`
> (01→02→03→04→05→06→07→08→10→15→11→09→12→13→14→16)

## Avancement

| # | Lot | Implémentation | QA | Rapport QA | Statut |
|---|---|---|---|---|---|
| 1 | LOT-01 Fiabilité panier | ✅ 16/07 | ✅ 16/07 (1 majeure corrigée) | `qa-LOT-01.md` | **Terminé** |
| 2 | LOT-02 Fantômes client + fiche resto | ✅ 16/07 | ✅ 16/07 (2 bloquantes ext. corrigées) | `qa-LOT-02.md` | **Terminé** |
| 3 | LOT-03 Checkout durci | ✅ 16/07 | ✅ 16/07 (1 majeure corrigée : panier orphelin) | `qa-LOT-03.md` | **Terminé** |
| 4 | LOT-04 Annulation client+resto | ✅ 16/07 | ✅ 16/07 (1 bloquante ext. corrigée) | `qa-LOT-04.md` | **Terminé** |
| 5 | LOT-05 Statuts bornés + dialogs | ✅ 16/07 | ✅ 16/07 | `qa-LOT-05.md` | **Terminé** |
| 6 | LOT-06 Livreur données réelles | ✅ 16/07 | ✅ 16/07 | `qa-LOT-06.md` | **Terminé** |
| 7 | LOT-07 Preuve livraison + incidents | ✅ 16/07 | ✅ 16/07 | `qa-LOT-07.md` | **Terminé** |
| 8 | LOT-08 Admin opérationnel | ✅ 16/07 | ✅ 16/07 | `qa-LOT-08.md` | **Terminé** |
| 9 | LOT-10 Navigation resto unifiée | ✅ 16/07 | ✅ 16/07 | `qa-LOT-10.md` | **Terminé** |
| 10 | LOT-15 Variantes/suppléments menu | ✅ 16/07 | ✅ 16/07 | `qa-LOT-15.md` | **Terminé** |
| 11 | LOT-11 Polling raisonné | ✅ 16/07 | ✅ 16/07 | `qa-LOT-11.md` | **Terminé** |
| 12 | LOT-09 Re-commande + avis nominatifs | ✅ 16/07 | ✅ 16/07 | `qa-LOT-09.md` | **Terminé** |
| 13 | LOT-12 Confort & a11y transverses | ✅ 16/07 | ✅ 16/07 (dark mode reporté, justifié) | `qa-LOT-12.md` | **Terminé** |
| 14 | LOT-13 Recherche unifiée | ✅ 16/07 | ✅ 16/07 (1 majeure QA-39 corrigée) | `qa-LOT-13.md` | **Terminé** |
| 15 | LOT-14 Horaires + pipeline images | ✅ 16/07 | ✅ 16/07 (1 majeure QA-40 corrigée) | `qa-LOT-14.md` | **Terminé** |
| 16 | LOT-16 Page Clients admin | ✅ 16/07 (audit + compléments) | ✅ 16/07 (2 majeures corrigées : blocage cosmétique, QA-41) | `qa-LOT-16.md` | **Terminé** |

## Problèmes rencontrés

1. **Chantier externe concurrent non commité** (« sync VPS » : routage par slug, FoodRequest, AdminMedia, suppression `supabase/`…) — a causé 2 anomalies bloquantes pendant le QA LOT-02 (syntaxe `}}`, réintroduction de la régression CONF-09), corrigées chirurgicalement. **Recommandation permanente : committer avant chaque lot.**
2. **Lint global instable** (81→86 problèmes selon les runs, fichiers externes) — le critère retenu est « zéro nouvelle erreur dans les fichiers touchés », vérifié fichier par fichier à chaque lot.
3. **Captures d'écran du pane indisponibles** (timeout systématique) — contrôles visuels réalisés par mesures DOM/styles calculés ; validation visuelle humaine recommandée en fin de plan.
4. **Pas de script de test** dans le projet — validation = build + parcours navigateur réels.

## Décisions prises

- **LOT-03** : mode VPS matérialisé par le flag explicite `VITE_USE_VPS_API` (documenté `.env.example` + CLAUDE.md) — aucun moyen fiable de détecter le backend sans requête perdue ; contrats API documentés dans `payments.ts`.
- **LOT-02** : routage par slug (chantier externe) conservé, seul le fallback `?? restaurants[0]` retiré.
- **LOT-01** : id composite `base::v{i}::s{i-j}` + `baseItemId` ; TTL 24 h glissant.
- Messages de commit proposés à chaque lot (pas de commit auto : le working tree mélange le chantier externe).

## Messages de commit proposés (à exécuter par le mainteneur)

- LOT-01 : `feat(cart): persistance localStorage (yamo_cart, TTL 24h) + id composite des personnalisations (baseItemId)`
- LOT-02 : `feat(client): actions contact réelles (tel/WhatsApp), fiche resto fiable (404/fermé/partage), carte "position estimée"`
- LOT-03 : `feat(checkout): minimum de commande bloquant, frais en skeleton, validation VPS obligatoire (VITE_USE_VPS_API), ETA confirmation` (+ fix QA-14 panier orphelin)
- LOT-04 : `feat(orders): annulation client (pending/confirmed) et restaurant avec motif obligatoire, visible sur les 3 profils (cancellationReason/cancelledBy)`
- LOT-05 : `feat(orders): statuts restaurant bornés à "Prête" (CONF-05) + remplacement des window.prompt/alert par dialogs shadcn (CONF-22)`
- LOT-06 : `feat(driver): rémunération affichée, géoloc réelle (jamais de distance inventée), GPS resto/client contextuel, encaissement espèces confirmé, privacy avant acceptation, messages WhatsApp réels, bip nouvelle course`
- LOT-07 : `feat(delivery): code de livraison 4 chiffres (client → livreur, 3 essais + repli tracé deliveredWithoutCode) + incidents livreur (lib incidents.ts, vue admin)`
- LOT-08 : `feat(admin): fiche commande (sheet détail + annulation motivée + contacts tel/WhatsApp), litiges actionnables (résolution incidents/annulations + badge sidebar), retrait carte de supervision factice`

## Décision produit requise (bloquant lancement, hors front)
**QA-23** : modèle de rémunération livreur — les restos « livraison gratuite » produisent « Vous gagnez : 0 FCFA » (vérité des données actuelles). Définir la rémunération plancher / part restaurant côté métier + backend.

- LOT-10 : `feat(restaurant): navigation par sidebar unique (+route /livreurs), toggle Ouvert/Fermé header avec confirmation, fin du window.location.reload, livreurs préférés par liste des livreurs récents (téléphone masqué + note)`

- LOT-15 : `feat(menu): variantes (surcoût) et suppléments créables/éditables par le restaurateur (section Options repliable), persistés et commandables côté client`

- LOT-11 : `perf(polling): hook usePolling (≥15s imposé, pause onglet masqué, tick au retour) sur 8 vues (15s opérationnel / 30s admin) + fix N+1 vérification des avis`

- LOT-09 : `feat(client): re-commande 1-clic (rematch baseItemId + indisponibles signalés + conflit panier) et avis nominatifs « Prénom N. » avec badge Commande vérifiée`

- LOT-12 : `feat(ux): onboarding première visite (3 écrans + ville), bannière hors-connexion (client + back-office), mode économie de données (yamo_data_saver + MotionConfig + images lazy), contrastes AA (text-muted 4.8:1, text-secondary 7.5:1)`

- LOT-13 : `feat(search): recherche unifiée — /restaurants à 2 modes (toggle Restaurants/Plats, q/ville/quartier partagés), vue plats extraite en DishResults, /explorer redirigé avec deep-links préservés, ExplorerMet supprimé`

- LOT-14 : `feat(restaurant): horaires structurés (lib hours.ts, ouvert = toggle ET plage réelle, plages de nuit, badge « ouvre à HH:MM », select fourchettes livraison) + pipeline images (lib media.ts : compression 1280px/JPEG q0.7 puis /api/media en VPS, data-URL compressée en mock) + fix overrides dans fetchRestaurant(s)ByOwner (QA-40)`

## Décision LOT-12 : dark mode back-office (CONF-32) reporté
Critère du plan « dark complet ou rien » : un dark honnête exige de détokeniser `bg-white` sur ~15 fichiers back-office + une passe visuelle humaine (captures indisponibles). À traiter comme lot dédié post-plan. Détail : `qa-LOT-12.md` §4.

## Écart LOT-14 : upload VPS non testé en réel
`VITE_USE_VPS_API` absent en dev et pas d'upload de test autorisé sur le VPS de production ; contrat vérifié contre `app/server/media-api.js`. À valider au prochain déploiement. Détail : `qa-LOT-14.md` §4.

- LOT-16 : `feat(admin): blocage client réellement effectif — CustomerBlockedError dans createOrder (point unique), message clair au checkout, fix déblocage silencieux à la reconnexion (sync suspension limitée aux livreurs), usePolling sur AdminCustomers`

## 🏁 Plan terminé — 16/16 lots livrés (16/07/2026)

**Audit final d'implémentation** : `docs/ux-final-validation.md` (16/07/2026) —
score global **90/100**, décision **PRÊT SOUS CONDITIONS** (front prêt ; lancement
conditionné au backend VPS, à la décision QA-23, à une passe visuelle humaine et au
commit du tree). 4 anomalies AF-01→04 consignées (dont AF-02 option English fantôme
et AF-03 bundle 1,7 MB).

Les 16 lots du plan (`ux-implementation-plan.md` §E) sont implémentés, QA-vérifiés
en navigateur réel et documentés (`qa-LOT-01` → `qa-LOT-16`).

### Reste à faire hors périmètre front (avant lancement)
1. **Backend VPS** : OTP SMS (CONF-08), `/api/orders/validate` (CONF-03), paiement
   MoMo réel, positions livreur réelles (CONF-34), `/api/admin/customers` (CONF-21),
   règle « client bloqué → 403 » côté serveur, upload `/api/media` à valider en réel
   (écart LOT-14).
2. **Décision produit QA-23** : rémunération livreur sur restos « livraison gratuite »
   (affiche « Vous gagnez : 0 FCFA » — vérité des données actuelles).
3. **Dark mode back-office** (CONF-32) : reporté, lot dédié post-plan.
4. **Passe visuelle humaine** sur les 6 résolutions (captures indisponibles côté outil).
5. **Committer le working tree** (chantier externe + 16 lots non commités — messages
   proposés ci-dessus, dernier commit : 089ab4c).

Note : le chantier externe a déjà créé `/admin/customers` + `AdminCustomers.tsx` — le LOT-16 deviendra un audit/complément de cette page plutôt qu'une création.
