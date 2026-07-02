# TASK-004 · Client — Accueil + Salle d'attente + store WS

- **Statut** : dispatché
- **Date** : 2026-07-02
- **Dépend de** : TASK-002 (contrat `shared/`), TASK-003 (serveur lobby)

## Objectif (une seule tâche)
Construire le client React du **lobby** : écran **Accueil** (créer/rejoindre) et **Salle d'attente**, branchés
sur le serveur TASK-003 via un **store WebSocket synchronisé**, avec la **base du design system** (fun/coloré, D-007).
Résultat attendu : un **lobby jouable de bout en bout en local** (créer dans un onglet, rejoindre dans un autre,
se voir mutuellement, l'hôte règle et lance). **Périmètre = lobby uniquement** ; la partie (phase `dealing` et
au-delà) est HORS scope → afficher un placeholder « La partie démarre… (à venir) » sur `phase !== 'lobby'`.

## Contexte utile (à LIRE)
- `docs/design-ux.md` → direction visuelle (D-007 fun/coloré), wireframes **Accueil** et **Salle d'attente**,
  couleurs joueurs accessibles, interactions.
- `docs/state.md` → section « 🔌 Contrat serveur figé (pour le client) » : routes, flux join, message `joined`,
  bornes de settings, erreurs.
- `shared/src/` : `ClientMessage`/`ServerMessage`, `PublicRoomState`, `Player`, `RoomSettings`,
  `DEFAULT_SETTINGS`, `Couleur`/`COULEURS`, `MIN_PLAYERS`, `MAX_PLAYERS`. **Réutilise ces types.**
- `client/src/` : app Vite/React existante (App.tsx = démo écho à REMPLACER), `wsUrl.ts` (résolution URL WS).

## Contrat serveur (rappel)
- Créer : `POST /api/rooms` → `{ code }`. Rejoindre : ouvrir WS `GET /api/ws?room=CODE`, 1er message
  `joinRoom {pseudo, couleur?, avatar?, playerId?}`.
- Le serveur répond `joined {playerId, state}` → **stocker `playerId` (localStorage) pour la reconnexion**, puis
  reçois les `roomState` diffusés. Erreurs `error {code, message}` (`ROOM_FULL`, `INVALID_PSEUDO`, `NOT_HOST`,
  `NOT_ENOUGH_PLAYERS`, `GAME_STARTED`, …) → afficher un feedback clair.
- Bornes settings à respecter dans l'UI : `nbManches` 1–20, `dureeSablier` 10–600 s, `vitesseReveal` ∈ {lent,normal,rapide}.
- Base URL API/WS via env (`VITE_WS_URL`/`VITE_API_URL`) avec défaut local (`http://localhost:8787`, `ws://localhost:8787`).

## À construire
1. **Store WS synchronisé** (hook/contexte, ex. `useRoom`) : connexion, envoi typé de `ClientMessage`, réception
   typée de `ServerMessage`, état = `{connexion, playerId, roomState, lastError}`. Reconnexion auto avec `playerId`
   stocké. Un seul WS par room. Messages **entrants discrets** (respecter la frugalité : pas de spam).
