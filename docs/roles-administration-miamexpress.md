# Roles et privileges d'administration - MiamExpress

Date de reference : 20 juillet 2026  
Projet : MiamExpress - livraison premium au Cameroun  
Objectif : definir une organisation realiste des profils d'administration, leurs privileges, leurs limites, les workflows de validation et les garde-fous de securite.

---

## 1. Vision generale

L'administration de MiamExpress ne doit pas reposer sur un seul profil "admin" qui peut tout faire.
Le projet gere plusieurs familles sensibles :

- clients ;
- restaurants ;
- livreurs ;
- commandes ;
- avis et commentaires ;
- paiements, commissions et soldes ;
- donnees demo et donnees reelles ;
- validations, suspensions et litiges.

Il faut donc mettre en place un modele d'administration base sur des roles, des permissions et des perimetres.

Le modele recommande est un RBAC avec perimetre :

- RBAC : Role Based Access Control, c'est-a-dire des permissions groupees par role.
- Perimetre : limitation possible par ville, restaurant, equipe ou module.
- Audit : chaque action sensible doit etre historisee.

Exemple :

- un Super Admin peut tout voir et tout modifier ;
- un Responsable Ville peut gerer uniquement Douala ou Yaounde ;
- un agent Support peut aider un client mais ne peut pas modifier les commissions ;
- un agent Finance peut gerer les paiements mais ne peut pas valider un livreur ;
- un Gestionnaire Livreurs peut valider un livreur mais ne peut pas supprimer un restaurant.

---

## 2. Principes directeurs

### 2.1 Separation des responsabilites

Chaque profil doit avoir uniquement les droits necessaires a sa mission.
Cela reduit les erreurs, les abus et les manipulations accidentelles.

Exemple :

- le Support Client ne doit pas avoir acces aux parametres systeme ;
- Finance ne doit pas pouvoir changer le statut d'une commande livree ;
- Gestion Livreurs ne doit pas modifier les menus des restaurants ;
- Moderation ne doit pas pouvoir creer un administrateur.

### 2.2 Perimetre geographique

MiamExpress opere par ville. Les roles operationnels doivent pouvoir etre limites a une ou plusieurs villes.

Exemples de perimetres :

- toutes les villes ;
- Douala uniquement ;
- Yaounde uniquement ;
- Bafoussam uniquement ;
- Kribi uniquement ;
- Limbe uniquement.

### 2.3 Traçabilite obligatoire

Toute action importante doit produire une ligne d'audit.

Exemples :

- validation d'un restaurant ;
- rejet d'un livreur ;
- suspension d'un client ;
- modification d'une commission ;
- annulation manuelle d'une commande ;
- remboursement ;
- suppression ou masquage d'un avis ;
- creation d'un compte administrateur ;
- changement de role d'un administrateur.

Chaque ligne d'audit doit contenir :

- identifiant de l'admin ;
- role de l'admin au moment de l'action ;
- action realisee ;
- type d'objet concerne ;
- identifiant de l'objet concerne ;
- ancienne valeur ;
- nouvelle valeur ;
- motif obligatoire pour les actions sensibles ;
- date et heure ;
- adresse IP si disponible ;
- user agent si disponible.

### 2.4 Donnees BD comme source de verite

Les donnees affichees dans l'administration doivent provenir de la base de donnees.
L'administration ne doit pas afficher des compteurs inventes, des notes simulees ou des donnees mockees en environnement VPS/production.

Cela concerne notamment :

- nombre d'avis ;
- note moyenne ;
- nombre de commandes ;
- nombre de clients ;
- statut d'un restaurant ;
- statut d'un livreur ;
- soldes ;
- commissions ;
- disponibilite des livreurs ;
- restaurants soumis ;
- livreurs soumis ;
- nouveaux clients.

### 2.5 Validation explicite des partenaires

Un restaurant ou un livreur ne doit pas devenir actif sans statut clair.
Il faut distinguer :

- soumis ;
- en cours de verification ;
- valide ;
- rejete ;
- suspendu ;
- archive.

### 2.6 Moins de suppression, plus d'archivage

Pour un produit de livraison, supprimer definitivement une entite peut casser l'historique.
Il vaut mieux privilegier :

- suspension ;
- desactivation ;
- archivage ;
- masquage ;
- soft delete.

La suppression definitive doit rester reservee au Super Admin.

---

## 3. Roles recommandes

### 3.1 Liste courte a mettre en place au lancement

Pour un lancement propre, les roles minimum recommandes sont :

| Role | Priorite | Pourquoi |
|---|---:|---|
| Super Admin | P0 | Necessaire pour gerer tout le systeme |
| Admin General | P0 | Necessaire pour piloter l'operationnel complet |
| Responsable Ville | P0 | Necessaire si plusieurs villes sont actives |
| Gestion Restaurants | P0 | Necessaire pour valider et suivre les restaurants |
| Gestion Livreurs | P0 | Necessaire pour valider et suivre les livreurs |
| Support Client | P0 | Necessaire pour gerer clients, questions et litiges |
| Dispatcher Commandes | P1 | Tres utile pour affecter et suivre les livraisons |
| Finance | P1 | Necessaire des que les paiements deviennent reguliers |
| Moderation Qualite | P1 | Necessaire quand les avis et plaintes augmentent |
| Analyste Lecture Seule | P2 | Utile pour reporting sans risque operationnel |

### 3.2 Roles complets recommandes

| Code | Profil | Niveau | Perimetre possible |
|---|---|---:|---|
| `super_admin` | Super Admin | 100 | Global |
| `admin_general` | Admin General | 90 | Global ou multi-villes |
| `city_manager` | Responsable Ville | 80 | Une ou plusieurs villes |
| `restaurant_manager` | Gestion Restaurants | 70 | Global, ville ou portefeuille |
| `courier_manager` | Gestion Livreurs | 70 | Global, ville ou zone |
| `support_agent` | Support Client | 60 | Global, ville ou equipe |
| `dispatcher` | Dispatcher Commandes | 60 | Ville ou zone |
| `finance_manager` | Finance / Comptabilite | 75 | Global ou ville |
| `quality_moderator` | Moderation & Qualite | 55 | Global ou ville |
| `readonly_analyst` | Analyste Lecture Seule | 30 | Global ou ville |

Le niveau sert uniquement d'indication de sensibilite.
Les permissions reelles doivent etre explicites et non deduites uniquement du niveau.

---

## 4. Description detaillee des profils

## 4.1 Super Admin

### Mission

Le Super Admin est le proprietaire operationnel et technique de la plateforme.
Il gere les droits, les parametres critiques, les roles, les acces et les actions irreversibles.

### Peut faire

- acceder a tous les modules ;
- creer, modifier, suspendre ou archiver un administrateur ;
- attribuer ou retirer des roles ;
- changer le perimetre d'un administrateur ;
- gerer les villes et zones ;
- valider ou suspendre restaurants et livreurs ;
- voir tous les clients ;
- voir toutes les commandes ;
- gerer les parametres systeme ;
- modifier les commissions globales ;
- consulter tous les journaux d'audit ;
- executer des actions de maintenance ;
- lancer ou relancer certains scripts controles, si expose dans l'admin ;
- debloquer une commande ou un compte ;
- supprimer definitivement une entite si la loi et la politique interne l'autorisent.

