# TASK-013 · Modes & réglages : mode 2 joueurs (coopératif) + temps infini

- **Statut** : dispatché
- **Date** : 2026-07-02
- **Dépend de** : TASK-002 (scoring/contrat), TASK-007 (round serveur), TASK-008 (client)

## Objectif (une seule tâche)
Ajouter deux réglages de partie : un **mode 2 joueurs** avec scoring **coopératif** distinct, et une option
**temps illimité** (sablier infini). Serveur + shared + client (lobby + affichage scores/reveal).

## Retours commanditaire (exacts)
- « Mets en place un **mode deux joueurs**, où le but est de faire le plus de points. Ici plus question de faire zéro
  si tout le monde fait la même paire, mais au contraire des **bonus** plus le nombre de paires en commun est élevé.
  Ex : **1→1pt, 2→2, 3→4, 4→8, 5→13**, et **2 points pour la poubelle** [pomme pourrie]. »
- « Mets une possibilité de **temps infini**. »

## Spécification
### Mode de jeu (réglage lobby)
- `mode: 'classique' | 'duo'` dans `RoomSettings` (défaut `classique`). Mets à jour `shared` + le sanitize serveur.
- **`classique`** : règles actuelles (3–8 joueurs, `computeRoundResult` inchangé : solo=0, unanime=0, sinon nb de makers, pomme ×2).
- **`duo`** : **exactement 2 joueurs**. `MIN_PLAYERS`/`MAX_PLAYERS` deviennent **mode-dépendants** (duo = 2 et 2).
  Le lobby doit refléter ça (garde de démarrage : duo exige 2 joueurs, classique 3).

