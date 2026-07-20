# Plan de test complet - MiamExpress

Date de reference : 20 juillet 2026  
Environnement cible principal : VPS production `https://miamexpress.cm`  
API locale VPS : `http://127.0.0.1:3002`  
Objectif : verifier minutieusement que les donnees demo, les parcours admin, clients, restaurants, livreurs, commandes, avis, assets et API fonctionnent de bout en bout.

---

## 1. Perimetre

Ce plan couvre les scenarios critiques suivants :

- Disponibilite generale de l'application et de l'API.
- Authentification et droits par role.
- Donnees demo operationnelles et idempotentes.
- Creation directe admin d'un livreur ou restaurant avec validation immediate.
- Gestion des candidatures soumises livreurs/restaurants.
- Visibilite des clients demo et des nouveaux clients inscrits.
- Parcours complet de commande client -> restaurant -> livreur -> livraison.
- Avis, commentaires, bons/mauvais retours.
- Commandes personnalisees et commandes pour quelqu'un d'autre.
- Suspension, reactivation, reset mot de passe.
- Robustesse : erreurs API, doublons, permissions, relance de seed, redemarrage PM2.
- Regression des erreurs observees : `500` API restaurants/reviews, `404` chunks JS.

Hors perimetre sauf demande specifique : tests de charge lourds, audit securite pentest, compatibilite exhaustive vieux navigateurs.

---

## 2. Comptes et donnees de reference

### 2.1 Comptes demo

| Role | Telephone | Mot de passe | Resultat attendu |
|---|---:|---:|---|
| Admin | `+237690000001` | `12345` | Acces dashboard admin |
| Client demo | `+237690000002` | `12345` | Peut commander |
| Restaurant approuve | `+237690000003` | `12345` | Acces dashboard restaurant |
| Restaurant en attente | `+237690000004` | `12345` | Dashboard bloque jusqu'a validation |
| Livreur approuve | `+237690000005` | `12345` | Acces dashboard livreur |
| Livreur en attente | `+237690000006` | `12345` | Dashboard bloque jusqu'a validation |

### 2.2 Donnees demo attendues apres seed

| Donnee | Minimum attendu | Verification |
|---|---:|---|
| Clients demo verifies | 15 | Admin > Clients + DB/API |
| Total clients visibles admin | >= 15 | `/api/admin/customers` |
| Livreurs soumis | >= 16 | Admin > Candidatures > En attente |
| Restaurants soumis | >= 8 | Admin > Candidatures > En attente |
| Mot de passe demo commun | `12345` | Connexion comptes demo |
| Seed idempotent | Oui | Relancer le seed sans doublons |

Commande de seed VPS :

```bash
cd /home/ubuntu/miamexpress
node scripts/seed-admin-demo.mjs
```

---

## 3. Convention de resultats

Utiliser ces statuts pendant l'execution :

| Statut | Signification |
|---|---|
| PASS | Le comportement attendu est confirme |
| FAIL | Le scenario echoue ou provoque une regression |
| BLOCKED | Impossible a tester sans donnees/acces/precondition |
| N/A | Non applicable dans cet environnement |
| RETEST | Corrige, a retester |

Niveaux de severite :

| Niveau | Description |
|---|---|
| S1 Bloquant | Empêche commande, login, paiement, admin critique ou demarrage API |
| S2 Majeur | Parcours important casse, contournement possible |
| S3 Moyen | Fonction secondaire degradee |
| S4 Mineur | Texte, style, confort, edge case non bloquant |

---

## 4. Pre-check avant test

| ID | Test | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| PRE-001 | PM2 API | `pm2 status miamexpress-api --no-color` | `miamexpress-api` online |  |
| PRE-002 | API restaurants | `curl -k https://miamexpress.cm/api/restaurants?limit=100` | HTTP 200 |  |
| PRE-003 | API reviews | `curl -k 'https://miamexpress.cm/api/reviews/summaries?targetType=restaurant&targetIds=1,2,3'` | HTTP 200 |  |
| PRE-004 | Front index | Ouvrir `https://miamexpress.cm` | Page charge sans ecran blanc |  |
| PRE-005 | Chunks anciens | Tester `/assets/DeliveryMap-CnSbso0n.js`, `/assets/leaflet-BOso5EEf.js`, `/assets/AddressPickerMap-CS4yUA8M.js` | HTTP 200 |  |
| PRE-006 | Chunks nouveaux | Tester chunks presents dans `dist/assets` | HTTP 200 |  |
| PRE-007 | Console navigateur | Ouvrir Home, Restaurants, Admin | Aucune erreur critique rouge |  |

