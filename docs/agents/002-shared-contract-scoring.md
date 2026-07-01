# TASK-002 · Contrat de données partagé + logique de score

- **Statut** : dispatché
- **Date** : 2026-07-01
- **Dépend de** : TASK-001 (scaffold `shared/`)

## Objectif (une seule tâche)
Faire de `shared/` la **source de vérité** du domaine et du protocole : types TypeScript complets (messages
client↔serveur + modèle d'état d'une room) **et** la **logique de score pure**, entièrement testée. Aucune infra,
aucun réseau, aucune UI — que du TS pur + tests Vitest.

## Contexte utile (à LIRE)
- `docs/architecture.md` → sections « Modèle d'état d'une salle », « Machine à états », « Protocole client ↔ serveur ».
- `docs/brief.md` → règles du jeu.
- `docs/decisions.md` → D-003 (unanime = 0), D-008 (`vitesseReveal`).
- Types actuels : `shared/src/index.ts` (échо — à ÉTENDRE, garde ou remplace proprement l'écho au besoin).

## À produire dans `shared/`
### 1. Modèle de domaine (types)
- `Couleur` (les 8 couleurs joueurs), `Player {id, pseudo, couleur, avatar?, connecte, scoreCumul}`.
- `Phase = 'lobby'|'dealing'|'forming'|'reveal'|'scores'|'finished'`.
- `RoomSettings {nbManches, dureeSablier, vitesseReveal:'lent'|'normal'|'rapide', variantesScoring}` + `DEFAULT_SETTINGS`.
- `Card {id: string; tags: CardTags}` avec `CardTags {concepts:string[]; couleursDominantes:string[]; categorie:string; ambiance:string[]; formes:string[]}` (schéma de `catalog.md` ; contenu réel viendra en Phase 3).
- `Pair = [string, string]` (2 cardIds). `PlayerSubmission {playerId; paires: Pair[]; pommePourrie: string}`.
- `PublicRoomState` : snapshot diffusable (joueurs, settings, phase, mancheCourante) — **sans** les soumissions secrètes.
- Types de résultats : `PairResult {pair; makers: string[]; pointsParMaker}`, `PommePourrieResult`,
  `RoundResult {parPaire: PairResult[]; pommesPourries; deltaScores: Record<string,number>}`, `Scoreboard`.
- Constantes : `MIN_PLAYERS=3`, `MAX_PLAYERS=8`, `CARDS_PER_ROUND=11`, `PAIRS_PER_ROUND=5`.

### 2. Protocole (unions discriminées par `type`)
- `ClientMessage` : `createRoom`, `joinRoom`, `updateSettings`, `startGame`, `submitPairs`, `advance`, `leaveRoom`
  (payloads conformes à `architecture.md`).
- `ServerMessage` : `roomState`, `roundStart`, `playerSubmitted`, `revealPayload`, `gameOver`, `error`.

### 3. Logique de score PURE (le cœur — à tester à fond)
Fonction pure `computeRoundResult(submissions: PlayerSubmission[], playerIds: string[]): RoundResult` appliquant :
- **Paires** : pour chaque paire distincte (indépendante de l'ordre des 2 cartes), `makers` = nb de joueurs l'ayant
  formée. `pointsParMaker = (makers === 1 || makers === nbJoueurs) ? 0 : makers`. (D-003 : solo=0, unanime=0.)
- **Pomme pourrie** : pour chaque carte-pomme distincte, `sharers` = nb de joueurs l'ayant en pomme pourrie.
  `pointsParSharer = (sharers === 1 || sharers === nbJoueurs) ? 0 : 2 * sharers` (double, même logique solo/unanime).
- Normaliser les paires (tri des 2 cardIds) pour comparer sans dépendre de l'ordre.
- Centraliser ces règles pour qu'elles soient **faciles à ajuster** (⚠️ à recouper avec le livret officiel plus tard —
  laisser un commentaire TODO explicite là-dessus, notamment sur le cas unanime de la pomme pourrie).

## Definition of Done (vérifiable)
- [x] Tous les types ci-dessus exportés depuis `shared/src/`, importables client + server, `npm run typecheck` PASS.
- [x] `computeRoundResult` pure (aucun effet de bord), déterministe. (Test dédié : mêmes entrées → mêmes sorties, entrées non mutées.)
- [x] Tests Vitest **exhaustifs** couvrant : paire solo=0, paire unanime=0, paire à 2/3/N makers, plusieurs paires,
      ordre des cartes inversé traité identiquement, pomme pourrie solo=0 / partagée=double / unanime=0,
      calcul des `deltaScores` agrégés. Cas limites (aucune soumission, 0 joueur, 3 joueurs min).
- [x] `npm run lint` et `npm test` PASS depuis la racine.
- [x] Aucun code d'infra/réseau/UI ajouté. `shared/` reste pur.

## Résultat (rempli au retour)
**Statut : TERMINÉ (2026-07-01).**

### Fichiers produits dans `shared/src/`
- `domain.ts` — modèle de domaine + constantes.
- `protocol.ts` — unions discriminées Client↔Serveur (+ écho scaffold conservé).
- `scoring.ts` — logique de score PURE (`computeRoundResult` + règles centralisées).
- `index.ts` — ré-export barrel (`export *` des 3 modules).
- `scoring.test.ts` — 32 tests ; `index.test.ts` — écho (1 test) conservé.

### Types exportés
- Domaine : `Couleur` (+ `COULEURS`), `Player`, `Phase`, `VitesseReveal`, `ScoringVariants`,
  `RoomSettings` (+ `DEFAULT_SETTINGS`), `CardTags`, `Card`, `Pair`, `PlayerSubmission`,
  `PublicRoomState`, `PairResult`, `PommePourrieResult`, `RoundResult`, `ScoreEntry`, `Scoreboard`,
  `MIN_PLAYERS`, `MAX_PLAYERS`, `CARDS_PER_ROUND`, `PAIRS_PER_ROUND`.
- Protocole : `ClientMessage` (`createRoom`, `joinRoom`, `updateSettings`, `startGame`, `submitPairs`,
  `advance`, `leaveRoom` + `echo`), `ServerMessage` (`roomState`, `roundStart`, `playerSubmitted`,
  `revealPayload`, `gameOver`, `error` + `echo`), + chaque interface de message, `ClientMessageType`,
  `ServerMessageType`, `EchoRequest`/`EchoResponse`/`createEchoRequest`.
- Scoring : `computeRoundResult`, `scorePaire`, `scorePommePourrie`, `normalizePair`, `pairKey`.

### Règles de score implémentées (centralisées, ⚠️ TODO livret officiel)
- `scorePaire(makers, nbJoueurs)` : solo (≤1) → 0 ; unanime (≥ nbJoueurs) → 0 (D-003) ; sinon `makers`.
- `scorePommePourrie(sharers, nbJoueurs)` : solo → 0 ; unanime → 0 (⚠️ à confirmer) ; sinon `2 × sharers`.
- Paires normalisées (tri des 2 cardIds) → ordre ignoré ; doublon de paire d'un même joueur compté 1 fois.

### Vérifs (depuis la racine)
- `npm run typecheck` : **PASS** (shared + client + server).
- `npm run lint` : **PASS**.
- `npm test` : **PASS** — shared 33 tests (scoring 32 + écho 1), client 1, total 34.
- Prettier : formaté (OK).

### Impact hors périmètre (signalé)
- L'élargissement de `ServerMessage` cassait `client/src/App.tsx:32` (`msg.text` sans narrowing).
  Correction **strict minimum** appliquée : narrowing `msg.type === 'echo'`. Aucune autre modif client/server.

### Point de contrat pour arbitrage du tracker
- **Cas UNANIME de la pomme pourrie** : traité ici comme 0 (par symétrie avec la paire, D-003), mais NON
  couvert explicitement par les sources → à recouper avec le livret officiel (TODO en tête de `scoring.ts`).
- `computeRoundResult(submissions, playerIds)` ignore `variantesScoring` (règles par défaut codées en dur mais
  isolées dans `scorePaire`/`scorePommePourrie`). Si les variantes doivent moduler le calcul, prévoir une
  évolution de signature (ex. passer `RoomSettings`) dans une tâche ultérieure.
