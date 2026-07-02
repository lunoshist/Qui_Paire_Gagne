# TASK-013 · Modes & réglages : mode 2 joueurs (coopératif) + temps infini

- **Statut** : dispatché
- **Date** : 2026-07-02
- **Dépend de** : TASK-002 (scoring/contrat), TASK-007 (round serveur), TASK-008 (client)

## Objectif (une seule tâche)
Ajouter deux réglages de partie : un **mode 2 joueurs** avec scoring **coopératif** distinct, et une option
**temps illimité** (sablier infini). Serveur + shared + client (lobby + affichage scores/reveal).

## Retours commanditaire (exacts)
- « Mets en place un **mode deux joueurs**, où le but est de faire le plus de points. Ici plus question de faire zéro
  si tout le monde fait la même paire, mais au contraire des **bonus** plus le nombre de paires en commun est élevé.
  Ex : **1→1pt, 2→2, 3→4, 4→8, 5→13**, et **2 points pour la poubelle** [pomme pourrie]. »
- « Mets une possibilité de **temps infini**. »

## Spécification
### Mode de jeu (réglage lobby)
- `mode: 'classique' | 'duo'` dans `RoomSettings` (défaut `classique`). Mets à jour `shared` + le sanitize serveur.
- **`classique`** : règles actuelles (3–8 joueurs, `computeRoundResult` inchangé : solo=0, unanime=0, sinon nb de makers, pomme ×2).
- **`duo`** : **exactement 2 joueurs**. `MIN_PLAYERS`/`MAX_PLAYERS` deviennent **mode-dépendants** (duo = 2 et 2).
  Le lobby doit refléter ça (garde de démarrage : duo exige 2 joueurs, classique 3).

### Scoring coopératif duo (fonction PURE dans `shared`, testée)
- On compte **C = nombre de paires en commun** entre les 2 joueurs (paires normalisées, cf. `pairKey`).
- Points de manche (attribués **aux DEUX** joueurs, score d'équipe) selon C :
  `0→0, 1→1, 2→2, 3→4, 4→8, 5→13`.
- **+2** si la **pomme pourrie est commune** (même carte non appariée chez les 2).
- Pas de règle « solo/unanime = 0 » en duo (c'est coopératif). Le total de manche est le même pour les 2 joueurs, cumulé sur les manches.
- Implémente `computeRoundResultDuo(subA, subB)` (ou un paramètre `mode` sur une fonction dédiée) renvoyant un
  résultat compatible avec le protocole reveal (deltaScores identiques pour les 2, détail des paires communes),
  + tests exhaustifs (C=0..5, poubelle commune ou non, ordre des cartes inversé).

### Temps illimité (réglage lobby)
- Option **sablier illimité** (ex. `dureeSablier: 0` ou un flag `sablierIllimite`). Choix documenté.
- En illimité : **pas d'alarme DO**, `deadline` absent/null ; la manche se résout **uniquement quand tous les
  joueurs (présents) ont soumis**. Le client n'affiche pas de compte à rebours (juste « en attente des joueurs »).

## Côté serveur (GameRoom)
- Appliquer `mode` : garde de démarrage (nb joueurs), fonction de scoring selon le mode à la résolution.
- Gérer `dureeSablier` illimité : ne pas armer d'alarme, résolution sur tous-soumis.
- Persistance/hibernation OK. Ne pas casser les tests existants (classique).

## Côté client
- Lobby : sélecteur **Mode** (Classique / Duo) + option **Temps illimité** (réglages hôte). Adapter le message
  « min. X joueurs » selon le mode. En duo, l'affichage des scores/reveal doit être cohérent (score d'équipe, nb de
  paires communes, bonus). Reveal fonctionnel en duo (peut réutiliser la structure existante).

## Definition of Done (vérifiable)
- [ ] `mode` duo jouable **à 2 joueurs** ; classique inchangé (3–8).
- [ ] Scoring duo conforme au barème (1/2/4/8/13 + 2 poubelle commune), fonction pure **testée** (C=0..5, poubelle).
- [ ] Temps illimité : aucune alarme, résolution sur tous-soumis, pas de compte à rebours affiché.
- [ ] Lobby : réglages Mode + Temps illimité fonctionnels, gardes de démarrage adaptées.
- [ ] `shared` mis à jour (documenté, tests verts) ; reveal/scores cohérents en duo.
- [ ] Tests : unitaires scoring duo + intégration serveur (partie duo 2 joueurs → score correct ; partie illimitée
      → résolution sur tous-soumis, pas d'alarme). Rapporter PASS/FAIL par cas.
- [ ] `npm run typecheck`, `npm run lint`, `npm test` (+ integration), `npm run build` PASS. Docs non touchés (sauf ce brief).

## Résultat (rempli au retour)
_(à compléter par le tracker après vérification)_
