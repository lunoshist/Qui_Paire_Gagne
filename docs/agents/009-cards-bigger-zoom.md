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
- [ ] Sur l'écran Formation, les cartes-images occupent la majeure partie de l'écran (desktop + mobile) ; les
      emplacements de paires sont compacts/secondaires. Le drag&drop ET le tap-to-pair fonctionnent toujours.
- [ ] Un zoom plein écran sur une carte est disponible et fonctionne au doigt (sans créer de paire par erreur).
- [ ] La Révélation montre les cartes en grand/lisibles.
- [ ] Responsive OK sur largeur mobile (~360px) et desktop.
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` PASS. Smoke tests RTL mis à jour si besoin.
- [ ] Ne touche PAS `server/` ni `shared/` ni `docs/` (sauf ce brief).

## Résultat (rempli au retour)
_(à compléter par le tracker après vérification — idéalement captures/observations sur la taille)_
