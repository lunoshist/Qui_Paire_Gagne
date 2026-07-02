# TASK-003 · Durable Object « room » + logique de lobby (serveur)

- **Statut** : dispatché
- **Date** : 2026-07-01
- **Dépend de** : TASK-001 (scaffold server), TASK-002 (contrat `shared/`)

## Objectif (une seule tâche)
Implémenter côté `server/` le **Durable Object autoritatif d'une room** et toute la **logique de LOBBY** :
créer une room, rejoindre/quitter, changer les réglages, lancer la partie (garde ≥ MIN_PLAYERS), avec diffusion
de l'état (`roomState`) — le tout via WebSocket Hibernation, état **persisté** pour survivre à l'hibernation.
**Périmètre = LOBBY uniquement.** La logique de manche (distribution/formation/révélation/scores) est HORS scope
(tâches suivantes) : `startGame` se contente de valider les gardes, passer `phase` à `'dealing'` et diffuser
(laisser un `// TODO TASK-005: démarrer la manche`).

## Contexte utile (à LIRE)
- `docs/architecture.md` → « Modèle d'état », « Machine à états », « Protocole client ↔ serveur »,
  « Règle de sécurité » (soumissions secrètes — pas concerné ici mais à garder en tête), « Résilience ».
- `docs/decisions.md` → D-005 (Cloudflare/DO SQLite/hibernation), D-009 (structure).
- `shared/` (TASK-002) : `PublicRoomState`, `Player`, `RoomSettings`, `DEFAULT_SETTINGS`, `ClientMessage`,
  `ServerMessage`, `Couleur`/`COULEURS`, `MIN_PLAYERS`, `MAX_PLAYERS`, `Phase`. **Réutilise ces types**, ne les
  redéfinis pas côté server.
- Point d'entrée actuel : `server/src/index.ts` (Worker) + `server/src/EchoRoom.ts` (à remplacer par `GameRoom`).

## Design imposé
- **Création** : `POST /api/rooms` → renvoie `{ code }` (4 lettres majuscules aléatoires). Pas d'état créé à ce
  stade (le DO s'initialise à la 1re connexion).
- **Connexion** : `GET /api/ws?room=CODE` → upgrade WebSocket → routage `env.GAME_ROOM.idFromName(CODE)`.
- **Identité joueur** : à la connexion, le client envoie en 1er un `joinRoom {pseudo, couleur?, avatar?, playerId?}`.
  - Si `playerId` fourni et connu → **reconnexion** (récupère la place/score, marque `connecte=true`).
  - Sinon nouveau `playerId` (généré serveur) → renvoyé au client (message `roomState` ou un ack) pour qu'il le
    stocke. Le 1er joueur devient **hôte**. Couleur : si prise/absente, assigner une couleur libre de `COULEURS`.
  - Refuser si room pleine (`MAX_PLAYERS`) ou partie déjà lancée (hors lobby) → `error`.
- **Messages lobby gérés dans le DO** : `joinRoom`, `updateSettings` (hôte only, validation), `startGame`
  (hôte only, `players.length >= MIN_PLAYERS` sinon `error`), `leaveRoom` (+ close WS).
- **Départ/déconnexion** (`webSocketClose` ou `leaveRoom`) : marquer déconnecté ou retirer ; si l'**hôte** part,
  **promouvoir** un autre joueur connecté ; si room vide → nettoyer l'état stocké.
- **Diffusion** : après tout changement d'état, **broadcast `roomState`** (snapshot `PublicRoomState`, SANS données
  secrètes) à tous les sockets. Les broadcasts sont libres (ne comptent pas au plafond) — mais garder les messages
  **entrants** discrets (déjà le cas ici).
- **Hibernation & persistance** : utiliser `state.acceptWebSocket()` + handlers `webSocketMessage`/`webSocketClose`.
  **Persister l'état autoritatif dans `ctx.storage`** (SQLite/KV du DO) pour qu'il survive à l'éviction mémoire ;
  reconstruire la vue en mémoire au réveil (constructeur). Attacher le `playerId` à chaque socket via
  `serializeAttachment()` / `deserializeAttachment()`.
