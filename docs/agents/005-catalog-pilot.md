# TASK-005 · Lot pilote du catalogue (validation du style)

- **Statut** : dispatché
- **Date** : 2026-07-02
- **Dépend de** : D-002 (style Dixit), D-006 (génération gratuite), `docs/catalog.md`

> Note : le `// TODO TASK-005` dans `server/src/GameRoom.ts` désigne en réalité la boucle de jeu
> (démarrage de manche), qui sera une tâche ultérieure — label à corriger à ce moment-là.

## Objectif (une seule tâche)
Générer un **lot pilote de ~16 illustrations style Dixit** (gratuit, sans clé) pour **valider l'esthétique**
avant toute production de masse, et produire une **galerie HTML** consultable. Aucune intégration au jeu, aucun
code applicatif. Juste : générer, sauvegarder, indexer.

## Contexte
- Style visé (D-002) : illustrations **détaillées, évocatrices, oniriques** (Dixit) — plusieurs lectures possibles.
  PAS de pictos. La richesse est fonctionnelle (empêche l'association unique évidente).
- Générateur (gratuit, sans clé) : **Pollinations** (basé Flux).
  URL type : `https://image.pollinations.ai/prompt/<PROMPT_URL_ENCODED>?width=1024&height=1024&model=flux&nologo=true&seed=<N>`
  (GET → renvoie une image JPEG/PNG ; encoder le prompt pour l'URL).

## Prompt maître (cohérence de collection — suffixe à ajouter à CHAQUE sujet)
```
, dreamlike storybook illustration, painterly digital art, whimsical and surreal, soft warm cinematic lighting,
rich intricate detail, muted-vibrant color palette, single evocative centered scene, fantasy picture-book art,
no text, no words, no letters
```

## Sujets du pilote (~16, volontairement évocateurs/ambigus)
1. a lonely lighthouse standing inside a giant teacup
2. a red fox reading an old book by candlelight
3. a small house carried on the back of a giant snail
4. a hot-air balloon made from a glowing jellyfish
5. an open birdcage with a full moon trapped inside
6. a spiral staircase climbing into the clouds
7. a paper boat sailing across a vast puddle at dusk
8. a key growing roots like a plant
9. a whale swimming through a starry night sky
10. a child holding a lantern in a dark enchanted forest
11. a wooden door standing alone in the middle of a field
12. a melting clock dripping into a quiet river
13. a chess king piece alone on a green hill
14. a theatre mask resting on an empty chair
15. a candle burning peacefully underwater
16. a tiny city built inside a glass bottle

## À produire (dans le dossier scratchpad fourni)
- `catalog-pilot/NN-slug.jpg` pour chaque sujet (NN = 01..16). Générer **séquentiellement**, avec **retry** (2-3
  essais) en cas d'échec réseau ; vérifier que chaque fichier fait **> 20 Ko** et est une image valide (sinon retry).
- `catalog-pilot/index.html` : galerie responsive (grille) affichant chaque image + son **sujet** + son **seed**.
  Titre « Lot pilote — Qui Paire Gagne (style à valider) ». Simple, autonome (pas de dépendances externes).
- Utiliser des **seeds fixes** (ex. seed = numéro du sujet) pour reproductibilité.

## Chemin de sortie (imposé)
Créer le dossier `catalog-pilot/` dans :
`/tmp/claude-1000/-home-lunos-CODE-HistoLyon-Qui-Paire-Gagne/a0816689-cb3d-45ca-a7fb-64fc74f2eb3c/scratchpad/`

## Definition of Done (vérifiable)
- [x] 16 sujets tentés ; rapporter combien d'images valides obtenues (viser 16/16, min. 12/16). → **16/16**
- [x] Chaque image valide > 20 Ko, dimensions ~1024². Prompt maître appliqué à tous (cohérence). → tailles 43–100 Ko OK ; **dimensions réelles 768×768** (voir note ci-dessous), prompt maître appliqué à tous.
- [x] `index.html` fonctionnel affichant toutes les images obtenues + sujet + seed.
- [x] Aucun fichier écrit hors du dossier scratchpad indiqué. Ne touche PAS le repo (ni `docs/` sauf ce brief), ni le code.

## Résultat (rempli au retour)
- **Images valides : 16/16** (JPEG, tous > 20 Ko, seed = numéro du sujet 01..16).
- **Taille moyenne : ~70 Ko** (min 43 Ko `14-theatre-mask`, max 100 Ko `12-melting-clock`).
- **Échecs : aucun.** Un seul retry nécessaire (sujet 16, réussi au 2e essai).
- **Anomalie dimensions** : malgré `width=1024&height=1024` dans l'URL, Pollinations a renvoyé des images **768×768**. Fonctionnel pour valider l'esthétique ; pour la prod de masse, prévoir upscale ou revérifier le paramètre de résolution du service.
- **Générateur** : Pollinations (Flux), gratuit sans clé — stable, ~1 image / 30–60 s en séquentiel.
- **Dossier de sortie** : `/tmp/claude-1000/-home-lunos-CODE-HistoLyon-Qui-Paire-Gagne/a0816689-cb3d-45ca-a7fb-64fc74f2eb3c/scratchpad/catalog-pilot/`
- **Galerie** : `/tmp/claude-1000/-home-lunos-CODE-HistoLyon-Qui-Paire-Gagne/a0816689-cb3d-45ca-a7fb-64fc74f2eb3c/scratchpad/catalog-pilot/index.html`
