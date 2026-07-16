# QA — LOT-03 (Checkout durci)

> **Date** : 16/07/2026 · QA indépendant sur CONF-03 (validation VPS bloquante), CONF-10 (minimum de commande), CONF-11 (frais en chargement), ETA de confirmation.
> **Méthode** : relecture à froid du diff (`payments.ts` réécrit, `Checkout.tsx`, `RestaurantDetail.tsx` CartContent), exécution réelle en mode mock ET en mode VPS (flag `VITE_USE_VPS_API=true` via `.env.local` temporaire + redémarrage serveur), 6 résolutions, cas limites.

## 1. Vérifications réalisées

| Scénario | Résultat |
|---|---|
| Panier 800 < min 2 000 → fiche resto | ✔ bandeau + delta + CTA désactivé avec tooltip (sidebar + sheet mobile) |
| Panier 800 < min 2 000 → checkout | ✔ bandeau `role="status"` + « Ajoutez 1 200 FCFA » + lien Retourner au menu + CTA désactivé |
| Passage à 2 400 ≥ min | ✔ bandeau disparaît, CTA suit les autres validations |
| Commande complète (mock) | ✔ créée avec montants client, confirmation avec **« Livraison estimée : 25-35 min »** |
| Mode VPS, endpoint absent | ✔ `validateOrder` lève `NetworkPaymentError: HTTP 404` correctement classée (→ blocage, pas de repli montants client) |
| Mode VPS, resto mock au checkout | ✔ bannière « aperçu de démonstration » + CTA désactivé |
| `grep VITE_SUPABASE payments.ts` | ✔ 0 occurrence |
| minOrder=0 | ✔ aucun bandeau (vérifié par code : `minOrder > 0` requis) |
| Double-clic CTA | ✔ `disabled` pendant `submitting` (pré-existant conservé) |
| MoMo VPS down | ✔ catch existant → notice « régler à la livraison » |
| Résolutions ×6 (bandeau minimum affiché) | ✔ aucun débordement, bandeau contenu à 360 px |
| Console | ✔ 0 erreur active |

## 2. Anomalies

### QA-14 — [CORRIGÉE] Panier orphelin : skeletons infinis sans explication
- **Gravité : Majeure** (état non géré sur l'écran de paiement)
- Route : `/checkout` · Composant : `Checkout.tsx` (résolution du restaurant du panier)
- **Problème** : si le restaurant du panier persisté n'existe plus (retiré du catalogue — plausible en mode VPS avec TTL 24 h), `restaurantReady` restait faux pour toujours : lignes Livraison/Total en skeleton permanent, CTA désactivé, **aucun message**. Cul-de-sac silencieux.
- **Attendu** : message explicite + porte de sortie.
- **Correction appliquée** : détection `cartRestaurantMissing` (`!loading && !restaurantReady`) → alerte `role="alert"` « Le restaurant de votre panier n'est plus disponible » + lien `/restaurants`. **Vérifiée en exécution réelle** (panier orphelin injecté → alerte affichée, lien présent, CTA désactivé).
- Fichiers : `src/pages/Checkout.tsx`.

### QA-15 — Contraste du bandeau minimum (or sur or clair)
- **Gravité : Mineure** — pattern §6.5 du design system, borderline WCAG pour le texte long du bandeau. À traiter globalement au LOT-12 (avec `text-muted`).
- Fichiers : `src/pages/Checkout.tsx`, `src/pages/RestaurantDetail.tsx`.

### QA-16 — Total du hero pendant le chargement du restaurant
- **Gravité : Mineure** — l'en-tête du hero affiche `total` (= sous-total + 0) tant que le resto charge ; le récapitulatif, lui, est correctement en skeleton. Transitoire (~instantané en mock), incohérence cosmétique en réseau lent. Correction possible : masquer le montant du hero tant que `!restaurantReady`.
- Fichiers : `src/pages/Checkout.tsx`.

## 3. Validation post-correction

| Commande | Résultat |
|---|---|
| `npx tsc -b` | ✅ 0 erreur |
| `npx eslint` (payments/Checkout/RestaurantDetail) | ✅ 4 signalements, tous pré-existants |
| `npm run build` | ✅ (32,5 s avant fix ; tsc revalidé après) |
| Console | ✅ 0 erreur |

## 4. Verdict
**LOT-03 : conforme.** 1 majeure détectée et corrigée (QA-14, panier orphelin), 2 mineures documentées (QA-15/16 → LOT-12). Dépendance backend inchangée : endpoints `/api/orders/validate` et `/api/payments/momo` à implémenter côté serveur avant d'activer `VITE_USE_VPS_API` en production.
