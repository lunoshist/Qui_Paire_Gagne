# TASK-009 · Cartes en GRAND (priorité #1) + zoom

- **Statut** : dispatché
- **Date** : 2026-07-02
- **Dépend de** : TASK-008 (écrans de jeu client)

## Objectif (une seule tâche)
Retravailler la mise en page de l'écran **Formation** (et l'affichage des cartes en **Révélation**) pour que
**les images occupent la majeure partie de l'écran** — c'est LE retour n°1 du commanditaire. Les emplacements de
paires deviennent secondaires/compacts. Ajouter un **zoom** (voir une carte en grand, crucial sur mobile).
Périmètre = **client uniquement**, layout/CSS + interaction zoom. Ne PAS casser le drag&drop / tap-to-pair existants.

## Contexte (à LIRE)
- Retour commanditaire : « les images sont trop petites. Ce sont les images qui doivent prendre la majeure partie de
  l'écran, pas les paires. D'autant plus vrai sur téléphone. Elles doivent apparaître plus grandes, et peut-être une
  option de zoom. » Le drag&drop / la façon de faire les paires « marche bien » → **ne pas le refondre**, juste la taille/place.
- Fichiers : `client/src/screens/Formation.tsx`, `client/src/screens/Reveal.tsx`, `client/src/ui/gameComponents.tsx`
  (`CardFace`), `client/src/styles.css`. Design system D-007 (mais le design global sera revu plus tard — ici on
  se concentre sur la TAILLE/LISIBILITÉ, pas l'esthétique).

## À faire
1. **Formation — images dominantes** :
   - Les 11 cartes du pool s'affichent **grandes** (l'essentiel de la surface), détails visibles, sur desktop ET mobile.
   - La zone des 5 paires + pomme pourrie devient **compacte/secondaire** (ex. barre latérale ou bandeau réduit,
     miniatures), sans gêner la lecture des grandes cartes. Repenser la disposition (pas juste réduire un peu).
   - Mobile : priorité absolue à la taille des cartes ; disposition adaptée (scroll vertical de grandes cartes, zone
     de paires en bas fixe/compacte, etc.). Le drag&drop ET le tap-to-pair doivent rester fonctionnels.
2. **Zoom** : au tap/clic (ou appui long) sur une carte → **agrandissement plein écran** (lightbox) pour voir les
   détails, avec fermeture facile. Doit marcher au doigt (mobile) et ne pas déclencher un appariement involontaire.
3. **Révélation** : afficher les cartes des paires révélées **en grand** aussi (mêmes cartes lisibles).
4. Responsive soigné (petits téléphones → grands écrans). Réutiliser les composants/tokens existants.

## Definition of Done (vérifiable)
- [x] Sur l'écran Formation, les cartes-images occupent la majeure partie de l'écran (desktop + mobile) ; les
      emplacements de paires sont compacts/secondaires. Le drag&drop ET le tap-to-pair fonctionnent toujours.
- [x] Un zoom plein écran sur une carte est disponible et fonctionne au doigt (sans créer de paire par erreur).
- [x] La Révélation montre les cartes en grand/lisibles.
- [x] Responsive OK sur largeur mobile (~360px) et desktop.
- [x] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` PASS. Smoke tests RTL mis à jour si besoin.
- [x] Ne touche PAS `server/` ni `shared/` ni `docs/` (sauf ce brief).

## Résultat (rempli au retour)

**Statut : livré, tout vérifié PASS.**

Fichiers modifiés (client uniquement) :
- `client/src/screens/Formation.tsx` — nouvelle disposition + bouton zoom + lightbox.
- `client/src/screens/Reveal.tsx` — cartes agrandies + zoom.
- `client/src/ui/gameComponents.tsx` — composant `Lightbox` (zoom plein écran réutilisable).
- `client/src/styles.css` — layout `formation-layout`, grandes cartes, panneau paires compact, styles lightbox.
- `client/src/screens/formation.screen.test.tsx` — nouveau smoke test du zoom (ouvre la lightbox sans créer de paire).

### Nouvelle mise en page
- **Desktop** : `formation-layout` en 2 colonnes — colonne principale = **pool des grandes cartes** (grille
  `minmax(180px, 1fr)`, images en `width:100%` = elles remplissent la cellule), colonne secondaire (260-320px,
  `sticky`) = panneau compact des 5 emplacements de paires (miniatures empilées) + pomme pourrie + bouton Valider.
- **Mobile (≤720px)** : layout en une colonne. Les grandes cartes défilent verticalement (**2 par ligne**, 1 par
  ligne sous 380px). Le panneau des paires devient une **barre compacte collée en bas** (`position:sticky; bottom:0`)
  avec défilement horizontal des 5 emplacements + pomme + bouton — on peut donc glisser une carte dessus tout en
  scrollant le pool.
- Le **drag&drop (dnd-kit)** et le **tap-to-pair** sont inchangés (mêmes handlers, mêmes ids droppables) : intacts.

### Zoom
- Chaque carte du pool (et miniatures placées) porte un **bouton loupe 🔍** en surimpression, rendu comme *frère*
  du bouton-carte (pas imbriqué → HTML valide) avec `stopPropagation` sur `pointerDown`+`click` : il n'amorce ni
  drag ni appariement. Clic → **lightbox plein écran** affichant l'image en `min(88vw, 78vh, 560px)` + le sujet.
- Fermeture : clic sur le fond, bouton ✕, ou touche **Échap**. `role="dialog" aria-modal`.
- En **Révélation**, les cartes sont directement cliquables (`zoomable-card`, curseur `zoom-in`) → même lightbox.

### Vérifications (réelles)
- `npm run typecheck` : PASS (shared + client + server).
- `npm run lint` : PASS (0 erreur).
- `npm test` : PASS — **40 tests** (dont le nouveau smoke test du zoom).
- `npm run build` : PASS (vite build OK).
- `npm run format` : mes fichiers reformatés au standard prettier. (Restent en drift `catalog/manifest.json` et
  `scripts/build-manifest.mjs`, **préexistants et hors périmètre** — non touchés.)

### Points d'arbitrage
- **Choix « bouton loupe » plutôt que tap/appui-long** pour le zoom : le tap est déjà pris par le tap-to-pair et
  l'appui long par le `TouchSensor` (délai 120ms). Un bouton dédié est sans ambiguïté et « une option de zoom »
  correspond littéralement à la demande. À valider ergonomiquement par le commanditaire.
- Zoom activé aussi sur les miniatures placées et la pomme (bouton loupe réduit) pour cohérence.
- Barre de paires **sticky en bas** sur mobile (vs simple bloc) : choix UX pour garder les zones de dépôt
  accessibles pendant le scroll ; à confirmer sur device réel (pas de test E2E ici, seulement smoke RTL/jsdom).
- L'esthétique globale n'a pas été retravaillée (hors périmètre : focus taille/lisibilité), réutilisation des
  tokens D-007 existants.
