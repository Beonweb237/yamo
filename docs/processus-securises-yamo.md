# Yamo - Processus securises pour profils Restaurant, Livreur et qualite des commandes

Version: 2.0  
Date: 14 juillet 2026  
Proprietaire: Operations, Confiance & Securite Yamo  
Portee: restaurants, livreurs, admins, support, commandes, documents, incidents

## 1. Objectif du document

Ce document definit l'ensemble des processus securises a appliquer pour gerer les profils Restaurant et Livreur sur Yamo, depuis la candidature jusqu'a la suspension, afin que les commandes se passent de maniere fiable, rapide et traçable.

Il sert a trois usages:

- Former l'equipe admin, support, restaurant et livreur.
- Standardiser les decisions: approbation, rejet, suspension, reactivation.
- Transformer les exigences operationnelles en controles produit a implementer dans l'application.

La regle de base est simple: aucun restaurant ni livreur ne doit participer a une commande tant que son identite, sa capacite operationnelle et ses informations essentielles ne sont pas verifiees.

## 2. Principes directeurs

### 2.1 Separation des responsabilites

- Le client commande et paie.
- Le restaurant accepte, prepare et declare la commande prete.
- Le livreur accepte, recupere et livre.
- L'admin valide les profils, surveille les anomalies et tranche les litiges.
- Le support accompagne les clients, restaurants et livreurs pendant les incidents.

Aucun acteur ne doit pouvoir valider seul une action qui le concerne directement. Par exemple, un restaurant ne s'auto-approuve pas; un livreur ne modifie pas son statut de suspension; un admin ne doit pas approuver une candidature sans trace.

### 2.2 Verification avant activation

Tout profil Restaurant ou Livreur doit passer par:

1. Creation du compte.
2. Soumission de candidature.
3. Verification documentaire.
4. Controle des informations de contact.
5. Approbation manuelle.
6. Activation progressive.

Dans le produit actuel, l'acces au dashboard est bloque par `RoleGate` tant que `profiles.is_approved` n'est pas vrai. Ce controle doit rester obligatoire.

### 2.3 Moindre privilege

Chaque profil accede uniquement aux donnees necessaires:

- Restaurant: ses commandes, son menu, ses informations restaurant.
- Livreur: les commandes disponibles et ses livraisons assignees.
- Client: ses propres commandes.
- Admin: supervision complete avec journalisation.

### 2.4 Traçabilite

Chaque decision importante doit etre horodatee et rattachee a un acteur:

- Candidature soumise.
- Documents reçus.
- Candidature approuvee ou rejetee.
- Motif de rejet.
- Suspension ou reactivation.
- Refus de commande.
- Annulation.
- Litige.
- Remboursement.
- Modification sensible de profil.

### 2.5 Qualite operationnelle avant croissance

Yamo ne doit pas ouvrir une ville ou signer massivement des partenaires si les fondamentaux ne sont pas stables:

- Menus complets.
- Photos fiables.
- Restaurants reactifs.
- Livreurs disponibles.
- Support joignable.
- Delais mesures.
- Litiges traites.

## 3. Roles et responsabilites

| Role | Responsabilites principales | Actions interdites |
|---|---|---|
| Client | Commander, renseigner adresse, payer, noter | Fausse adresse, abus remboursement, harcelement livreur/resto |
| Restaurant | Tenir menu a jour, accepter/refuser vite, preparer, marquer pret | Accepter sans stock, changer prix apres commande, retarder volontairement |
| Livreur | Etre disponible, accepter, recuperer, livrer, communiquer proprement | Garder une commande, livrer a mauvaise personne, marquer livre sans livraison |
| Admin | Valider profils, surveiller KPIs, suspendre/reactiver, traiter litiges | Approuver sans preuves, modifier sans motif, partager documents |
| Support | Informer, calmer incident, collecter preuves, escalader | Promettre remboursement sans verification, divulguer donnees inutiles |
| Tech/Ops | Maintenir roles, RLS, logs, alertes, sauvegardes | Bypasser controles en production sans trace |

## 4. Donnees et statuts existants dans l'application

### 4.1 Tables et champs clefs