### Ne devrait pas faire au quotidien

- traiter toutes les commandes une par une ;
- gerer tous les tickets clients ;
- faire le dispatch quotidien ;
- valider manuellement chaque petit changement de menu.

Le Super Admin doit rester un role de controle, pas le role utilise pour toutes les operations courantes.

### Actions sensibles

Les actions suivantes doivent exiger confirmation et motif :

- changement de role d'un administrateur ;
- suspension d'un administrateur ;
- suppression definitive ;
- modification des commissions globales ;
- changement de configuration paiement ;
- export complet des donnees clients ;
- reinitialisation forcee d'un mot de passe ;
- annulation massive de commandes ;
- modification manuelle de donnees financieres.

---

## 4.2 Admin General

### Mission

L'Admin General pilote les operations de la plateforme sans gerer les droits les plus sensibles.
Il peut remplacer temporairement plusieurs profils operationnels, mais ne doit pas avoir les memes privileges que le Super Admin.

### Peut faire

- voir tous les tableaux de bord operationnels ;
- voir clients, restaurants, livreurs et commandes ;
- valider ou rejeter un restaurant soumis ;
- valider ou rejeter un livreur soumis ;
- suspendre temporairement un client, un livreur ou un restaurant ;
- reactiver un profil suspendu selon les regles ;
- modifier les informations operationnelles d'un restaurant ;
- modifier les informations operationnelles d'un livreur ;
- affecter ou reaffecter une commande ;
- annuler une commande selon conditions ;
- gerer les litiges simples ;
- consulter les avis et signalements ;
- masquer un avis abusif avec motif ;
- consulter les statistiques globales ;
- exporter des rapports operationnels limites.

### Ne peut pas faire

- creer un Super Admin ;
- modifier son propre role ;
- modifier les permissions systeme ;
- supprimer definitivement des donnees ;
- modifier les parametres techniques critiques ;
- changer les taux de commission globaux sans validation Super Admin ;
- acceder aux secrets techniques ;
- manipuler directement la base de donnees depuis l'interface.

### Perimetre

Par defaut global, mais il peut etre limite a certaines villes si l'entreprise grandit.

---

## 4.3 Responsable Ville

### Mission

Le Responsable Ville gere les operations d'une ville precise.
Il est responsable de la qualite locale : restaurants actifs, livreurs disponibles, commandes, incidents et satisfaction client.

### Peut faire dans sa ville

- voir les restaurants de sa ville ;
- voir les restaurants soumis dans sa ville ;
- valider ou rejeter un restaurant de sa ville si la politique l'autorise ;
- voir les livreurs de sa ville ;
- voir les livreurs soumis dans sa ville ;
- valider ou rejeter un livreur de sa ville si la politique l'autorise ;
- voir les clients actifs dans sa ville ;
- voir les nouveaux clients de sa ville ;
- suivre les commandes locales ;
- affecter ou reaffecter un livreur ;
- gerer les retards et incidents locaux ;
- suspendre temporairement un livreur local ;
- proposer la suspension d'un restaurant ;
- consulter les avis lies aux restaurants et livreurs de sa ville ;
- consulter les performances locales.

### Ne peut pas faire

- voir les donnees d'une ville hors perimetre ;
- modifier les commissions globales ;
- creer des administrateurs globaux ;
- supprimer definitivement ;
- exporter toutes les donnees nationales ;
- changer des parametres systeme ;
- modifier les roles.

### KPIs principaux

- temps moyen d'acceptation restaurant ;
- temps moyen d'assignation livreur ;
- temps moyen de livraison ;
- taux d'annulation ;
- taux de commandes en retard ;
- taux de restaurants actifs ;
- taux de livreurs disponibles ;
- satisfaction client locale ;
- nombre de nouveaux clients.

---

## 4.4 Gestion Restaurants

### Mission

Ce profil gere le cycle de vie des restaurants : inscription, verification, validation, activation, suivi qualite, suspension et mise a jour des informations.

### Peut faire

- voir les restaurants soumis ;
- voir les restaurants valides ;
- voir les restaurants rejetes ;
- voir les restaurants suspendus ;
- creer un restaurant depuis l'admin ;
- valider directement un restaurant cree par l'admin ;
- passer un restaurant soumis en verification ;
- approuver un restaurant ;
- rejeter un restaurant avec motif ;
- demander des pieces complementaires ;
- modifier les informations du restaurant ;
- modifier l'adresse, ville et zone ;
- modifier les horaires ;
- modifier les contacts operationnels ;
- verifier les documents ;
- activer ou desactiver temporairement l'affichage public ;
- suspendre temporairement un restaurant selon regles ;
- consulter les commandes du restaurant ;
- consulter les avis du restaurant ;
- consulter les performances du restaurant ;
- aider a corriger les menus, photos et descriptions.

### Ne peut pas faire

- modifier les donnees financieres globales ;
- changer les roles admin ;
- voir les informations sensibles des livreurs hors besoin ;
- rembourser une commande sans role finance ou support autorise ;
- supprimer definitivement un restaurant ;
- modifier les notes ou le nombre d'avis manuellement ;
- inventer des compteurs ou forcer une note commerciale.

### Champs qu'il peut modifier

- nom commercial ;
- description ;
- type de cuisine ;
- adresse ;
- ville ;
- quartier ;
- latitude / longitude ;
- telephone professionnel ;
- email professionnel ;
- horaires ;
- statut ouvert / ferme ;
- temps de preparation moyen ;
- frais de livraison si configurable ;
- images ;
- menu et disponibilite des plats ;
- tags operationnels.

### Champs sensibles limites

Ces champs doivent etre limites ou exiger validation superieure :

- taux de commission ;
- coordonnees de paiement ;
- proprietaire legal ;
- documents officiels ;
- suppression du compte ;
- historique de paiement.

---

## 4.5 Gestion Livreurs

### Mission

Ce profil gere l'onboarding, la validation, l'activite, la disponibilite et la qualite des livreurs.

### Peut faire

- voir les livreurs soumis ;
- voir les livreurs valides ;
- voir les livreurs rejetes ;
- voir les livreurs suspendus ;
- creer un livreur depuis l'admin ;
- valider directement un livreur cree par l'admin ;
- passer un livreur soumis en verification ;
- approuver un livreur ;
- rejeter un livreur avec motif ;
- demander des pieces complementaires ;
- modifier les informations operationnelles du livreur ;
- verifier les documents ;
- affecter une ville ou une zone ;
- activer ou desactiver un livreur ;
- suspendre temporairement un livreur ;
- consulter les livraisons effectuees ;
- consulter les notes et avis du livreur ;
- consulter les incidents de livraison ;
- consulter la disponibilite ;
- gerer les niveaux ou badges de performance si le systeme en contient.

### Ne peut pas faire

- modifier les taux de commission globaux ;
- modifier les soldes financiers sans role finance ;
- supprimer definitivement un livreur ;
- changer les roles admin ;
- masquer des avis clients sans role moderation ;
- modifier manuellement le nombre de commandes effectuees ;
- inventer les performances d'un livreur.

### Champs qu'il peut modifier

