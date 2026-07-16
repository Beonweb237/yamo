# QA — LOT-06 (Livreur : données de décision réelles, espèces, privacy)

> **Date** : 16/07/2026 · QA sur CONF-15 (rémunération + géoloc réelle + GPS contextuel), CONF-16 (espèces), CONF-23 (privacy avant acceptation), CONF-07 (messages fantômes → WhatsApp), bip nouvelle course (partie CONF-32).
> **Méthode** : revue du diff (`DriverDashboard.tsx` seul fichier applicatif modifié) + cycle réel complet (commande créée → prête → acceptée → récupérée → livrée avec confirmation d'encaissement), 360×800 vérifié.

## 1. Scénarios validés en exécution réelle

| Scénario | Résultat |
|---|---|
| Carte « Disponibles » : **« Vous gagnez : X FCFA »** en tête (l'info de décision n°1) | ✔ (0 FCFA affiché honnêtement pour un resto en livraison gratuite) |
| Privacy (CONF-23) : quartier + ville seulement, **aucun téléphone/nom/adresse exacte** avant acceptation | ✔ vérifié sur le DOM complet |
| Distance : GPS refusé/indisponible → **« Distance indisponible — activez la localisation »** (aucune valeur inventée ; `stableOffset` et coordonnées en dur supprimés) | ✔ chemin sans-permission exercé en réel (pane sans géoloc) |
| Distance réelle : `watchPosition` (actif seulement « En ligne ») + haversine vers les vraies coordonnées du restaurant | ✔ par code (non observable en sandbox sans GPS — validation humaine sur téléphone recommandée) |
| GPS contextuel : `ready` → **GPS restaurant** (coordonnées réelles 4.0511,9.7075) ; après récupération → **GPS client** | ✔ les deux états observés |
| Messages rapides : 3 chips **WhatsApp réels** vers le numéro du client (`wa.me/237690000002`) avec messages préremplis contextualisés (n° de commande) — plus aucun toast simulé | ✔ |
| Espèces (CONF-16) : encart « À encaisser à la livraison : 3 500 FCFA » sur course active cash | ✔ |
| Clôture cash → **dialog « Confirmez que vous avez bien encaissé 3 500 FCFA »** → statut `delivered` | ✔ exercé en réel |
| Clôture non-cash directe (pas de dialog) | ✔ par code (`requestMarkDelivered`) |
| Bip nouvelle course : pattern identique au resto (`knownAvailableIdsRef` + WebAudio), toggle 🔊 persistant (`yamo_driver_sound`, documenté CLAUDE.md), toast « Nouvelle course — vous gagnez X FCFA » | ✔ code + toggle visible/cliquable ; son non audible en sandbox (validation humaine) |
| 360×800 : aucun débordement, bouton son ≥ 40 px | ✔ |
| `tsc` / `build` / lint | ✔ 0 erreur / 42,5 s / 4 signalements = baseline pré-existante exacte (setTab-effect, loadAll-effect, 2 × Date.now purity) |
| Données de test | ✔ commande de cycle supprimée, session restaurée |

## 2. Anomalies

### QA-23 — Rémunération 0 FCFA sur les restos « livraison gratuite »
- **Gravité : Moyenne (constat produit, pas un bug du lot)** — le modèle de gains actuel = `deliveryFee` de la commande ; un resto en livraison gratuite produit « Vous gagnez : 0 FCFA ». C'est la **vérité des données** (le lot affiche honnêtement ce qui était caché avant), mais le modèle économique livreur doit être défini côté produit/backend (rémunération plancher ? part restaurant ?). Référencé à l'audit (E.3 « Rémunération… côté livreur », priorité produit n°7). À trancher avant lancement — hors périmètre front.

### QA-24 — Distance non testable en réel dans la sandbox
- **Gravité : Mineure (limite d'outillage)** — le chemin « avec GPS » (`watchPosition` → km réels) est validé par code et par le chemin d'échec exercé ; test terrain sur téléphone recommandé.

### QA-25 — `watchPosition` conservé actif tant que l'onglet est ouvert et en ligne
- **Gravité : Mineure** — consommation batterie maîtrisée (`maximumAge: 30 s`, coupé hors-ligne), mais pas de pause quand l'onglet est masqué. À regrouper avec LOT-11 (visibilitychange).

## 3. Verdict
**LOT-06 : conforme.** Plus aucune donnée inventée ni action simulée dans le parcours livreur ; rémunération, GPS contextuel, espèces et privacy vérifiés en cycle réel. 1 moyenne **produit** (modèle de gains — décision métier requise), 2 mineures.