| Domaine | Donnees actuelles | Usage operationnel |
|---|---|---|
| `profiles` | role, phone, is_approved, is_suspended, suspension_reason | controle d'acces et suspension |
| `applications` | type, status, documents, rejection_reason | candidature restaurant/livreur |
| `restaurants` | owner_id, name, address, phone, hours, is_open | profil restaurant et disponibilite |
| `menu_items` | restaurant_id, name, price, category, image, is_available | catalogue client et menu restaurant |
| `orders` | customer_id, restaurant_id, status, total, notes, ETA, recipient | cycle de commande |
| `deliveries` | order_id, driver_id, status, timestamps | assignation et livraison |
| `payments` | method, amount, status | reconciliation paiement |
| `reviews` / `restaurant_reviews` | rating, comment | qualite post-livraison |
| `driver_payouts` | amount, status, processed_reason | paiements livreurs |

### 4.2 Statuts de candidature

| Statut | Signification | Action suivante |
|---|---|---|
| `pending` | candidature soumise, non verifiee | revue admin |
| `approved` | profil valide | activation dashboard |
| `rejected` | profil refuse | motif obligatoire, reprise possible selon regle |

### 4.3 Statuts de commande

| Statut | Responsable | Signification |
|---|---|---|
| `pending` | restaurant | commande recue, pas encore acceptee |
| `confirmed` | restaurant | commande acceptee avec temps de preparation |
| `preparing` | restaurant/systeme | repas en preparation |
| `ready` | restaurant | repas pret a recuperer |
| `picked_up` | livreur | commande recuperee au restaurant |
| `delivering` | livreur | en route vers client/beneficiaire |
| `delivered` | livreur/client | commande terminee |
| `cancelled` | restaurant/admin/systeme | commande annulee |

## 5. Cycle de vie d'un profil Restaurant

### 5.1 Etape 1 - Creation du compte

Exigences:

- Numero de telephone valide.
- Role `restaurant` choisi a l'inscription.
- Un numero ne doit pas creer plusieurs roles concurrents.
- Le compte reste bloque tant que la candidature n'est pas approuvee.

Controles recommandes:

- Normaliser les numeros au format Cameroun: `+2376XXXXXXXX` ou format numerique equivalent.
- Bloquer les numeros deja lies a un autre role actif.
- Detecter les emails ou numeros deja rejetes pour fraude.
- Ajouter rate limit OTP et connexion.

### 5.2 Etape 2 - Soumission candidature Restaurant

Champs obligatoires:

- Nom du restaurant.
- Ville.
- Quartier/adresse precise.
- Telephone professionnel.
- Nom du responsable.
- Notes utiles: specialites, horaires, capacite, zone.

Documents minimum:

- Piece d'identite du responsable: CNI, passeport ou document reconnu localement.
- Registre de commerce ou justificatif d'activite, si disponible selon le type d'etablissement.
- Photo facade ou point de vente.
- Photo cuisine ou zone de preparation, recommandee.
- Photo du responsable, recommandee pour controle interne.

Regles de qualite document:

- Document lisible.
- Photo non floue.
- Nom coherent avec la declaration.
- Telephone joignable.
- Adresse verifiable.
- Aucun document visiblement modifie.

### 5.3 Etape 3 - Verification admin Restaurant

Checklist admin obligatoire avant approbation:

- Le restaurant existe ou peut etre localise.
- Le numero de telephone repond.
- Le responsable confirme la candidature.
- Les documents sont lisibles.
- Le nom du restaurant n'usurpe pas une enseigne connue.
- L'adresse correspond a la ville/quartier annonce.
- Le restaurant comprend le principe de confirmation de commande.
- Le restaurant accepte les regles de prix, delais, annulation et hygiene.

Decision possible:

- Approuver et lier a un restaurant existant.
- Approuver et creer une fiche restaurant fermee par defaut.
- Rejeter avec motif clair.
- Demander complement avant decision finale.

Regle importante:

Un restaurant nouvellement approuve doit etre `is_open = false` tant que son menu, ses images, ses prix et ses horaires ne sont pas verifies.

### 5.4 Etape 4 - Activation Restaurant

Conditions d'activation publique:

- Profil approuve: `profiles.is_approved = true`.
- Restaurant lie a `owner_id`.
- Telephone restaurant renseigne.
- Adresse complete.
- Horaires renseignes.
- Au moins 8 plats actifs ou une carte coherente selon le type de restaurant.
- Au moins 80% des plats visibles avec image appropriee.
- Prix complets.
- Categories coherentes.
- Restaurant forme au dashboard.

Phase probatoire recommande:

- 14 jours de surveillance renforcee.
- Limite de visibilite initiale par zone.
- Appel de controle apres les 5 premieres commandes.
- Suspension automatique recommandee si 3 incidents graves pendant la phase probatoire.

### 5.5 Etape 5 - Gestion continue Restaurant

Obligations quotidiennes:

- Ouvrir/fermer correctement son statut.
- Desactiver les plats indisponibles avant les heures de pointe.
- Confirmer ou refuser une commande rapidement.
- Renseigner un temps de preparation realiste.
- Marquer la commande prete seulement quand elle est vraiment prete.
- Emballer correctement.
- Refuser plutot qu'accepter une commande impossible.

Obligations hebdomadaires:

- Verifier prix et photos.
- Nettoyer plats indisponibles durablement.
- Verifier horaires et jours de fermeture.
- Lire les avis clients.
- Corriger les plats qui generent des plaintes.

## 6. Cycle de vie d'un profil Livreur

### 6.1 Etape 1 - Creation du compte

Exigences:

- Numero de telephone valide et joignable.
- Role `livreur`.
- Profil bloque jusqu'a approbation.
- Aucune livraison possible si `is_suspended = true`.

### 6.2 Etape 2 - Soumission candidature Livreur

Champs obligatoires:

- Nom complet.
- Telephone.
- Ville principale.
- Quartier de depart habituel.
- Disponibilites approximatives.
- Type de vehicule: moto, velo, voiture, autre.

Documents minimum:

- Piece d'identite.
- Permis si vehicule motorise.
- Assurance du vehicule si applicable.
- Photo du livreur.
- Photo du vehicule.
- Numero d'immatriculation si vehicule motorise.

Verification physique recommandee avant activation forte:

- Appel video ou rencontre rapide.
- Controle du vehicule.
- Controle du sac de livraison si requis.
- Test de comprehension des statuts de commande.

### 6.3 Etape 3 - Verification admin Livreur

Checklist admin obligatoire:

- Identite coherente avec le document.
- Telephone confirme.
- Photo de profil claire.
- Vehicule visible et coherent avec la ville d'operation.
- Permis/assurance lisibles si requis.
- Le livreur comprend les regles de recuperation et livraison.
- Le livreur accepte les regles cash, ponctualite, respect client et support.

Decision possible:

- Approuver.
- Rejeter avec motif.
- Demander documents complementaires.
- Marquer profil a risque si des elements restent a verifier.

### 6.4 Etape 4 - Activation Livreur

Conditions d'activation:

- Profil approuve.
- Pas de suspension active.
- Ville operationnelle ouverte.
- Telephone confirme.
- Formation de base terminee.
- Mode de paiement livreur configure si paiements/commissions requis.

Phase probatoire:

- 20 premieres livraisons sous surveillance.
- Pas plus de 2 annulations apres acceptation.
- Note moyenne minimale: 4/5 apres 10 avis.
- Retards suivis manuellement.

### 6.5 Etape 5 - Gestion continue Livreur

Obligations pendant le service:

- Passer en ligne seulement si disponible.
- Garder telephone charge et internet actif.
- Accepter uniquement les courses qu'il peut honorer.
- Aller au restaurant au bon moment, selon `estimated_ready_at`.
- Confirmer la recuperation uniquement apres reception physique du repas.
- Appeler le client ou beneficiaire seulement si necessaire.
- Respecter le montant a encaisser.
- Marquer livre uniquement apres remise effective.

Interdictions:

- Confier la commande a une autre personne.
- Changer le prix de livraison.
- Demander un supplement non autorise.
- Garder une commande.
- Marquer livre avant remise.
- Harceler le client, le beneficiaire ou le restaurant.
- Partager les coordonnees client hors livraison.

## 7. Gestion des commandes pour quelqu'un d'autre

Yamo supporte le cas ou le client commande pour une autre personne.