- Renommer `EchoRoom` → `GameRoom`, binding `GAME_ROOM`, mettre à jour `wrangler.toml` (migration ; rien n'étant
  déployé, un remplacement propre de la classe SQLite suffit). L'écho peut disparaître côté serveur (le démo client
  écho cessera de fonctionner — **acceptable**, le client sera refait en TASK-004 ; ne PAS toucher `client/`).

## Definition of Done (vérifiable)
- [x] `POST /api/rooms` renvoie un code à 4 lettres ; `GET /api/ws?room=CODE` upgrade en WS vers le bon DO.
- [x] `GameRoom` en **WebSocket Hibernation** + état **persisté dans `ctx.storage`** (survit à un redémarrage du DO).
- [x] Lobby complet : join (host = 1er, attribution couleur, playerId renvoyé), reconnexion via `playerId`,
      updateSettings (hôte only), startGame (garde ≥ MIN_PLAYERS → sinon `error` ; succès → `phase='dealing'` + TODO),
      leaveRoom/disconnect avec **promotion d'hôte** et nettoyage room vide.
- [x] `roomState` (PublicRoomState) diffusé à chaque changement ; **aucune donnée secrète** dans le snapshot.
- [x] `MAX_PLAYERS` et « partie déjà lancée » refusés proprement (`error`).
- [x] **Test d'intégration local** (`server/test/integration.mjs`, client WS Node 24 contre `wrangler dev`) :
      12/12 PASS (voir « Résultat »). Persistance à travers une **éviction complète du DO** non automatisable
      simplement sous `wrangler dev` → procédure manuelle documentée ci-dessous.
- [x] `npm run typecheck`, `npm run lint`, `npm test` PASS depuis la racine.
- [x] Ne touche PAS `client/` ni `docs/` (sauf ce brief). Modifs `shared/` documentées (flux create/join),
      tests `shared` restés verts (33/33).

## Résultat (rempli au retour)

