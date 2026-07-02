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

## ⏭️ Prochaine action immédiate
- QC du lot #1 (vision) → sélection + manifeste + assets committés dans `catalog/images/`.
- Poursuivre le catalogue par lots (viser ≥100 cartes). Puis **Phase 4 (boucle de jeu)** : algo de tirage,
  distribution 11 cartes, formation (drag&drop), scoring serveur (`computeRoundResult`), révélation.
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