Definitions:

- Commanditaire: compte connecte qui passe la commande.
- Beneficiaire: personne qui reçoit la commande.
- Telephone de paiement: numero utilise pour Mobile Money, potentiellement different.
- Telephone de livraison: numero a appeler par le livreur.

Regles obligatoires:

- Le commanditaire reste responsable de la commande et du paiement.
- Le beneficiaire doit avoir un nom et un numero si la commande est pour quelqu'un d'autre.
- Le livreur appelle le beneficiaire si renseigne, sinon le client.
- Le support et l'admin doivent voir commanditaire et beneficiaire.
- Les notes ne doivent pas contenir d'informations sensibles inutiles.

Cas d'usage:

- Parent/enfant.
- Bureau/collegue.
- Cadeau repas.
- Commande dans une autre ville.
- Livraison a une personne malade ou agee.

Risques a gerer:

- Beneficiaire non informe.
- Mauvais numero.
- Adresse incomplete.
- Paiement a la livraison refuse par beneficiaire.
- Commande cadeau ou surprise mal communiquee.

Controle recommande:

- Si paiement a la livraison et beneficiaire different, afficher un avertissement au commanditaire.
- Ajouter une option: "Le beneficiaire sait-il qu'il devra payer ?" quand paiement cash.
- Ajouter SMS/WhatsApp automatique au beneficiaire apres confirmation.

## 8. Regles de fonctionnement Restaurant pour que les commandes se passent bien

### 8.1 Avant ouverture quotidienne

Le restaurant doit verifier:

- Statut ouvert/ferme.
- Horaires du jour.
- Disponibilite des plats.
- Prix.
- Delais moyens de preparation.
- Telephone restaurant joignable.
- Personnel cuisine informe que Yamo est actif.
- Emballages disponibles.

### 8.2 Pendant la commande

| Moment | Regle | Delai cible |
|---|---|---:|
| Reception commande | Accepter ou refuser | moins de 3 min |
| Confirmation | Choisir temps de preparation realiste | immediat |
| Preparation | Respecter l'ETA | selon plat |
| Plat pret | Marquer pret uniquement quand emballe | immediat |
| Probleme | Contacter support ou refuser proprement | moins de 5 min |

Regles critiques:

- Ne jamais accepter une commande si un plat est indisponible sans solution immediate.
- Ne jamais marquer "pret" si le plat n'est pas emballe.
- Ne pas attendre que le livreur arrive pour commencer la preparation si le statut est confirme.
- Ne pas modifier oralement la commande avec le livreur sans validation client/support.

### 8.3 Qualite du menu

Chaque plat doit avoir:

- Nom clair.
- Prix exact.
- Categorie correcte.
- Description courte si necessaire.
- Image representative.
- Disponibilite a jour.
- Statut populaire seulement si justifie.

Seuils recommandes:

- Minimum 6 plats par grande categorie active, sauf concept specialiste.
- 80% minimum de plats avec image avant lancement public.
- 100% des plats populaires avec image.
- Aucun plat sans prix.
- Aucun doublon evident.

### 8.4 Hygiene et emballage

Yamo ne doit pas se substituer aux autorites competentes, mais doit imposer ses standards internes:

- Cuisine propre.
- Emballage ferme.
- Boissons fermees.
- Separateur chaud/froid si possible.
- Sauce emballee separement quand necessaire.
- Sac adapte au transport.
- Pas de plat ouvert remis au livreur.

En cas de plainte hygiene grave, le restaurant doit etre suspendu temporairement jusqu'a verification.

## 9. Regles de fonctionnement Livreur pour que les commandes se passent bien

### 9.1 Avant mise en ligne

Le livreur doit verifier:

- Telephone charge.
- Connexion internet active.
- Vehicule utilisable.
- Essence ou autonomie suffisante.
- Moyen de navigation disponible.
- Sac de livraison propre.
- Disponibilite reelle pendant au moins 30 minutes.

### 9.2 Acceptation d'une livraison

Le livreur doit accepter uniquement si:

- Il peut aller au restaurant rapidement.
- La zone est accessible.
- Il peut joindre le client/beneficiaire si besoin.
- Il accepte le mode de paiement affiche.