---

## 5. Tests d'authentification et roles

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| AUTH-001 | Login admin valide | Se connecter avec `+237690000001 / 12345` | Dashboard admin accessible |  |
| AUTH-002 | Login admin mauvais mot de passe | Mot de passe incorrect | Message d'erreur clair, pas de session |  |
| AUTH-003 | Login client valide | Se connecter client demo | Acces parcours client |  |
| AUTH-004 | Login restaurant approuve | Se connecter restaurant approuve | Dashboard restaurant accessible |  |
| AUTH-005 | Login restaurant non approuve | Se connecter restaurant pending | Acces dashboard bloque avec message validation |  |
| AUTH-006 | Login livreur approuve | Se connecter livreur approuve | Dashboard livreur accessible |  |
| AUTH-007 | Login livreur non approuve | Se connecter livreur pending | Acces dashboard bloque |  |
| AUTH-008 | Session persistante | Rafraichir page apres login | Session conservee |  |
| AUTH-009 | Deconnexion | Cliquer deconnexion | Retour login, routes privees bloquees |  |
| AUTH-010 | Nouveau client inscrit | Creer un compte client neuf | Connexion possible, visible admin |  |
| AUTH-011 | Telephone deja utilise | Inscription avec telephone existant | Pas de doublon dangereux, message clair |  |
| AUTH-012 | Utilisateur suspendu | Suspendre puis tenter connexion/action | Acces ou action bloquee selon regle metier |  |

---

## 6. Tests donnees demo et idempotence

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| DEMO-001 | Seed admin demo | Lancer `node scripts/seed-admin-demo.mjs` | Script termine sans erreur |  |
| DEMO-002 | Clients demo presents | Ouvrir Admin > Clients | Au moins 15 clients demo visibles |  |
| DEMO-003 | Livreurs soumis visibles | Admin > Candidatures > En attente | Au moins 16 candidatures livreur |  |
| DEMO-004 | Restaurants soumis visibles | Admin > Candidatures > En attente | Au moins 8 candidatures restaurant |  |
| DEMO-005 | Seed idempotent | Relancer le seed 2 fois | Les compteurs ne doublent pas |  |
| DEMO-006 | Mot de passe demo | Tester plusieurs comptes demo avec `12345` | Connexion OK selon role/statut |  |
| DEMO-007 | Donnees coherentes apres PM2 restart | Redemarrer API puis verifier admin | Donnees conservees |  |

---

## 7. Admin - Candidatures

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| APP-001 | Liste en attente | Admin > Candidatures > En attente | Liste chargee sans erreur |  |
| APP-002 | Recherche par nom | Rechercher un nom candidat | Resultats filtres correctement |  |
| APP-003 | Recherche par telephone | Rechercher numero | Ligne correspondante trouvee |  |
| APP-004 | Recherche par ville | Rechercher `Douala`, `Yaounde`, etc. | Resultats de la ville |  |
| APP-005 | Approuver livreur soumis | Cliquer Approuver sur livreur pending | Candidature passe approuvee, user `is_approved=true` |  |
| APP-006 | Rejeter livreur soumis | Rejeter avec motif | Candidature passe rejetee, motif conserve |  |
| APP-007 | Approuver restaurant sans lien | Approuver restaurant pending sans selection | Restaurant cree + candidature approuvee |  |
| APP-008 | Approuver restaurant avec lien | Selectionner restaurant existant puis approuver | `owner_id` assigne, pas de doublon |  |
| APP-009 | Rejeter restaurant soumis | Rejeter avec motif | Statut rejetee, motif visible/admin |  |
| APP-010 | Onglets | Basculer pending/approved/rejected | Compteurs et listes coherents |  |
| APP-011 | Candidat sans documents | Ouvrir candidature sans docs | UI stable, message clair |  |
| APP-012 | Documents fournis | Ouvrir documents si presents | Images/liens ouvrables |  |
| APP-013 | Action doublon | Rejouer approbation ou creation meme telephone | Pas d'erreur SQL, pas de doublon |  |

---

