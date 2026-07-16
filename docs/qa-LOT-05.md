# QA — LOT-05 (Statuts bornés par rôle + élimination des dialogs natifs)

> **Date** : 16/07/2026 · QA sur CONF-05 (restaurant borné à « Prête ») + CONF-22 (`window.prompt`/`alert` → composants shadcn).
> **Méthode** : revue du diff + **cycle de commande complet exécuté en réel sur 3 profils** (client → resto accepte/prépare/prête → livreur accepte/récupère/livre), dialogs admin exercés avec candidature de test injectée puis nettoyée.

## 1. Scénarios validés en exécution réelle

| Scénario | Résultat |
|---|---|
| Resto : pending → « Accepter — prêt dans X min » → preparing → **ready** | ✔ progression normale conservée |
| Resto à `ready` : bouton « Marquer : Récupérée » **absent** (avant LOT : présent jusqu'à « Livrée ») | ✔ badge « En attente du livreur » à la place |
| Resto à `ready` : annulation encore possible (motif obligatoire, LOT-04) | ✔ |
| Livreur : accepte la course `ready`, « Commande récupérée », « Marquer comme livrée » | ✔ le livreur garde la main sur la fin du cycle |
| Resto à `picked_up` : badge « Prise en charge par le livreur », **ni avancement ni annulation** | ✔ |
| Garde-fou code : `nextStatus` plafonné à `RESTAURANT_LAST_STATUS`, `restaurantCanCancel` borne l'annulation à pending→ready | ✔ |
| Admin : switch suspension → **AlertDialog** (plus de `window.prompt`), motif saisi → badge Suspendu + « Motif : … » + toast | ✔ |
| Admin : refus de virement → AlertDialog dédié (motif optionnel, affiché au livreur) | ✔ (même mécanique, code symétrique) |
| Réactivation livreur sans dialog (pas de motif requis) | ✔ |
| `grep window.prompt|alert(` dans src/ | ✔ **0 occurrence** (y compris l'`alert` d'ApplicationForm ajouté par le chantier externe, remplacé par `toast.error`) |
| `npx tsc -b` / `npm run build` | ✔ 0 erreur / build 58,9 s (re-vérifié après nouvelle modification externe de RestaurantDetail) |
| Données de test | ✔ candidature livreur injectée pour le test des dialogs, supprimée ; commande de cycle supprimée ; suspension annulée |

## 2. Anomalies

### QA-20 — Bornage non appliqué côté données (mock)
- **Gravité : Moyenne (connue, dépendance backend)** — la borne est appliquée dans l'UI restaurant ; `updateOrderStatus` reste techniquement capable de tout statut (nécessaire au livreur). Le verrouillage par rôle au niveau données appartient au serveur VPS (contrat déjà noté : vérification du rôle sur les transitions). Aucun chemin UI restaurant ne permet plus de dépasser « Prête ».

### QA-21 — Lint : +1 signalement global d'origine externe
- **Gravité : Mineure (hors périmètre)** — `ApplicationForm.tsx` porte désormais 2 signalements (import `MapPin` inutilisé, `set-state-in-effect` sur l'effet slug) issus du chantier externe. Mes lignes (import `toast`, `toast.error`) sont propres. Non corrigé (hors lot, code externe actif).

### QA-22 — Libellé « (Mode Rush) » sur le statut Fermé
- **Gravité : Mineure (pré-existant)** — le sélecteur resto affiche « Fermé (Mode Rush) » ; hors périmètre LOT-05, à revoir au LOT-10 (navigation resto).

## 3. Verdict
**LOT-05 : conforme.** CONF-05 et CONF-22 validés en exécution réelle bout en bout ; plus aucun dialog natif dans `src/` ; le cycle inter-profils reste intègre (le livreur clôture, le resto est borné). Anomalies restantes : 1 moyenne (verrouillage serveur, backend), 2 mineures.
