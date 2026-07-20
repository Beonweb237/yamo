# Plan — Intégrité des données adossées à un profil

Date : 2026-07-20
Règle produit : **toute donnée affichée sur le site doit être adossée à un profil réel en base ;
l'identité affichée (nom d'auteur d'un avis, etc.) doit être DÉRIVÉE du profil lié, jamais un
libellé arbitraire.**

---

## 0. Constat (vérifié en prod, 2026-07-20)

Déclencheur : sur une fiche restaurant, un avis s'affiche sous « Client test A. » alors qu'aucun
utilisateur « Client test A » n'existe.

Enquête (table `reviews`, VPS prod) :

| Mesure | Valeur | Lecture |
|---|---|---|
| Avis total | 62 | — |
| `customer_id IS NULL` (orphelins) | **0** | ✅ tout avis est lié à un utilisateur |
| `customer_id` ne référençant aucun `users` | **0** | ✅ aucune FK cassée |
| Avis avec `author_name` stocké (texte libre) | **58** | ⚠️ identité stockée en dur |
| dont `author_name` fabriqué (« Client test X. ») | **32** | ❌ identité inventée, ≠ profil lié |
| `is_test = true` | 26 | filtrés du public par l'API (l.249 reviews-routes.js) |

**Diagnostic** : ce n'est PAS un problème d'orphelin (le lien `customer_id → users` est intact —
ex. l'avis « Client test A. » pointe réellement vers *Jean Test* / *Ines Etoa*, role `client`).
Le défaut est que **l'identité affichée provient du champ libre `reviews.author_name`**, affiché
verbatim côté front (`normalizeReview`, `reviews.ts:359`), et que :
- le **seed** `scripts/seed-review-examples.mjs` (l.23-47) force `author_name = 'Client test A.'…` ;
- le **fallback dev** `src/lib/reviews.ts` `LOCAL_DEMO_REVIEWS` (l.103-204) fait de même
  (gated `ALLOW_DEV_REVIEW_FALLBACK`, inactif en VPS mais présent dans le code).

Cause racine : **`author_name` est une source d'identité parallèle au profil.** Il faut une source
unique de vérité = le profil `customer_id`, et une dérivation serveur du nom affiché.

---

## 1. Plan de CONTRÔLE GLOBAL (audit « rien d'affiché sans profil »)

Objectif : détecter, sur tout le site, toute donnée d'identité visible non adossée à un profil réel,
et empêcher toute régression.

### 1.1 Inventaire des surfaces d'identité affichée
| Surface | Source actuelle | Adossé à un profil ? |
|---|---|---|
| Avis restaurant / livreur | `reviews.author_name` (libre) | Lien OK via `customer_id`, mais **nom affiché non dérivé** ❌ |
| Réponse restaurateur à un avis | `owner_reply` (JSON) | Restaurant = profil ✅ (à vérifier) |
| Commande « pour un tiers » | `orders.recipient_name/phone` | **Par design non-profil** — à cadrer (libellé « Destinataire », pas « client ») |
| Dashboards admin (clients/livreurs/restos) | tables FK vers `users` | ✅ |
| Demandes de plat (food_requests) | `customer_id` FK | ✅ (à confirmer affichage) |

### 1.2 Requêtes d'audit (le « contrôleur ») — 0 attendu partout
```sql
-- A. Avis orphelins (aucun client lié)
SELECT count(*) FROM reviews WHERE customer_id IS NULL;

-- B. Avis dont le customer_id ne référence aucun utilisateur
SELECT count(*) FROM reviews r
  WHERE r.customer_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.customer_id);

-- C. Avis dont le client lié n'a pas le rôle 'client'
SELECT count(*) FROM reviews r JOIN users u ON u.id = r.customer_id
  WHERE u.role <> 'client';

-- D. Identité inventée : author_name qui ne dérive pas du profil lié
--    (dérivé = 'Prénom I.' à partir de users.full_name)
SELECT count(*) FROM reviews r JOIN users u ON u.id = r.customer_id
  WHERE r.author_name IS NOT NULL
    AND r.author_name <> anonymize(u.full_name);   -- anonymize() = fonction §2.2

-- E. Fuite de données de test dans le public
SELECT count(*) FROM reviews WHERE is_test = true AND status = 'published';
--    (public OK tant que l'API filtre is_test=false ; ce compteur documente le volume)

-- F. Généralisation : toute table à FK vers users, lignes orphelines
--    (deliveries.driver_id, orders.customer_id/driver_id, applications.applicant_id,
--     payout_requests.driver_id, restaurants.owner_id, food_requests.customer_id, addresses.user_id)
--    → pour chaque : LEFT JOIN users, WHERE users.id IS NULL → 0 attendu.
```

### 1.3 Contrôle continu
- Script **`npm run verify:data-integrity`** (`app/scripts/verify-data-integrity.mjs`) exécutant A→F,
  imprimant un tableau, et **sortant en code ≠ 0 si un compteur > 0**.
- Ajouté au smoke-test post-déploiement (plan-test §23) et exécutable localement (mock : no-op).

---

## 2. Plan d'IMPLÉMENTATION (source unique = le profil)

Ordre recommandé, chaque lot livrable indépendamment.

### LOT A — Schéma & contraintes (empêcher la récidive)
- `ALTER TABLE reviews ALTER COLUMN customer_id SET NOT NULL;` (déjà 0 NULL → sûr).
- Confirmer la FK `reviews_customer_id_fkey` (présente). Choisir `ON DELETE RESTRICT` (un avis ne
  peut exister sans son client) plutôt que CASCADE, ou anonymiser à la suppression.
- **Déprécier `author_name` comme entrée** : ce n'est plus une donnée saisissable ; c'est au mieux
  un cache dérivé recalculé serveur.

### LOT B — API (dérivation serveur du nom affiché)
- Endpoint public des avis : `JOIN users u ON u.id = r.customer_id`, renvoyer un champ
  **`display_name = anonymize(u.full_name)`** ; **ne plus exposer `author_name` brut**.
- `anonymize(full_name)` (§2.2) : `"Jean Test" → "Jean T."`, `NULL/vide → "Client vérifié"`.
- Écriture (`POST /api/reviews`) : **ignorer tout `author_name` reçu du client** (l'identité vient du
  token/`customer_id`, déjà via `assertOwnDeliveredOrder`). Ne rien stocker de saisissable.

### LOT C — Frontend
- `normalizeReview` (reviews.ts:359) : afficher `display_name` (API) et non `author_name` brut.
- Retirer / neutraliser `LOCAL_DEMO_REVIEWS` (« Client test X. ») : soit supprimés, soit noms dérivés
  neutres et strictement dev (`ALLOW_DEV_REVIEW_FALLBACK` déjà en place).
- Conserver le badge « Client vérifié » pour les avis sans nom dérivable.

### LOT D — Backfill / nettoyage prod (données existantes)
- **Backup pg_dump** d'abord.
- Recalcul : `UPDATE reviews r SET author_name = NULL FROM users u WHERE u.id = r.customer_id;`
  (on laisse l'API dériver) **ou** `SET author_name = anonymize(u.full_name)` si l'on garde le cache.
- Les 26 `is_test=true` : conservés (déjà filtrés du public) ou supprimés si pur bruit — décision §3.
- Après backfill, l'audit §1.2-D doit retomber à 0.

### LOT E — Seeds
- `seed-review-examples.mjs` : ne plus fixer `author_name` fabriqué ; dériver du `full_name` du client
  de la commande, ou laisser NULL. Par défaut `is_test=true` pour les exemples (ne pas polluer le
  public) OU générer de vrais avis anonymisés assumés comme démo.

### LOT F — Contrôle (clôture)
- Livrer `verify-data-integrity.mjs` (§1.3) et l'exécuter : tous compteurs à 0.

---

## 2.2 Fonction de dérivation (référence unique)
```
anonymize(full_name):
  s = trim(full_name)
  si vide → "Client vérifié"
  parts = split(s, /\s+/)
  si len(parts) > 1 → `${parts[0]} ${upper(parts[1][0])}.`   // "Jean Test" → "Jean T."
  sinon → parts[0]
```
(Aligné sur `defaultAuthorName`, reviews.ts:308-309, et `anonymize` de seedDemoData.ts.)

---

## 3. Décisions à trancher avant exécution
1. **`author_name`** : (a) déprécié, dérivation serveur à la volée (recommandé) ; ou (b) conservé
   comme cache recalculé serveur.
2. **32 avis publics à nom fabriqué** : (a) réécrire le nom dérivé du vrai client (recommandé,
   garde le volume d'avis) ; (b) basculer en `is_test=true` (retirés du public) ; (c) supprimer.
3. **26 avis `is_test=true`** : conserver (filtrés) ou purger.

---

## 4. Prompt d'exécution (prêt à l'emploi)

> Contexte : app MiamExpress, backend VPS (voir CLAUDE.md). Règle : toute identité affichée doit
> dériver d'un profil réel ; `reviews.author_name` ne doit plus être une identité saisie/fabriquée.
>
> 1. **Audit** — écris `app/scripts/verify-data-integrity.mjs` qui exécute les requêtes A→F du
>    §1.2 (lecture DB via les vars `.env.server`, penser à nettoyer les CR), imprime un tableau et
>    sort en code ≠ 0 si un compteur > 0. Ajoute le script `verify:data-integrity` au `package.json`.
>    Lance-le et rapporte les compteurs.
> 2. **API** — dans `server/src/reviews-routes.js`, fais joindre `users` aux endpoints de lecture
>    publique et renvoie `display_name = anonymize(full_name)` ; cesse d'exposer `author_name` brut ;
>    en écriture, ignore tout `author_name` entrant. Ajoute un helper `anonymize()` (§2.2).
> 3. **Front** — `src/lib/reviews.ts` : consomme `display_name` ; supprime les `LOCAL_DEMO_REVIEWS`
>    à noms « Client test X. » (ou rends-les strictement dev + noms neutres).
> 4. **Backfill** — après `pg_dump`, applique la décision §3.2 aux 32 avis publics fabriqués et
>    §3.3 aux is_test. Re-lance l'audit : tout à 0.
> 5. **Seed** — `seed-review-examples.mjs` : plus de `author_name` fabriqué ; `is_test=true` par
>    défaut. 6. **Contraintes** — `reviews.customer_id NOT NULL`.
> Critères d'acceptation : `verify:data-integrity` = 0 partout ; aucune identité affichée qui ne
> dérive d'un profil réel ; `npm run build` OK ; parcours avis (création + affichage) inchangé.
