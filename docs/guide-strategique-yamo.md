# Guide Stratégique Yamo 360° — Business, Croissance, Opérations et Sécurité

Version : 1.0 — consolidation du 14 juillet 2026
Propriétaire : Direction Yamo (Stratégie, Opérations, Confiance & Sécurité, Tech)
Portée : investisseurs, direction, produit/tech, opérations, support, restaurants, livreurs, admin
Documents sources consolidés : `business-plan-yamo.md`, `manuel-profils-securite-yamo.md`, `processus-securises-yamo.md`

> Ce document fusionne la stratégie business, le modèle opérationnel et le cadre de sécurité de Yamo en un seul référentiel de pilotage. Il ne remplace pas les documents sources, qui restent les références détaillées ; il en est la synthèse exécutable, enrichie des éléments manquants identifiés lors de l'audit croisé (suspension restaurant, alerting automatisé, gestion de crise, conformité légale détaillée, unit economics complet, organisation à 24 mois).

---

## Sommaire

**Partie I — Vision, marché et positionnement**
1. Résumé exécutif
2. Contexte et opportunité de marché
3. Problèmes résolus, par acteur
4. Vision, mission, positionnement
5. Marché cible et segmentation
6. Analyse concurrentielle

**Partie II — Modèle économique et stratégie commerciale**
7. Solution et proposition de valeur
8. Modèle économique et sources de revenus
9. Stratégie de prix et unit economics
10. Stratégie go-to-market
11. Stratégie marketing et campagnes
12. B2B, franchise et partenariats *(complément)*

**Partie III — Opérations et fiabilité de la commande**
13. Flux opérationnel de la commande
14. Cycle de vie du profil Restaurant
15. Cycle de vie du profil Livreur
16. Commandes pour un tiers
17. Règles opérationnelles pour fiabiliser la commande
18. Support client et gestion des litiges
19. KPIs, seuils d'alerte et alerting automatisé *(complété)*

**Partie IV — Confiance, sécurité et gouvernance**
20. Principes directeurs de sécurité
21. Rôles et séparation des responsabilités
22. Modèle de données et statuts
23. Sécurité technique transverse
24. Échelle de sanctions — Restaurant et Livreur *(gap comblé : suspension restaurant)*
25. Gestion de crise et continuité d'activité *(nouveau)*

**Partie V — Produit, technologie et roadmap**
26. État du produit et priorités techniques
27. Roadmap 18 mois consolidée
28. Exigences produit à ajouter (P0/P1/P2)

**Partie VI — Organisation, finance et financement**
29. Organisation et équipe
30. Projections financières détaillées
31. Besoin de financement
32. Cadre légal et conformité (Cameroun) *(enrichi)*

**Partie VII — Pilotage et exécution**
33. Plan d'action immédiat (90 jours)
34. Hypothèses à valider sur le terrain
35. Risques et mitigation — matrice consolidée
36. Gouvernance documentaire

**Partie VIII — Annexes**
A. Checklists opérationnelles
B. Modèles de messages
C. Glossaire des statuts et rôles
D. Sources et références

---

# Partie I — Vision, marché et positionnement

## 1. Résumé exécutif

Yamo est une plateforme de livraison de repas et de produits vendus par des restaurants au Cameroun, structurée autour de quatre espaces applicatifs : client, restaurant, livreur et admin. Sa promesse est simple — permettre à des clients de commander facilement dans des restaurants locaux fiables, donner à ces restaurants un canal digital prêt à vendre, et synchroniser les livreurs avec le temps réel de préparation des repas.

Le positionnement retenu est **« la livraison locale fiable, rapide et structurée »**, d'abord à Douala, puis Yaoundé, puis les grandes villes du pays. Trois convictions structurent la stratégie :

- La confiance est la variable la plus rare du marché camerounais de la livraison — elle se construit par la vérification des profils, la qualité du catalogue et la fiabilité des délais, pas seulement par une interface soignée.
- L'exécution opérationnelle (catalogue propre, restaurants réactifs, livreurs disponibles, support rapide) est le véritable facteur différenciant, davantage que la technologie brute.
- La croissance doit être disciplinée par zone : ne pas ouvrir une ville tant que les fondamentaux (restaurants signés, livreurs vérifiés, support joignable) ne sont pas stables.

**Objectifs à 36 mois** :
- Devenir une référence de livraison alimentaire dans les grandes villes camerounaises.
- Atteindre environ **1,3 million de commandes annuelles** en année 3.
- Générer environ **1,87 milliard FCFA de revenu net annuel** en année 3.
- Construire une opération rentable avec une **marge EBITDA positive dès l'année 2**.

Ce guide relie cette ambition business à son exécution concrète : qui valide un restaurant, qui suspend un livreur, quelles données sont journalisées, quel est le seuil d'alerte sur un retard, quel budget finance quelle phase. C'est la caractéristique de Yamo par rapport à un concurrent qui ne serait qu'une interface de commande : un système opérationnel documenté de bout en bout.

## 2. Contexte et opportunité de marché

Le Cameroun compte environ **29,9 millions d'habitants** (2025, Banque mondiale), avec une forte concentration urbaine, une population jeune, un usage mobile croissant et une culture solide de restauration hors domicile.

| Indicateur | Signal business | Source |
|---|---:|---|
| Population Cameroun 2025 | 29 879 337 habitants | Banque mondiale |
| Utilisateurs internet 2024 | 46 % de la population | Banque mondiale |
| PIB 2025 | 58,93 milliards USD | Banque mondiale |
| Croissance PIB 2025 | 3,2 % | Banque mondiale |
| Douala | plus grand centre économique du pays | Données publiques ville |
| Mobile money | canal de paiement structurel en Afrique | GSMA Inclusive Digital Finance |

**Lecture stratégique** : les villes denses réduisent les distances moyennes de livraison et améliorent la rentabilité par zone ; le mobile est le canal naturel d'acquisition, de suivi et de paiement ; les restaurants ont besoin d'un outil simple pour gérer menus, disponibilités et délais ; la confiance (menus fiables, profils validés, prix clairs, statut visible, support local) sera le principal facteur de différenciation face à des alternatives informelles (WhatsApp, appels directs, coursiers individuels).

## 3. Problèmes résolus, par acteur

| Acteur | Frictions actuelles | Ce que Yamo doit garantir |
|---|---|---|
| **Client** | Menus peu visibles, prix/disponibilités incertains, délais opaques, comparaison difficile | Menus complets avec images, statut de commande visible en continu, comparaison par cuisine/prix/distance/popularité |
| **Restaurant** | Pas d'outil digital simple, gestion des commandes manuelle, pas de visibilité sur le délai | Digitalisation sans complexité technique, confirmation rapide, ETA de préparation, statistiques simples |
| **Livreur** | Attente longue au restaurant, courses peu rentables, statuts flous | Synchronisation sur l'ETA restaurant, courses proches et rentables, statuts clairs (accepté, en route, récupéré, livré) |
| **Admin** | Pas de vue consolidée, validation manuelle non standardisée | Validation structurée des candidatures, supervision par ville/restaurant/statut, contrôle qualité du catalogue |

## 4. Vision, mission, positionnement

**Vision** — Devenir l'infrastructure locale de commande et de livraison la plus fiable pour les restaurants et commerces alimentaires du Cameroun.

**Mission** — Simplifier l'accès aux repas et produits alimentaires de qualité, tout en donnant aux restaurants et livreurs des outils concrets pour vendre, préparer et livrer mieux.

**Positionnement** — *« Yamo, la livraison fiable des restaurants camerounais. »*

**Attributs de marque** — Local · Rapide · Transparent · Professionnel · Accessible · Fiable.

**Message principal** — *« Commandez vos restaurants préférés, suivez votre repas, recevez vite. »*

## 5. Marché cible et segmentation

### Géographie de lancement (phasage par vagues)