Le systeme doit eviter d'envoyer trop tot un livreur si le repas n'est pas pret. Le temps restaurant `estimated_ready_at` doit guider l'assignation.

### 9.3 Recuperation au restaurant

Le livreur doit:

- Verifier le numero de commande.
- Verifier le nom du restaurant.
- Verifier le nombre de sacs/boissons.
- Confirmer recuperation seulement apres reception physique.
- Signaler au support si attente excessive.

Le restaurant doit:

- Remettre une commande emballee.
- Confirmer oralement les elements si necessaire.
- Ne pas changer la destination avec le livreur.

### 9.4 Livraison au client ou beneficiaire

Le livreur doit:

- Utiliser l'adresse et le point de repere fournis.
- Appeler le beneficiaire si la commande est pour quelqu'un d'autre.
- Faire au maximum 3 tentatives d'appel en cas d'absence.
- Attendre 5 minutes apres contact impossible, sauf consigne support differente.
- Marquer livre seulement apres remise.
- Remonter au support toute adresse douteuse ou conflit paiement.

### 9.5 Paiement cash

Regles:

- Montant exact affiche dans l'app.
- Aucun supplement non autorise.
- Si le beneficiaire refuse de payer, ne pas remettre la commande et contacter support.
- En cas de monnaie insuffisante, signaler au support et chercher solution avec client.
- Cash collecte doit etre rapproche avec les rapports livreur.

## 10. Securite technique et controles d'acces

### 10.1 Authentification

Exigences:

- OTP ou connexion securisee.
- Session expiree regulierement.
- Rate limit sur tentatives de connexion.
- Blocage temporaire apres tentatives abusives.
- Admin protege par role dedie.

A ajouter en priorite:

- 2FA admin.
- Journal des connexions admin.
- Alerte sur connexions inhabituelles.
- Liste noire telephone/email/appareil.

### 10.2 RLS et roles Supabase

Regles attendues:

- `profiles.role`, `is_approved`, `is_suspended` modifiables uniquement par admin.
- Un restaurant ne lit que ses commandes.
- Un livreur ne lit que les commandes disponibles ou assignees.
- Un client ne lit que ses commandes.
- Les documents de candidature sont visibles uniquement par admin et candidat proprietaire si necessaire.

Controle a maintenir:

- Ne jamais exposer la cle `service_role` cote navigateur.
- Les scripts de seed/admin doivent utiliser `.env.server` uniquement.
- Toute mutation sensible doit etre testee avec un compte non admin.

### 10.3 Donnees personnelles

Donnees sensibles:

- Telephone client.
- Telephone beneficiaire.
- Adresse de livraison.
- Documents CNI/permis/assurance.
- Photos personnelles.
- Historique commande.
- Donnees paiement.

Regles:

- Ne collecter que ce qui est utile.
- Ne pas afficher les documents hors espace admin.
- Limiter l'affichage du telephone au moment utile.
- Masquer partiellement les numeros dans les vues non operationnelles.
- Supprimer ou archiver les documents obsoletes selon politique interne.
- Ne jamais envoyer les documents dans des groupes WhatsApp non controles.

### 10.4 Audit logs recommandes

A implementer:

| Action | Donnees a journaliser |
|---|---|
| Approbation candidature | admin_id, application_id, decision, date |
| Rejet candidature | admin_id, motif, date |
| Suspension | admin_id, profil_id, motif, duree |
| Reactivation | admin_id, motif, date |
| Modification menu | restaurant_id, champ modifie, ancien/nouveau |
| Annulation commande | acteur, motif, statut precedent |
| Remboursement | admin_id/system, montant, raison |
| Paiement livreur | admin_id, montant, statut |

## 11. Gestion des incidents et litiges

### 11.1 Niveaux de gravite

| Niveau | Exemple | Delai de reaction | Responsable |
|---|---|---:|---|
| S1 Critique | vol, agression, fraude paiement, fuite documents | immediat | Operations + Direction |
| S2 Eleve | commande non livree, hygiene grave, usurpation profil | moins de 30 min | Support senior/Admin |
| S3 Moyen | retard important, mauvais plat, client absent | moins de 2 h | Support |
| S4 Faible | question menu, petite erreur adresse, demande info | moins de 24 h | Support |