### Scoring coopératif duo (fonction PURE dans `shared`, testée)
- On compte **C = nombre de paires en commun** entre les 2 joueurs (paires normalisées, cf. `pairKey`).
- Points de manche (attribués **aux DEUX** joueurs, score d'équipe) selon C :
  `0→0, 1→1, 2→2, 3→4, 4→8, 5→13`.
- **+2** si la **pomme pourrie est commune** (même carte non appariée chez les 2).
- Pas de règle « solo/unanime = 0 » en duo (c'est coopératif). Le total de manche est le même pour les 2 joueurs, cumulé sur les manches.
- Implémente `computeRoundResultDuo(subA, subB)` (ou un paramètre `mode` sur une fonction dédiée) renvoyant un
  résultat compatible avec le protocole reveal (deltaScores identiques pour les 2, détail des paires communes),
  + tests exhaustifs (C=0..5, poubelle commune ou non, ordre des cartes inversé).

### Temps illimité (réglage lobby)
- Option **sablier illimité** (ex. `dureeSablier: 0` ou un flag `sablierIllimite`). Choix documenté.
- En illimité : **pas d'alarme DO**, `deadline` absent/null ; la manche se résout **uniquement quand tous les
  joueurs (présents) ont soumis**. Le client n'affiche pas de compte à rebours (juste « en attente des joueurs »).

## Côté serveur (GameRoom)
- Appliquer `mode` : garde de démarrage (nb joueurs), fonction de scoring selon le mode à la résolution.
- Gérer `dureeSablier` illimité : ne pas armer d'alarme, résolution sur tous-soumis.
- Persistance/hibernation OK. Ne pas casser les tests existants (classique).

## Côté client
- Lobby : sélecteur **Mode** (Classique / Duo) + option **Temps illimité** (réglages hôte). Adapter le message
  « min. X joueurs » selon le mode. En duo, l'affichage des scores/reveal doit être cohérent (score d'équipe, nb de
  paires communes, bonus). Reveal fonctionnel en duo (peut réutiliser la structure existante).

## Definition of Done (vérifiable)
- [x] `mode` duo jouable **à 2 joueurs** ; classique inchangé (3–8).
- [x] Scoring duo conforme au barème (1/2/4/8/13 + 2 poubelle commune), fonction pure **testée** (C=0..5, poubelle).
- [x] Temps illimité : aucune alarme, résolution sur tous-soumis, pas de compte à rebours affiché.
- [x] Lobby : réglages Mode + Temps illimité fonctionnels, gardes de démarrage adaptées.
- [x] `shared` mis à jour (documenté, tests verts) ; reveal/scores cohérents en duo.
- [x] Tests : unitaires scoring duo + intégration serveur (partie duo 2 joueurs → score correct ; partie illimitée
      → résolution sur tous-soumis, pas d'alarme). Rapporter PASS/FAIL par cas.
- [x] `npm run typecheck`, `npm run lint`, `npm test` (+ integration), `npm run build` PASS. Docs non touchés (sauf ce brief).

## Résultat (rempli au retour)

**Livré — toutes les vérifs PASS.** (2026-07-02)

### Fichiers modifiés
- **shared** : `domain.ts` (type `Mode`/`MODES`, `PLAYER_BOUNDS`, `minPlayers`/`maxPlayers`,
  `RoomSettings.mode` + `RoomSettings.sablierIllimite`, `DEFAULT_SETTINGS`) ; `scoring.ts`
  (`computeRoundResultDuo`, `duoTeamPoints`, `DUO_PAIR_POINTS`, `DUO_POMME_BONUS`) ;
  `protocol.ts` (`RoundStartMessage.deadline: number | null`) ; `scoring.test.ts` (+ tests duo).
- **server** : `GameRoom.ts` (sanitize mode/illimité + compat ascendante ; garde join `maxPlayers(mode)` ;
  garde start min/max par mode + refus duo>2 en updateSettings ; `beginRound` deadline null sans alarme
  en illimité ; `resolveRound` → dispatch `computeResult` selon mode) ; `test/integration.mjs` (+4 sections).
- **client** : `store/roomStore.ts` (`RoundInfo.deadline` nullable, `missingPlayers`/`canStartGame` mode-dépendants) ;
  `screens/Room.tsx` (sélecteur Mode + toggle Temps illimité, compteurs/bannières mode-dépendants, `duo` → Reveal) ;
  `screens/Formation.tsx` (pas de compte à rebours ni auto-soumission en illimité) ; `screens/Reveal.tsx` (`duo` prop,
  résumé « paires en commun » + score d'équipe).

### Design / arbitrages
- **Représentation mode** : `mode: 'classique' | 'duo'` dans `RoomSettings`. Bornes de population
  centralisées dans `PLAYER_BOUNDS` (classique 3–8, duo 2–2) via `minPlayers()`/`maxPlayers()`.
  `MIN_PLAYERS`/`MAX_PLAYERS` conservés (= bornes classique) pour compat ascendante.
- **Temps illimité** : **flag booléen** `sablierIllimite` (choix retenu vs `dureeSablier=0`) — garde
  `dureeSablier` toujours valide et rend l'intention explicite. Serveur : `deadline = null`, **aucune alarme
  armée** (et purge d'une alarme résiduelle) ; résolution uniquement sur tous-soumis. Client : pas de `Countdown`
  (affiche « ⏳ ∞ »), pas d'auto-soumission.
- **Scoring duo** (pur, testé) : `C` = nb de paires communes (clés normalisées, doublons internes ignorés) ;
  score d'équipe `DUO_PAIR_POINTS[C]` (`0,1,2,4,8,13`) `+2` si pomme pourrie commune ; `deltaScores`
  identiques pour les 2. Astuce reveal : chaque paire commune porte un **point marginal** (`[1,1,2,4,5]`) dont la
  somme reconstitue exactement le total → la mise en scène pas-à-pas existante affiche le barème (1→2→4→8→13)
  sans logique de score spécifique côté client. Un participant sans soumission = soumission vide (équipe = 0 possible).

### Vérifs par cas
- **Unitaires scoring duo (shared, 47 tests scoring)** : `duoTeamPoints` barème 0/1/2/4/8/13 + bonus pomme ;
  `computeRoundResultDuo` C=0..5 (délta d'équipe + somme marginale) ; pomme commune (+2) / différente (0) ;
  C=5+pomme=15 ; ordre de cartes inversé compté commun ; doublon interne ignoré ; pureté. → **PASS**.
- **Intégration serveur (49/49 PASS)**, dont nouveaux :
  - `duo : startGame à 2 joueurs → roundStart` → PASS
  - `duo C=5 + pomme commune → 15/15` → PASS ; `5 paires communes, somme marginale = 13` → PASS
  - `duo C=3, pommes différentes → 4/4` → PASS
  - `duo : 3e joueur refusé (ROOM_FULL)` → PASS ; `duo : démarrage à 1 joueur refusé (NOT_ENOUGH_PLAYERS)` → PASS
  - `temps illimité : roundStart deadline null` → PASS ; `aucune résolution avant tous-soumis (pas d'alarme)` → PASS ;
    `résolution sur tous-soumis (6/6/0)` → PASS
  - Tous les tests classiques préexistants (1–16) → PASS (non-régression).
- `npm run typecheck` → PASS · `npm run lint` → PASS · `npm test` (48 shared + 45 client) → PASS ·
  `npm run test:integration -w @qpg/server` → 49/49 PASS · `npm run build` → PASS · `npm run format` (check) → PASS.