- nom ;
- telephone ;
- ville ;
- zone principale ;
- moyen de transport ;
- plaque ou identifiant vehicule ;
- disponibilite ;
- statut operationnel ;
- documents de verification ;
- contact d'urgence ;
- commentaire interne.

### Champs sensibles limites

- informations de paiement ;
- historique financier ;
- sanctions graves ;
- suppression definitive ;
- modification massive des statistiques.

---

## 4.6 Support Client

### Mission

Le Support Client aide les clients, traite les questions, suit les commandes problematiques et gere les litiges simples.

### Peut faire

- rechercher un client ;
- voir les nouveaux clients ;
- voir les clients demo et reels ;
- consulter le profil client ;
- consulter l'historique des commandes ;
- consulter les avis laisses par le client ;
- consulter les tickets ou plaintes ;
- contacter le client via les canaux prevus ;
- ajouter une note interne ;
- aider a corriger une adresse ;
- signaler une commande problematique ;
- demander une reaffectation livreur ;
- annuler une commande dans une fenetre autorisee ;
- proposer un remboursement ;
- appliquer un geste commercial limite si autorise ;
- bloquer temporairement un client abusif avec motif, selon politique.

### Ne peut pas faire

- valider un restaurant ;
- valider un livreur ;
- modifier les commissions ;
- modifier les soldes ;
- supprimer un compte ;
- changer un role administrateur ;
- modifier une note restaurant ;
- modifier un avis sans role moderation ;
- exporter toute la base client.

### Donnees client visibles

Le support peut voir :

- nom ;
- telephone ;
- email si disponible ;
- ville ;
- adresses de livraison ;
- commandes ;
- statuts de commande ;
- incidents ;
- tickets ;
- date d'inscription ;
- statut nouveau client ;
- statut bloque ou actif.

Les donnees tres sensibles doivent etre masquees ou limitees :

- moyens de paiement complets ;
- tokens ;
- informations techniques de session ;
- donnees non necessaires au support.

---

## 4.7 Dispatcher Commandes

### Mission

Le Dispatcher pilote les commandes en temps reel.
Il s'assure que chaque commande acceptée par un restaurant a un livreur disponible et que les retards sont traites rapidement.

### Peut faire

- voir les commandes en cours ;
- filtrer par ville, quartier, statut, retard ;
- voir les livreurs disponibles ;
- affecter un livreur a une commande ;
- reaffecter un livreur ;
- changer certains statuts operationnels ;
- marquer un incident de livraison ;
- contacter restaurant ou livreur via les outils prevus ;
- consulter la carte de livraison ;
- prioriser une commande ;
- signaler une commande bloquee au support ou admin general.

### Ne peut pas faire

- valider un restaurant ;
- valider un livreur ;
- modifier les prix ;
- modifier les commissions ;
- rembourser directement ;
- supprimer une commande ;
- modifier l'historique d'une commande livree ;
- acceder a tous les rapports financiers.

### Statuts qu'il peut manipuler

Selon le systeme existant, il peut agir sur :

- en attente d'assignation ;
- assignee ;
- acceptee par livreur ;
- recuperee ;
- en cours de livraison ;
- livree ;
- incident ;
- retard.

Les statuts paiement et remboursement doivent rester hors perimetre dispatcher.

---

## 4.8 Finance / Comptabilite

### Mission

Finance gere les commissions, paiements, soldes, remboursements et exports comptables.

### Peut faire

- consulter les revenus ;
- consulter les commissions ;
- consulter les paiements clients ;
- consulter les soldes restaurants ;
- consulter les soldes livreurs ;
- valider un paiement sortant ;
- exporter les rapports financiers ;
- consulter les remboursements ;
- approuver certains remboursements ;
- marquer un paiement comme traite si connecte a une preuve ;
- rapprocher paiement et commande ;
- consulter les historiques financiers.

### Ne peut pas faire

- modifier un menu ;
- valider un livreur sans role supplementaire ;
- valider un restaurant sans role supplementaire ;
- affecter les commandes au quotidien ;
- changer un avis ;
- supprimer un client ;
- changer les roles admin ;
- modifier les statuts operationnels sans justification financiere.

### Actions sensibles

Les actions suivantes doivent etre auditees et souvent confirmees :

- modification de commission ;
- paiement sortant ;
- remboursement ;
- correction manuelle de solde ;
- export financier ;
- changement d'information de paiement restaurant/livreur.

---

## 4.9 Moderation & Qualite

### Mission

Moderation & Qualite protege la confiance sur la plateforme :
avis, commentaires, plaintes, comportements abusifs, qualite restaurants, qualite livreurs.

### Peut faire

- consulter les avis clients ;
- consulter les commentaires restaurants ;
- consulter les commentaires livreurs ;
- masquer un avis abusif ;
- restaurer un avis masque ;
- traiter les signalements ;
- ajouter une note de moderation ;
- proposer une sanction ;
- suspendre temporairement un avis ou commentaire ;
- consulter les incidents repetes ;
- suivre les restaurants a faible note ;
- suivre les livreurs a faible note ;
- signaler un profil a l'Admin General.

### Ne peut pas faire

- modifier la note moyenne manuellement ;
- modifier le nombre d'avis ;
- inventer des avis ;
- supprimer definitivement un avis sans droit eleve ;
- rembourser ;
- modifier les commissions ;
- valider un restaurant sans role supplementaire ;
- valider un livreur sans role supplementaire.

### Regles de moderation recommandees

Un avis peut etre masque si :

- injure grave ;
- menace ;
- contenu discriminatoire ;
- donnees personnelles ;
- spam ;
- faux avis manifeste ;
- commentaire sans lien avec la commande ;
- tentative de chantage.

Un avis ne doit pas etre masque simplement parce qu'il est negatif.

---

## 4.10 Analyste Lecture Seule

### Mission

L'Analyste consulte les donnees pour suivre la performance, sans pouvoir modifier l'operationnel.

### Peut faire

- voir les dashboards ;
- voir les statistiques ;
- exporter certains rapports anonymises ou limites ;
- consulter les volumes de commandes ;
- consulter les performances par ville ;
- consulter les tendances clients ;
- consulter les performances restaurants ;
- consulter les performances livreurs.

### Ne peut pas faire

- modifier une commande ;
- modifier un client ;
- valider un restaurant ;
- valider un livreur ;
- changer un statut ;
- acceder aux donnees sensibles completes ;
- gerer les paiements ;
- gerer les roles.

---

## 5. Matrice de permissions globale

Legende :

- `A` : acces total ;
- `M` : modification autorisee ;
- `V` : visualisation seule ;
- `L` : limite par perimetre ou condition ;
- `N` : non autorise.