### 11.2 Procedure litige standard

1. Recevoir le signalement.
2. Identifier commande, client, restaurant, livreur.
3. Verifier statuts et timestamps.
4. Lire notes, ETA, paiement et appels si disponibles.
5. Contacter l'acteur manquant.
6. Decider: aucune action, avoir, remboursement, nouvelle livraison, sanction.
7. Documenter la decision.
8. Cloturer le litige avec message clair.

### 11.3 Matrice de decision

| Incident | Decision par defaut | Escalade |
|---|---|---|
| Restaurant n'a pas confirme | annulation + information client | si repetition, penalite restaurant |
| Plat indisponible apres confirmation | remplacement avec accord client ou annulation | si repetition, revue menu |
| Retard restaurant > 20 min | avoir possible client | si repetition, masquage temporaire |
| Livreur attend trop au resto | avertissement restaurant | si repas pas pret mais marque pret, penalite |
| Client/beneficiaire injoignable | 3 appels + 5 min + support | facturation selon politique cash |
| Commande marquee livree mais client conteste | enquete immediatement | suspension livreur si preuve forte |
| Paiement Mobile Money echoue | ne pas preparer si paiement obligatoire | proposer cash si autorise |
| Mauvaise adresse | support contacte client | frais supplementaire si long detour |
| Hygiene grave | suspension temporaire restaurant | verification terrain |

## 12. Sanctions, suspension et reactivation

### 12.1 Principes

- Toujours documenter le motif.
- Distinguer erreur ponctuelle et fraude.
- Proteger d'abord le client et la plateforme.
- Donner une voie de correction quand le risque est faible.
- Suspendre immediatement en cas de risque securite, vol, menace ou fraude.

### 12.2 Echelle Restaurant

| Niveau | Declencheur | Action |
|---|---|---|
| Avertissement | retard ponctuel, menu incomplet | message + conseil |
| Restriction | plusieurs retards ou refus | baisse visibilite / mode ferme temporaire |
| Suspension courte | plaintes repetees, hygiene douteuse | 24h a 7 jours + verification |
| Suspension longue | fraude, usurpation, hygiene grave | desactivation + revue direction |
| Resiliation | recurrence grave, mise en danger | suppression partenariat |

### 12.3 Echelle Livreur

| Niveau | Declencheur | Action |
|---|---|---|
| Avertissement | retard ponctuel, mauvaise communication | rappel regles |
| Restriction | annulations apres acceptation | masquage temporaire du pool |
| Suspension courte | retards repetees, comportement irrespectueux | 24h a 7 jours |
| Suspension longue | commande non livree, cash non reverse | enquete + suspension |
| Resiliation | vol, menace, fraude identite | exclusion definitive |

### 12.4 Reactivation

Conditions possibles:

- Motif resolu.
- Documents corriges.
- Formation reprise.
- Engagement ecrit ou verbal documente.
- Periode probatoire definie.

Une reactivation doit etre journalisee avec motif et admin responsable.

## 13. KPIs et seuils d'alerte

### 13.1 Restaurant

| KPI | Cible lancement | Alerte |
|---|---:|---:|
| Temps moyen confirmation | moins de 3 min | plus de 7 min |
| Taux acceptation commande | plus de 85% | moins de 70% |
| Annulations apres confirmation | moins de 5% | plus de 10% |
| Retard preparation > 15 min | moins de 10% | plus de 20% |
| Plats avec image | plus de 80% | moins de 60% |
| Note moyenne restaurant | plus de 4.0 | moins de 3.5 |
| Plaintes hygiene | 0 | 1 grave |

### 13.2 Livreur

| KPI | Cible lancement | Alerte |
|---|---:|---:|
| Acceptation courses proposees | plus de 60% | moins de 35% |
| Annulation apres acceptation | moins de 5% | plus de 10% |
| Arrivee au restaurant apres pret | moins de 10 min | plus de 20 min |
| Commandes livrees sans incident | plus de 95% | moins de 90% |
| Note moyenne livreur | plus de 4.2 | moins de 3.7 |
| Litiges cash | moins de 1% | plus de 3% |

### 13.3 Commandes

