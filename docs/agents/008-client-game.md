# TASK-008 · Client — écran de jeu (Formation + Révélation + Scores + Victoire)

- **Statut** : dispatché
- **Date** : 2026-07-02
- **Dépend de** : TASK-004 (client lobby + store), TASK-007 (messages serveur de manche), `shared/`

## Objectif (une seule tâche)
Rendre le jeu **jouable de bout en bout côté client** : étendre le store WS pour gérer les messages de manche, puis
construire l'écran **Formation** (afficher les 11 cartes, former ses 5 paires + pomme pourrie, sablier, soumettre),
et des écrans **Révélation + Scores + Victoire** **fonctionnels** (animation soignée = TASK-009 ensuite). Inclure le
**pipeline d'assets** (rendre le catalogue accessible au client déployé).

## Contexte utile (à LIRE)
- `docs/design-ux.md` → wireframes Formation & Révélation, interactions (drag&drop + tap-to-pair), storyboard.
- `docs/architecture.md` → protocole (roundStart/playerSubmitted/revealPayload/gameOver), frugalité (drag&drop LOCAL,
  timer LOCAL sur `deadline`, aucune émission par mouvement ; un seul `submitPairs`).
- `shared/src/` : `RoundStartMessage {manche, cards:[11 ids], deadline}`, `PlayerSubmittedMessage {playerId}`,
  `RevealPayloadMessage` (RoundResult : parPaire/pommesPourries/deltaScores), `GameOverMessage {classement,...}`,
  `submitPairs {paires:[[a,b]×5], pommePourrie}`, `advance`, `CARDS_PER_ROUND`, `PAIRS_PER_ROUND`, `Phase`.
- `client/src/store/roomStore.ts` + `useRoom.ts` (à ÉTENDRE ; ils ignorent aujourd'hui les messages de jeu).
- `client/src/screens/Room.tsx` (route la phase ; aujourd'hui placeholder si phase ≠ lobby).
- `catalog/manifest.json` + `catalog/images/` (racine) : mapping id → image.

## À implémenter
1. **Pipeline d'assets** : au build client, **copier `catalog/manifest.json` + `catalog/images/` dans les assets
   servis** (ex. `client/public/catalog/`) via un script prebuild (`predev`/`prebuild`). Le client charge le
   manifeste (`/catalog/manifest.json`) et les images (`/catalog/images/<file>`). (Le catalogue grandira ; le script
   doit juste recopier le dossier courant.)
2. **Store** : gérer `roundStart` (stocker manche/cards/deadline), `playerSubmitted` (set des joueurs ayant fini),
   `revealPayload` (stocker le résultat), `gameOver` (classement). Exposer `submitPairs(paires, pommePourrie)` et
   `advance()`. Router selon `phase` : lobby / forming / reveal / finished.
3. **Écran Formation** (phase `forming`) :
   - Afficher les **11 cartes** (images du manifeste) dans un pool.
   - **Former 5 paires** + **1 pomme pourrie** : drag&drop (dnd-kit) **et** tap-to-pair (mobile). Slots clairs.
     Réarrangement possible ; la carte restante va auto en pomme pourrie.
   - **Sablier** : compte à rebours LOCAL basé sur `deadline` (pas de tick serveur).
   - **Valider** → `submitPairs`. Après soumission : état « en attente », afficher **qui a fini** (`playerSubmitted`).
   - **Auto-soumission** à l'échéance si l'arrangement est complet (sinon le serveur comptera 0 — l'indiquer).
4. **Écran Révélation** (phase `reveal`) — FONCTIONNEL (pas besoin d'animation riche ici, c'est TASK-009) :
   afficher chaque paire du `revealPayload` (les 2 images), qui l'a faite (jetons couleur), les points ; traiter
   visuellement les **0 point** (solo / unanime) ; puis les **pommes pourries**. Bouton **Continuer** (hôte → `advance`).
5. **Écran Scores / Victoire** : tableau cumul trié ; sur `finished` (gameOver) → **podium** + boutons Rejouer /
   Retour lobby.
6. **Responsive** mobile + desktop, réutiliser le design system (D-007) existant.

## Definition of Done (vérifiable)
- [ ] Le catalogue (manifeste + images) est servi avec le client (script de copie au build) ; les cartes s'affichent.
- [ ] Formation : 11 cartes affichées, 5 paires + pomme pourrie formables en drag&drop ET tap-to-pair, sablier local,
      `submitPairs` envoyé une seule fois, état d'attente + « qui a fini », auto-soumission à l'échéance si complet.
- [ ] Révélation : affiche paires + auteurs + points depuis `revealPayload`, cas 0-point visibles, pommes pourries ;
      `advance` (hôte) enchaîne.
- [ ] Scores/Victoire : cumul trié + écran de victoire (podium, rejouer/retour).
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` PASS. Tests : logique pure du store (réduction
      des messages de jeu) + smoke RTL de l'écran Formation.
- [ ] **Vérif end-to-end locale** (documentée) : `wrangler dev` + `vite dev`, 3 onglets → créer/rejoindre → lancer →
      former paires → soumettre → révélation → scores → manche suivante / victoire. Automatiser ce qui est raisonnable.
- [ ] Ne touche PAS `server/` ni `docs/` (sauf ce brief). `shared/` seulement si nécessaire (documenté, tests verts).

## Résultat (rempli au retour)
_(à compléter par le tracker après vérification)_