| Module / Action | Super Admin | Admin General | Resp. Ville | Restos | Livreurs | Support | Dispatcher | Finance | Moderation | Analyste |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Dashboard global | A | A | L | L | L | L | L | V | V | V |
| Gestion admins | A | N | N | N | N | N | N | N | N | N |
| Attribution roles | A | N | N | N | N | N | N | N | N | N |
| Parametres systeme | A | L | N | N | N | N | N | N | N | N |
| Villes et zones | A | M | L | V | V | V | V | V | V | V |
| Restaurants soumis | A | M | L | M | V | V | V | V | V | V |
| Creation restaurant admin | A | M | L | M | N | N | N | N | N | N |
| Validation restaurant | A | M | L | M | N | N | N | N | N | N |
| Suspension restaurant | A | M | L | L | N | N | N | N | L | N |
| Menus restaurant | A | M | L | M | N | N | V | N | V | V |
| Livreurs soumis | A | M | L | V | M | V | V | V | V | V |
| Creation livreur admin | A | M | L | N | M | N | N | N | N | N |
| Validation livreur | A | M | L | N | M | N | N | N | N | N |
| Suspension livreur | A | M | L | N | M | N | L | N | L | N |
| Clients | A | M | L | N | N | M | L | V | L | V |
| Nouveaux clients | A | M | L | N | N | M | L | V | V | V |
| Commandes | A | M | L | V | V | L | M | V | V | V |
| Assignation livreur | A | M | L | N | L | L | M | N | N | N |
| Annulation commande | A | M | L | N | N | L | L | L | N | N |
| Remboursement | A | L | N | N | N | L | N | M | N | N |
| Avis et commentaires | A | M | L | V | V | V | N | V | M | V |
| Moderation avis | A | M | L | N | N | N | N | N | M | N |
| Paiements | A | L | V | N | N | N | N | M | N | V |
| Commissions | A | L | V | N | N | N | N | M | N | V |
| Exports operationnels | A | M | L | L | L | L | N | V | V | V |
| Exports financiers | A | L | N | N | N | N | N | M | N | L |
| Journaux d'audit | A | V | L | N | N | N | N | V | V | V |
| Suppression definitive | A | N | N | N | N | N | N | N | N | N |

---

## 6. Permissions detaillees par module

## 6.1 Module Restaurants

### Permissions recommandees

| Permission | Description | Roles autorises |
|---|---|---|
| `restaurants.view` | Voir la liste des restaurants | Super Admin, Admin General, Responsable Ville, Gestion Restaurants, Support en lecture |
| `restaurants.view_submitted` | Voir les restaurants soumis | Super Admin, Admin General, Responsable Ville, Gestion Restaurants |
| `restaurants.create` | Creer un restaurant depuis l'admin | Super Admin, Admin General, Gestion Restaurants |
| `restaurants.create_approved` | Creer et valider directement | Super Admin, Admin General, Gestion Restaurants |
| `restaurants.update_profile` | Modifier informations publiques | Super Admin, Admin General, Responsable Ville, Gestion Restaurants |
| `restaurants.update_menu` | Modifier menus et plats | Super Admin, Admin General, Gestion Restaurants |
| `restaurants.approve` | Valider un restaurant soumis | Super Admin, Admin General, Responsable Ville, Gestion Restaurants |
| `restaurants.reject` | Rejeter avec motif | Super Admin, Admin General, Responsable Ville, Gestion Restaurants |
| `restaurants.suspend` | Suspendre temporairement | Super Admin, Admin General, Responsable Ville sous condition |
| `restaurants.reactivate` | Reactiver | Super Admin, Admin General, Gestion Restaurants sous condition |
| `restaurants.archive` | Archiver | Super Admin, Admin General |
| `restaurants.delete` | Suppression definitive | Super Admin uniquement |
| `restaurants.documents.view` | Voir documents | Super Admin, Admin General, Gestion Restaurants |
| `restaurants.documents.validate` | Valider documents | Super Admin, Admin General, Gestion Restaurants |
| `restaurants.finance.view` | Voir donnees finance restaurant | Super Admin, Finance |
| `restaurants.finance.update` | Modifier donnees paiement | Super Admin, Finance avec audit |

### Statuts restaurant

| Statut | Signification | Visible public ? |
|---|---|---|
| `draft` | Cree mais incomplet | Non |
| `submitted` | Soumis par le restaurant | Non |
| `under_review` | En verification | Non |
| `approved` | Valide administrativement | Oui si actif |
| `active` | Visible et commandable | Oui |
| `inactive` | Cache temporairement | Non |
| `rejected` | Refuse | Non |
| `suspended` | Suspendu apres probleme | Non |
| `archived` | Conserve pour historique | Non |

### Workflow restaurant soumis

1. Restaurant cree son compte ou est ajoute par admin.
2. Statut initial : `submitted` ou `draft`.
3. Gestion Restaurants verifie les informations.
4. Si dossier incomplet : `under_review` avec demande de pieces.
5. Si conforme : `approved`, puis `active`.
6. Si non conforme : `rejected` avec motif.
7. Si probleme apres validation : `suspended`.

### Creation directe par admin

Quand l'admin cree un restaurant et veut le valider directement :

- le formulaire doit exiger les champs minimum ;
- l'action doit produire une ligne d'audit ;
- le statut peut passer directement a `approved` ou `active` ;
- un motif ou commentaire interne doit etre enregistre ;
- le restaurant doit apparaitre dans la liste des restaurants valides ;
- il ne doit pas apparaitre comme soumis sauf si l'admin choisit explicitement "en attente".

---

## 6.2 Module Livreurs

### Permissions recommandees

| Permission | Description | Roles autorises |
|---|---|---|
| `couriers.view` | Voir livreurs | Super Admin, Admin General, Responsable Ville, Gestion Livreurs, Dispatcher |
| `couriers.view_submitted` | Voir livreurs soumis | Super Admin, Admin General, Responsable Ville, Gestion Livreurs |
| `couriers.create` | Creer un livreur depuis admin | Super Admin, Admin General, Gestion Livreurs |
| `couriers.create_approved` | Creer et valider directement | Super Admin, Admin General, Gestion Livreurs |
| `couriers.update_profile` | Modifier profil operationnel | Super Admin, Admin General, Responsable Ville, Gestion Livreurs |
| `couriers.approve` | Valider un livreur | Super Admin, Admin General, Responsable Ville, Gestion Livreurs |
| `couriers.reject` | Rejeter un livreur | Super Admin, Admin General, Responsable Ville, Gestion Livreurs |
| `couriers.suspend` | Suspendre livreur | Super Admin, Admin General, Responsable Ville, Gestion Livreurs |
| `couriers.reactivate` | Reactiver livreur | Super Admin, Admin General, Gestion Livreurs |
| `couriers.documents.view` | Voir documents | Super Admin, Admin General, Gestion Livreurs |
| `couriers.documents.validate` | Valider documents | Super Admin, Admin General, Gestion Livreurs |
| `couriers.availability.update` | Modifier disponibilite | Super Admin, Admin General, Gestion Livreurs, Dispatcher sous condition |
| `couriers.performance.view` | Voir performances | Super Admin, Admin General, Responsable Ville, Gestion Livreurs, Dispatcher |
| `couriers.finance.view` | Voir soldes livreurs | Super Admin, Finance |
| `couriers.finance.update` | Modifier paiement livreur | Super Admin, Finance |

### Statuts livreur

| Statut | Signification | Peut recevoir commandes ? |
|---|---|---|
| `draft` | Profil incomplet | Non |
| `submitted` | Candidature envoyee | Non |
| `under_review` | Verification en cours | Non |
| `approved` | Valide administrativement | Non si pas disponible |
| `available` | Disponible | Oui |
| `busy` | En livraison | Non pour nouvelle commande selon logique |
| `offline` | Hors ligne | Non |
| `rejected` | Refuse | Non |
| `suspended` | Suspendu | Non |
| `archived` | Archive | Non |