| KPI | Cible | Action si alerte |
|---|---:|---|
| Commandes bloquees `pending` > 10 min | moins de 3% | auto-alerte resto/support |
| Commandes `ready` sans livreur > 15 min | moins de 5% | alerte dispatch |
| Retard total > 30 min | moins de 10% | compensation possible |
| Annulation globale | moins de 8% | analyse par source |
| Paiements echoues | moins de 3% | fallback cash/support |

## 14. Checklists operationnelles

### 14.1 Checklist admin quotidienne

- [ ] Verifier candidatures en attente.
- [ ] Prioriser les restaurants/livreurs des villes actives.
- [ ] Traiter les litiges ouverts.
- [ ] Revoir commandes bloquees ou annulees.
- [ ] Verifier restaurants avec retards ou annulations.
- [ ] Verifier livreurs avec incidents ou suspensions.
- [ ] Controler demandes de paiement livreur.
- [ ] Verifier menus sans image ou categories vides.
- [ ] Documenter toute decision sensible.

### 14.2 Checklist restaurant avant ouverture

- [ ] Dashboard accessible.
- [ ] Statut restaurant ouvert uniquement si equipe disponible.
- [ ] Plats indisponibles desactives.
- [ ] Prix a jour.
- [ ] Temps moyen de preparation connu.
- [ ] Emballages disponibles.
- [ ] Telephone joignable.
- [ ] Personnel informe.

### 14.3 Checklist livreur avant mise en ligne

- [ ] Telephone charge.
- [ ] Internet actif.
- [ ] GPS fonctionne.
- [ ] Vehicule pret.
- [ ] Sac propre.
- [ ] Disponibilite reelle.
- [ ] Comprend zone de service.
- [ ] Peut gerer paiement cash si applicable.

### 14.4 Checklist support en cas de retard

- [ ] Identifier statut exact.
- [ ] Verifier ETA restaurant.
- [ ] Contacter restaurant si repas pas pret.
- [ ] Contacter livreur si repas pret mais non recupere.
- [ ] Informer client avec delai concret.
- [ ] Proposer geste si retard important.
- [ ] Documenter cause du retard.

## 15. Formation obligatoire

### 15.1 Restaurant

Modules minimum:

- Utilisation dashboard.
- Accepter/refuser une commande.
- Choisir temps de preparation.
- Marquer pret correctement.
- Gerer plats indisponibles.
- Regles d'emballage.
- Gestion des plaintes.
- Bonnes pratiques photos/menu.

Validation:

- Test de 5 questions.
- Simulation d'une commande.
- Appel de controle apres activation.

### 15.2 Livreur

Modules minimum:

- Utilisation dashboard.
- Accepter une livraison.
- Recuperer une commande.
- Livrer au client ou beneficiaire.
- Gerer client absent.
- Paiement cash.
- Communication respectueuse.
- Procedure incident.

Validation:

- Test de comprehension.
- Simulation de livraison.
- Premiere semaine sous surveillance.

## 16. Exigences produit a ajouter ou renforcer

### Priorite P0 - Avant lancement commercial serieux

- Journal d'audit admin.
- Motif obligatoire pour suspension/reactivation.
- Suspension restaurant, pas seulement livreur.
- Table `profile_incidents` ou equivalente.
- Alerte commande `pending` trop longtemps.
- Alerte commande `ready` sans livreur.
- Motif d'annulation obligatoire.
- Verification document taille/type cote client et serveur.
- Stockage documents dans Supabase Storage prive, pas en texte base64 long terme.
- Politique RLS testee par role.

### Priorite P1 - Stabilisation operationnelle

- Score qualite restaurant.
- Score fiabilite livreur.
- Auto-masquage restaurant en cas d'incidents repetes.
- Expiration documents livreur: assurance, permis si applicable.
- Assignation livreur basee sur ETA restaurant.
- Preuve de livraison: photo optionnelle ou code court client.
- Masquage partiel telephone hors livraison active.
- Templates SMS/WhatsApp pour beneficiaire.

### Priorite P2 - Maturite

- Detection fraude multi-comptes.
- Geofencing par ville/quartier.
- Dispatch intelligent par densite.
- Assurance incident partenaire.
- Dashboard qualite hebdomadaire.
- Enquetes terrain planifiees.
- Contrats numeriques signes.