### Fichiers
- **Créés** : `server/src/GameRoom.ts` (DO lobby), `server/test/integration.mjs` (test d'intégration).
- **Modifiés** : `server/src/index.ts` (routes `POST /api/rooms` + `GET /api/ws`), `server/wrangler.toml`
  (binding `GAME_ROOM`, `new_sqlite_classes=["GameRoom"]`), `server/package.json` (script `test:integration`),
  `shared/src/protocol.ts` (réconciliation `JoinRoomMessage` + ajout `JoinedMessage`), `eslint.config.mjs`
  (globals Node/WebSocket pour `server/test/**/*.mjs`).
- **Supprimé** : `server/src/EchoRoom.ts`.

### Design final du flux create/join
- **Création** : `POST /api/rooms` → `{ code }` (4 lettres A–Z, `crypto.getRandomValues`). Aucun état DO créé
  à ce stade. CORS `*` + preflight `OPTIONS` gérés (le front Pages appellera cross-origin).
- **Connexion** : `GET /api/ws?room=CODE` (Upgrade WS obligatoire, code validé `^[A-Z]{4}$`) →
  `env.GAME_ROOM.idFromName(CODE)`. Le DO mémorise le code (query) dès l'upgrade (`ctx.storage['code']`).
- **1er message** `joinRoom {pseudo, couleur?, avatar?, playerId?}` :
  - `playerId` connu → reconnexion (`connecte=true`, ré-attache le socket) ;
  - sinon nouveau `playerId` (`crypto.randomUUID`), couleur souhaitée si libre sinon 1re libre de `COULEURS`,
    1er joueur = hôte. Le serveur répond au socket par un **`joined {playerId, state}`** (ciblé) puis diffuse
    `roomState` à tous.
  - Refus : `GAME_STARTED` (phase ≠ lobby), `ROOM_FULL` (≥ `MAX_PLAYERS`), `INVALID_PSEUDO`, `ALREADY_JOINED`.

### Messages gérés (DO)
`joinRoom`, `updateSettings` (hôte + lobby + validation → sinon `NOT_HOST`/`NOT_IN_LOBBY`/`INVALID_SETTINGS`),
`startGame` (hôte + `players ≥ MIN_PLAYERS` → sinon `NOT_HOST`/`NOT_ENOUGH_PLAYERS`/`ALREADY_STARTED` ;
succès → `phase='dealing'` + `// TODO TASK-005`), `leaveRoom` (retire + ferme le WS). Autres → `UNSUPPORTED`.

### Persistance / hibernation / reconnexion / promotion
- **Persistance** : `ctx.storage` clé `room` = snapshot `PublicRoomState` complet (le lobby n'a aucun secret) ;
  clé `code`. Écrit après chaque mutation ; rechargé dans le constructeur via `blockConcurrencyWhile`.
- **Hibernation** : `state.acceptWebSocket()` + `webSocketMessage`/`webSocketClose` (pas de `addEventListener`).
  Identité socket via `serializeAttachment({playerId})` / `deserializeAttachment()` (persiste à l'hibernation).
- **Déconnexion** : `webSocketClose` en **lobby** ⇒ retrait du joueur ; **en partie** ⇒ `connecte=false`
  (place conservée pour reconnexion). `leaveRoom` ⇒ retrait explicite.
- **Promotion d'hôte** : si l'hôte part/tombe, nouvel hôte = 1er joueur `connecte`, sinon 1er restant.
- **Room vide** ⇒ `storage.deleteAll()` (nettoyage). DO jamais rejoint et sans socket ⇒ nettoyé aussi.

### Modifs `shared/` (documentées)
- `JoinRoomMessage` : suppression de `roomCode` (désormais dans l'URL), `couleur` rendue optionnelle, ajout
  `playerId?` (reconnexion) — conforme au « Design imposé ».
- Ajout `JoinedMessage {type:'joined', playerId, state}` (ack ciblé qui renvoie le `playerId` généré serveur).
- `CreateRoomMessage` conservé (inutilisé côté serveur, création = HTTP) avec commentaire ; tests `shared` verts.

### Résultats des vérifs
- `npm run typecheck` : **PASS** (shared + client + server).
- `npm run lint` : **PASS**.
- `npm test` : **PASS** (33/33 shared, 1/1 client).
- `npm run test:integration -w @qpg/server` (wrangler dev réel, Node 24) : **12/12 PASS** —
  server ready ; `POST /api/rooms`→code ; 3 playerId distincts ; host=1er ; couleurs distinctes ;
  updateSettings hôte reflété ; updateSettings non-hôte→`NOT_HOST` ; startGame@2→`NOT_ENOUGH_PLAYERS` ;
  startGame@3→`dealing` ; départ hôte→promotion ; déconnexion en partie garde la place ; reconnexion via playerId.

### Persistance après éviction complète du DO — procédure manuelle
Le test de reconnexion prouve la conservation d'état pendant la vie du DO. Pour vérifier la survie à une
**éviction mémoire réelle** : `wrangler dev` → POST room, joindre 2 joueurs, puis soit attendre l'hibernation,
soit relancer `wrangler dev` (le storage local `.wrangler/state` persiste), rouvrir un WS sur le même code et
`joinRoom` avec le `playerId` mémorisé → l'état (joueurs/hôte/réglages) est rechargé identique.

### Écarts / points d'arbitrage tracker
- **Ack `joined`** ajouté (le brief autorisait « roomState ou un ack »). Le client (TASK-004) doit lire
  `playerId` dans `joined` (pas dans `roomState`, qui est un broadcast identique pour tous).
- **`CreateRoomMessage`** devenu obsolète (création HTTP). Conservé pour éviter le churn ; à retirer si le
  tracker préfère un protocole strict.
- Bornes de validation des réglages fixées côté serveur (`nbManches` 1–20, `dureeSablier` 10–600 s) — à
  confirmer/aligner avec l'UI de settings en TASK-004.