### Workflow livreur soumis

1. Livreur cree son compte ou est ajoute par admin.
2. Statut initial : `submitted`.
3. Gestion Livreurs verifie documents, ville, transport et telephone.
4. Si complet : `approved`.
5. Quand il se connecte et active sa disponibilite : `available`.
6. En course : `busy`.
7. Hors service volontaire : `offline`.
8. Probleme grave : `suspended`.

### Creation directe par admin

Quand l'admin cree un livreur et le valide directement :

- les champs minimum doivent etre remplis ;
- ville et zone doivent etre definies ;
- le moyen de transport doit etre precise ;
- statut peut passer directement a `approved` ;
- disponibilite reste `offline` tant que le livreur n'est pas pret ;
- l'action doit etre auditee.

---

## 6.3 Module Clients

### Permissions recommandees

| Permission | Description | Roles autorises |
|---|---|---|
| `customers.view` | Voir clients | Super Admin, Admin General, Responsable Ville, Support, Analyste lecture |
| `customers.view_new` | Voir nouveaux clients | Super Admin, Admin General, Responsable Ville, Support |
| `customers.update_profile` | Corriger infos simples | Super Admin, Admin General, Support |
| `customers.block` | Bloquer temporairement | Super Admin, Admin General, Support sous condition |
| `customers.unblock` | Debloquer | Super Admin, Admin General |
| `customers.orders.view` | Voir commandes client | Super Admin, Admin General, Responsable Ville, Support |
| `customers.notes.create` | Ajouter note interne | Super Admin, Admin General, Support |
| `customers.export` | Export clients | Super Admin, Admin General limite, Analyste anonymise |
| `customers.delete` | Suppression definitive | Super Admin uniquement, selon politique donnees |

### Visibilite des nouveaux clients

Un nouveau client doit etre visible dans l'administration des son inscription.

Champs utiles :

- nom ;
- telephone ;
- email si disponible ;
- ville ;
- date d'inscription ;
- statut : nouveau, actif, bloque ;
- nombre de commandes ;
- derniere commande ;
- source si disponible ;
- tag demo ou reel.

### Regles recommandees

- Un client demo doit etre identifiable comme demo.
- Un nouveau client reel ne doit pas etre confondu avec un client demo.
- Le tableau admin doit permettre de filtrer :
  - nouveaux clients ;
  - clients sans commande ;
  - clients avec commande ;
  - clients bloques ;
  - clients demo ;
  - clients reels.

---

## 6.4 Module Commandes

### Permissions recommandees

| Permission | Description | Roles autorises |
|---|---|---|
| `orders.view` | Voir commandes | Super Admin, Admin General, Responsable Ville, Support, Dispatcher, Finance lecture |
| `orders.view_live` | Voir commandes en temps reel | Super Admin, Admin General, Responsable Ville, Dispatcher |
| `orders.assign_courier` | Affecter livreur | Super Admin, Admin General, Responsable Ville, Dispatcher |
| `orders.reassign_courier` | Reaffecter livreur | Super Admin, Admin General, Responsable Ville, Dispatcher |
| `orders.update_status` | Modifier statut operationnel | Super Admin, Admin General, Responsable Ville, Dispatcher |
| `orders.cancel` | Annuler commande | Super Admin, Admin General, Support limite, Responsable Ville limite |
| `orders.refund_request` | Demander remboursement | Super Admin, Admin General, Support |
| `orders.refund_approve` | Approuver remboursement | Super Admin, Finance |
| `orders.incident.create` | Creer incident | Super Admin, Admin General, Responsable Ville, Support, Dispatcher |
| `orders.manual_price_adjustment` | Ajustement prix | Super Admin, Finance sous condition |

### Statuts commande recommandes

| Statut | Signification | Roles pouvant agir |
|---|---|---|
| `created` | Commande creee | Systeme, Support |
| `pending_payment` | Paiement en attente | Systeme, Finance |
| `paid` | Paiement confirme | Systeme, Finance |
| `sent_to_restaurant` | Transmise au restaurant | Systeme, Dispatcher |
| `accepted_by_restaurant` | Acceptee par restaurant | Restaurant, Admin |
| `rejected_by_restaurant` | Refusee par restaurant | Restaurant, Admin |
| `preparing` | En preparation | Restaurant |
| `ready_for_pickup` | Prete | Restaurant, Dispatcher |
| `assigned_to_courier` | Livreur assigne | Dispatcher |
| `picked_up` | Recuperee | Livreur, Dispatcher |
| `on_the_way` | En livraison | Livreur, Dispatcher |
| `delivered` | Livree | Livreur, Systeme |
| `cancelled` | Annulee | Admin, Support selon condition |
| `refunded` | Remboursee | Finance |
| `incident` | Probleme | Support, Dispatcher, Admin |

### Regles importantes

- Une commande livree ne doit pas etre modifiable librement.
- Une annulation doit avoir un motif.
- Une reaffectation livreur doit etre historisee.
- Un remboursement doit etre separe de l'annulation operationnelle.
- Les commandes personnalisees doivent avoir un statut clair :
  - soumise ;
  - acceptee ;
  - refusee ;
  - non aboutie ;
  - convertie en commande standard ;
  - livree.

---

## 6.5 Module Avis et commentaires

### Permissions recommandees

| Permission | Description | Roles autorises |
|---|---|---|
| `reviews.view` | Voir les avis | Super Admin, Admin General, Responsable Ville, Support, Moderation |
| `reviews.summary.view` | Voir notes et resumés | Tous les admins lecture selon perimetre |
| `reviews.moderate` | Masquer/restaurer avis | Super Admin, Admin General, Moderation |
| `reviews.reply` | Repondre a un avis | Restaurant autorise, Admin General, Moderation |
| `reviews.recalculate` | Recalculer resumes depuis DB | Super Admin, Admin General technique |
| `reviews.delete` | Suppression definitive | Super Admin uniquement |

### Regle source de verite

Les valeurs suivantes doivent venir uniquement de la base de donnees :

- note moyenne ;
- nombre d'avis ;
- repartition 1 a 5 etoiles ;
- avis recents ;
- avis verifies ;
- notes livreurs ;
- notes restaurants.

Si aucun avis reel n'existe, l'interface doit afficher :

- note : `0` ou message "aucun avis" selon design ;
- nombre d'avis : `0` ;
- liste : vide ;
- aucun faux commentaire.

---

## 6.6 Module Finance

### Permissions recommandees

| Permission | Description | Roles autorises |
|---|---|---|
| `finance.dashboard.view` | Voir dashboard finance | Super Admin, Finance |
| `finance.orders.view` | Voir paiements commandes | Super Admin, Finance |
| `finance.commissions.view` | Voir commissions | Super Admin, Finance, Admin General lecture |
| `finance.commissions.update` | Modifier commissions | Super Admin, Finance avec validation |
| `finance.payouts.view` | Voir paiements sortants | Super Admin, Finance |
| `finance.payouts.create` | Creer paiement sortant | Finance |
| `finance.payouts.approve` | Approuver paiement | Super Admin ou Finance senior |
| `finance.refunds.view` | Voir remboursements | Super Admin, Finance, Support limite |
| `finance.refunds.approve` | Approuver remboursement | Super Admin, Finance |
| `finance.export` | Export financier | Super Admin, Finance |

