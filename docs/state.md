# État courant — source de vérité vivante

> À LIRE EN PREMIER. Mettre à jour à chaque avancée/décision. _MàJ : 2026-07-01._

## 🎯 Phase courante
**Phase 1 TERMINÉE → entrée Phase 2 (fondations techniques).** Toute la réflexion produit/design est consignée
(`architecture.md`, `design-ux.md`, `catalog.md`). Décisions D-001→D-008 actées.
Prochain : découper Phase 2 en briefs builders et lancer la construction (scaffold monorepo en premier).

## ✅ Fait
- Règles officielles recherchées et consignées.
- Brief rédigé et validé par le commanditaire.
- Système de consignation en place (`AGENTS.md` + `docs/`).
- Décisions D-002/003/004 actées (`docs/decisions.md`).
- Brouillons de fond amorcés : `architecture.md`, `design-ux.md`, `catalog.md`.
- Roadmap détaillée en 6 phases.

## 🔄 En cours
- Présentation du plan détaillé au commanditaire pour validation avant d'attaquer la Phase 1 en profondeur.

## ⏭️ Prochaine action immédiate
- **Phase 2 — Fondations.** TASK-001 (scaffold) + TASK-002 (contrat partagé + score pur) **livrées + vérifiées**.
  Premier **commit git** effectué (milestones activés par le commanditaire).
- **TASK-003 dispatchée** : Durable Object « room » + lobby (create/join/settings/start) + broadcasts d'état.
- Files d'attente : TASK-004 (client Accueil + Salle d'attente), déploiement (compte Cloudflare),
  Phase 3 (lot pilote catalogue), Phase 4 (boucle de jeu).

## 🧩 TODO connus (non bloquants, à traiter plus tard)
- **Pomme pourrie unanime = 0** : hypothèse par symétrie (D-003), à recouper avec le livret officiel (TODO dans `scoring.ts`).
- **`variantesScoring`** : pas encore câblé dans `computeRoundResult` (règles par défaut). Évolution de signature
  possible (passer `RoomSettings`) quand on ajoutera des variantes.

## ⚠️ Dépendance à venir (commanditaire)
- **Compte Cloudflare** : créé par le commanditaire (2026-07-01). Méthode d'accès retenue = **`wrangler login`
  (OAuth)** : il tape `! npx wrangler@latest login` dans le prompt quand on déploiera ; les creds sont stockées
  localement et utilisables par mes commandes. Workers AI (génération catalogue) sera appelé **via binding `AI`
  dans un Worker déployé** → aucune clé à manipuler. Fallback : API token + Account ID dans `.env` gitignoré.
  Non requis avant le 1er déploiement (≈ après TASK-003/004).

## ❓ Questions ouvertes
- **D-006** : quel modèle IA pour générer les cartes (Flux/Midjourney/Ideogram/SDXL) ? quel budget ? qui
  fournit les accès/clés ? (bloquant pour Phase 3, pas pour Phase 1/2).
- Recouper la règle de scoring avec le livret officiel PDF (confirmer D-003).

## 🚧 Blocages
- Aucun blocage technique. En attente de validation du plan + décision D-006 pour la partie catalogue.

## 🧭 Hypothèses de travail (non actées)
- Stack : Cloudflare (Pages + Workers + Durable Objects) + R2 ; front React+Vite+TS + dnd-kit + Motion. À valider P1.
- Responsive mobile + desktop obligatoire.
