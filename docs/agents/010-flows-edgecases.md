# TASK-010 · Flows & scénarios — reconnexion, rejouer, rejoindre en cours, cas limites

- **Statut** : livré
- **Date** : 2026-07-02
- **Dépend de** : TASK-003 (lobby), TASK-007 (round serveur), TASK-008 (client jeu)

## Objectif (une seule tâche)
Rendre l'expérience **fluide et sans point de friction** en couvrant **tous** les scénarios de cycle de vie d'une
partie (pas seulement les exemples). Serveur (GameRoom) + client (store/écrans). Le but : plus jamais de joueur
« coincé », et pouvoir rejouer/relancer sans recréer de room.

## Contexte (retours commanditaire, à traiter EXHAUSTIVEMENT)
- Fin de partie : **il faut pouvoir rejouer / relancer sans recréer une room** (frustrant).
- **Rejoindre une partie en cours** : aujourd'hui refusé (`GAME_STARTED`).
- **Reconnexion en pleine manche** : aujourd'hui on reste bloqué sur « La partie démarre… / Chargement » (le serveur
  ne re-diffuse pas l'état de manche au rejoint). Doit **revenir comme si de rien n'était**.
- **Relancer pour inclure quelqu'un ou changer un réglage** : impossible actuellement.
- « Vraiment tout envisager » → voir la checklist ci-dessous.

## Scénarios à couvrir (checklist)
### Reconnexion / resync (PRIORITÉ)
- [x] À la (re)connexion WS (join avec `playerId` connu), le serveur **renvoie à CE socket l'état courant complet** :
      `roomState` (via `joined`) + selon la phase : `roundStart` (avec `deadline` restant) en `forming`, `revealPayload`
      en `reveal`/`scores`, `gameOver` en `finished`. Le client route alors vers le bon écran (fini le placeholder bloquant).
- [x] Le client gère la réception tardive de ces messages (reconnexion) sans casser l'état local (réducteur idempotent).
- [x] Un joueur qui recharge la page en pleine manche **retrouve sa place, son état de soumission, le sablier en cours**
      (resync ré-émet `roundStart` avec la même `deadline` + un `playerSubmitted` par joueur déjà soumis).

### Rejoindre en cours de partie
- [x] Autoriser un nouveau joueur à rejoindre une partie déjà lancée : il est ajouté, **spectateur** de la manche en
      cours (écran clair « partie en cours, tu joueras à la prochaine manche »), puis **inclus dès la manche suivante**.
- [x] Respecter `MAX_PLAYERS` (garde `ROOM_FULL` conservée).

### Fin de partie / rejouer / relancer
- [x] Depuis l'écran Victoire (finished), l'hôte peut **Retour au lobby** (`returnToLobby`) : phase→lobby, scores
      remis à zéro, **joueurs conservés** ; l'hôte peut alors changer les réglages et relancer (`startGame`).
- [x] « Rejouer » = retour au lobby puis relance (même mécanisme) → réutilisable pour inclure un nouveau venu ou
      changer un paramètre. Tout le monde suit (broadcast `roomState`).
- [x] Pas de cul-de-sac : le bouton « Rejouer » de l'hôte déclenche `returnToLobby` (même salle).

### Départs / déconnexions en jeu
- [x] **Hôte qui quitte en pleine partie** → promotion d'un autre joueur (via `promoteHost`, déjà appelé dans
      `markDisconnected` ET `removePlayer` → couvre toutes les phases).
- [x] Joueur qui quitte en manche → compté absent (0) ; s'il revient avant résolution, il reprend (place conservée
      + resync).
- [x] Tous les joueurs partis → nettoyage (déjà géré). Robustesse hôte part pendant reveal/finished → promotion.
- [ ] (Bonus, NON fait) reprise de place en LOBBY au rechargement sans doublon (délai de grâce) : hors périmètre,
      un départ en lobby retire toujours la place (comportement inchangé).

