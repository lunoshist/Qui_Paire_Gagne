# TASK-011 · Révélation retravaillée (meneur pas-à-pas) + fin de partie soignée

- **Statut** : dispatché
- **Date** : 2026-07-02
- **Dépend de** : TASK-007 (reveal serveur), TASK-008 (écrans), TASK-010 (flows)

## Objectif (une seule tâche)
Refondre la **révélation** selon le retour commanditaire, et rendre le **reveal des scores / la fin de partie
plus impactants**. Serveur (pilotage pas-à-pas synchronisé) + client (écran Révélation + Victoire).

## Retour commanditaire (exact)
- « Pour la révélation c'est trop rapide, et surtout **il n'y a pas de différence entre les trois modes**. »
- Attendu : **PAR DÉFAUT, les paires apparaissent UNE PAR UNE, jusqu'à ce que le MENEUR (hôte) passe à la suivante**
  → laisse aux auteurs le temps de s'expliquer/se justifier.
- Un **mode rapide** = ce qui est déjà en place (auto enchaîné).
- « Pour le reveal des scores, la fin de partie, il faut un truc **plus impactant, plus soigné**. »

## À faire
### Modes de révélation (le point clé : ils doivent VRAIMENT différer)
- Réglage `vitesseReveal` (lobby) → rendre les modes distincts et clairs. Cible :
  - **Meneur / pas-à-pas (DÉFAUT)** : révélation **une paire à la fois**, **synchronisée pour tous**, l'**hôte**
    clique « Suivante » pour avancer (les non-hôtes voient la même chose + mention « le meneur dévoile… »).
  - **Rapide (auto)** : enchaînement automatique (comportement actuel).
  - (Tu peux simplifier l'enum à 2 modes clairs OU garder 3 en les rendant réellement différents ; documente le choix.
   Mets à jour `shared` (`VitesseReveal`) + les libellés du lobby si besoin, tests verts.)
### Synchronisation serveur (pour le mode meneur)
- Le serveur pilote un **curseur de révélation** : ordonner les items (paires triées crescendo, puis pommes pourries),
  garder un `revealStep`. Nouveau message **`revealNext`** (hôte) → incrémente le curseur, **broadcast** de l'étape
  courante à tous (tout le monde voit la même paire au même moment). Quand tout est révélé → l'hôte fait `advance`
  (déjà existant) pour la manche suivante. Persister `revealStep` (hibernation). En mode **rapide**, l'auto-play
  client actuel suffit (pas besoin du pas-à-pas serveur).
### Fin de partie / scores plus soignés
- **Reveal des points** : à chaque paire dévoilée, animation satisfaisante (points qui « tombent »/volent vers les
  scores, mise en avant des auteurs, gags 0-point solo/unanime). Utiliser des animations (CSS ou lib `motion` si dispo).
- **Écran Victoire** : podium plus spectaculaire (1/2/3), effet de célébration (confettis/anim), classement final
  clair. « Plus impactant, plus soigné » — sans refonte du design global (ça viendra), mais nettement plus abouti.

## Definition of Done (vérifiable)
- [x] Mode **meneur pas-à-pas** par défaut : paires révélées 1 à 1, **synchronisées**, l'hôte avance (`revealNext`),
      les autres suivent ; à la fin, `advance` pour la manche suivante.
- [x] Mode **rapide** = auto (distinct et visiblement différent du mode meneur).
- [x] Reveal des points animé/satisfaisant ; cas 0-point (solo/unanime) mis en scène.
- [x] Écran Victoire nettement plus soigné (podium + célébration).
- [x] `revealNext` géré serveur (curseur synchronisé, persistant) ; `shared` mis à jour (documenté ci-dessous).
- [x] Tests : intégration serveur (revealNext avance le curseur, borne haute, non-hôte refusé, resync) + client (réducteur/état).
- [x] `npm run typecheck`, `npm run lint`, `npm test` (+ integration), `npm run build` PASS. Docs non touchés (sauf ce brief).

## Résultat (rempli au retour)

### Décision d'arbitrage : enum `VitesseReveal` simplifié à 2 modes
Passé de `'lent' | 'normal' | 'rapide'` (3 tempos indistincts — plainte n°1) à **2 modes au comportement
franchement distinct** :
- **`meneur`** (DÉFAUT, `DEFAULT_SETTINGS.vitesseReveal`) : révélation **une paire à la fois**, curseur
  `revealStep` **autoritatif serveur**, l'hôte clique « Suivante » (`revealNext`) → broadcast `revealStep` à tous.