| Phase | Villes | Logique |
|---|---|---|
| **Phase 1 — MVP commercial** | Douala : Bonapriso, Akwa, Bonamoussadi, Makepe, Bali, Deido, Bepanda, Logpom, PK, Yassa | Densité, pouvoir d'achat, restaurants déjà structurés |
| **Phase 2 — Expansion prioritaire** | Yaoundé (Bastos, Mvan, Essos, Biyem-Assi, Odza, Omnisports, Melen, Nlongkak, Ngousso), Bafoussam, Bamenda, Garoua, Maroua, Ngaoundéré | Deuxième pôle économique + villes régionales majeures |
| **Phase 3 — Couverture grandes villes** | Bertoua, Ébolowa, Kribi, Limbé, Buéa, Kumba, Édéa, Nkongsamba, Dschang, Foumban, Sangmélima | Consolidation de la couverture nationale |

**Règle d'or** : l'app peut afficher toutes les grandes villes, mais l'opération ne s'active que zone par zone, en fonction du nombre réel de restaurants et de livreurs disponibles. Les critères d'ouverture d'une ville sont détaillés en §10.

### Segments clients

| Segment | Besoin | Offre Yamo |
|---|---|---|
| Jeunes actifs urbains | Repas rapide au bureau/domicile | Livraison rapide, favoris, paiement mobile |
| Étudiants | Prix accessibles, snacks, boissons | Menus abordables, promos locales |
| Familles | Repas du soir, week-end, anniversaires | Paniers groupés, restaurants vérifiés |
| Entreprises | Repas d'équipe, réunions, pauses | Comptes B2B, commandes planifiées |
| Diaspora / famille à distance | Commander pour un proche | Paiement digital, adresse bénéficiaire dédiée |

### Segments restaurants

| Segment | Besoin | Approche Yamo |
|---|---|---|
| Restaurants populaires | Volume supplémentaire | Commission raisonnable, visibilité |
| Fast-food / snacks | Rotation rapide | Intégration simple, photos propres |
| Restaurants premium | Clientèle solvable | Branding, packaging, délais fiables |
| Pâtisseries / boissons | Commandes fréquentes | Catégories dédiées, upsell |
| Traiteurs | Commandes planifiées | Module B2B, précommande |

### Segments livreurs

Livreurs indépendants à moto · petites flottes locales · étudiants à disponibilité horaire · livreurs spécialisés par zone dense.

## 6. Analyse concurrentielle

**Concurrents directs** : plateformes de livraison locales par ville, services informels (WhatsApp, appels, coursiers individuels), restaurants qui livrent eux-mêmes, super-apps africaines ou services logistiques susceptibles d'entrer sur le segment alimentaire.

**Concurrents indirects** : taxis/motos informels, commandes téléphoniques, pages Instagram/Facebook de restaurants, groupes WhatsApp de restauration.

**Avantage défendable de Yamo** :
- Opérations pensées pour le contexte camerounais, pas seulement une interface.
- Validation systématique des profils restaurants et livreurs.
- Catalogue complet avec exigence d'images appropriées.
- Temps de préparation visible par tous les acteurs (client, restaurant, livreur).
- Approche par quartier pour fiabiliser les délais plutôt qu'une promesse nationale uniforme.
- Données internes propriétaires : popularité, zones chaudes, catégories, délais réels — un actif que les canaux informels n'accumulent jamais.

---

# Partie II — Modèle économique et stratégie commerciale

## 7. Solution et proposition de valeur

Yamo est une marketplace locale à quatre espaces : **Client** (découverte, panier, checkout, suivi), **Restaurant** (menus, images, catégories, disponibilités, commandes, ETA), **Livreur** (tableau de bord, affectation, statut), **Admin** (validation, suivi, statistiques, contrôle qualité).

**Différenciation clé** : Yamo ne doit pas seulement être une app de livraison — elle doit devenir un système opérationnel qui synchronise client, cuisine et livreur autour d'un délai fiable.

| Pour... | Valeur apportée |
|---|---|
| **Les clients** | Commande en quelques clics, menus complets avec images, statuts détaillés (en attente → confirmée → en préparation → prête → en livraison → livrée), estimation fiable, découverte par ville/catégorie/note/prix |
| **Les restaurants** | Plus de commandes sans app propriétaire, gestion simple du menu, confirmation + ETA, moins d'appels et d'erreurs, statistiques (commandes, CA, plats populaires) |
| **Les livreurs** | Missions synchronisées sur l'ETA cuisine, moins d'attente au restaurant, meilleure densité de commandes donc meilleurs revenus |
| **Yamo** | Plateforme multi-acteurs à effets de réseau, données opérationnelles par zone/cuisine, extension possible vers courses, épicerie, boissons, pâtisserie, traiteur, B2B |

## 8. Modèle économique et sources de revenus

1. **Commission restaurant** — taux standard 15 % du montant des plats (fourchette 12–18 % selon volume/exclusivité ; 16–18 % pour le premium/forte demande ; 10–12 % pendant 60 jours pour les restaurants sensibles au prix, en amorçage).
2. **Frais de livraison** — payés par le client selon distance, ville, météo ou heure de pointe ; objectif : couvrir la rémunération livreur + une marge nette cible de **300 à 500 FCFA par commande**.
3. **Abonnements restaurants** :

| Offre | Prix mensuel | Cible | Avantages |
|---|---:|---|---|
| Free | 0 FCFA | Lancement | Commission standard, visibilité normale |
| Pro | 15 000 FCFA | Restaurants actifs | Boost local, stats avancées, support prioritaire |
| Premium | 35 000 FCFA | Chaînes / premium | Mise en avant, shooting photo, rapports, campagnes |

4. **Mise en avant et publicité** — restaurant sponsorisé par quartier, plat populaire mis en avant, campagne week-end/heure de pointe, pack lancement pour nouveaux restaurants.
5. **B2B et commandes groupées** — plateforme entreprises (repas du midi, réunions, événements), frais de service sur commande planifiée, facturation mensuelle.
6. **Services additionnels** — shooting photo menu, packaging partenaire, formation restaurant, création/nettoyage du menu digital.

## 9. Stratégie de prix et unit economics

### Panier et frais côté client

- Plat principal : 3 000–5 000 FCFA · Boisson/dessert : 500–1 500 FCFA · Frais de livraison : 700–1 500 FCFA selon distance.
- **Panier moyen cible année 1 : 5 500 FCFA.**

### Unit economics d'une commande type *(complément — décomposition du revenu net par commande)*

| Poste | Montant | Note |
|---|---:|---|
| Panier moyen | 5 500 FCFA | Hypothèse année 1 |
| Commission restaurant (15 %) | 825 FCFA | Revenu Yamo |
| Frais de livraison facturés au client | ~1 100 FCFA | Variable selon distance |
| Rémunération versée au livreur | ~750 FCFA | Base + bonus éventuel |
| **Marge nette livraison** | **~350 FCFA** | Revenu Yamo |
| **Revenu net Yamo par commande (hors abonnement/pub)** | **~1 175 FCFA** | Commission + marge livraison |
| Coût support alloué par commande | à mesurer dès le lancement | KPI à instrumenter (voir §19) |
| Coût acquisition amorti par commande | à mesurer par cohorte | Dépend du canal (voir §10) |

Ce tableau doit être recalculé chaque mois avec les données réelles (voir §34, hypothèses à valider sur le terrain) : c'est la boussole qui dit si un segment (ville, restaurant, canal marketing) est structurellement rentable ou seulement générateur de volume.

### Restaurants

- 30 premiers jours sans commission ou commission réduite pour signer vite les restaurants vitrines.
- Commission normale après activation ; pack photo gratuit pour les 20 premiers restaurants stratégiques par ville.
- Contrat simple avec règles claires : prix, délais, annulation, disponibilités.

### Livreurs

Rémunération = base par livraison selon distance + bonus heure de pointe + bonus ponctualité/taux d'acceptation, avec une pénalité douce en cas d'annulations abusives après acceptation.

## 10. Stratégie go-to-market

### Phase 0 — Préparation commerciale (2 à 4 semaines)

Finaliser les profils de test, activer les comptes restaurant/livreur/admin, vérifier la couverture catalogue par catégorie, appliquer la migration du temps de préparation en base, définir les zones pilotes de Douala, signer 30 restaurants pilotes, recruter 50 livreurs, créer les scripts support.