## Definition of Done (vérifiable)
- [x] Reconnexion en `forming`/`reveal`/`finished` → le client affiche le bon écran (aucun blocage « Chargement »).
- [x] Rejoindre en cours = spectateur puis intégré à la manche suivante.
- [x] `returnToLobby` (hôte) fonctionne depuis la fin de partie ; on peut changer réglages + relancer, même room.
- [x] Promotion d'hôte en pleine partie.
- [x] Nouveau message protocole `returnToLobby` dans `shared/` — documenté ; tests shared/client verts.
- [x] **Tests d'intégration** couvrant les 5 cas — tous PASS (voir Résultat).
- [x] `npm run typecheck`, `npm run lint`, `npm test` (+ integration) PASS. `npm run build` PASS. Docs non touchés (sauf ce brief).

## Résultat (rempli au retour)

### Côté serveur (`server/src/GameRoom.ts`)
- **Resync ciblé** : nouveau `sendResync(ws, playerId)` appelé après `joined` à chaque (re)connexion. Selon la phase
  envoie au SEUL socket : `roundStart` (participant, `forming`) + `playerSubmitted` des déjà-soumis, `revealPayload`
  (`reveal`/`scores`), `gameOver` (`finished`). Refactor : `buildRevealPayload` / `buildGameOver` partagés par
  broadcast et resync.
- **Join en cours autorisé** : suppression du refus `GAME_STARTED`. Notion de **participants** ajoutée à `RoundData`
  (joueurs présents au démarrage du round) : un arrivant en cours est spectateur (rejet `SPECTATOR` s'il tente de
  soumettre, exclu du scoring et du « tous ont soumis »), intégré au prochain `beginRound`. Migration ascendante gérée
  (round persisté sans `participants`).
- **`returnToLobby`** (hôte, depuis `finished`) : scores à 0, `mancheCourante=0`, `round=null`, alarme purgée,
  joueurs conservés → relance possible dans la même salle.
- **Promotion d'hôte** : déjà branchée dans `markDisconnected` et `removePlayer` → vérifiée en pleine manche.

### Côté client
- `shared/src/protocol.ts` : message `ReturnToLobbyMessage` ajouté à `ClientMessage`.
- `store/roomStore.ts` : le réducteur efface `round/submitted/reveal/gameOver` quand un `roomState`/`joined` arrive en
  phase `lobby` (nettoie l'ardoise après `returnToLobby`) ; conserve l'état hors lobby (reconnexion mid-partie).
- `store/useRoom.ts` : émetteur `returnToLobby()`.
- `screens/Room.tsx` : routage phase revu — spectateur en `forming` (nouveau `SpectatorPanel`) quand pas de round
  courant ; placeholders de transition non bloquants ; passe `iAmHost`/`onReturnToLobby` à Victory.
- `screens/Victory.tsx` : bouton « Rejouer (même salle) » = `returnToLobby` pour l'hôte, sinon bannière d'attente.

### Vérifications (réel, par cas)
- `npm run typecheck` : **PASS** (shared/client/server). `npm run lint` : **PASS**. `npm run build` : **PASS**.
- `npm test` : **PASS** — shared 33 tests, client 42 tests (dont nouveaux tests réducteur lobby-reset).
- `npm run test:integration -w @qpg/server` : **33 PASS / 0 FAIL**, dont les 5 nouveaux cas :
  - reconnexion mid-forming → re-reçoit `roundStart` (mêmes cartes + `deadline` en cours) : **PASS**
  - reconnexion mid-forming → restaure l'état « a soumis » (`playerSubmitted`) : **PASS**
  - reconnexion mid-reveal → re-reçoit `revealPayload` (deltas + soumissions) : **PASS**
  - join-in-progress → spectateur (aucun `roundStart`) + soumission refusée `SPECTATOR` : **PASS**
  - join-in-progress → intégré à la manche suivante (reçoit `roundStart`, peut soumettre) : **PASS**
  - `returnToLobby` non-hôte → `NOT_HOST` ; hôte → lobby (joueurs conservés, scores 0, manche 0) + relance : **PASS**
  - hôte quitte en jeu → promotion (nouvel hôte, partie non interrompue) : **PASS**

### Points d'arbitrage
- `returnToLobby` restreint à la phase `finished` (per brief) ; renvoie `NOT_FINISHED` sinon.
- Reprise de place en LOBBY au rechargement (anti-doublon) laissée hors périmètre (marquée bonus non fait).
- `revealPayload` de resync inclut toutes les soumissions mémorisées de la manche (participants) — cohérent avec le
  broadcast live désormais construit de la même source.
