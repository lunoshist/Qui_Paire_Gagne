# État courant — source de vérité vivante

> À LIRE EN PREMIER. Mettre à jour à chaque avancée/décision. _MàJ : 2026-07-01._

## 🎉 JEU COMPLET EN LIGNE & JOUABLE (2026-07-02)
- **https://qui-paire-gagne.pages.dev** — partie complète : lobby → 11 cartes → formation (drag&drop/tap) → sablier →
  révélation → scores → manches → victoire. Testé en prod (3 joueurs, tirage 11, scoring exact 14/14/0).
- Serveur (round logic) + client (jeu) déployés ; catalogue = **295 cartes curées** par le commanditaire (curation en cours, redéployable via `scripts/build-manifest.mjs` + redeploy).
- Reste : enrichir/curer le catalogue, algo de tirage par ambiguïté (tags riches), polish révélation animée (TASK-009), reconnexion en pleine manche.

## 🎯 Phase courante — PEAUFINAGE (playtests #1 & #2, backlogs D-014/D-015)
Jeu en ligne, jouable, en amélioration continue. **Tout le code des retours #1 & #2 est fait & déployé** :
- ✅ TASK-009 cartes en grand + zoom · ✅ TASK-010 flows (reconnexion/rejouer/rejoindre-en-cours/promotion hôte)
- ✅ TASK-011 révélation 2 modes (Meneur pas-à-pas / Rapide) + scores animés + Victoire confettis/podium
  (⚠️ D-008 revu : `VitesseReveal` = `meneur|rapide`)