2. **Routing** : `/` (Accueil) et `/room/:code` (Salle d'attente). Rejoindre via lien `/room/CODE` = pré-remplir le code.
3. **Accueil** : champ pseudo, sélecteur de **couleur** (parmi `COULEURS`, indication des prises si connue),
   bouton **Créer** (POST /api/rooms → navigue vers `/room/code` → connecte + join en hôte), section **Rejoindre**
   (champ code → navigue + connecte + join). Validation pseudo non vide.
4. **Salle d'attente** : liste des joueurs (couleur + pseudo + badge hôte + statut connecté), bouton **Copier le
   lien** bien visible, **panneau de réglages** (éditable par l'hôte seulement : nbManches, dureeSablier,
   vitesseReveal — envoie `updateSettings` ; lecture seule pour les autres), bouton **Lancer** (hôte, désactivé si
   `< MIN_PLAYERS`) + mention « min. 3 joueurs ». Sur `phase !== 'lobby'` → placeholder de transition.
5. **Design system de base** (fun/coloré, D-007) : **CSS + variables (design tokens)** — palette vive mais pas
   criarde, coins arrondis, gros boutons, ombres douces, une **police display ronde** (ex. Fredoka/Baloo, self-host
   ou Google Fonts). Composants réutilisables minimaux : `Button`, `Panel/Card`, `Input`, `PlayerBadge`. Pas de
   framework CSS lourd. **Responsive** mobile + desktop de base. Couleurs joueurs distinctes + secours non-couleur
   (initiale/forme) pour l'accessibilité.

## Definition of Done (vérifiable)
- [x] Accueil : créer une room fonctionne (POST → navigation → join hôte) ; rejoindre par code + par lien fonctionne.
- [x] Salle d'attente : liste joueurs live, copie du lien, réglages éditables par l'hôte (reflétés chez tous via
      `roomState`), bouton Lancer désactivé < MIN_PLAYERS et actif ≥ MIN_PLAYERS, placeholder si `phase !== 'lobby'`.
- [x] `playerId` persisté (localStorage) + **reconnexion** auto (voir note lobby vs partie dans « Résultat »).
- [x] Erreurs serveur affichées lisiblement (ex. room pleine, pseudo invalide) — bannière `role="alert"`.
- [x] Design system fun/coloré appliqué (tokens CSS, police ronde Fredoka, composants de base), responsive de base.
- [x] Démo écho supprimée (App.tsx refait). `VITE_*` documentés dans `.env.example`.
- [x] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` PASS depuis la racine.
- [x] **Tests** : unitaires sur la logique pure (réducteur du store, URLs, routeur, garde MIN_PLAYERS) + smoke
      tests RTL/jsdom des 2 écrans. **21 tests client** (4 fichiers) + 33 tests `shared` inchangés.
- [x] **Vérification manuelle documentée** (voir « Résultat ») + **E2E automatisé** contre `wrangler dev`
      (POST + WS join/settings/erreurs/start/reconnexion in-game) : PASS.
- [x] Ne touche PAS `server/` ni `docs/` (sauf ce brief). `shared/` **inchangé** (tests shared verts).

## Résultat (rempli au retour)

### Arborescence client produite
```
client/
  index.html                    # titre + police Fredoka (Google Fonts)
  .env.example                  # VITE_API_URL + VITE_WS_URL documentés
  vite.config.ts                # env jsdom + globals + include .test.{ts,tsx}
  vite-env.d.ts                 # types VITE_API_URL / VITE_WS_URL
  src/
    main.tsx                    # import './styles.css'
    App.tsx                     # routeur : Home (/) vs Room (/room/:code), démo écho supprimée
    router.ts (+ .test.ts)      # micro-routeur History API (parseRoute + useRoute)
    wsUrl.ts (+ .test.ts)       # résolution API/WS + buildCreateRoomUrl / buildRoomWsUrl
    api.ts                      # createRoom() -> POST /api/rooms
    storage.ts                  # playerId/pseudo/couleur (localStorage) + joinIntent (sessionStorage)
    styles.css                  # design tokens + styles composants
    store/
      roomStore.ts (+ .test.ts) # réducteur PUR + gardes (isHost, missingPlayers, canStartGame)
      useRoom.ts                # hook WebSocket (connexion, join, reconnexion backoff, émetteurs)
    ui/
      colors.ts                 # palette 8 couleurs joueurs + secours non-couleur (symbole)
      components.tsx            # Button, Panel, Input, Select, ColorPicker, PlayerBadge, Banner
    screens/
      Home.tsx                  # Accueil (créer / rejoindre)
      Room.tsx                  # Salle d'attente + JoinGate (lien direct) + SettingsPanel
      screens.test.tsx          # smoke tests RTL des 2 écrans (mock WebSocket)
```

### Design du store WS + routing
- **Séparation pur/effets** : `store/roomStore.ts` = réducteur pur `reduce(state, action)` +
  gardes dérivées, testable sans WebSocket. État = `{ connection, playerId, roomState, lastError }`.
  Seuls `joined` / `roomState` / `error` sont traités (lobby) ; messages de jeu ignorés.
- **`store/useRoom.ts`** : hook branché sur le réducteur. Ouvre **un seul WS par salle**
  (`/api/ws?room=CODE`), envoie `joinRoom{pseudo,couleur?,playerId?}` à l'ouverture, persiste le
  `playerId` reçu dans `joined` (localStorage, clé par salle), **reconnexion auto** avec backoff
  (0.5→8 s). Expose `updateSettings`, `startGame`, `clearError`. Entrants discrets (aucun spam).
- **Routing** : micro-routeur maison `router.ts` (History API, **zéro dépendance**) — `/` (Accueil)
  et `/room/:CODE`. `App.tsx` remonte `Room` par `key={code}`. Ouvrir un lien `/room/CODE` mène au
  `JoinGate` (pré-rempli, pseudo requis) avant connexion.
- **Passage Accueil → Salle** : « intention de join » en sessionStorage (pseudo+couleur), consommée
  au montage de la salle ; sinon reconnexion via playerId stocké ; sinon `JoinGate`.

### Composants du design system (D-007)
`Button` (primary/accent/ghost, lg, block), `Panel`, `Input`, `Select`, `ColorPicker` (8 couleurs,
prises grisées, secours forme/symbole), `PlayerBadge` (pastille + initiale + symbole + tag Hôte +
statut connecté), `Banner` (error/warn/info). Tokens CSS (`styles.css`) : crème chaleureux + accents
corail/turquoise/jaune/violet, coins arrondis, ombres douces, police **Fredoka**, grid responsive
(1 colonne < 720 px), focus visibles, couleurs joueurs daltonisme-safe (teinte **+** symbole).

### Résultats de vérif (racine)
- `npm run typecheck` : **PASS** (shared + client + server).
- `npm run lint` : **PASS** (0 warning).
- `npm test` : **PASS** — client **21 tests** (router 3, wsUrl 4, roomStore 10, screens 4) ;
  shared **33 tests** (inchangés).
- `npm run build` : **PASS** (43 modules, ~208 kB js / 66 kB gzip, css 7 kB).
- Smoke tests RTL : Accueil (titre + boutons créer/rejoindre) ; Salle d'attente (WS ouvert vers
  `room=ABCD`, liste joueurs, Lancer désactivé <3 / actif =3, placeholder hors lobby).

### Vérification manuelle / E2E
**Automatisé** : script Node contre `wrangler dev` rejouant le contrat exact du client —
`POST /api/rooms` → 3 WS `joinRoom` → broadcast joueurs+couleurs → `updateSettings` hôte reflété
chez tous → `updateSettings` non-hôte → `NOT_HOST` → `startGame` hôte → `phase=dealing` →
déconnexion/reconnexion in-game via `playerId` (place conservée, `connecte` false→true). **Tout PASS.**

**Procédure manuelle** (2-3 onglets) :
1. `npm run dev:server` (wrangler, port 8787) puis `npm run dev:client` (Vite, port 5173).
2. Onglet A : saisir pseudo, « Créer une partie » → arrive sur `/room/CODE` en hôte.
3. « Copier le lien », coller dans onglets B/C (ou saisir le CODE via « Rejoindre ») → tous se voient
   en direct (couleurs, tag Hôte, point connecté).
4. Hôte modifie Manches/Sablier/Révélation → répercuté chez B/C ; réglages en lecture seule côté B/C.
5. Bouton « Lancer » grisé tant que <3 joueurs (bannière « min. 3 »), actif à 3 ; clic → placeholder
   « La partie démarre… (à venir) » chez tous.
6. Recharger un onglet : reconnexion auto (playerId localStorage).

### Points nécessitant un arbitrage du tracker
- **Reconnexion en LOBBY** : le serveur retire la place à la fermeture du WS en phase `lobby`
  (`webSocketClose` → `removePlayer`). Donc un rechargement de page **en lobby** re-rejoint la salle
  mais peut créer une **nouvelle** entrée (nouveau `playerId`/couleur, statut hôte éventuellement
  promu à un autre) plutôt que de restaurer l'ancienne. La reprise de place « vraie » via `playerId`
  fonctionne **en partie** (`phase !== 'lobby'` → `markDisconnected`, vérifié en E2E). Le client fait
  sa part (persiste + renvoie `playerId`) ; c'est une **sémantique serveur** à confirmer si l'on veut
  une reprise stricte de place dès le lobby (nécessiterait un délai de grâce côté serveur — hors scope).
- **Ajout de devDeps client** : `jsdom`, `@testing-library/react`, `@testing-library/dom` (smoke tests).
  Routing fait maison (pas de `react-router`) pour rester frugal. `shared/` non modifié.
