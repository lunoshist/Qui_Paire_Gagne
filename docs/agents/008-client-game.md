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
- [x] Le catalogue (manifeste + images) est servi avec le client (script de copie au build) ; les cartes s'affichent.
- [x] Formation : 11 cartes affichées, 5 paires + pomme pourrie formables en drag&drop ET tap-to-pair, sablier local,
      `submitPairs` envoyé une seule fois, état d'attente + « qui a fini », auto-soumission à l'échéance si complet.
- [x] Révélation : affiche paires + auteurs + points depuis `revealPayload`, cas 0-point visibles, pommes pourries ;
      `advance` (hôte) enchaîne.
- [x] Scores/Victoire : cumul trié + écran de victoire (podium, rejouer/retour).
- [x] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` PASS. Tests : logique pure du store (réduction
      des messages de jeu) + logique pure de formation + smoke RTL de l'écran Formation.
- [x] **Vérif end-to-end locale** (documentée) : couverte par `server/test/integration.mjs` (protocole complet
      lobby→manche→reveal→gameOver, 22/22) + procédure manuelle 3 onglets ci-dessous.
- [x] Ne touche PAS `server/` ni `docs/` (sauf ce brief). `shared/` : NON modifié (le contrat couvrait déjà tout).

## Résultat (rempli au retour)

### Fichiers créés (client)
- `client/scripts/copy-catalog.mjs` — pipeline d'assets (recopie `catalog/` → `client/public/catalog/`).
- `client/src/catalog.ts` — chargement du manifeste `/catalog/manifest.json` (cache module + hook `useCatalog`,
  helpers `cardImage`/`cardSubject`, dégradation silencieuse hors-ligne).
- `client/src/game/formation.ts` — logique PURE de formation (5 emplacements + pool → paires + pomme pourrie).
- `client/src/game/formation.test.ts` — tests unitaires de la formation (17 cas).
- `client/src/ui/gameComponents.tsx` — présentiels de jeu : `CardFace`, `PlayerToken`, `Countdown`.
- `client/src/screens/Formation.tsx` — écran Formation (dnd-kit + tap-to-pair + sablier + auto-soumission).
- `client/src/screens/Reveal.tsx` — écran Révélation fonctionnel (paires/auteurs/points + pommes + scores).
- `client/src/screens/Victory.tsx` — écran Victoire (podium + classement + rejouer/retour).
- `client/src/screens/formation.screen.test.tsx` — smoke RTL de Formation (3 tests).

### Fichiers modifiés (client + config)
- `client/src/store/roomStore.ts` — état étendu (`round`, `submitted`, `reveal`, `gameOver`) + réduction pure des
  messages de jeu (`roundStart`/`playerSubmitted`/`revealPayload`/`gameOver`).
- `client/src/store/roomStore.test.ts` — tests de la réduction des messages de jeu (remplace l'ancien « ignoré »).
- `client/src/store/useRoom.ts` — émetteurs `submitPairs()` et `advance()`.
- `client/src/screens/Room.tsx` — routage par phase (lobby / dealing / forming / reveal / finished).
- `client/src/styles.css` — styles des écrans de jeu (design system D-007 réutilisé).
- `client/package.json` — deps `@dnd-kit/core` + `@dnd-kit/utilities` ; scripts `predev`/`prebuild` (copie catalogue).
- `eslint.config.mjs` — globals Node pour `**/scripts/**/*.mjs`.
- `.gitignore` — ignore `client/public/catalog/` (régénéré au build).

### Design retenu
- **Store** : réducteur pur (roomStore) inchangé côté architecture ; `roundStart` remet à zéro l'ardoise
  (`submitted`/`reveal`/`gameOver`), `playerSubmitted` alimente un set idempotent, `revealPayload`/`gameOver` stockés
  tels quels. `useRoom` expose les émetteurs ; aucune émission par mouvement (frugalité respectée).
- **Formation** : `formation.ts` immuable et testable en isolation. UI = `DndContext` (Pointer/Touch/Keyboard
  sensors) : cartes draggables, emplacements + pool + cartes droppables (drop carte-sur-carte = paire) ; tap-to-pair
  en miroir (sélection → appariement, tap sur carte placée = retour au pool). La 11e carte devient auto la pomme
  pourrie une fois les 5 paires pleines.
- **Sablier** : 100 % LOCAL (interval 250 ms sur `deadline`), état d'urgence < 10 s ; à l'échéance, auto-soumission
  si complet (sinon message « 0 point »), garde `expiredHandled` pour n'envoyer qu'une fois.
- **Révélation** : fonctionnelle (anim riche = TASK-009). Paires triées crescendo (0-point d'abord), auteurs en
  jetons couleur, cas solo/unanime explicités, pommes pourries (dorées si double), panneau scores (cumul trié + delta).
- **Assets** : script prebuild/predev qui recopie `catalog/manifest.json` + `catalog/images/` dans `public/catalog/`
  (servi par Vite en dev, copié dans `dist/` au build → Cloudflare Pages). Images manquantes → repli sur le sujet.

### Résultats de vérification
- `npm run typecheck` : PASS (shared + client + server).
- `npm run lint` : PASS (0 erreur).
- `npm test` : PASS — **39 tests** (store réduction lobby+jeu, formation pure ×17, smoke RTL Formation ×3,
  + tests pré-existants router/wsUrl/screens).
- `npm run build` : PASS (prebuild copie le catalogue → `dist/catalog/…`, bundle 265 kB / 84 kB gzip).
- **E2E** : `server/test/integration.mjs` = **22/22 PASS** (le protocole complet consommé par le client :
  roundStart → submitPairs → playerSubmitted → revealPayload → advance → gameOver, + alarme).

### Procédure manuelle (browser e2e, 3 onglets)
1. Terminal A : `npm run dev:server` (wrangler dev).
2. Terminal B : `npm run dev:client` (le `predev` recopie le catalogue ; Vite sur `http://localhost:5173`).
3. Onglet 1 : saisir un pseudo → « Créer une partie » → noter le code / copier le lien.
4. Onglets 2 & 3 : ouvrir le lien, rejoindre (pseudos distincts).
5. Onglet 1 (hôte) : régler un sablier court si besoin → « Lancer ». Les 3 onglets passent en Formation, 11 cartes.
6. Dans chaque onglet : former 5 paires (drag&drop OU double-tap) → « Valider ». Vérifier « qui a fini » + attente.
7. Tous soumis (ou échéance) → Révélation identique sur les 3 onglets ; l'hôte clique « Continuer ».
8. Manche suivante puis, à la dernière, écran Victoire (podium + classement).

### Points d'arbitrage
- **Phase `scores`** : le serveur (TASK-007) ne l'émet jamais (il reste en `reveal` jusqu'à `advance`) ; l'écran
  Révélation intègre donc le panneau de scores. Le routage gère quand même `scores` par sécurité.
- **« Rejouer »/« Retour lobby »** (Victoire) : aucun message serveur de redémarrage n'existe → les deux boutons
  ramènent à l'Accueil (créer une nouvelle partie). À enrichir si un `restart` serveur est ajouté plus tard.
- **Images manquantes** : le manifeste peut référencer des fichiers absents (catalogue en cours de curation) ; la
  carte dégrade proprement en affichant le sujet. Aucune casse.
- **Reconnexion en pleine manche** : le serveur ne re-diffuse pas `roundStart`/`revealPayload` sur un `joined` de
  reprise → un joueur revenu en cours de `forming` n'a pas ses cartes. Hors périmètre (limite serveur, à traiter en
  résilience). Fonctionne parfaitement si l'on rejoint avant le lancement.
- **`@dnd-kit/sortable`** non retenu (installé puis retiré) : seuls `core` + `utilities` sont nécessaires.