## 8. Admin - Creation directe livreur/restaurant

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| CREATE-001 | Ouvrir modal livreur | Admin > Candidatures > Livreur valide | Modal livreur ouverte |  |
| CREATE-002 | Creer livreur valide | Remplir nom, telephone, ville, adresse, mot de passe | HTTP 201, candidature `approved` |  |
| CREATE-003 | Livreur visible | Admin > Livreurs | Nouveau livreur visible |  |
| CREATE-004 | Connexion livreur cree | Login avec telephone/mot de passe | Dashboard livreur accessible |  |
| CREATE-005 | Rejouer meme livreur | Creer avec meme telephone | Mise a jour sans doublon, HTTP 201 |  |
| CREATE-006 | Ouvrir modal restaurant | Admin > Candidatures > Restaurant valide | Modal restaurant ouverte |  |
| CREATE-007 | Creer restaurant valide | Remplir responsable, nom restaurant, telephone, ville, quartier | HTTP 201, restaurant cree |  |
| CREATE-008 | Restaurant visible public | Aller page restaurants | Restaurant cree visible |  |
| CREATE-009 | Connexion restaurant cree | Login proprietaire | Dashboard restaurant accessible |  |
| CREATE-010 | Rejouer meme restaurant | Creer avec meme telephone | Mise a jour sans doublon, pas d'overflow SQL |  |
| CREATE-011 | Validation champs requis | Soumettre sans telephone | Erreur claire, pas de requete destructrice |  |
| CREATE-012 | Mot de passe court | Mot de passe < 4 caracteres | Erreur claire |  |
| CREATE-013 | Taux commission | Creer restaurant sans commission explicite | `commission_rate` valide, pas numeric overflow |  |

---

## 9. Admin - Clients

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| CUST-001 | Liste clients | Admin > Clients | Clients serveur visibles |  |
| CUST-002 | Clients demo | Chercher clients seed | Presents |  |
| CUST-003 | Nouveau client visible | Inscrire un client neuf puis refresh admin | Client apparait |  |
| CUST-004 | Recherche telephone | Rechercher numero | Client trouve |  |
| CUST-005 | Recherche ville | Rechercher ville | Filtrage correct |  |
| CUST-006 | Detail client | Ouvrir panneau detail | Infos, commandes, statuts visibles |  |
| CUST-007 | Bloquer client | Cliquer Bloquer | Client passe bloque, persist apres refresh |  |
| CUST-008 | Debloquer client | Cliquer Debloquer | Client actif |  |
| CUST-009 | Reset mot de passe client | Definir nouveau mot de passe | Connexion avec nouveau mot de passe OK |  |
| CUST-010 | Stats commande | Client avec commandes | Total, nombre, derniere commande coherents |  |
| CUST-011 | Client sans commande | Nouveau client sans commande | Badge Nouveau, pas d'erreur |  |

---

## 10. Admin - Livreurs

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| DRV-001 | Liste livreurs approuves | Admin > Livreurs | Liste chargee |  |
| DRV-002 | Livreurs crees admin | Chercher livreur cree | Visible |  |
| DRV-003 | Detail livreur | Ouvrir fiche | Nom, telephone, ville, stats visibles |  |
| DRV-004 | Suspendre livreur | Desactiver avec motif | Statut suspendu persistant |  |
| DRV-005 | Reactiver livreur | Reactiver | Statut actif |  |
| DRV-006 | Reset mot de passe | Definir nouveau mot de passe | Connexion avec nouveau mot de passe OK |  |
| DRV-007 | Virements liste | Voir demandes de virement | Chargement sans erreur |  |
| DRV-008 | Marquer virement paye | Cliquer Payer | Statut paye |  |
| DRV-009 | Rejeter virement | Rejeter avec motif | Statut rejete, motif conserve |  |
| DRV-010 | Stats livraisons | Livreur avec livraisons | Compteurs coherents |  |

---

## 11. Admin - Restaurants

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| REST-001 | Liste restaurants | Admin > Restaurants | Liste chargee |  |
| REST-002 | Restaurant cree admin | Chercher restaurant cree | Visible |  |
| REST-003 | Restaurant approuve depuis candidature | Approuver puis chercher | Visible et lie au owner |  |
| REST-004 | Details restaurant | Ouvrir fiche/admin | Nom, ville, adresse, telephone presents |  |
| REST-005 | Statut ouvert/ferme | Modifier si fonctionnalite presente | Persist et reflete public |  |
| REST-006 | Acces dashboard proprietaire | Login proprietaire | Dashboard accessible |  |
| REST-007 | Restaurant pending | Login compte non approuve | Dashboard bloque |  |

---