- ✅ TASK-013 mode **duo coopératif** (barème 1/2/4/8/13 + 2 poubelle) + **temps illimité**
- ✅ TASK-014 passe **design** (espacements/hiérarchie/tokens, fix crop `contain`, révélation « hero »)
- ✅ **CI/CD** GitHub Actions en place (`.github/workflows/deploy.yml`) — **manque juste les 2 secrets GitHub**
  (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`) à ajouter par le commanditaire pour activer l'auto-deploy.
  Commits locaux non poussés en attendant (push validera le 1er auto-deploy).

## 🔭 Reste / pistes
- Activer CI/CD (secrets) → pousser.
- **Tags riches** (couleurs/catégorie/ambiance) pour l'**algo de tirage par ambiguïté** (aujourd'hui tirage aléatoire).
- Génération d'images en boucle + curation (pool en cours) ; finale « pommes pourries » à théâtraliser ?
- Sons, autres réglages, reprise de place en lobby (anti-doublon).
Détails : D-014, D-015.

## ✅ Fait
- Règles officielles recherchées et consignées.
- Brief rédigé et validé par le commanditaire.
- Système de consignation en place (`AGENTS.md` + `docs/`).
- Décisions D-002/003/004 actées (`docs/decisions.md`).
- Brouillons de fond amorcés : `architecture.md`, `design-ux.md`, `catalog.md`.
- Roadmap détaillée en 6 phases.

## 🔄 En cours
- Présentation du plan détaillé au commanditaire pour validation avant d'attaquer la Phase 1 en profondeur.

## 🌍 EN LIGNE
- **Jeu (lobby)** : https://qui-paire-gagne.pages.dev · **Worker** : https://qui-paire-gagne-server.lunoshist.workers.dev
- Déploiement validé en prod (2026-07-02). Procédure de redéploiement : `docs/deployment.md`.

## 🎨 Catalogue — pilote v1 REJETÉ, pilote v2 en cours
- **Pilote v1 (Dixit/onirique) REJETÉ** par le commanditaire (sujets flous/surréalistes → pas d'associations). Voir D-011.
  Ancienne galerie : https://pilot.qui-paire-gagne.pages.dev (à ignorer / remplacer).
- **Direction corrigée (D-011)** : concept central CLAIR + variété (ambiances/contextes/formes/couleurs). Cf. `catalog.md` § Style révisé.
- **Pilote v2 FAIT** (16/16, généré en direct par le tracker après coupures d'agents) : galerie **https://pilot2.qui-paire-gagne.pages.dev**
  (5 sujets ×2 médiums côte à côte + 6 sujets variés). Direction corrigée validée visuellement (sujets clairs, variété OK). **En attente : choix du médium (illustration/photo/mix).**
- ⚠️ TODO prod : résolution (Pollinations rend du 768 malgré 1024) → upscale/meilleure résolution avant prod de masse.

## 🎨 Catalogue — direction VALIDÉE (v2), production multi-sources lancée
- Retour commanditaire sur pilote v2 : direction bien meilleure. **Médium au cas par cas** (illustration surtout,
  réaliste parfois ex. boussole) **+ images libres de droit** (Openverse CC0/PDM, testé OK). Défauts à filtrer au QC
  (parapluie double toile, fil de téléphone dans le vide, ambulance pas assez FR, éviter sujets texte/chiffres). Cf. D-011, D-012.
- **Lot de production #1 EN COURS** (script direct `scratchpad/batch1.py`, 12 sujets × [1 illu IA + 2 libres de droit]).
  → au retour : **QC visuel par le tracker** (choisir le meilleur médium/candidat par sujet), tagging, `catalog/manifest.json`.

## 🃏 Catalogue — NOUVELLE STRATÉGIE : volume + curation par le commanditaire (D-013)
- ⚠️ Revirement : l'agent NE cure PAS. Objectif **3000+ images**, tout dans `catalog/pool/` (local, gitignoré), le
  **commanditaire supprime** ce qu'il ne veut pas. Ne plus jamais stocker l'unique copie dans /tmp (éphémère).
- **72 images récupérées** des pilotes/lots dans `catalog/pool/{pilote-v1,pilote-v2,lot1,lot1-fix}/` (ballons + boussole retrouvés).
- **Collectes en cours** (background) : `harvest_rf.py` → `catalog/pool/rf/` (Openverse CC0/PDM/BY, ~120 concepts, provenance dans `_sources.jsonl`) ;
  `harvest_ai.py` → `catalog/pool/ai-illu/` (illustrations IA AVEC fond/contexte, consigne commanditaire).
- `catalog/images/` + `manifest.json` actuels (12) = provisoires (contiennent l'ambulance ratée) → le vrai catalogue
  sera reconstruit à partir des survivants après curation. Images servies en statique via Pages.

## 🎮 Boucle de jeu
- **TASK-007 (serveur) FINIE** : GameRoom joue une manche complète (tirage, sablier via alarme DO, soumissions secrètes,
  scores, enchaînement, gameOver). 22/22 tests intégration. Committé `3738886`.
- **TASK-008 (client) dispatchée** : store étendu (roundStart/playerSubmitted/revealPayload/gameOver) + écran Formation
  (drag&drop/tap, sablier, soumission) + Révélation/Scores/Victoire fonctionnels + pipeline d'assets (catalog→client).
- À suivre : TASK-009 = polish de la révélation animée (storyboard + tempos D-008).

## ⏭️ Prochaine action immédiate
- Vérifier/intégrer TASK-008 → **jeu jouable de bout en bout**, redéployer.
- Collectes catalogue : laisser tourner/relancer vers ~3000 (ajouter Wikimedia + concepts). Commanditaire cure `catalog/pool/`.
- Ordre proposé : (1) **lot pilote de cartes** via générateur gratuit sans clé (Pollinations/Flux) + tags →
  débloque l'affichage des 11 cartes ; (2) **algo de tirage** ; (3) **TASK-005 : distribution + formation (drag&drop)** ;
  (4) résolution/scoring serveur (réutilise `computeRoundResult`) ; (5) **révélation animée** ; (6) scores + enchaînement.
- Génération d'images via Workers AI possible aussi (compte dispo), mais Pollinations reste plus simple pour le pilote.

## 🔌 Contrat serveur figé (pour le client — TASK-004)
- Créer : `POST /api/rooms` → `{code}` (4 lettres). Rejoindre : WS `GET /api/ws?room=CODE`, 1er msg `joinRoom{pseudo,couleur?,avatar?,playerId?}`.
- Le serveur répond `joined {playerId, state}` (⚠️ lire `playerId` ICI, pas dans `roomState`), puis diffuse `roomState`.
- Erreurs : `GAME_STARTED`, `ROOM_FULL`, `INVALID_PSEUDO`, `NOT_HOST`, `NOT_ENOUGH_PLAYERS`, etc.
- Bornes settings serveur : `nbManches` 1–20, `dureeSablier` 10–600 s → l'UI doit s'aligner.
- `CreateRoomMessage` obsolète (création = HTTP), ne pas l'utiliser côté client.

## 🧩 TODO connus (non bloquants, à traiter plus tard)
- **Pomme pourrie unanime = 0** : hypothèse par symétrie (D-003), à recouper avec le livret officiel (TODO dans `scoring.ts`).
- **`variantesScoring`** : pas encore câblé dans `computeRoundResult` (règles par défaut). Évolution de signature
  possible (passer `RoomSettings`) quand on ajoutera des variantes.
- **Reprise de place en LOBBY** : au rechargement de page en lobby, le serveur retire le joueur à la déconnexion →
  re-join = nouvelle entrée (nouveau playerId/couleur, hôte possiblement réattribué). La reprise exacte via `playerId`
  marche une fois la partie lancée. Fix futur : délai de grâce côté serveur en lobby (TASK-003, à rouvrir).

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
