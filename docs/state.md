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

## ⏭️ Prochaine action immédiate
- **Phase 2 TERMINÉE** (lobby en ligne). Prochaine grande étape : **Phase 3 (lot pilote catalogue) + Phase 4 (boucle de jeu)**.
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