## 12. Parcours client - commande standard

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| ORD-001 | Parcourir restaurants | Client login -> Restaurants | Liste chargee |  |
| ORD-002 | Detail restaurant | Ouvrir un restaurant | Menu et avis chargent |  |
| ORD-003 | Ajouter au panier | Ajouter 1 article | Panier mis a jour |  |
| ORD-004 | Modifier quantite | + / - quantite | Total correct |  |
| ORD-005 | Supprimer article | Retirer article | Panier correct |  |
| ORD-006 | Checkout adresse valide | Renseigner adresse complete | Passe etape suivante |  |
| ORD-007 | Checkout adresse incomplete | Laisser champ requis vide | Erreur claire |  |
| ORD-008 | Paiement cash | Selectionner cash | Commande creee |  |
| ORD-009 | Paiement mobile money | Selection MTN/Orange si actif | Statut attendu, pas de crash |  |
| ORD-010 | Historique client | Apres commande | Commande visible dans historique |  |
| ORD-011 | Admin voit commande | Admin > Commandes | Commande visible |  |
| ORD-012 | Restaurant voit commande | Dashboard restaurant | Commande entrante visible |  |

---

## 13. Commandes speciales et personnalisees

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| SPEC-001 | Commande pour soi | Checkout destinataire soi | Contact client utilise |  |
| SPEC-002 | Commande pour quelqu'un d'autre | Renseigner autre nom/tel/adresse | Infos destinataire conservees |  |
| SPEC-003 | Commande personnalisee simple | Creer demande personnalisee | Demande enregistree |  |
| SPEC-004 | Commande personnalisee acceptee | Restaurant/admin accepte | Statut success/accepted |  |
| SPEC-005 | Commande personnalisee refusee | Rejet avec motif | Statut rejected, motif visible |  |
| SPEC-006 | Commande personnalisee incomplete | Champs requis vides | Validation claire |  |
| SPEC-007 | Au moins 10 commandes personnalisees demo | Verifier base/admin | Melange reussies/non abouties |  |

---

## 14. Parcours restaurant - traitement commande

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| RORD-001 | Voir commandes entrantes | Login restaurant | Commandes visibles |  |
| RORD-002 | Accepter commande | Cliquer accepter | Statut confirme/preparation |  |
| RORD-003 | Rejeter commande | Rejeter avec motif | Client/admin voient rejet |  |
| RORD-004 | Marquer preparation | Changer statut | Statut `preparing` |  |
| RORD-005 | Marquer prete | Changer statut | Statut `ready` |  |
| RORD-006 | Rupture ou indisponible | Marquer item indisponible si present | Client ne peut plus commander item |  |
| RORD-007 | Commande annulee | Annuler scenario permis | Statut coherent |  |

---

## 15. Parcours livreur - livraison

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| DLV-001 | Mise en ligne | Login livreur -> En ligne | Statut online persiste |  |
| DLV-002 | Voir livraisons disponibles | Commande prete dans sa ville | Livraison visible |  |
| DLV-003 | Accepter livraison | Cliquer accepter | Livraison assignee au livreur |  |
| DLV-004 | Recuperer commande | Marquer picked up | Statut commande/livraison coherent |  |
| DLV-005 | En livraison | Marquer delivering | Client/admin voient progression |  |
| DLV-006 | Livrer | Marquer delivered | Commande livree, stats incrementent |  |
| DLV-007 | Livreur hors zone | Login livreur autre ville | Ne voit pas commande hors zone si regle active |  |
| DLV-008 | Livreur suspendu | Suspendre puis tenter accepter | Action bloquee |  |
| DLV-009 | Plusieurs livraisons | Livreur avec dizaines commandes demo | Stats et performance OK |  |

---

## 16. Avis et commentaires

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| REV-001 | Bon avis restaurant | Client laisse 5 etoiles + commentaire | Avis cree, resume mis a jour |  |
| REV-002 | Mauvais avis restaurant | Client laisse 1-2 etoiles + commentaire | Avis cree, moyenne mise a jour |  |
| REV-003 | Bon avis livreur | Apres livraison | Avis livreur visible/admin/stats |  |
| REV-004 | Mauvais avis livreur | Apres livraison | Avis conserve, stats recalculent |  |
| REV-005 | Commentaire vide | Soumettre selon regle | Accepte ou bloque clairement |  |
| REV-006 | Commentaire tres long | Soumettre texte long | Limite/validation propre, pas de crash |  |
| REV-007 | Resume avis API | `/api/reviews/summaries` | HTTP 200, donnees attendues |  |
| REV-008 | Admin avis | Admin > Reviews si present | Avis listes sans erreur |  |

