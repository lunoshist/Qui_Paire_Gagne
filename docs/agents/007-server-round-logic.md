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
- [ ] `startGame` → tirage de 11 cartes + `roundStart` (avec `deadline`) diffusé ; alarme DO armée.
- [ ] `submitPairs` validé + stocké **secret** ; `playerSubmitted` diffusé sans contenu ; résolution si tous soumis.
- [ ] Résolution aussi déclenchée par l'**alarme** à l'échéance du sablier (testé).
- [ ] `revealPayload` = `computeRoundResult` correct ; `scoreCumul` mis à jour ; soumissions absentes = 0.
- [ ] `advance` enchaîne les manches puis `gameOver {scoreboard}` après `nbManches`.
- [ ] Aucune fuite de soumission avant reveal (vérifié dans un test).
- [ ] **Test d'intégration** (étendre `server/test/integration.mjs` ou nouveau) : partie 3 joueurs, 1 manche complète
      (join → start → submit ×3 → revealPayload conforme aux scores attendus → advance → manche 2 / gameOver).
      + un test du tirage (11 distinctes). Rapporter PASS/FAIL par cas.
- [ ] `npm run typecheck`, `npm run lint`, `npm test` PASS. Ne touche PAS `client/` ni `docs/` (sauf ce brief).
      Modifs `shared/` seulement si nécessaire (documenter, tests shared verts).

## Résultat (rempli au retour)
_(à compléter par le tracker après vérification)_
