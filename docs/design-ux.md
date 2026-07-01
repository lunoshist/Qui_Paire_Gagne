# Design & UX

_MàJ : 2026-07-01. Décisions liées : D-007 (UI fun/coloré), D-008 (reveal tempo configurable)._

## Boussole
Références : skribbl, Gartic Phone, Codenames, Make It Meme. Zéro friction, on partage un lien, on joue.
Le fun se joue dans **la fluidité du drag & drop** et **la mise en scène de la révélation**.

## Direction visuelle (D-007 : fun / coloré / ludique)
UI joyeuse et accueillante qui **encadre** des cartes-illustrations riches (style Dixit) sans leur voler la vedette.
- **Palette** : fond clair/chaleureux (crème/pastel) OU sombre-ludique, + **couleurs d'accent vives** (corail,
  turquoise, jaune soleil, violet). Vive **mais pas criard** — les illustrations doivent ressortir.
- **Formes** : coins bien arrondis, gros boutons pleins, ombres douces, un peu de « bounce » (esprit jouet).
- **Typo** : une display ronde et sympa pour les titres (ex. genre Baloo/Fredoka), une sans-serif lisible pour le texte.
- **Motion** : micro-interactions partout (hover, snap, pop), transitions ressort (Motion). Jamais gratuit :
  chaque anim porte un feedback.