---

## 17. Securite fonctionnelle et permissions

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| SEC-001 | Admin route sans token | Appeler `/api/admin/customers` sans token | HTTP 401 |  |
| SEC-002 | Admin route token client | Token client sur route admin | HTTP 403 |  |
| SEC-003 | Client modifie role | Tenter PATCH role/is_approved | Refuse ou champs ignores |  |
| SEC-004 | Mot de passe court API | PATCH password < 4 | HTTP 400 |  |
| SEC-005 | Candidature inexistante approve | Appeler approve id fake | HTTP 404 |  |
| SEC-006 | Client inexistant suspension | Patch id fake | HTTP 404 |  |
| SEC-007 | Donnees sensibles | GET users/profiles | Pas de `password_hash`, OTP non expose |  |
| SEC-008 | Cross-role dashboard | Client tente URL admin | Bloque/redirige |  |

---

## 18. Regression des erreurs initiales

| ID | Erreur initiale | Test | Resultat attendu | Statut |
|---|---|---|---|---|
| REG-001 | `/api/restaurants?limit=100` 500 | Appel public HTTPS | HTTP 200 |  |
| REG-002 | `/api/reviews/summaries` 500 | Appel public HTTPS | HTTP 200 |  |
| REG-003 | `DeliveryMap-CnSbso0n.js` 404 | HEAD/GET asset public | HTTP 200 |  |
| REG-004 | `leaflet-BOso5EEf.js` 404 | HEAD/GET asset public | HTTP 200 |  |
| REG-005 | Dynamic import failed | Ouvrir page carte/livraison | Aucun ecran blanc, pas d'erreur module |  |
| REG-006 | Nouvel index cache | Hard refresh + navigation | Pas de mismatch chunks |  |
| REG-007 | Admin customers local-only | Creer client serveur puis admin | Client visible |  |

---

## 19. Tests responsive et UI

| ID | Scenario | Viewport | Resultat attendu | Statut |
|---|---|---:|---|---|
| UI-001 | Home mobile | 360x800 | Pas de debordement horizontal |  |
| UI-002 | Restaurants mobile | 360x800 | Cartes lisibles, boutons accessibles |  |
| UI-003 | Admin candidatures mobile | 390x844 | Onglets/search utilisables |  |
| UI-004 | Modal creation admin mobile | 390x844 | Champs visibles, pas de texte coupe |  |
| UI-005 | Admin clients mobile | 390x844 | Liste et detail scrollent proprement |  |
| UI-006 | Admin livreurs mobile | 390x844 | Actions accessibles |  |
| UI-007 | Desktop admin | 1440x900 | Pas de chevauchement |  |
| UI-008 | Console | Tous | Pas d'erreurs rouges critiques |  |

---

## 20. Tests API automatisables

### 20.1 Login admin et routes admin

```bash
BASE="http://127.0.0.1:3002"
TOKEN=$(curl -s -X POST "$BASE/api/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+237690000001","password":"12345"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).session.access_token))")

curl -i -H "Authorization: Bearer $TOKEN" "$BASE/api/admin/customers"
curl -i -H "Authorization: Bearer $TOKEN" "$BASE/api/applications?status=eq.pending&limit=100"
```

### 20.2 Creation directe livreur

```bash
curl -i -X POST "$BASE/api/admin/accounts" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "type":"livreur",
    "applicantName":"Livreur Test Automatique",
    "contactPhone":"+237653910001",
    "city":"Douala",
    "address":"Akwa",
    "password":"12345"
  }'
```

Attendu : HTTP `201`, `application.status = approved`.

### 20.3 Creation directe restaurant

```bash
curl -i -X POST "$BASE/api/admin/accounts" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "type":"restaurant",
    "applicantName":"Responsable Test Automatique",
    "restaurantName":"Restaurant Test Automatique",
    "contactPhone":"+237653910002",
    "city":"Douala",
    "neighborhood":"Bonapriso",
    "address":"Bonapriso, Douala",
    "password":"12345"
  }'
```

Attendu : HTTP `201`, `application.status = approved`, `restaurant.id` present.

### 20.4 Assets publics

```bash
for asset in \
  /assets/DeliveryMap-CnSbso0n.js \
  /assets/leaflet-BOso5EEf.js \
  /assets/AddressPickerMap-CS4yUA8M.js; do
  curl -k -s -o /dev/null -w "%{http_code} ${asset}\n" "https://miamexpress.cm${asset}"
done
```