- **`rapide`** : auto-play **100 % client** (timer local ~1,2 s/étape), zéro message par étape.
- Compat ascendante serveur : réglages persistés avec un ancien tempo (`lent`/`normal`) retombent sur `meneur`
  au réveil du DO ; le client mappe défensivement tout mode ≠ `rapide` vers l'affichage meneur.

### Curseur serveur (mode meneur)
- `RoundData.revealStep` (persisté, hibernation ; migration si absent → 0) ; initialisé à 0 en entrée de `reveal`.
- Message client **`revealNext`** (hôte only, phase `reveal`) → incrémente, **borné** par `revealTotalSteps()`
  = nb paires distinctes + 1 étape finale « pommes pourries » (si ≥1) ; broadcast **`revealStep { step }`**.
- `revealPayload` porte désormais `revealStep` → un **resync mid-reveal** renvoie le curseur COURANT (pas 0).
- `advance` (existant) inchangé → manche suivante / fin.

### Fichiers modifiés
- `shared/src/domain.ts` : `VitesseReveal` → `'meneur' | 'rapide'` ; défaut `meneur`.
- `shared/src/protocol.ts` : `+ RevealNextMessage` (client), `+ RevealStepMessage` (serveur),
  `+ revealStep` sur `RevealPayloadMessage`.
- `server/src/GameRoom.ts` : `RoundData.revealStep` + migration, `handleRevealNext` + `revealTotalSteps`,
  init/persist du curseur, `VITESSES` = 2 modes + migration réglages, `buildRevealPayload` porte `revealStep`.
- `client/src/store/roomStore.ts` : état `revealStep`, réducteur `revealStep` + init via `revealPayload` + reset.
- `client/src/store/useRoom.ts` : émetteur `revealNext`.
- `client/src/screens/Reveal.tsx` : refonte — curseur meneur (serveur) vs rapide (timer local), révélation
  progressive, scores **en direct** qui montent, gags solo/unanime, finale pommes, barre de progression, contrôles hôte/non-hôte.
- `client/src/screens/Victory.tsx` : confettis CSS, podium animé (marches qui montent, médailles, couronne), gagnant surligné.
- `client/src/screens/Room.tsx` : libellés lobby (Meneur pas à pas / Rapide auto) + passe `mode`/`revealStep`/`onRevealNext`.
- `client/src/styles.css` : animations reveal-pop/deflate/wobble/points-fly/score-bump, barre de progression,
  confettis, podium ; respect `prefers-reduced-motion`.
- Tests : `client/src/store/roomStore.test.ts` (+ curseur), `server/test/integration.mjs` (bloc #16).

### Animations (sans lib — framer-motion absent → CSS pur)
- Reveal : `reveal-pop` (apparition ressort de chaque paire), `deflate` (gag solo dégonflé), `wobble` (gag unanime),
  `points-fly` (« +N » qui s'envole), `score-bump` (le total pulse quand il monte), barre de progression animée.
- Victory : `confetti-fall` (80 confettis), `podium-rise` (marches en cascade), `crown-bounce` (couronne + médailles).

### Résultats des vérifs (réel)
- `npm run typecheck` → **PASS** (shared + client + server).
- `npm run lint` → **PASS**.
- `npm test` → **PASS** : shared 33/33, client 45/45 (dont réducteur `revealStep` : payload/resync/step/reset).
- `npm run test:integration -w @qpg/server` → **PASS 40/40**, dont bloc #16 :
  revealStep initial 0 · revealNext non-hôte refusé (NOT_HOST) · incrément diffusé à tous · atteint le total ·
  **borne haute** (au bout, plus d'incrément) · **resync mid-reveal** renvoie le step courant.
- `npm run build` → **PASS** (vite build OK).

### Points d'arbitrage
- **2 modes plutôt que 3** : choix assumé pour que la différence soit franche (le cœur de la plainte). Le tempo
  fin (lent/normal/rapide) n'apportait pas de vraie différence perçue ; le pas-à-pas meneur remplace « lent/normal ».
- **1 étape = 1 paire, + 1 étape finale groupée pour toutes les pommes** (révélation simultanée, cf. storyboard D-008).
- **Mode rapide = auto-play client** (pas de curseur serveur) : conforme au brief (« l'auto-play client actuel suffit »).