### Garde-fous

- Toute modification financiere doit etre auditee.
- Les exports doivent etre limites aux roles autorises.
- Les soldes ne doivent pas etre modifies sans motif.
- Les remboursements doivent etre rattaches a une commande.
- Les paiements sortants doivent etre rattaches a un livreur ou restaurant.

---

## 7. Workflows operationnels cles

## 7.1 Restaurant soumis puis valide

1. Restaurant s'inscrit.
2. Le restaurant apparait dans Admin > Restaurants > Soumis.
3. Gestion Restaurants ouvre le dossier.
4. Il verifie :
   - nom ;
   - ville ;
   - adresse ;
   - telephone ;
   - type de cuisine ;
   - horaires ;
   - photos ;
   - menu minimum ;
   - documents si requis.
5. Si incomplet : statut `under_review`.
6. Si refuse : statut `rejected`, motif obligatoire.
7. Si accepte : statut `approved`.
8. Si le restaurant doit etre visible immediatement : statut `active`.
9. Audit obligatoire.

## 7.2 Restaurant cree par admin et valide directement

1. Admin clique "Creer restaurant".
2. Il remplit les champs obligatoires.
3. Il choisit :
   - enregistrer comme brouillon ;
   - creer en attente ;
   - creer et valider directement.
4. Si "creer et valider directement" :
   - statut `approved` ou `active` ;
   - motif ou note interne obligatoire ;
   - audit obligatoire.
5. Le restaurant apparait dans la liste des restaurants valides.

## 7.3 Livreur soumis puis valide

1. Livreur s'inscrit.
2. Il apparait dans Admin > Livreurs > Soumis.
3. Gestion Livreurs verifie :
   - identite ;
   - telephone ;
   - ville ;
   - moyen de transport ;
   - zone ;
   - documents ;
   - disponibilite initiale.
4. Si incomplet : `under_review`.
5. Si refuse : `rejected`, motif obligatoire.
6. Si accepte : `approved`.
7. Le livreur ne recoit des commandes que s'il est `available`.

## 7.4 Livreur cree par admin et valide directement

1. Admin clique "Creer livreur".
2. Il remplit les champs obligatoires.
3. Il choisit "valider directement".
4. Statut administratif : `approved`.
5. Statut disponibilite : `offline` par defaut.
6. Audit obligatoire.
7. Le livreur apparait dans la liste des livreurs valides.

## 7.5 Nouveau client visible

1. Client cree un compte.
2. La ligne client est creee en base.
3. Le client apparait immediatement dans Admin > Clients.
4. Il est tague `nouveau` tant qu'il n'a pas encore de commande ou pendant une duree configuree.
5. Si c'est un compte demo, il est tague `demo`.
6. Le support peut filtrer nouveaux clients, clients demo et clients reels.

## 7.6 Commande avec incident

1. Client passe commande.
2. Restaurant accepte.
3. Dispatcher affecte livreur.
4. Livreur recupere.
5. Incident declare : retard, client absent, restaurant ferme, mauvais article, adresse incorrecte.
6. Support ou Dispatcher ajoute un motif.
7. Selon cas :
   - reaffectation ;
   - annulation ;
   - remboursement demande ;
   - livraison continue ;
   - ticket support ouvert.
8. Tout changement de statut est historise.

---

## 8. Regles de securite par action sensible

| Action | Confirmation | Motif | Audit | Role minimum |
|---|---:|---:|---:|---|
| Creer admin | Oui | Oui | Oui | Super Admin |
| Changer role admin | Oui | Oui | Oui | Super Admin |
| Suspendre admin | Oui | Oui | Oui | Super Admin |
| Creer restaurant valide | Oui | Oui | Oui | Gestion Restaurants |
| Rejeter restaurant | Oui | Oui | Oui | Gestion Restaurants |
| Suspendre restaurant | Oui | Oui | Oui | Admin General |
| Creer livreur valide | Oui | Oui | Oui | Gestion Livreurs |
| Rejeter livreur | Oui | Oui | Oui | Gestion Livreurs |
| Suspendre livreur | Oui | Oui | Oui | Gestion Livreurs |
| Bloquer client | Oui | Oui | Oui | Support senior |
| Annuler commande | Oui | Oui | Oui | Support / Dispatcher selon cas |
| Rembourser | Oui | Oui | Oui | Finance |
| Modifier commission | Oui | Oui | Oui | Finance senior / Super Admin |
| Masquer avis | Oui | Oui | Oui | Moderation |
| Supprimer definitivement | Oui | Oui | Oui | Super Admin |

---

## 9. Modele technique recommande

## 9.1 Tables recommandees

### `admin_roles`

| Champ | Type recommande | Description |
|---|---|---|
| `id` | uuid ou serial | Identifiant role |
| `code` | text unique | Code technique du role |
| `name` | text | Nom lisible |
| `description` | text | Description |
| `level` | integer | Niveau indicatif |
| `is_system` | boolean | Role systeme non supprimable |
| `created_at` | timestamp | Creation |
| `updated_at` | timestamp | Modification |

### `admin_permissions`

| Champ | Type recommande | Description |
|---|---|---|
| `id` | uuid ou serial | Identifiant permission |
| `code` | text unique | Ex : `restaurants.approve` |
| `module` | text | Module |
| `description` | text | Description |
| `is_sensitive` | boolean | Exige motif/audit |

### `admin_role_permissions`

| Champ | Type recommande | Description |
|---|---|---|
| `role_id` | fk | Role |
| `permission_id` | fk | Permission |
| `created_at` | timestamp | Creation |

### `admin_user_roles`

| Champ | Type recommande | Description |
|---|---|---|
| `admin_user_id` | fk | Admin |
| `role_id` | fk | Role |
| `scope_type` | text | `global`, `city`, `restaurant`, `zone` |
| `scope_id` | text nullable | ID du perimetre |
| `created_by` | fk | Admin createur |
| `created_at` | timestamp | Creation |

### `admin_audit_logs`

| Champ | Type recommande | Description |
|---|---|---|
| `id` | uuid ou serial | Identifiant |
| `admin_user_id` | fk | Admin |
| `admin_role_code` | text | Role au moment de l'action |
| `action` | text | Action |
| `target_type` | text | Type d'objet |
| `target_id` | text | ID objet |
| `old_value` | jsonb | Ancienne valeur |
| `new_value` | jsonb | Nouvelle valeur |
| `reason` | text | Motif |
| `ip_address` | text | IP |
| `user_agent` | text | User agent |
| `created_at` | timestamp | Date |

### `admin_notes`

| Champ | Type recommande | Description |
|---|---|---|
| `id` | uuid ou serial | Identifiant |
| `target_type` | text | client, restaurant, livreur, commande |
| `target_id` | text | ID cible |
| `note` | text | Note interne |
| `visibility` | text | interne, support, direction |
| `created_by` | fk | Admin |
| `created_at` | timestamp | Creation |