### Phase 1 — Lancement Douala (3 mois)

**Objectifs** : 30–50 restaurants actifs · 50–80 livreurs inscrits (25 actifs/jour) · 3 000–5 000 clients inscrits · 300 commandes/jour en fin de phase · taux de livraison réussie > 92 %.

**Canaux** : terrain (restaurants, flyers QR, codes promo quartier), micro-influence food locale, TikTok/Instagram (vidéos courtes de plats réels), WhatsApp Business (support + relance), parrainage client↔client et restaurant↔restaurant.

### Phase 2 — Douala + Yaoundé (mois 4 à 9)

**Objectifs** : 120 restaurants actifs · 150 livreurs actifs · 30 000 clients inscrits · 1 500 commandes/jour en fin de phase.

**Actions** : ouverture Yaoundé par zones (Bastos, Essos, Mvan, Biyem-Assi, Odza), mise en place d'un responsable ville, dashboards opérationnels par ville, lancement des comptes entreprises et commandes groupées.

### Phase 3 — Grandes villes (mois 10 à 18)

Ouverture de Bafoussam, Bamenda, Garoua, Maroua, Ngaoundéré selon readiness terrain ; stabilisation qualité avant chaque nouvelle ville ; modèle franchise/partenaire opérationnel par ville si nécessaire (voir §12).

**Critères d'ouverture d'une ville** — 20 restaurants signés · 30 livreurs vérifiés · 1 responsable local · zones de livraison cartographiées · support client disponible · paiement et remboursement testés.

## 11. Stratégie marketing et campagnes