- **Couleurs joueurs** (jusqu'à 8, distinctes + **daltonisme-safe**, chacune avec un picto/forme de secours) :
  🔵 bleu · 🔴 rouge/corail · 🟢 vert · 🟡 jaune · 🟣 violet · 🟠 orange · 🩷 rose · 🩵 cyan.
- **Son** : effets légers optionnels (pop, tick sablier, fanfare victoire), coupables.
- **Nom/branding** : à définir (placeholder « Qui Paire Gagne »).

## Parcours & wireframes basse fidélité

### 1. Accueil
```
+------------------------------------------+
|           QUI PAIRE GAGNE  🎴            |
|         (logo fun, coloré, animé)        |
|                                          |
|   Pseudo [____________]  🎨 couleur      |
|                                          |
|          (  + Créer une partie  )        |
|   ── ou ──                               |
|   Rejoindre :  [ CODE ]   ( Go → )       |
+------------------------------------------+
```

### 2. Salle d'attente (lobby)
```
+------------------------------------------+
| Salle  ABCD        [ Copier le lien 🔗 ] |
+------------------+-----------------------+
| Joueurs (3/8)    | Réglages (hôte seul)  |
|  🔵 Alex (hôte)  |  Manches   [ 4  ▾ ]   |
|  🔴 Sam          |  Sablier   [ 90s ▾ ]  |
|  🟢 Lou          |  Révélation[Normal▾]  |
|                  |  Scoring   [Standard] |
|                  |     ( ▶ Lancer )      |
+------------------+-----------------------+
| ⚠ min. 3 joueurs pour démarrer           |
```
Non-hôtes : réglages en lecture seule. Bouton copier le lien très visible (invitation = cœur du produit).

### 3. Formation des paires
```
+------------------------------------------+
| Manche 1/4      ⏳ 0:47     ✓ Sam  ·Lou  |  <- qui a fini (sans contenu)
+------------------------------------------+
| POOL                                     |
|  [1][2][3][4][5][6][7][8][9][10][11]     |  <- illustrations, glissables
+------------------------------------------+
| MES PAIRES                               |
|  (  )(  )   (  )(  )   (  )(  )           |
|  (  )(  )   (  )(  )                      |  <- 5 slots de paire
|  🍎 POMME POURRIE : (  )                  |  <- rempli auto par la carte restante
|                          ( ✓ Valider )   |
+------------------------------------------+
```

### 4. Révélation (voir storyboard détaillé plus bas)
```
+------------------------------------------+
|          Révélation — paire 2/5          |
|     [  carte A  ]   💞   [  carte B  ]    |
|                                          |
|   Qui a fait cette paire ?               |
|     🔵Alex  🟢Lou   →  +2 chacun         |
+------------------------------------------+
```

### 5. Scores (manche + cumul)
```
+------------------------------------------+
|           Scores — fin manche 1          |
|  1. 🟢 Lou    7   (+7)                    |
|  2. 🔵 Alex   5   (+5)                    |
|  3. 🔴 Sam    3   (+3)                    |
|            ( Manche suivante → )          |
+------------------------------------------+
```

### 6. Victoire
```
+------------------------------------------+
|              🏆 VICTOIRE 🏆              |
|                  🟢 Lou                   |
|          [ podium 1 - 2 - 3 ] 🎉          |
|   ( Rejouer )       ( Retour au lobby )   |
+------------------------------------------+
```

## Interactions clés
- **Drag & drop (desktop) + tap-to-pair (mobile)** via dnd-kit :
  - Desktop : glisser une carte du pool vers un slot ; glisser une carte sur une autre = crée la paire.
  - Mobile/fallback : **taper une carte → taper sa partenaire** = paire formée (plus fiable au doigt).
  - Snap dans les slots, **verrouillage** visuel de la paire, **annulation/réarrangement** possible avant Valider.
  - Accessibilité clavier (dnd-kit) : focus + flèches + entrée.
- **Pomme pourrie** : dès 5 paires formées, la carte restante tombe **automatiquement** dans le slot 🍎 ;
  le joueur peut réarranger (choix stratégique, elle vaut **double**).
- **Sablier** : compte à rebours **local** (deadline serveur), montée de tension en fin (couleur → rouge, tick).
  À l'expiration : auto-soumission de l'état courant (paires incomplètes = pénalité naturelle, pas de points).
- **Feedback** : chaque action = réponse immédiate (pop, glow, son léger). Après Valider : état « en attente
  des autres » + liste de qui a fini.

## Storyboard de la révélation (LE moment fun)
Piloté **côté client** depuis **un seul `revealPayload`** (frugalité des messages). Le **tempo** (D-008) est un
paramètre d'animation local : `lent` / `normal` / `rapide` → durée des pauses et vitesse des anims.

**Données du payload** : pour chaque **paire distincte** formée par ≥1 joueur : les 2 cartes, la liste des
joueurs l'ayant faite, le nombre N ; + les **pommes pourries** de chacun ; + deltas et cumuls de score.

**Séquence** :
1. **Carte-titre** « Révélation ! » (fanfare courte).
2. **Paire par paire**, dans un ordre à crescendo (par nombre de faiseurs croissant, les 0-point d'abord) :
   - Gros plan sur les **2 cartes** au centre (elles se rapprochent, petit cœur 💞).
   - **Beat de suspense** (durée selon tempo).
   - **Apparition des jetons** des joueurs qui l'ont faite ; les **+points volent** vers leurs scores (anim).
   - **Cas spéciaux traités avec gags** :
     - **Solo** (1 seul) : « personne d'autre… **0 point** 😬 » (petit effet dégonflé).
     - **Unanime** (tous) : « **trop évident !** tout le monde l'a → **0 point** 🤪 » (effet comique).
3. **Finale — pommes pourries 🍎** : révélation simultanée des cartes non appariées de chacun ; les
   correspondances rapportent **double** (anim dorée, temps fort).
4. **Bilan** de la manche s'assemble → transition vers l'écran Scores.

**Réglage des tempos** :
- `lent` : longues pauses, suspense appuyé, gros plans (~40–60 s/manche). 
- `normal` : rythme équilibré, auto-advance (~25–35 s).
- `rapide` : punchy, anims snappy, enchaînement serré (~12–20 s).
Tous en **auto-advance** (garde la synchro entre clients + zéro message par étape). Option future : pas-à-pas
piloté par l'hôte.

## Résilience UX (à raffiner)
- Joueur déconnecté pendant `forming` : sa soumission courante (ou vide) est prise à l'expiration.
- Reconnexion : reprise de la place/score via `playerId` (localStorage).
- Hôte qui part : promotion automatique + toast « Nouvel hôte : X ».