## 17. Regles de communication

### 17.1 Avec les restaurants

- Communication professionnelle.
- Toujours confirmer les changements sensibles par ecrit.
- Ne jamais negocier une commande hors plateforme.
- Documenter promesses et exceptions.

### 17.2 Avec les livreurs

- Instructions courtes et actionnables.
- Aucune humiliation publique.
- Suspension expliquee avec motif.
- Reprise possible si le risque est corrige.

### 17.3 Avec les clients

- Donner un statut clair.
- Ne pas inventer de delai.
- Assumer les erreurs de coordination.
- Proposer solution: attendre, remplacer, annuler, rembourser, avoir.

### 17.4 Avec les beneficiaires

- Appeler uniquement pour la livraison.
- Ne pas divulguer donnees du commanditaire sauf necessaire.
- Si le beneficiaire ne connait pas la commande, contacter le commanditaire/support.

## 18. Modeles de messages

### 18.1 Demande de document manquant

Bonjour, votre candidature Yamo est presque complete. Il manque: [document]. Merci de l'ajouter pour que notre equipe puisse finaliser la verification.

### 18.2 Rejet candidature

Bonjour, votre candidature Yamo ne peut pas etre approuvee pour le moment. Motif: [motif]. Vous pouvez contacter le support si vous souhaitez fournir un complement.

### 18.3 Approbation restaurant

Bonjour, votre restaurant est approuve sur Yamo. Avant ouverture publique, merci de completer le menu, les photos, les prix et les horaires. Notre equipe vous accompagne pour la premiere mise en ligne.

### 18.4 Approbation livreur

Bonjour, votre profil livreur est approuve. Vous pouvez acceder a votre espace livreur. Merci de respecter les consignes de disponibilite, recuperation et livraison.

### 18.5 Suspension temporaire

Bonjour, votre profil Yamo est temporairement suspendu. Motif: [motif]. Notre equipe vous contactera pour la suite. Merci de ne pas creer de nouveau compte pendant la verification.

### 18.6 Retard commande client

Votre commande est toujours suivie par Yamo. Le retard vient de [restaurant/livraison]. Nouvelle estimation: [delai]. Merci pour votre patience.

## 19. Gouvernance documentaire

Ce document doit etre mis a jour:

- A chaque changement majeur du flux commande.
- A chaque ajout de paiement reel.
- A chaque nouvelle ville ouverte.
- Apres incident critique.
- Tous les mois pendant les 6 premiers mois de lancement.
- Tous les trimestres ensuite.

Responsables de mise a jour:

- Operations pour les regles terrain.
- Tech pour les controles produit et securite.
- Support pour les litiges et messages.
- Direction pour sanctions graves et politique commerciale.

## 20. Resume executif des regles non negociables

1. Aucun restaurant ou livreur non approuve ne participe aux commandes.
2. Chaque candidature doit avoir documents et verification de contact.
3. Le restaurant doit confirmer rapidement et donner un vrai temps de preparation.
4. Le livreur ne doit etre envoye que quand le repas est pret ou proche de l'etre.
5. Les menus doivent etre propres: prix, images, categories, disponibilites.
6. Les commandes pour quelqu'un d'autre doivent afficher clairement le beneficiaire.
7. Les incidents doivent etre documentes, pas traites oralement sans trace.
8. Les suspensions doivent avoir un motif.
9. Les donnees personnelles doivent etre vues uniquement par ceux qui en ont besoin.
10. La croissance par ville doit attendre que les operations soient fiables.

## 21. Annexe - Definition d'une commande reussie

Une commande Yamo est consideree reussie si:

- Le client a commande sans confusion.
- Le restaurant a confirme en moins de 3 minutes.
- Le temps de preparation annonce est respecte.
- Le livreur arrive sans attente excessive.
- Le plat est emballe et complet.
- Le client ou beneficiaire est joignable.
- Le paiement est clair.
- La commande est remise a la bonne personne.
- Le statut final est correct.
- Aucun litige grave n'est ouvert.

Ce document doit guider toutes les decisions produit et operations autour des profils Restaurant et Livreur.
