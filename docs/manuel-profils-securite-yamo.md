# Yamo — Manuel opérationnel : Gestion sécurisée des profils Restaurant et Livreur

> Document interactif (Artifact Claude) — v1.0 — juillet 2026
> Propriétaire : Équipe Opérations & Confiance Yamo

**Lien du document :** https://claude.ai/code/artifact/dd625ff8-3694-4816-8c4a-3cf733257e07

## Contenu

Manuel de référence couvrant tout le cycle de vie des profils Restaurant et Livreur,
ancré dans le schéma Supabase réel de l'application (tables, RLS, migrations) :

1. Cycle de vie — Profil Restaurant (candidature, pièces, validation, activation, suspension)
2. Cycle de vie — Profil Livreur (candidature, pièces, validation, disponibilité, sanctions)
3. Sécurité technique transverse (RLS par table, garde-fous DB, paiements, données personnelles)
4. Faire en sorte que la commande se passe bien (flux de statuts, qualité catalogue, confiance)
5. Gestion financière (commissions, codes promo, virements livreurs)
6. Indicateurs et seuils d'alerte (KPIs lancement / maturité)
7. Échelle de sanctions (4 niveaux, de l'avertissement à la résiliation)
8. Support et litiges
9. Compléments recommandés (registre priorisé des écarts identifiés)

Chaque règle est étiquetée **en place** (vérifié dans le code actuel), **recommandé**
(manquant, à construire) ou **urgence haute** dans le registre final — pour distinguer
clairement l'existant de ce qui reste à bâtir.

## Écarts prioritaires identifiés

- Aucune suspension possible pour un compte restaurant (contrairement au livreur)
- Aucune alerte automatique sur le franchissement des seuils KPI

## Note

Le lien pointe vers un artifact hébergé sur claude.ai — document privé par défaut,
partageable depuis son menu de partage. Se rendre sur le lien pour la version à jour ;
ce fichier sert de pointeur depuis le dépôt du projet.