Attendu : `200` pour chaque asset.

---

## 21. Tests base de donnees et coherence

Executer depuis le VPS avec l'utilisateur DB approprie.

| ID | Requete | Attendu | Statut |
|---|---|---|---|
| DB-001 | `SELECT count(*) FROM users WHERE role='client';` | >= 15 |  |
| DB-002 | `SELECT type,status,count(*) FROM applications GROUP BY type,status;` | pending livreur/restaurants presents |  |
| DB-003 | `SELECT count(*) FROM users WHERE role='livreur' AND is_approved=true;` | Inclut livreurs valides |  |
| DB-004 | `SELECT count(*) FROM users WHERE role='restaurant' AND is_approved=true;` | Inclut restaurants valides |  |
| DB-005 | `SELECT count(*) FROM restaurants WHERE owner_id IS NOT NULL;` | Restaurants proprietaires lies |  |
| DB-006 | `SELECT count(*) FROM orders;` | Commandes demo/creees presentes |  |
| DB-007 | `SELECT count(*) FROM deliveries;` | Livraisons presentes si commandes livrees |  |
| DB-008 | `SELECT phone,count(*) FROM users GROUP BY phone HAVING count(*) > 1;` | 0 doublon |  |

---

## 22. Scenarios de reprise et rollback

| ID | Scenario | Etapes | Resultat attendu | Statut |
|---|---|---|---|---|
| OPS-001 | Restart API | `pm2 restart miamexpress-api --update-env` | API revient online |  |
| OPS-002 | Logs apres restart | `pm2 logs miamexpress-api --lines 80` | Pas d'erreur fatale |  |
| OPS-003 | Backup deploy present | `ls -td backups/codex_admin_* | head` | Sauvegardes presentes |  |
| OPS-004 | Seed apres restart | Relancer seed | Pas de doublons |  |
| OPS-005 | Cache navigateur | Hard refresh + navigation | Pas de chunk 404 |  |

Dernieres sauvegardes connues lors du deploiement :

```text
/home/ubuntu/miamexpress/backups/codex_admin_demo_20260720_061059
/home/ubuntu/miamexpress/backups/codex_admin_rate_20260720_061938
```

---

## 23. Smoke test minimal apres chaque deploiement

A executer rapidement apres chaque push VPS :

1. `pm2 status miamexpress-api --no-color` -> online.
2. `https://miamexpress.cm` -> page charge.
3. `/api/restaurants?limit=100` -> 200.
4. `/api/reviews/summaries?targetType=restaurant&targetIds=1,2,3` -> 200.
5. Login admin `+237690000001 / 12345` -> OK.
6. Admin > Clients -> liste chargee.
7. Admin > Candidatures -> livreurs/restaurants pending visibles.
8. Creer un livreur valide avec telephone de test unique -> 201 approved.
9. Creer un restaurant valide avec telephone de test unique -> 201 approved.
10. Verifier les trois assets historiques -> 200.

---

## 24. Criteres d'acceptation finale

Le lot est considere valide si :

- Aucun endpoint critique ne retourne `500`.
- Aucun chunk JS critique ne retourne `404` sur le domaine public.
- L'admin peut creer et valider directement un livreur.
- L'admin peut creer et valider directement un restaurant.
- Les candidatures soumises livreurs/restaurants sont visibles et actionnables.
- Les clients demo sont visibles.
- Un nouveau client inscrit devient visible cote admin.
- Les commandes standard et personnalisees passent les etapes attendues.
- Les livreurs peuvent executer les commandes jusqu'a livraison.
- Les restaurants peuvent accepter/rejeter/preparer les commandes.
- Les avis bons/mauvais sont enregistrables et resumes sans erreur.
- Le seed demo est rejouable sans doublons.
- Les roles et permissions admin/client/restaurant/livreur sont respectes.
- PM2 reste online apres redemarrage.

---

## 25. Modele de rapport de test

```md
# Rapport de test MiamExpress

Date :
Testeur :
Environnement :
Version / backup :

## Resume
- Total tests :
- PASS :
- FAIL :
- BLOCKED :
- N/A :

## Defauts critiques
| ID test | Severite | Description | Preuve | Statut |
|---|---|---|---|---|

## Resultats detailles
| ID test | Statut | Notes | Capture/log |
|---|---|---|---|

## Decision
- [ ] Valide pour production
- [ ] Valide avec reserves
- [ ] Refuse / correction requise
```