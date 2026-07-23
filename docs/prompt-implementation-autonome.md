# Prompt maître — Implémentation autonome des améliorations (MiamExpress/Yamo)

> À coller dans une session Claude Code fraîche. Il génère `prompts-successifs.md` +
> `coordination-prompts.md` puis exécute tout, avec les garde-fous et le contexte réels du projet.

```
MISSION : À partir de l'audit et de TOUTES les améliorations déjà suggérées pour MiamExpress/Yamo
(dossier app/), prépare PUIS exécute un plan d'implémentation complet, méthodique et AUTONOME.
Tu as mon autorisation durable pour les déploiements VPS décrits ici.

── SOURCES DES RECOMMANDATIONS (recenser UNIQUEMENT ce qui s'y trouve — ne rien inventer) ──
- app/docs/plan-optimisation-fiche-programme.md   (fiche programme : LOT 1-5)
- app/docs/plan-prompts-app-client.md             (app client CP1-9 : templates, HomePremium, reorder, promos, mobile)
- app/docs/plan-prompts-i18n-seo.md + app/docs/seo-i18n-url-architecture.md
- app/docs/ux-audit-optimal.md + app/docs/ux-implementation-plan.md (CONF-xx / LOT-xx)
- OPTIMISATION_UX_YAMO.md (racine du workspace)
- CLAUDE.md + la mémoire projet (index MEMORY.md).
Lis-les TOUS avant de planifier. Ce qui est déjà fait (voir « Avancement » dans les docs + mémoire)
ne doit PAS être réimplémenté : vérifie, documente, passe.

── 1. ANALYSER ──
- Recense toutes les améliorations des sources ci-dessus.
- Regroupe par domaine : UX/UI, navigation, fonctionnalités, contenu, responsive, accessibilité,
  performance, sécurité, SEO, architecture technique, qualité du code.
- Identifie dépendances, conflits, risques de régression.
- Classe : critique / élevée / moyenne / faible.
- LIS le code concerné AVANT toute modif : respecte l'architecture (double chemin VPS/mock, adaptateur
  supabase.ts = VPS, ne pas rebrancher Supabase), la charte (vert #157F3D, or #D4A843, tokens Tailwind
  green-primary/gold-accent/text-muted…), shadcn/ui (src/components/ui/), les layouts existants
  (Layout / BackOfficeLayout), les conventions. N'invente aucune exigence métier ; ambiguïté mineure
  → option la plus cohérente + documente le choix.

── 2. CRÉER app/docs/prompts-successifs.md ──
Série de prompts d'implémentation numérotés, autonomes. Chaque prompt : objectif · priorité · recos
concernées · fichiers/pages/composants à analyser · modifications exactes attendues · dépendances aux
étapes précédentes · réutilisation OBLIGATOIRE de l'archi et du design system · cas limites + états
loading (Skeleton)/error/empty · vérifs responsive (360px + desktop) / a11y (clavier, aria, contraste
≥4.5:1) / perf (pas de polling <15s, images lazy) / compatibilité · critères d'acceptation MESURABLES ·
exécution tests+lint+build+contrôle pixel · correction immédiate des erreurs liées · interdiction de
régression et de hors-périmètre.
Ordre : fondations/composants partagés → architecture/navigation → fonctionnalités → interfaces →
responsive → accessibilité → performance → SEO → sécurité → tests/contrôle final.

── 3. CRÉER app/docs/coordination-prompts.md ──
Procédure centrale : lire/exécuter les prompts dans l'ordre · vérifier les dépendances · analyser l'état
actuel avant modif (dont `tasklist | grep codex`) · préserver les fonctionnalités opérationnelles ·
CHECKPOINT git (commit isolé) avant tout changement important · valider chaque étape par ses critères ·
exécuter les tests après chaque prompt · corriger avant de poursuivre · tenir un JOURNAL d'exécution ·
reprise propre après interruption · gérer un blocage SANS contournement silencieux · validation globale
finale. Statuts par étape : À faire / En cours / Bloqué / À corriger / Terminé.

── GARDE-FOUS MiamExpress (boucle bloquante entre CHAQUE prompt) ──
1) aucun codex.exe (tasklist) — sinon STOP & DEMANDE (Codex fait des blanket-commits qui balayent le
   travail et ré-entrelace les fichiers ; voir mémoire « concurrence-codex-danger ») ;
2) npm run verify:hooks  → 0 violation (react-hooks/rules-of-hooks) ;
3) npm run verify:i18n   → pages prioritaires 100% (clé = texte FR ; keySeparator/nsSeparator false ;
   toute nouvelle chaîne UI passe par t() ; EN dans src/i18n/locales/en.json) ;
4) npm run build         → EXIT 0 (tsc -b && vite build) ;
5) contrôle PIXEL : rendu à 360px ET desktop conforme, 0 erreur console ;
6) RÉEL uniquement : aucune donnée/promo factice — masquer une section si pas de donnée réelle
   (module alimentaire = VPS-only, invisible en preview mock) ;
7) identité MiamExpress stricte (tokens verts/or, pas de couleur en dur hors config d'apparence).
N'avance JAMAIS sur du rouge : corrige d'abord.

── 4. EXÉCUTER ──
Utilise coordination-prompts.md comme procédure. Exécute chaque prompt de prompts-successifs.md dans
l'ordre ; ne lance pas une étape tant que la précédente n'est pas implémentée ET validée. Après chaque
prompt : inspecte les modifs, exécute les vérifs, corrige, vérifie l'absence de régression, MAJ statut +
journal. Si une amélioration est déjà correctement présente : vérifie, documente, passe (ne réimplémente
pas). Blocage critique nécessitant une décision humaine : documente problème + conséquences + options,
suspends UNIQUEMENT l'étape concernée, continue les autres si possible.

── 5. CONTRAINTES ──
Préserve la logique métier, les données et les fonctionnalités existantes. Ne supprime rien d'utile sans
justification explicite. Réutilise en priorité composants/styles/variables/deps existants. Pas de
duplication ni de solution temporaire. Ne modifie pas de fichiers hors recommandations. Respecte l'identité
visuelle et les conventions. Résultat responsive, accessible, performant, prêt production. Ne te limite PAS
à générer les fichiers de planification : exécute réellement toutes les étapes réalisables.

── DÉPLOIEMENT (quand une reco validée est prête pour la prod) ──
build + `npx react-snap` (prerender /fr /en — config `reactSnap` de package.json, Chrome local ;
INDISPENSABLE sinon Nginx try_files /fr/index.html casse le routing) + tar/scp de dist (assets + fr + en +
index.html + 200.html + robots.txt + sitemap.xml, IMAGES conservées) + backup `dist.bak-<horodatage>`.
Cible : ubuntu@51.222.15.0:/home/ubuntu/miamexpress/dist, clé ~/.ssh/id_ed25519_jackpot. Backend intouché
sauf endpoint explicitement requis (alors déployer server/ proprement, sans secret). Vérifier en prod après
(curl + navigateur FR ET EN).

── STOP & DEMANDE (ne pas faire en autonome) ──
codex.exe/édition concurrente détectée ; action destructive/irréversible non prévue ; garde-fou (dont
pixel) impossible à rendre vert ; secret/clé de signature ; soumission à un service externe ; décision
produit ambiguë (formulation EN d'une page très visible, règle métier d'une promo) → propose, ne devine pas.

── 6. RAPPORT FINAL ──
Fichiers de coordination créés · améliorations appliquées · fichiers/composants modifiés · tests &
validations effectués (verify:hooks, verify:i18n, build, pixel) · problèmes rencontrés + solutions · recos
NON appliquées + justification · points nécessitant une validation humaine · état final du build et du projet.

Objectif : une implémentation complète, cohérente, vérifiée, fidèle aux améliorations suggérées, SANS
régression ni modification inutile. Commence par l'étape 1 (analyse), puis crée les deux fichiers, puis exécute.
```