**Angles marketing** : cuisine camerounaise authentique (grillades, poulet DG, eru, ndolé, poisson braisé) · rapidité fiable (le restaurant confirme et annonce l'ETA) · images vraies · prix clairs · soutien aux restaurants locaux.

| Campagne | Mécanique |
|---|---|
| Lancement quartier | Codes promo par zone (AKWA1000, BONA1000, MAKEPE1000), restaurants vitrines, flyers QR |
| Heure du midi | Pack bureau (plat + boisson + livraison réduite), ciblage entreprises/coworking |
| Week-end famille | Menus groupés, grillades, pizza, pâtisserie, jus naturels |
| Rétention | 5ᵉ commande livraison offerte, relance panier abandonné, favoris, notifications promos locales |

## 12. B2B, franchise et partenariats *(complément)*

Ce volet est esquissé dans le business plan (comptes B2B, module traiteur, modèle franchise en Phase 3) mais mérite d'être structuré en amont pour ne pas être improvisé au moment de l'expansion :

- **Offre entreprise** : compte facturé mensuellement, catalogue de restaurants partenaires « pause déjeuner », commande groupée avec fenêtre de livraison unique, reporting de consommation pour l'entreprise cliente.
- **Offre traiteur/événementiel** : précommande à J-2 minimum, acompte ou garantie de paiement, SLA de préparation différent du flux à la commande classique.
- **Modèle franchise/partenaire local** (villes de phase 3) : un opérateur local reprend le rôle de city manager sous contrat, avec accès à un dashboard dédié, un partage de revenu défini contractuellement, et les mêmes obligations de conformité (RLS, KPIs, sanctions) que l'équipe interne — la marque Yamo et les standards de qualité restent non négociables quel que soit l'opérateur.
- **Critère de passage à un modèle franchisé** : ne l'envisager que pour une ville ayant déjà démontré une demande organique (recherches, demandes entrantes) mais où le coût d'implantation d'une équipe interne ne se justifie pas encore économiquement.

---

# Partie III — Opérations et fiabilité de la commande

## 13. Flux opérationnel de la commande

1. Le client passe commande.
2. Le restaurant reçoit la commande à l'état `pending`.
3. Le restaurant confirme (`confirmed`) ou refuse.
4. S'il confirme, il choisit un temps de préparation réaliste (10, 15, 20, 30, 45 min ou personnalisé).
5. Le client voit : confirmée → en préparation → estimation.
6. Le système propose la course au livreur au bon moment, en fonction de `estimated_ready_at` — **jamais avant**, pour éviter l'attente inutile au restaurant.
7. Le livreur arrive au moment où le plat est prêt.
8. Le restaurant marque `ready`.
9. Le livreur récupère (`picked_up`) et livre (`delivering`).
10. Le client confirme ou le système clôture après livraison (`delivered`).

Une commande annulée peut l'être à tout moment par le restaurant, l'admin ou le système (`cancelled`), avec motif obligatoire (voir §22 et §23.4).

## 14. Cycle de vie du profil Restaurant

### Étape 1 — Création du compte
Numéro de téléphone valide, rôle `restaurant` choisi à l'inscription, un numéro ne doit pas créer plusieurs rôles concurrents, compte bloqué tant que la candidature n'est pas approuvée. Contrôles recommandés : normalisation au format `+2376XXXXXXXX`, blocage des numéros déjà liés à un rôle actif, détection des numéros/emails déjà rejetés pour fraude, rate limit OTP/connexion.

### Étape 2 — Soumission de la candidature
**Champs obligatoires** : nom du restaurant, ville, quartier/adresse précise, téléphone professionnel, nom du responsable, notes utiles (spécialités, horaires, capacité, zone).
**Documents minimum** : pièce d'identité du responsable, registre de commerce ou justificatif d'activité si disponible, photo façade/point de vente, photo cuisine (recommandée), photo du responsable (recommandée pour contrôle interne).
**Règles de qualité document** : lisible, non flou, nom cohérent, téléphone joignable, adresse vérifiable, aucun document visiblement modifié.

### Étape 3 — Vérification admin
**Checklist obligatoire avant approbation** : le restaurant existe/est localisable · le téléphone répond · le responsable confirme la candidature · documents lisibles · le nom n'usurpe pas une enseigne connue · l'adresse correspond à la ville/quartier annoncé · le restaurant comprend le principe de confirmation de commande · il accepte les règles de prix/délais/annulation/hygiène.
**Décisions possibles** : approuver et lier à une fiche existante, approuver et créer une fiche fermée par défaut, rejeter avec motif clair, demander un complément.
**Règle importante** : un restaurant nouvellement approuvé reste `is_open = false` tant que menu, images, prix et horaires ne sont pas vérifiés.

### Étape 4 — Activation
**Conditions** : `profiles.is_approved = true` · restaurant lié à `owner_id` · téléphone et adresse complets · horaires renseignés · au moins 8 plats actifs (ou carte cohérente selon le concept) · au moins 80 % des plats avec image appropriée · prix complets · catégories cohérentes · restaurant formé au dashboard.
**Phase probatoire** : 14 jours de surveillance renforcée, visibilité initiale limitée par zone, appel de contrôle après les 5 premières commandes, **suspension automatique recommandée si 3 incidents graves** pendant la phase probatoire.

### Étape 5 — Gestion continue
**Quotidien** : ouvrir/fermer le statut correctement, désactiver les plats indisponibles avant les heures de pointe, confirmer/refuser vite, ETA réaliste, marquer « prêt » seulement si réellement emballé.
**Hebdomadaire** : vérifier prix/photos, nettoyer les plats durablement indisponibles, vérifier horaires, lire les avis, corriger les plats générant des plaintes.

## 15. Cycle de vie du profil Livreur

### Étape 1 — Création du compte
Téléphone valide et joignable, rôle `livreur`, profil bloqué jusqu'à approbation, **aucune livraison possible si `is_suspended = true`**.

### Étape 2 — Soumission candidature
**Champs obligatoires** : nom complet, téléphone, ville principale, quartier de départ habituel, disponibilités approximatives, type de véhicule (moto, vélo, voiture, autre).
**Documents minimum** : pièce d'identité, permis si véhicule motorisé, assurance si applicable, photo du livreur, photo du véhicule, immatriculation si motorisé.
**Vérification physique recommandée** avant activation forte : appel vidéo ou rencontre rapide, contrôle du véhicule et du sac de livraison, test de compréhension des statuts de commande.

### Étape 3 — Vérification admin
Identité cohérente avec le document · téléphone confirmé · photo de profil claire · véhicule cohérent avec la ville d'opération · permis/assurance lisibles si requis · compréhension des règles de récupération/livraison · acceptation des règles cash, ponctualité, respect client, support.
Décisions possibles : approuver, rejeter avec motif, demander des documents complémentaires, marquer « profil à risque » si des éléments restent à vérifier.

### Étape 4 — Activation
Profil approuvé, pas de suspension active, ville opérationnelle ouverte, téléphone confirmé, formation de base terminée, mode de paiement livreur configuré.
**Phase probatoire** : 20 premières livraisons sous surveillance, pas plus de 2 annulations après acceptation, note moyenne minimale 4/5 après 10 avis, retards suivis manuellement.

### Étape 5 — Gestion continue
**Pendant le service** : en ligne uniquement si disponible, téléphone chargé/internet actif, n'accepter que ce qu'il peut honorer, se présenter au restaurant selon `estimated_ready_at`, confirmer la récupération seulement après réception physique, respecter le montant à encaisser, marquer livré seulement après remise effective.
**Interdictions strictes** : confier la commande à un tiers, changer le prix de livraison, demander un supplément non autorisé, garder une commande, marquer livré avant remise, harceler client/bénéficiaire/restaurant, partager les coordonnées client hors livraison.

## 16. Commandes pour un tiers

Yamo supporte le cas où le client commande pour une autre personne.

**Définitions** — Commanditaire : compte qui passe et paie la commande. Bénéficiaire : personne qui la reçoit. Téléphone de paiement et téléphone de livraison peuvent différer.

**Règles obligatoires** : le commanditaire reste responsable de la commande et du paiement · le bénéficiaire doit avoir un nom et un numéro s'il est distinct · le livreur appelle le bénéficiaire s'il est renseigné, sinon le client · support et admin doivent voir les deux identités · les notes ne doivent pas contenir d'informations sensibles inutiles.

**Cas d'usage courants** : parent/enfant, bureau/collègue, cadeau repas, commande dans une autre ville, livraison à une personne malade ou âgée.

**Contrôles recommandés** : avertissement au commanditaire si paiement à la livraison + bénéficiaire différent · option « le bénéficiaire sait-il qu'il devra payer ? » pour le cash · SMS/WhatsApp automatique au bénéficiaire après confirmation.

## 17. Règles opérationnelles pour fiabiliser la commande

### Côté restaurant

**Avant ouverture** : statut ouvert/fermé à jour, horaires du jour, disponibilité des plats, prix, délais moyens connus, téléphone joignable, personnel informé, emballages disponibles.

| Moment | Règle | Délai cible |
|---|---|---:|
| Réception commande | Accepter ou refuser | < 3 min |
| Confirmation | Choisir un ETA réaliste | immédiat |
| Préparation | Respecter l'ETA | selon plat |
| Plat prêt | Marquer prêt uniquement si emballé | immédiat |
| Problème | Contacter support ou refuser proprement | < 5 min |

**Règles critiques** : ne jamais accepter une commande si un plat est indisponible sans solution immédiate · ne jamais marquer « prêt » sans emballage effectif · commencer la préparation dès la confirmation, pas à l'arrivée du livreur · ne jamais modifier oralement une commande avec le livreur sans validation client/support.

**Qualité du menu** — chaque plat doit avoir nom clair, prix exact, catégorie correcte, image représentative, disponibilité à jour. Seuils : minimum 6 plats par grande catégorie active (sauf concept spécialiste), 80 % minimum de plats avec image avant lancement public, 100 % des plats « populaires » avec image, aucun plat sans prix, aucun doublon évident.

**Hygiène et emballage** — cuisine propre, emballage fermé, boissons fermées, séparateur chaud/froid si possible, sauce emballée séparément, sac adapté, aucun plat ouvert remis au livreur. Toute plainte hygiène grave entraîne une **suspension temporaire immédiate** dans l'attente de vérification.

### Côté livreur

**Avant mise en ligne** : téléphone chargé, connexion active, véhicule utilisable, autonomie suffisante, navigation disponible, sac propre, disponibilité réelle d'au moins 30 minutes.

**Acceptation** : uniquement si le livreur peut rejoindre le restaurant rapidement, la zone est accessible, il peut joindre le client/bénéficiaire si besoin, et il accepte le mode de paiement affiché. Le système ne doit jamais envoyer un livreur trop tôt si le repas n'est pas prêt — l'assignation doit être guidée par `estimated_ready_at`.

**Récupération** : vérifier le numéro de commande, le nom du restaurant, le nombre de sacs/boissons ; confirmer la récupération seulement après réception physique ; signaler au support toute attente excessive.

**Livraison** : utiliser l'adresse et le point de repère fournis, appeler le bénéficiaire si applicable, maximum 3 tentatives d'appel en cas d'absence, attendre 5 minutes après contact impossible (sauf consigne support différente), marquer livré seulement après remise, remonter toute adresse douteuse ou conflit de paiement.

**Paiement cash** : montant exact affiché, aucun supplément non autorisé, refus du bénéficiaire de payer → ne pas remettre la commande et contacter le support, monnaie insuffisante → signaler et chercher une solution, cash collecté rapproché avec les rapports livreur.

## 18. Support client et gestion des litiges

**Canaux prioritaires** : WhatsApp Business, chat in-app (à terme), appel pour incidents urgents, email pour restaurants/partenaires.

**Motifs suivis** : retard, plat indisponible, adresse incorrecte, livreur introuvable, paiement échoué, qualité du plat, remboursement.

### Niveaux de gravité

| Niveau | Exemple | Délai de réaction | Responsable |
|---|---|---:|---|
| S1 Critique | vol, agression, fraude paiement, fuite de documents | Immédiat | Opérations + Direction |
| S2 Élevé | commande non livrée, hygiène grave, usurpation de profil | < 30 min | Support senior / Admin |
| S3 Moyen | retard important, mauvais plat, client absent | < 2 h | Support |
| S4 Faible | question menu, petite erreur d'adresse, demande d'info | < 24 h | Support |

### Procédure litige standard

1. Recevoir le signalement.
2. Identifier commande, client, restaurant, livreur.
3. Vérifier statuts et horodatages.
4. Lire notes, ETA, paiement et appels disponibles.
5. Contacter l'acteur manquant.
6. Décider : aucune action, avoir, remboursement, nouvelle livraison, sanction.
7. Documenter la décision.
8. Clôturer avec un message clair.

### Matrice de décision

| Incident | Décision par défaut | Escalade |
|---|---|---|
| Restaurant n'a pas confirmé | Annulation + information client | Répétition → pénalité restaurant |
| Plat indisponible après confirmation | Remplacement avec accord client ou annulation | Répétition → revue du menu |
| Retard restaurant > 20 min | Avoir possible client | Répétition → masquage temporaire |
| Livreur attend trop au restaurant | Avertissement restaurant | Si marqué « prêt » à tort → pénalité |
| Client/bénéficiaire injoignable | 3 appels + 5 min + support | Facturation selon politique cash |
| Livré mais client conteste | Enquête immédiate | Suspension livreur si preuve forte |
| Paiement Mobile Money échoué | Ne pas préparer si paiement obligatoire | Proposer cash si autorisé |
| Mauvaise adresse | Support contacte le client | Frais supplémentaire si long détour |
| Hygiène grave | Suspension temporaire restaurant | Vérification terrain |

## 19. KPIs, seuils d'alerte et alerting automatisé

### Restaurant

| KPI | Cible lancement | Alerte |
|---|---:|---:|
| Temps moyen de confirmation | < 3 min | > 7 min |
| Taux d'acceptation | > 85 % | < 70 % |
| Annulations après confirmation | < 5 % | > 10 % |
| Retard préparation > 15 min | < 10 % | > 20 % |
| Plats avec image | > 80 % | < 60 % |
| Note moyenne | > 4.0 | < 3.5 |
| Plaintes hygiène | 0 | 1 grave |

### Livreur

| KPI | Cible lancement | Alerte |
|---|---:|---:|
| Acceptation des courses proposées | > 60 % | < 35 % |
| Annulation après acceptation | < 5 % | > 10 % |
| Arrivée au restaurant après « prêt » | < 10 min | > 20 min |
| Commandes livrées sans incident | > 95 % | < 90 % |
| Note moyenne | > 4.2 | < 3.7 |
| Litiges cash | < 1 % | > 3 % |

### Commandes

| KPI | Cible | Action si alerte |
|---|---:|---|
| Commandes bloquées `pending` > 10 min | < 3 % | Auto-alerte resto/support |
| Commandes `ready` sans livreur > 15 min | < 5 % | Alerte dispatch |
| Retard total > 30 min | < 10 % | Compensation possible |
| Annulation globale | < 8 % | Analyse par source |
| Paiements échoués | < 3 % | Fallback cash/support |

### Alerting automatisé — spécification à construire *(gap comblé)*

Le manuel des profils de sécurité identifie explicitement l'absence d'alerte automatique sur franchissement de seuil comme un écart prioritaire. Spécification minimale à implémenter avant tout passage à l'échelle :

- **Déclencheurs temps réel** : commande `pending` depuis > 10 min sans action restaurant → notification restaurant + ticket support automatique ; commande `ready` sans livreur assigné depuis > 15 min → alerte dispatch/admin ; 3 annulations livreur en 24h → gel temporaire du pool pour ce livreur en attente de revue.
- **Déclencheurs journaliers (batch)** : calcul quotidien des KPIs par restaurant/livreur/ville, comparaison au seuil d'alerte, génération d'une liste priorisée pour la checklist admin quotidienne (§A.1).
- **Canal de diffusion** : dashboard admin en premier lieu ; relai WhatsApp/email pour les alertes S1/S2 (voir §18) vers le responsable d'astreinte.
- **Traçabilité** : chaque alerte doit produire une entrée journalisée (type, seuil franchi, entité concernée, horodatage) consultable dans l'audit log (§23.4), pour permettre l'analyse rétrospective des incidents récurrents.
- **Priorité produit** : cette brique est classée P0 dans la roadmap technique (§28) — elle conditionne la capacité à ouvrir une deuxième ville sans multiplier les incidents non détectés.

---

# Partie IV — Confiance, sécurité et gouvernance

## 20. Principes directeurs de sécurité

**Règle de base** : aucun restaurant ni livreur ne participe à une commande tant que son identité, sa capacité opérationnelle et ses informations essentielles ne sont pas vérifiées.

1. **Séparation des responsabilités** — le client commande et paie ; le restaurant accepte/prépare/déclare prêt ; le livreur accepte/récupère/livre ; l'admin valide les profils, surveille les anomalies et tranche les litiges ; le support accompagne pendant les incidents. Aucun acteur ne valide seul une action qui le concerne directement (un restaurant ne s'auto-approuve pas, un livreur ne modifie pas son propre statut de suspension, un admin n'approuve pas sans trace).
2. **Vérification avant activation** — création du compte → soumission de candidature → vérification documentaire → contrôle de contact → approbation manuelle → activation progressive. Dans le produit actuel, l'accès au dashboard est bloqué par `RoleGate` tant que `profiles.is_approved` n'est pas vrai ; ce contrôle doit rester non négociable.
3. **Moindre privilège** — restaurant : ses commandes, son menu, ses infos ; livreur : commandes disponibles + livraisons assignées ; client : ses propres commandes ; admin : supervision complète, journalisée.
4. **Traçabilité** — chaque décision importante est horodatée et rattachée à un acteur : candidature soumise, documents reçus, approbation/rejet (avec motif), suspension/réactivation, refus de commande, annulation, litige, remboursement, modification sensible de profil.
5. **Qualité opérationnelle avant croissance** — pas d'ouverture de ville ni de signature massive de partenaires sans fondamentaux stables (menus complets, photos fiables, restaurants réactifs, livreurs disponibles, support joignable, délais mesurés, litiges traités).

## 21. Rôles et séparation des responsabilités

| Rôle | Responsabilités principales | Actions interdites |
|---|---|---|
| Client | Commander, renseigner l'adresse, payer, noter | Fausse adresse, abus de remboursement, harcèlement livreur/resto |
| Restaurant | Menu à jour, accepter/refuser vite, préparer, marquer prêt | Accepter sans stock, changer le prix après commande, retarder volontairement |
| Livreur | Être disponible, accepter, récupérer, livrer, communiquer proprement | Garder une commande, livrer à la mauvaise personne, marquer livré sans livraison |
| Admin | Valider les profils, surveiller les KPIs, suspendre/réactiver, traiter les litiges | Approuver sans preuves, modifier sans motif, partager des documents |
| Support | Informer, calmer l'incident, collecter des preuves, escalader | Promettre un remboursement sans vérification, divulguer des données inutiles |
| Tech/Ops | Maintenir rôles, RLS, logs, alertes, sauvegardes | Bypasser les contrôles en production sans trace |

## 22. Modèle de données et statuts

### Tables et champs clés (schéma Supabase réel)

| Domaine | Données actuelles | Usage opérationnel |
|---|---|---|
| `profiles` | role, phone, is_approved, is_suspended, suspension_reason | Contrôle d'accès et suspension |
| `applications` | type, status, documents, rejection_reason | Candidature restaurant/livreur |
| `restaurants` | owner_id, name, address, phone, hours, is_open | Profil restaurant et disponibilité |
| `menu_items` | restaurant_id, name, price, category, image, is_available | Catalogue client et menu restaurant |
| `orders` | customer_id, restaurant_id, status, total, notes, ETA, recipient | Cycle de commande |
| `deliveries` | order_id, driver_id, status, timestamps | Assignation et livraison |
| `payments` | method, amount, status | Réconciliation paiement |
| `reviews` / `restaurant_reviews` | rating, comment | Qualité post-livraison |
| `driver_payouts` | amount, status, processed_reason | Paiements livreurs |

### Statuts de candidature

| Statut | Signification | Action suivante |
|---|---|---|
| `pending` | Soumise, non vérifiée | Revue admin |
| `approved` | Profil validé | Activation dashboard |
| `rejected` | Refusée | Motif obligatoire, reprise possible selon règle |

### Statuts de commande

| Statut | Responsable | Signification |
|---|---|---|
| `pending` | Restaurant | Reçue, pas encore acceptée |
| `confirmed` | Restaurant | Acceptée avec temps de préparation |
| `preparing` | Restaurant/système | En préparation |
| `ready` | Restaurant | Prête à récupérer |
| `picked_up` | Livreur | Récupérée au restaurant |
| `delivering` | Livreur | En route |
| `delivered` | Livreur/client | Terminée |
| `cancelled` | Restaurant/admin/système | Annulée |

## 23. Sécurité technique transverse

### 23.1 Authentification

En place : OTP ou connexion sécurisée, session expirée régulièrement, rate limit sur les tentatives, blocage temporaire après abus, admin protégé par rôle dédié.
**À ajouter en priorité** : 2FA admin, journal des connexions admin, alerte sur connexions inhabituelles, liste noire téléphone/email/appareil.

### 23.2 RLS et rôles Supabase

Règles attendues : `profiles.role`, `is_approved`, `is_suspended` modifiables uniquement par l'admin · un restaurant ne lit que ses commandes · un livreur ne lit que les commandes disponibles ou assignées · un client ne lit que ses commandes · les documents de candidature sont visibles uniquement par l'admin (et le candidat propriétaire si nécessaire).
**Contrôles à maintenir en continu** : ne jamais exposer la clé `service_role` côté navigateur, les scripts de seed/admin doivent utiliser `.env.server` exclusivement, toute mutation sensible doit être testée avec un compte non-admin avant mise en production.

### 23.3 Données personnelles

Données sensibles : téléphone client, téléphone bénéficiaire, adresse de livraison, documents CNI/permis/assurance, photos personnelles, historique de commande, données de paiement.
Règles : ne collecter que ce qui est utile · ne pas afficher les documents hors espace admin · limiter l'affichage du téléphone au moment utile · masquer partiellement les numéros dans les vues non opérationnelles · archiver/supprimer les documents obsolètes selon la politique interne · ne jamais transmettre de documents dans des groupes WhatsApp non contrôlés.

### 23.4 Audit logs

| Action | Données à journaliser |
|---|---|
| Approbation candidature | admin_id, application_id, décision, date |
| Rejet candidature | admin_id, motif, date |
| Suspension | admin_id, profil_id, motif, durée |
| Réactivation | admin_id, motif, date |
| Modification menu | restaurant_id, champ modifié, ancien/nouveau |
| Annulation commande | acteur, motif, statut précédent |
| Remboursement | admin_id/système, montant, raison |
| Paiement livreur | admin_id, montant, statut |

Ce journal d'audit est classé **priorité P0** (§28) : sans lui, aucune des décisions de sanction ci-dessous n'est défendable en cas de litige ou de contrôle.

## 24. Échelle de sanctions — Restaurant et Livreur

**Principes** : toujours documenter le motif · distinguer erreur ponctuelle et fraude · protéger d'abord le client et la plateforme · offrir une voie de correction quand le risque est faible · suspendre immédiatement en cas de risque sécurité, vol, menace ou fraude.

### Échelle Restaurant *(écart comblé — le manuel de sécurité notait l'absence de suspension restaurant dans le code actuel ; l'échelle ci-dessous, définie dans les processus, doit être portée dans le produit en priorité P0)*

| Niveau | Déclencheur | Action |
|---|---|---|
| Avertissement | Retard ponctuel, menu incomplet | Message + conseil |
| Restriction | Plusieurs retards ou refus | Baisse de visibilité / mode fermé temporaire |
| Suspension courte | Plaintes répétées, hygiène douteuse | 24h à 7 jours + vérification |
| Suspension longue | Fraude, usurpation, hygiène grave | Désactivation + revue direction |
| Résiliation | Récurrence grave, mise en danger | Suppression du partenariat |

> **Constat technique important** : le schéma `profiles` porte déjà `is_suspended` / `suspension_reason` pour tous les rôles, mais l'interface et les garde-fous applicatifs ne permettent actuellement de suspendre qu'un livreur. Tant que la suspension restaurant n'est pas exposée dans le produit (dashboard admin + blocage de réception de commandes), l'échelle ci-dessus reste une procédure manuelle (fermeture forcée, retrait de visibilité) et non un contrôle système — c'est un risque opérationnel à traiter avant tout passage à l'échelle multi-villes.

### Échelle Livreur

| Niveau | Déclencheur | Action |
|---|---|---|
| Avertissement | Retard ponctuel, mauvaise communication | Rappel des règles |
| Restriction | Annulations après acceptation | Masquage temporaire du pool |
| Suspension courte | Retards répétés, comportement irrespectueux | 24h à 7 jours |
| Suspension longue | Commande non livrée, cash non reversé | Enquête + suspension |
| Résiliation | Vol, menace, fraude d'identité | Exclusion définitive |

### Réactivation

Conditions possibles : motif résolu, documents corrigés, formation reprise, engagement documenté, période probatoire définie. Toute réactivation doit être journalisée avec motif et admin responsable.

## 25. Gestion de crise et continuité d'activité *(nouveau — non couvert par les documents sources)*

Les documents sources traitent les incidents unitaires (S1 à S4, §18) mais pas les scénarios de crise transverse. À définir avant le lancement Phase 1 :

- **Panne de paiement mobile money généralisée** (MTN/Orange indisponible) : basculement automatique vers le paiement à la livraison en fallback, communication proactive aux clients en cours de commande, suivi manuel de la réconciliation à la reprise du service.
- **Incident de sécurité (fuite de documents, accès non autorisé)** : procédure de confinement immédiat (révocation d'accès, rotation des clés), notification à la direction sous 1h, évaluation de l'obligation de notification aux personnes concernées selon la sensibilité des données exposées (voir §32, conformité).
- **Incident grave impliquant un livreur ou un client** (accident, agression) : contact immédiat avec les secours si nécessaire, suspension conservatoire du profil concerné dans l'attente des faits, point de contact unique désigné (Opérations + Direction) pour la communication avec les parties prenantes.
- **Panne applicative en heure de pointe** : procédure de communication aux restaurants/livreurs actifs (SMS/WhatsApp direct si le canal in-app est indisponible), main courante des commandes en cours pour éviter les pertes de repas préparés.
- **Principe transverse** : toute crise majeure fait l'objet d'un post-mortem écrit sous 5 jours ouvrés, versé dans la gouvernance documentaire (§36), avec actions correctives assignées et échéance.

---

# Partie V — Produit, technologie et roadmap

## 26. État du produit et priorités techniques

**Base existante** : frontend React/TypeScript/Vite/Tailwind, backend Supabase, données mockées pour fallback/test, scripts de seed catalogue et profils, espaces client/restaurant/livreur/admin, gestion des commandes et des menus, validation admin des candidatures, confirmation et temps de préparation.

**Priorités avant lancement commercial** :

1. **Paiements réels** — MTN Mobile Money, Orange Money, paiement à la livraison en fallback, webhooks et réconciliation.
2. **Temps réel** — Supabase Realtime pour les statuts de commande, notifications client/restaurant/livreur, historique des événements.
3. **Géolocalisation** — adresse client structurée, zones de livraison, distance estimée, carte livreur.
4. **Qualité catalogue** — nom/prix/catégorie/image/disponibilité obligatoires, détection des menus sans image ou des catégories trop vides, statut « à vérifier » pour les nouveaux plats.
5. **Sécurité et rôles** — RLS renforcée, contrôle admin strict, validation documentaire, journal des actions sensibles.
6. **Observabilité** — logs d'incidents commandes, dashboard de conversion checkout, alertes commandes bloquées, suivi du temps moyen par étape.

## 27. Roadmap 18 mois consolidée

| Période | Jalons |
|---|---|
| **Mois 1–2** | Stabiliser catalogue/profils/commandes, appliquer les migrations Supabase restantes, finaliser les paiements de test, signer les restaurants pilotes, recruter les premiers livreurs, mettre en place le support WhatsApp |
| **Mois 3–4** | Lancement public Douala par zones, campagnes QR/influence locale, suivi quotidien des incidents, optimisation du temps de préparation, tableaux de bord opérations |
| **Mois 5–6** | Paiements MTN/Orange Money en production, notifications temps réel, offre Restaurant Pro, première offre B2B entreprises |
| **Mois 7–9** | Ouverture Yaoundé, recrutement city manager, standardisation onboarding restaurants, automatisation de la vérification catalogue |
| **Mois 10–12** | Expansion Bafoussam/Bamenda selon readiness, programme fidélité client, programme performance livreur, reporting financier mensuel complet |
| **Mois 13–18** | Ouverture Garoua/Maroua/Ngaoundéré si KPIs valides, modèle franchise/partenaire local, offres traiteur/entreprise, optimisation analytics pour la prévision de demande |

## 28. Exigences produit à ajouter (P0/P1/P2)

### P0 — Avant un lancement commercial sérieux

Journal d'audit admin · motif obligatoire pour suspension/réactivation · **suspension restaurant exposée dans le produit** (pas seulement livreur) · table `profile_incidents` ou équivalente · alerte commande `pending` trop longtemps · alerte commande `ready` sans livreur · motif d'annulation obligatoire · vérification de la taille/du type des documents côté client et serveur · stockage des documents dans Supabase Storage privé (pas en texte base64 long terme) · politique RLS testée par rôle.

### P1 — Stabilisation opérationnelle

Score qualité restaurant · score fiabilité livreur · auto-masquage restaurant en cas d'incidents répétés · expiration des documents livreur (assurance, permis) · assignation livreur basée sur l'ETA restaurant · preuve de livraison (photo optionnelle ou code court client) · masquage partiel du téléphone hors livraison active · templates SMS/WhatsApp pour le bénéficiaire.

### P2 — Maturité

Détection de fraude multi-comptes · geofencing par ville/quartier · dispatch intelligent par densité · assurance incident partenaire · dashboard qualité hebdomadaire · enquêtes terrain planifiées · contrats numériques signés.

---

# Partie VI — Organisation, finance et financement

## 29. Organisation et équipe

### Équipe minimale au lancement

| Rôle | Nombre | Responsabilités |
|---|---:|---|
| CEO / Operations Lead | 1 | Partenariats, stratégie, qualité opérationnelle |
| Tech Lead | 1 | App, backend, paiements, sécurité |
| Responsable restaurants | 1 | Acquisition et formation restaurants |
| Responsable livreurs | 1 | Recrutement, vérification, planning |
| Support client | 2 | WhatsApp, appels, incidents |
| Marketing terrain | 2 | Activations, QR, influence locale |
| Finance/Admin | 1 (temps partiel) | Réconciliation, paiements, contrats |

### Équipe à 12 mois

City managers Douala et Yaoundé · support niveau 1 et 2 · responsable qualité catalogue · responsable paiement et fraude · data/BI (temps partiel) · account managers restaurants.

### Équipe à 24 mois *(complément — non détaillé dans les sources)*

À ce stade (Phase 3 en cours, plusieurs villes ouvertes), la structure doit se professionnaliser sans perdre l'agilité terrain :

- **Un responsable Confiance & Sécurité dédié**, distinct du Tech Lead, propriétaire de l'échelle de sanctions, de l'audit log et des KPIs de qualité — jusque-là portés de façon diffuse entre Operations et Tech.
- **Un responsable Finance à temps plein**, remplaçant le temps partiel initial, pour piloter la réconciliation multi-villes, les paiements livreurs à volume et le reporting investisseurs.
- **Des city managers pour chaque ville de Phase 2/3 ouverte**, avec un support niveau 1 localisé par fuseau d'activité si les volumes le justifient.
- **Une fonction Legal/Compliance** (interne ou cabinet externe sous mandat régulier) pour suivre les évolutions réglementaires (données personnelles, mobile money, droit du travail des livreurs indépendants).

## 30. Projections financières détaillées

> Hypothèses de pilotage à réviser après 30, 60 et 90 jours de données réelles (voir §34).

### Hypothèses principales

| Hypothèse | Année 1 | Année 2 | Année 3 |
|---|---:|---:|---:|
| Commandes annuelles | 180 000 | 720 000 | 1 320 000 |
| Commandes moyennes/mois | 15 000 | 60 000 | 110 000 |
| Panier moyen | 5 500 FCFA | 5 800 FCFA | 6 000 FCFA |
| Commission moyenne | 15 % | 15 % | 15 % |
| Marge nette livraison/commande | 350 FCFA | 350 FCFA | 350 FCFA |
| Revenus abonnements/pub/B2B | 15 M FCFA | 90 M FCFA | 220 M FCFA |

### Chiffre d'affaires et marge

| Ligne | Année 1 | Année 2 | Année 3 |
|---|---:|---:|---:|
| GMV | 990 M FCFA | 4,176 Md FCFA | 7,920 Md FCFA |
| Commissions restaurants | 148,5 M FCFA | 626,4 M FCFA | 1,188 Md FCFA |
| Marge nette livraison | 63 M FCFA | 252 M FCFA | 462 M FCFA |
| Abonnements/pub/B2B | 15 M FCFA | 90 M FCFA | 220 M FCFA |
| **Revenu net total** | **226,5 M FCFA** | **968,4 M FCFA** | **1,870 Md FCFA** |
| Charges opérationnelles | 260 M FCFA | 720 M FCFA | 1,180 Md FCFA |
| **EBITDA estimé** | **-33,5 M FCFA** | **248,4 M FCFA** | **690 M FCFA** |

### Charges principales — année 1

| Poste | Budget annuel estimé |
|---|---:|
| Équipe et salaires | 84 M FCFA |
| Marketing et acquisition | 54 M FCFA |
| Opérations livreurs et support | 42 M FCFA |
| Technologie, outils, hébergement | 18 M FCFA |
| Shooting photos et catalogue | 12 M FCFA |
| Legal, admin, comptabilité | 10 M FCFA |
| Promotions clients | 30 M FCFA |
| Réserve incidents | 10 M FCFA |
| **Total** | **260 M FCFA** |

### Seuil de rentabilité simplifié

Revenu net moyen hors abonnement par commande : commission (5 500 × 15 % = 825 FCFA) + marge livraison (350 FCFA) = **1 175 FCFA**. Avec 21,7 M FCFA de charges mensuelles moyennes en année 1, le seuil hors abonnements se situe autour de **18 500 commandes/mois, soit ~620 commandes/jour**.

## 31. Besoin de financement

### Option prudente — 12 mois

Besoin recommandé : **290 M FCFA**.

| Usage | Montant |
|---|---:|
| Opérations et équipe | 110 M FCFA |
| Marketing/acquisition | 60 M FCFA |
| Technologie et paiements | 25 M FCFA |
| Support, qualité, formation | 25 M FCFA |
| Promotions lancement | 35 M FCFA |
| Fonds de roulement | 35 M FCFA |

Objectif : financer le lancement Douala, l'ouverture Yaoundé, la stabilisation tech et le support opérationnel.

### Option bootstrap

Budget minimum : **50 à 80 M FCFA**. Approche : Douala uniquement, 20–30 restaurants, paiement à la livraison au démarrage, marketing terrain et WhatsApp, équipe très réduite.
**Risque assumé** : croissance plus lente, qualité de support limitée, difficulté à financer promotions et recrutement livreurs — à documenter explicitement auprès de toute partie prenante avant de choisir cette voie.

## 32. Cadre légal et conformité (Cameroun)

À valider avec un conseil juridique local avant lancement commercial complet — liste de base issue du business plan, structurée ci-dessous par domaine pour en faciliter le suivi :

### Structure et contrats

- Création ou mise à jour de la structure juridique de l'entreprise.
- Contrats restaurants (commission, délais, annulation, résiliation).
- Contrats ou conditions pour livreurs indépendants — **point d'attention** : clarifier le statut (indépendant vs assimilé salarié) au regard du droit du travail camerounais, notamment concernant les avantages liés aux sanctions/suspensions (§24), qui ressemblent à un pouvoir disciplinaire employeur.
- Conditions générales d'utilisation (client, restaurant, livreur).
- Politique de confidentialité, alignée sur les pratiques de collecte décrites en §23.3.

### Données et paiements

- Protection des données personnelles : base légale de la collecte des documents d'identité, durée de conservation, droit d'accès/suppression.
- Conformité paiements mobile money (relation contractuelle avec MTN/Orange, gestion des webhooks, réconciliation).
- Règles fiscales sur commissions et facturation (TVA le cas échéant, facturation aux restaurants et entreprises B2B).

### Opérations et risques

- Gestion des remboursements (politique écrite, alignée sur la matrice de décision §18).
- Assurance ou couverture incidents livraison selon le modèle retenu (accident livreur, produit défectueux, perte de commande).
- Procédure de notification en cas d'incident de sécurité impliquant des données personnelles (à articuler avec §25, gestion de crise).

---

# Partie VII — Pilotage et exécution

## 33. Plan d'action immédiat (90 jours)

**Priorité 1 — Produit** : vérifier que tous les profils fonctionnent (client, restaurant, livreur, admin) · pousser la migration ETA de préparation en base Supabase · tester le flux complet commande→confirmation→ETA→livreur→livraison · ajouter des alertes admin pour commandes bloquées (§19) · renforcer la cohérence typographique et l'accessibilité mobile.

**Priorité 2 — Catalogue** : garantir 6 à 10 plats par catégorie stratégique · garantir des images appropriées sur toutes les catégories (boissons, jus, plats principaux, entrées, desserts, grillades, pâtisseries) · ajouter un statut de qualité catalogue (complet / à vérifier / incomplet) · créer une vérification automatique avant lancement.

**Priorité 3 — Opérations** : définir les zones pilotes de Douala · signer 30 restaurants · recruter 50 livreurs · former les restaurants à confirmer les commandes et choisir un ETA réaliste · préparer les scripts support.

**Priorité 4 — Commercial** : créer la brochure restaurant · créer la grille de commission · créer l'offre de lancement 60 jours · identifier les restaurants vitrines par quartier · mettre en place le programme de parrainage.

**Priorité 5 — Finance** : fixer le budget de lancement à 90 jours · construire le tableau de bord GMV/revenu/marge/burn · définir la politique de remboursement · définir le calendrier de paiement restaurants et livreurs.

## 34. Hypothèses à valider sur le terrain

Avant d'investir fortement, Yamo doit valider empiriquement : le panier moyen réel par ville · le taux de commission accepté par les restaurants · le coût réel de livraison par distance · le temps moyen de préparation par catégorie de plat · le taux d'annulation restaurant · le taux de rétention client après la première commande · le coût d'acquisition client par canal · le nombre de commandes/jour nécessaire pour garder les livreurs actifs.

Ces variables alimentent directement le tableau d'unit economics (§9) — toute dérive significative doit déclencher une révision des hypothèses de projection financière (§30), pas seulement un ajustement marketing.

## 35. Risques et mitigation — matrice consolidée

| Risque | Impact | Mitigation |
|---|---|---|
| Restaurants ne confirment pas vite | Retard, annulations | Alertes (§19), formation, pénalité douce, tableau de bord |
| Menus incomplets | Faible conversion | Contrôle admin, photos obligatoires, filtre sans image |
| Livreurs insuffisants aux heures de pointe | Retards | Planning par zone, bonus peak, pooling de livreurs |
| Paiements mobiles instables | Commandes bloquées | Paiement à la livraison en fallback, réconciliation manuelle, procédure de crise (§25) |
| Fraude commande/livraison | Pertes financières | Vérification téléphone, logs, plafonds, validation admin |
| Mauvaise qualité repas | Perte de confiance | Notation restaurant, support, suspension temporaire (§24) |
| Expansion trop rapide | Opération fragile | Critères d'ouverture par ville (§10), city manager, phasage |
| Pression concurrentielle | Acquisition plus chère | Différenciation locale, qualité catalogue, B2B, exclusivités |
| Suspension restaurant non opérante en production | Incidents graves non contenus | Prioriser P0 §28 avant toute ouverture de nouvelle ville |
| Absence d'alerting automatisé | Détection tardive des dérives | Implémenter la spécification §19 avant Phase 2 |

## 36. Gouvernance documentaire

Ce guide doit être mis à jour :

- À chaque changement majeur du flux de commande.
- À chaque ajout de paiement réel.
- À chaque nouvelle ville ouverte.
- Après tout incident critique (S1) ou toute crise majeure (§25), sous forme de post-mortem intégré.
- Tous les mois pendant les 6 premiers mois de lancement.
- Tous les trimestres ensuite.

**Responsables de mise à jour** : Opérations pour les règles terrain · Tech pour les contrôles produit et sécurité · Support pour les litiges et messages · Direction pour les sanctions graves et la politique commerciale · Finance pour les projections et le besoin de financement.

---

# Partie VIII — Annexes

## A. Checklists opérationnelles

### A.1 Checklist admin quotidienne

- [ ] Vérifier les candidatures en attente.
- [ ] Prioriser les restaurants/livreurs des villes actives.
- [ ] Traiter les litiges ouverts.
- [ ] Revoir les commandes bloquées ou annulées.
- [ ] Vérifier les restaurants avec retards ou annulations.
- [ ] Vérifier les livreurs avec incidents ou suspensions.
- [ ] Contrôler les demandes de paiement livreur.
- [ ] Vérifier les menus sans image ou catégories vides.
- [ ] Documenter toute décision sensible.

### A.2 Checklist restaurant avant ouverture

- [ ] Dashboard accessible.
- [ ] Statut ouvert uniquement si équipe disponible.
- [ ] Plats indisponibles désactivés.
- [ ] Prix à jour.
- [ ] Temps moyen de préparation connu.
- [ ] Emballages disponibles.
- [ ] Téléphone joignable.
- [ ] Personnel informé.

### A.3 Checklist livreur avant mise en ligne

- [ ] Téléphone chargé.
- [ ] Internet actif.
- [ ] GPS fonctionnel.
- [ ] Véhicule prêt.
- [ ] Sac propre.
- [ ] Disponibilité réelle.
- [ ] Comprend sa zone de service.
- [ ] Peut gérer le paiement cash si applicable.

### A.4 Checklist support en cas de retard

- [ ] Identifier le statut exact.
- [ ] Vérifier l'ETA restaurant.
- [ ] Contacter le restaurant si le repas n'est pas prêt.
- [ ] Contacter le livreur si le repas est prêt mais non récupéré.
- [ ] Informer le client avec un délai concret.
- [ ] Proposer un geste commercial si le retard est important.
- [ ] Documenter la cause du retard.

## B. Modèles de messages

**Demande de document manquant** — « Bonjour, votre candidature Yamo est presque complète. Il manque : [document]. Merci de l'ajouter pour que notre équipe puisse finaliser la vérification. »

**Rejet candidature** — « Bonjour, votre candidature Yamo ne peut pas être approuvée pour le moment. Motif : [motif]. Vous pouvez contacter le support si vous souhaitez fournir un complément. »

**Approbation restaurant** — « Bonjour, votre restaurant est approuvé sur Yamo. Avant ouverture publique, merci de compléter le menu, les photos, les prix et les horaires. Notre équipe vous accompagne pour la première mise en ligne. »

**Approbation livreur** — « Bonjour, votre profil livreur est approuvé. Vous pouvez accéder à votre espace livreur. Merci de respecter les consignes de disponibilité, récupération et livraison. »

**Suspension temporaire** — « Bonjour, votre profil Yamo est temporairement suspendu. Motif : [motif]. Notre équipe vous contactera pour la suite. Merci de ne pas créer de nouveau compte pendant la vérification. »

**Retard commande client** — « Votre commande est toujours suivie par Yamo. Le retard vient de [restaurant/livraison]. Nouvelle estimation : [délai]. Merci pour votre patience. »

## C. Glossaire des statuts et rôles

- **Commanditaire** — compte connecté qui passe et paie la commande.
- **Bénéficiaire** — personne qui reçoit la commande, potentiellement distincte du commanditaire.
- **ETA (`estimated_ready_at`)** — estimation du moment où le plat sera prêt, déclarée par le restaurant, utilisée pour synchroniser l'assignation du livreur.
- **RLS (Row Level Security)** — mécanisme Supabase restreignant l'accès aux lignes de données selon le rôle et l'identité de l'utilisateur.
- **RoleGate** — composant applicatif bloquant l'accès au dashboard tant que `profiles.is_approved` n'est pas vrai.
- **City manager** — responsable opérationnel local d'une ville, garant des KPIs et de la qualité du réseau restaurants/livreurs sur sa zone.
- **Phase probatoire** — période de surveillance renforcée suivant l'activation d'un profil restaurant (14 jours) ou livreur (20 premières livraisons).

## D. Sources et références

- Banque mondiale, données pays Cameroun : https://data.worldbank.org/country/cameroon
- Banque mondiale, page pays Cameroun : https://www.worldbank.org/en/country/cameroon/overview
- GSMA Inclusive Digital Finance et Mobile Money : https://www.gsma.com/mobilefordevelopment/mobile-money/
- Données publiques sur Douala, rôle économique et population indicative : https://en.wikipedia.org/wiki/Douala
- Documentation interne du projet Yamo : `business-plan-yamo.md`, `manuel-profils-securite-yamo.md`, `processus-securises-yamo.md`, README.md et structure applicative locale.

---

*Fin du guide stratégique consolidé. Les sections marquées « complément » ou « nouveau » comblent des manques identifiés lors de la fusion des trois documents sources ; elles doivent être validées et affinées par la Direction et l'équipe Tech avant d'être considérées comme normatives au même titre que le reste du document.*
