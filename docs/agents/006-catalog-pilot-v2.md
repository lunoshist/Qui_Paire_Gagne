# TASK-006 · Lot pilote v2 — direction corrigée + test de médium

- **Statut** : dispatché
- **Date** : 2026-07-02
- **Dépend de** : D-011 (direction artistique corrigée), retour commanditaire sur pilote v1

## Objectif (une seule tâche)
Générer un **pilote v2** d'illustrations/cartes selon la direction CORRIGÉE (concept central clair + variété), et
**tester 2 médiums** (illustration nette vs photo réaliste) sur les mêmes sujets, pour trancher le style. Produire
une galerie HTML consultable. Aucune intégration au jeu, aucun code applicatif.

## Direction (D-011 — LIRE `docs/catalog.md` § Style révisé)
- Chaque carte = **UN concept/objet central CLAIR et immédiatement reconnaissable** (comme le vrai jeu : ambulance,
  chiffres à la craie sur tableau noir…). On identifie le sujet au premier regard.
- **Contexte/fond lisible**, souvent assez épuré, qui soutient la lecture et ajoute des attributs associables.
- **VARIÉTÉ** : concepts, ambiances (joyeux, calme, dramatique, froid, nocturne, chaud…), contextes, formes, palettes.
- **INTERDIT** : scènes surréalistes/oniriques, sujets composites absurdes, images floues/illisibles, ambiance uniforme.

## Générateur
Pollinations (gratuit, sans clé) : `https://image.pollinations.ai/prompt/<PROMPT_ENCODE>?width=1024&height=1024&model=flux&nologo=true&seed=<N>`
(réessayer 1024 ; si le service renvoie 768, l'accepter et le noter). Séquentiel + retry (2-3 essais), vérifier chaque
image > 20 Ko et valide.

## Suffixe de lisibilité (léger — à ajouter à CHAQUE prompt ; NE PAS remettre de « dreamlike/onirique »)
```
, single clear central subject, instantly recognizable, well composed, readable, sharp, high detail, no text, no words, no letters
```

## Tags de médium (à combiner avec chaque sujet)
- **Illustration** (`-illu`) : `vibrant detailed illustration, clean simple background, modern editorial storybook illustration, crisp shapes`
- **Photo** (`-photo`) : `high quality realistic photograph, clean simple background, sharp focus, natural lighting`

## Groupe A — comparaison de médium (5 sujets × 2 médiums = 10 images)
Fichiers `cmp-NN-slug-illu.jpg` ET `cmp-NN-slug-photo.jpg` (même seed pour la paire = NN) :
1. an ambulance on a street (mood: urgence, rouge/blanc)
2. numbers written in white chalk on a black chalkboard (mood: école)
3. a red umbrella open (mood: pluie)
4. a birthday cake with lit candles (mood: fête, chaleureux)
5. a brass compass (mood: aventure/voyage)

## Groupe B — variété (6 sujets, médium ILLUSTRATION, ambiances variées = 6 images)
Fichiers `var-NN-slug.jpg` (seed = NN, NN de 06 à 11) :
6. a bunch of colorful balloons (mood: joyeux, très coloré)
7. a steaming cup of coffee on a wooden table (mood: chaud, matin, cosy)
8. a snowy mountain peak under a cold blue sky (mood: froid, grandiose)
9. an old rotary telephone (mood: rétro/vintage)
10. a slice of watermelon (mood: été, frais, rouge-vert)
11. a chessboard mid-game, close up (mood: stratégie, noir-blanc, tendu)

## Galerie (`index.html`)
Deux sections claires :
- **« Comparaison médium (illustration vs photo) »** : afficher les paires **côte à côte** (illu | photo) par sujet, étiquetées.
- **« Variété (illustration) »** : grille des 6 sujets variés, avec label.
Titre : « Pilote v2 — direction corrigée ». Responsive, autonome (aucune dépendance).

## Chemin de sortie (imposé — NOUVEAU dossier)
`/tmp/claude-1000/-home-lunos-CODE-HistoLyon-Qui-Paire-Gagne/a0816689-cb3d-45ca-a7fb-64fc74f2eb3c/scratchpad/catalog-pilot-v2/`

## Definition of Done (vérifiable)
- [ ] 16 images tentées (10 comparaison + 6 variété) ; rapporter le nb valides (viser 16/16, min 13/16).
- [ ] Sujets CLAIRS/reconnaissables, fond lisible, ambiances VARIÉES (pas d'uniformité onirique). Suffixe léger appliqué.
- [ ] Paires cmp en **même seed** illu/photo pour comparaison honnête.
- [ ] `index.html` avec les 2 sections (paires côte à côte + variété).
- [ ] Rien écrit hors du dossier scratchpad indiqué. Ne touche pas au repo/code (sauf ce brief pour le rapport).

## Résultat (rempli au retour)
_(à compléter par le tracker : nb images, dimensions réelles, chemin, impression)_