## 9.2 Format de permission

Format recommande :

```text
module.action
```

Exemples :

```text
restaurants.view
restaurants.approve
restaurants.suspend
couriers.view_submitted
couriers.approve
customers.view_new
orders.assign_courier
orders.cancel
reviews.moderate
finance.refunds.approve
admin.roles.update
audit.view
```

## 9.3 Verification des permissions cote backend

Chaque route admin sensible doit verifier :

1. utilisateur authentifie ;
2. role admin actif ;
3. permission requise ;
4. perimetre autorise ;
5. statut cible compatible ;
6. motif si action sensible ;
7. ecriture audit.

Exemple logique :

```text
can(admin, "restaurants.approve", restaurant.city_id)
```

La verification ne doit pas etre uniquement cote frontend.
Le backend doit bloquer toute action non autorisee.

---

## 10. Interface admin recommandee

## 10.1 Navigation principale

Menu admin recommande :

- Tableau de bord ;
- Commandes ;
- Restaurants ;
- Livreurs ;
- Clients ;
- Avis & qualite ;
- Finance ;
- Support & litiges ;
- Rapports ;
- Administration ;
- Audit.

L'affichage du menu doit dependre des permissions.
Un profil sans permission Finance ne doit pas voir le menu Finance.

## 10.2 Pages prioritaires

### Dashboard

Afficher selon role :

- commandes du jour ;
- commandes en retard ;
- restaurants actifs ;
- restaurants soumis ;
- livreurs disponibles ;
- livreurs soumis ;
- nouveaux clients ;
- tickets ouverts ;
- avis negatifs recents ;
- chiffre d'affaires si role autorise.

### Restaurants

Onglets :

- Tous ;
- Soumis ;
- En verification ;
- Valides ;
- Actifs ;
- Rejetes ;
- Suspendus.

Actions :

- creer restaurant ;
- creer et valider ;
- modifier ;
- valider ;
- rejeter ;
- suspendre ;
- reactiver ;
- voir commandes ;
- voir avis ;
- voir audit.

### Livreurs

Onglets :

- Tous ;
- Soumis ;
- En verification ;
- Valides ;
- Disponibles ;
- Hors ligne ;
- Suspendus ;
- Rejetes.

Actions :

- creer livreur ;
- creer et valider ;
- modifier ;
- valider ;
- rejeter ;
- suspendre ;
- reactiver ;
- voir courses ;
- voir performance ;
- voir audit.

### Clients

Onglets :

- Tous ;
- Nouveaux ;
- Avec commandes ;
- Sans commande ;
- Demo ;
- Bloques.

Actions :

- voir profil ;
- voir commandes ;
- ajouter note ;
- ouvrir ticket ;
- bloquer ;
- debloquer ;
- contacter.

### Commandes

Onglets :

- En attente ;
- Acceptees ;
- En preparation ;
- Pretes ;
- A assigner ;
- En livraison ;
- Livrees ;
- Annulees ;
- Incidents.

Actions :

- assigner livreur ;
- reassigner ;
- voir details ;
- signaler incident ;
- annuler ;
- demander remboursement ;
- voir audit.

### Avis & qualite

Onglets :

- Tous les avis ;
- Avis restaurants ;
- Avis livreurs ;
- Avis signales ;
- Avis masques ;
- Faibles notes ;
- Sans reponse.

Actions :

- masquer ;
- restaurer ;
- repondre ;
- ajouter note interne ;
- signaler profil.

---

## 11. Politique de perimetre

## 11.1 Perimetres supportes

| Type | Description | Exemple |
|---|---|---|
| `global` | Acces national | Super Admin |
| `city` | Acces ville | Responsable Douala |
| `zone` | Acces quartier/zone | Dispatcher Bonapriso |
| `restaurant` | Acces restaurant precis | Manager restaurant |
| `team` | Acces equipe support | Support niveau 1 |

## 11.2 Regles

- Un admin peut avoir plusieurs roles.
- Un admin peut avoir plusieurs perimetres.
- Le perimetre le plus restrictif doit s'appliquer.
- Un role global doit etre rare.
- Un admin ne doit pas pouvoir elargir son propre perimetre.
- Un Responsable Ville ne doit pas voir les details operationnels d'une autre ville.

---

## 12. Niveaux de support recommandes

### Support Niveau 1

Peut :

- voir clients ;
- voir commandes ;
- ajouter notes ;
- repondre aux questions simples ;
- signaler incident.

Ne peut pas :

- rembourser ;
- suspendre ;
- annuler apres preparation ;
- modifier prix.

### Support Niveau 2

Peut :

- annuler sous conditions ;
- demander remboursement ;
- bloquer temporairement un client abusif ;
- traiter litiges simples ;
- escalader a Finance ou Admin General.

### Support Senior

Peut :

- traiter litiges complexes ;
- approuver gestes commerciaux limites ;
- recommander suspension ;
- coordonner avec dispatcher et finance.

---

## 13. Sanctions et escalade

## 13.1 Restaurants

| Niveau | Mesure | Decideur |
|---|---|---|
| 1 | Avertissement interne | Gestion Restaurants |
| 2 | Mise sous surveillance | Gestion Restaurants / Responsable Ville |
| 3 | Suspension temporaire | Admin General |
| 4 | Suspension longue | Admin General + Super Admin |
| 5 | Rupture / archivage | Super Admin |

Motifs possibles :

- retards repetes ;
- commandes rejetees trop souvent ;
- faux menu ;
- prix incorrects ;
- mauvais comportement ;
- hygiene ou conformite ;
- plaintes graves ;
- fraude.

## 13.2 Livreurs

| Niveau | Mesure | Decideur |
|---|---|---|
| 1 | Avertissement | Gestion Livreurs |
| 2 | Retrait temporaire de disponibilite | Gestion Livreurs |
| 3 | Suspension courte | Gestion Livreurs / Responsable Ville |
| 4 | Suspension longue | Admin General |
| 5 | Desactivation / archivage | Super Admin |

Motifs possibles :

- retards repetes ;
- commandes abandonnees ;
- mauvais comportement client ;
- fausse livraison ;
- perte de commande ;
- fraude ;
- refus repetes injustifies.

## 13.3 Clients

| Niveau | Mesure | Decideur |
|---|---|---|
| 1 | Note interne | Support |
| 2 | Avertissement | Support |
| 3 | Blocage temporaire | Support senior |
| 4 | Suspension | Admin General |
| 5 | Archivage / restriction longue | Super Admin |

Motifs possibles :

- fausses commandes ;
- insultes ;
- non-paiement ;
- abus de remboursement ;
- client absent de facon repetee ;
- tentative de fraude.

---

## 14. Donnees demo et administration

Les donnees demo doivent permettre de tester chaque role.

### 14.1 Donnees demo attendues

Pour tester l'administration, prevoir :

- clients demo visibles ;
- nouveaux clients visibles ;
- restaurants soumis ;
- restaurants valides ;
- restaurants rejetes ;
- restaurants suspendus ;
- livreurs soumis ;
- livreurs valides ;
- livreurs suspendus ;
- commandes en cours ;
- commandes livrees ;
- commandes annulees ;
- commandes rejetees ;
- commandes personnalisees reussies ;
- commandes personnalisees non abouties ;
- bons avis ;
- mauvais avis ;
- avis moderes ;
- incidents ;
- remboursements simulables si module finance actif.

