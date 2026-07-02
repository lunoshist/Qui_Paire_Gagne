# TASK-007 · Logique serveur d'une manche (dealing → forming → reveal → scores)

- **Statut** : dispatché
- **Date** : 2026-07-02
- **Dépend de** : TASK-002 (`shared/` : types + `computeRoundResult`), TASK-003 (GameRoom lobby)

## Objectif (une seule tâche)
Étendre le Durable Object `GameRoom` (côté `server/`) pour jouer une **manche complète**, côté serveur uniquement :
distribution des 11 cartes → formation (soumissions secrètes + sablier) → résolution (scores) → révélation →
enchaînement des manches → fin de partie. **Périmètre = serveur.** L'UI de jeu côté client = tâche suivante (TASK-008).

## Contexte utile (à LIRE)
- `docs/architecture.md` → « Machine à états », « Protocole client ↔ serveur », « Règle de sécurité » (soumissions
  SECRÈTES jusqu'au reveal), « frugalité des messages ».
- `shared/` : `ClientMessage`/`ServerMessage` (`startGame`, `submitPairs`, `advance`, `roundStart`,
  `playerSubmitted`, `revealPayload`, `gameOver`), `PlayerSubmission`, `RoundResult`, `computeRoundResult`,
  `CARDS_PER_ROUND` (11), `PAIRS_PER_ROUND` (5), `DEFAULT_SETTINGS`. **Réutilise `computeRoundResult` tel quel.**
- `server/src/GameRoom.ts` (lobby existant ; `startGame` a un `// TODO TASK-005` → c'est CE travail ; corrige le label).
- `catalog/manifest.json` (racine) : pool de cartes `{id, tags,...}`. Le serveur a besoin des **ids + tags** pour le
  tirage (pas des images). Bundler/importer ce JSON dans le worker (ids+tags seulement).

## À implémenter (dans GameRoom, en respectant hibernation + persistance `ctx.storage`)
1. **Tirage** : à `startGame` (garde ≥ MIN_PLAYERS déjà là), passer `phase='dealing'` puis tirer **11 cartes**.
   - v1 SIMPLE : 11 ids aléatoires distincts du manifeste. **TODO** (commentaire) : remplacer par l'algo d'ambiguïté
     de `docs/catalog.md` quand le catalogue sera plus grand. Si le manifeste a < 11 cartes → `error` clair.
2. **Forming** : `phase='forming'`, calculer `deadline = Date.now() + dureeSablier*1000`, **broadcast** `roundStart
   {manche, cards:[11 ids], deadline}`. Armer une **alarme DO** (`ctx.storage.setAlarm(deadline)`) pour la résolution.
3. **`submitPairs {paires, pommePourrie}`** : valider (5 paires, cartes ∈ tirage, pomme pourrie = la 11e non appariée),
   **stocker la soumission en privé** (JAMAIS diffusée), marquer le joueur soumis, **broadcast `playerSubmitted
   {playerId}`** (sans contenu). Si **tous les joueurs connectés** ont soumis → résoudre immédiatement (annuler l'alarme).
4. **Résolution** (déclenchée par tous-soumis OU par l'**alarme** à l'échéance) : `computeRoundResult(soumissions,
   idsJoueursConnectés)`, cumuler dans `scoreCumul`, `phase='reveal'`, **broadcast `revealPayload`** (contenu de
   `RoundResult` : parPaire, pommesPourries, deltaScores — le client a le manifeste pour les images). Les joueurs
   sans soumission (déconnexion/temps écoulé) = soumission vide (0 point), à gérer proprement.
5. **`advance`** (hôte ; ou auto après délai) : si `manche < nbManches` → nouvelle manche (retour dealing/tirage) ;
   sinon `phase='finished'` + **broadcast `gameOver {scoreboard trié}`**.
6. **Secret** : à AUCUN moment les paires d'un joueur ne sont diffusées avant `reveal`. Le `roomState`/snapshots ne
   contiennent pas les soumissions.
7. Persister tout nouvel état dans `ctx.storage` (survit à l'hibernation). Gérer l'`alarm()` handler du DO.

## Definition of Done (vérifiable)
- [x] `startGame` → tirage de 11 cartes + `roundStart` (avec `deadline`) diffusé ; alarme DO armée.
- [x] `submitPairs` validé + stocké **secret** ; `playerSubmitted` diffusé sans contenu ; résolution si tous soumis.
- [x] Résolution aussi déclenchée par l'**alarme** à l'échéance du sablier (testé).
- [x] `revealPayload` = `computeRoundResult` correct ; `scoreCumul` mis à jour ; soumissions absentes = 0.
- [x] `advance` enchaîne les manches puis `gameOver {scoreboard}` après `nbManches`.
- [x] Aucune fuite de soumission avant reveal (vérifié dans un test).
- [x] **Test d'intégration** (étendre `server/test/integration.mjs` ou nouveau) : partie 3 joueurs, 1 manche complète
      (join → start → submit ×3 → revealPayload conforme aux scores attendus → advance → manche 2 / gameOver).
      + un test du tirage (11 distinctes). Rapporter PASS/FAIL par cas.
- [x] `npm run typecheck`, `npm run lint`, `npm test` PASS. Ne touche PAS `client/` ni `docs/` (sauf ce brief).
      Modifs `shared/` seulement si nécessaire (documenter, tests shared verts).

## Résultat (rempli au retour)

**Statut : TERMINÉ.** Périmètre respecté (serveur uniquement ; `client/` et `shared/` intacts, `docs/` = ce
seul brief).

### Fichiers modifiés / créés
- `server/src/GameRoom.ts` — logique complète d'une manche ajoutée au DO (le `// TODO TASK-005` est remplacé).
- `server/src/cards.ts` (nouveau) — pool de cartes bundlé depuis `catalog/manifest.json` (**id + tags seulement** ;
  `file`/`source` écartés). Import JSON build-time (`resolveJsonModule` déjà activé) inliné par esbuild.
- `server/test/integration.mjs` — 3 nouveaux blocs (manche complète, anti-fuite, alarme) + journal `raw` par client.

### Design
- **États** : `dealing` (transitoire, tirage) → `forming` (soumissions + sablier) → `reveal` (résolu) →
  `advance` → manche suivante (`dealing`) ou `finished`. Le champ `mancheCourante` passe à 1 au `startGame`.
- **Secret / anti-fuite** : l'état SECRET (`tirage`, `deadline`, `submissions`, `reveal`) est persisté sous une
  clé de storage séparée (`round`) et n'est **jamais** inclus dans le snapshot public (`roomState`). Les
  soumissions ne sortent qu'au `revealPayload`. `playerSubmitted` ne porte que `{type, playerId}`. Vérifié par
  scan du flux brut reçu par un joueur n'ayant pas encore soumis.
- **Alarme DO** : `setAlarm(deadline)` armée en entrant en `forming` ; handler `alarm()` → `resolveRound()` si
  encore en `forming` (survit à l'hibernation via réhydratation dans le constructeur). Résolution anticipée
  (tous connectés soumis) → `deleteAlarm()`. Une déconnexion peut aussi débloquer la résolution.
- **Tirage** : v1 = 11 ids DISTINCTS aléatoires (Fisher–Yates partiel, RNG `crypto`). `TODO` documenté pour
  brancher l'algo d'ambiguïté de `docs/catalog.md`. Garde `CATALOG_TOO_SMALL` si le pool < 11.
- **Résolution** : `computeRoundResult(soumissions_connectés, ids_connectés)` réutilisé tel quel ; cumul dans
  `scoreCumul` de chaque joueur ; joueurs connectés sans soumission = 0 (deltaScores initialisé à 0). `gameOver`
  diffuse un `classement` trié par score décroissant + `scoresFinaux`.
- **Persistance** : `persist()` écrit `room` ET `round` (ou les supprime) → survit à l'hibernation. Nettoyage de
  l'alarme + du storage quand la salle se vide.
- **Validation `submitPairs`** : exactement 5 paires de 2 cartes distinctes, 1 pomme pourrie, 11 ids distincts
  couvrant EXACTEMENT le tirage ; refus si déjà soumis (`ALREADY_SUBMITTED`) ou hors `forming` (`NOT_FORMING`).

### Résultats de vérification
- `npm run typecheck` → **PASS** (shared + client + server).
- `npm run lint` → **PASS**.
- `npm test` → **PASS** (shared 33, client 21).
- `npm run test:integration -w @qpg/server` → **22 PASS / 0 FAIL**, dont les cas TASK-007 :
  - `roundStart manche 1 : 11 cartes DISTINCTES + deadline` → PASS
  - `anti-fuite : aucune soumission/reveal diffusé avant reveal` → PASS
  - `revealPayload manche 1 : deltaScores conformes (6/6/0)` → PASS
  - `revealPayload manche 1 : cumul conforme (6/6/0)` → PASS
  - `revealPayload : soumissions révélées (au reveal seulement)` → PASS
  - `advance → manche 2 démarrée (nouveau roundStart)` → PASS
  - `revealPayload manche 2 : cumul cumulé sur 2 manches (12/12/0)` → PASS
  - `gameOver après nbManches : classement trié + scores finaux` → PASS
  - `phase finished après gameOver` → PASS
  - `résolution par ALARME à l'échéance du sablier (aucune soumission → 0 pt)` → PASS

### Points d'arbitrage
- **Sablier de test** : `sanitizeSettings` impose `dureeSablier ≥ 10 s` (règle lobby existante, non modifiée).
  Le test d'alarme utilise donc **10 s** (au lieu des ~2 s suggérés) et attend le reveal jusqu'à 15 s, plutôt que
  d'affaiblir la validation de production.
- **Soumission puis déconnexion** : un joueur déconnecté au moment de la résolution est traité comme absent
  (0 pt), même s'il avait soumis — cohérent avec « scores calculés sur les joueurs connectés ». S'il se reconnecte
  avant l'échéance, sa soumission est reprise.
- **Phase `scores`** : non matérialisée séparément (le `revealPayload` porte déjà `deltaScores` + `cumul`) ;
  `advance` part directement de `reveal`. Conforme à l'architecture (phase `scores` optionnelle).
- **Auto-advance** : non implémenté (seul l'hôte déclenche `advance`) — laissé à la couche client/UX (TASK-008).