### 14.2 Regle importante

Les donnees demo doivent etre marquees comme demo.

Champs possibles :

- `is_demo = true` ;
- `demo_batch` ;
- `created_by_seed` ;
- `demo_scenario`.

Cela permet de :

- filtrer les donnees demo ;
- eviter les doublons ;
- relancer les seeds ;
- ne pas confondre demo et production ;
- nettoyer si necessaire.

---

## 15. Exemples de profils concrets pour l'equipe

### Direction / fondateur

Role recommande :

- Super Admin.

Usage :

- configuration ;
- controle ;
- decisions sensibles ;
- audit.

### Responsable operations national

Role recommande :

- Admin General.

Usage :

- supervision quotidienne ;
- arbitrage ;
- validation finale ;
- suivi KPIs.

### Responsable Douala

Role recommande :

- Responsable Ville avec perimetre Douala.

Usage :

- livreurs Douala ;
- restaurants Douala ;
- commandes Douala ;
- incidents Douala.

### Agent onboarding restaurants

Role recommande :

- Gestion Restaurants.

Usage :

- traiter restaurants soumis ;
- creer restaurants ;
- valider directement si dossier complet ;
- suivre qualite catalogue.

### Agent onboarding livreurs

Role recommande :

- Gestion Livreurs.

Usage :

- traiter livreurs soumis ;
- creer livreurs ;
- valider directement si dossier complet ;
- surveiller performance.

### Agent support

Role recommande :

- Support Client niveau 1 ou 2.

Usage :

- repondre clients ;
- suivre commandes ;
- ouvrir tickets ;
- escalader litiges.

### Agent dispatch

Role recommande :

- Dispatcher.

Usage :

- affecter livreurs ;
- surveiller retards ;
- reaffecter ;
- traiter incidents terrain.

### Comptable

Role recommande :

- Finance.

Usage :

- commissions ;
- soldes ;
- exports ;
- paiements ;
- remboursements.

---

## 16. Priorite d'implementation

## Phase 1 - Minimum solide

Objectif : rendre l'administration exploitable sans risque majeur.

A mettre en place :

- roles de base ;
- permissions backend ;
- affichage menus selon permissions ;
- restaurants soumis ;
- livreurs soumis ;
- clients visibles ;
- nouveaux clients visibles ;
- creation restaurant depuis admin ;
- creation livreur depuis admin ;
- validation directe restaurant/livreur ;
- audit des actions sensibles ;
- filtres par statut.

Roles phase 1 :

- Super Admin ;
- Admin General ;
- Gestion Restaurants ;
- Gestion Livreurs ;
- Support Client ;
- Dispatcher.

## Phase 2 - Organisation multi-ville

Objectif : gerer la croissance.

A mettre en place :

- Responsable Ville ;
- perimetres par ville ;
- dashboards locaux ;
- restrictions par ville ;
- KPIs par ville ;
- exports operationnels par ville.

## Phase 3 - Finance et qualite avancee

Objectif : securiser argent et reputation.

A mettre en place :

- Finance ;
- Moderation ;
- remboursements ;
- commissions ;
- paiements sortants ;
- moderation avis ;
- sanctions ;
- rapports avances ;
- audit consultable.

## Phase 4 - Gouvernance avancee

Objectif : controle mature.

A mettre en place :

- approbation a deux niveaux pour actions critiques ;
- alertes automatiques ;
- detection anomalies ;
- historique detaille par entite ;
- export audit ;
- roles personnalises si necessaire.

---

## 17. Checklist fonctionnelle de validation

### Roles et acces

- [ ] Un Super Admin peut creer un administrateur.
- [ ] Un Admin General ne peut pas creer de Super Admin.
- [ ] Un Support Client ne voit pas Finance.
- [ ] Un Dispatcher ne voit pas Gestion Admins.
- [ ] Un Gestion Restaurants ne peut pas valider un livreur.
- [ ] Un Gestion Livreurs ne peut pas valider un restaurant.
- [ ] Un Responsable Ville ne voit que sa ville.
- [ ] Un Analyste ne peut rien modifier.

### Restaurants

- [ ] Un restaurant soumis apparait dans l'onglet Soumis.
- [ ] Un admin autorise peut valider un restaurant soumis.
- [ ] Un admin autorise peut creer un restaurant valide directement.
- [ ] Un rejet exige un motif.
- [ ] Une suspension exige un motif.
- [ ] Un restaurant suspendu n'est pas commandable.

### Livreurs

- [ ] Un livreur soumis apparait dans l'onglet Soumis.
- [ ] Un admin autorise peut valider un livreur soumis.
- [ ] Un admin autorise peut creer un livreur valide directement.
- [ ] Un rejet exige un motif.
- [ ] Une suspension exige un motif.
- [ ] Un livreur suspendu ne peut pas recevoir de commande.

### Clients

- [ ] Les clients demo sont visibles.
- [ ] Un nouveau client reel est visible apres inscription.
- [ ] Les clients demo sont filtrables.
- [ ] Les nouveaux clients sont filtrables.
- [ ] Le support peut voir l'historique client.

### Commandes

- [ ] Le dispatcher peut voir les commandes en cours.
- [ ] Le dispatcher peut assigner un livreur.
- [ ] Le dispatcher peut reassigner un livreur.
- [ ] Une annulation exige un motif.
- [ ] Une commande livree ne peut pas etre modifiee librement.

### Avis

- [ ] Le nombre d'avis vient de la BD.
- [ ] La note moyenne vient de la BD.
- [ ] Aucun avis invente n'est affiche.
- [ ] Un avis negatif legitime n'est pas masque automatiquement.
- [ ] Un avis masque reste visible dans l'admin moderation.

### Audit

- [ ] Chaque validation restaurant est auditee.
- [ ] Chaque validation livreur est auditee.
- [ ] Chaque suspension est auditee.
- [ ] Chaque remboursement est audite.
- [ ] Chaque changement de role est audite.

---

## 18. Recommandation finale

La structure la plus realiste pour MiamExpress est :

1. un Super Admin tres protege ;
2. un Admin General pour l'exploitation nationale ;
3. des Responsables Ville quand plusieurs villes tournent ;
4. deux roles separes pour onboarding restaurants et livreurs ;
5. un Support Client pour les clients et litiges simples ;
6. un Dispatcher pour les commandes en temps reel ;
7. un Finance pour l'argent ;
8. un Moderation & Qualite pour les avis et la confiance ;
9. un Analyste Lecture Seule pour observer sans risque.

Le point le plus important est de ne jamais lier l'affichage admin a des donnees inventees.
Les restaurants, livreurs, clients, commandes, avis, notes, compteurs et paiements doivent venir de la base de donnees.

Le deuxieme point le plus important est l'audit.
Dans un systeme de livraison, les erreurs humaines arrivent vite.
L'audit permet de comprendre, corriger et proteger l'entreprise.

Le troisieme point est la limitation par ville.
Elle rend l'administration beaucoup plus saine quand Douala, Yaounde, Bafoussam, Kribi et Limbe tournent en parallele.
