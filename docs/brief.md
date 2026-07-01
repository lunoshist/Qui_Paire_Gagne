# Brief projet — « Qui Paire Gagne » en ligne

_Dernière mise à jour : 2026-07-01_

## 0. Contexte & intention
Le commanditaire a joué au jeu de société **Qui Paire Gagne** récemment, l'a adoré, et constate
qu'il ne se vend plus. Il veut une **version en ligne** pour y jouer n'importe où, avec n'importe qui.
Objectif : une **interface soignée et fun**, dans la lignée de skribbl / Gartic Phone / Codenames /
Make It Meme / GeoGuessr. Le résultat de qualité passe par : un **flow bien pensé**, les bons boutons
aux bons endroits, des **interactions fluides, intuitives et agréables**, une **mise en scène** de la
révélation, et un site **fiable 24/24 hébergé gratuitement**.

## 1. Le jeu (règles de référence)
Source : Le Scorpion Masqué (2015), Stephen Glenn. Recoupé via bibliojeu.net / trictrac.net.

- **3 à 8 joueurs.** Jeu d'ambiance, de rapidité et surtout de **consensus / association d'idées**.
  Le but n'est PAS d'avoir raison, mais de **deviner ce que les autres vont associer**.
- Chaque manche :
  - **11 photos** étalées, numérotées **1 à 11**.
  - Chaque joueur possède sa série de cartes numérotées 1→11 (identifiée par une couleur).
  - **Sablier ~90 s** : chacun forme **secrètement 5 paires** en associant les images
    (thème, couleur, forme, association d'idées…), en essayant de matcher les choix des autres.
  - Il reste **1 carte non appariée** → la **« pomme pourrie »**, posée face cachée.
- **Révélation & décompte** : on annonce les paires une à une ; tous ceux qui ont fait la même paire
  se signalent. On marque **autant de points que de joueurs ayant fait cette paire**.
  Une paire faite **seul = 0 point**. La **pomme pourrie rapporte DOUBLE** si d'autres ont la même carte inutilisée.
- **4 manches**, le plus de points l'emporte.

### ⚠️ Point de règle à confirmer (voir docs/state.md > questions ouvertes)
Divergence entre sources sur le cas **« TOUS les joueurs ont fait la même paire »** :
- Source A (bibliojeu) : chacun marque le nombre de joueurs (consensus large récompensé).
- Source B (1re recherche) : paire faite par tous = **0 point** (trop évidente, comme la paire solo).
→ À trancher avec le commanditaire (il y a joué) + règle officielle. Sera de toute façon un **réglage configurable**.

### Tension de design à préserver
Le sel du jeu = viser le **consensus sans être trop évident**. Le catalogue et l'algo de tirage
doivent produire des situations **ambiguës** (plusieurs appariements plausibles) — sinon ça devient un memory banal.

## 2. Expérience en ligne visée (flow)
1. **Créer un lobby** → code / lien partageable ; les autres rejoignent avec pseudo (+ avatar/couleur).
2. **Salle d'attente** : liste des joueurs, réglages (nb de manches, durée sablier, variantes), l'hôte lance.
3. **Manche** : les 11 cartes s'affichent ; **drag & drop** pour constituer 5 paires dans des slots ;
   timer visible ; feedback quand on a fini ; pomme pourrie déduite automatiquement.
4. **Révélation** : moment **mis en scène** (cœur du fun) — paires dévoilées une à une, on voit qui a
   matché qui, les points tombent avec des animations satisfaisantes.
5. **Scores** : tableau de la manche + cumul général.
6. **Enchaînement** auto de la manche suivante selon les réglages, puis **écran de victoire** final.

## 3. Défi central — le catalogue de cartes
Point le plus structurant, **à préparer sérieusement en amont**. Le catalogue n'est pas qu'une banque
d'images : c'est un **système** = images + **métadonnées/tags** (couleur dominante, catégorie, forme,
concepts) permettant à un algo de composer des **tirages de 11 cartes volontairement ambigus**.
Approche (IA cohérente / banque libre de droits / mixte) et style visuel : voir décisions + roadmap.
Le jeu original comporte ~300 images ; viser un catalogue **large** pour la rejouabilité.

## 4. Contraintes techniques anticipées
- **Temps réel multijoueur** : synchro lobby/timer/révélation → WebSocket ou état serveur partagé.
- **Hébergement gratuit ET 24/24** : piège principal — beaucoup d'offres gratuites « s'endorment »
  (cold start). Viser une stack qui reste disponible gratuitement. À valider en phase architecture.
- **Responsive** : jouable mobile ET desktop ; le **drag & drop tactile** demande un soin particulier.
- **Modèle joueurs** : a priori salles éphémères (pseudo + code, sans compte) façon skribbl — à confirmer.

## 5. Mode de fonctionnement (attendu du commanditaire)
- L'agent principal est le **tracker** : il produit d'abord un **plan exhaustif et précis** incluant
  EXPLICITEMENT les **étapes de réflexion pure** souvent oubliées : architecture, modèle de données,
  **flow UX**, **direction de design**, mécaniques d'interaction, mise en scène de la révélation.
  On ne code qu'une fois ces fondations posées.
- Les **sous-agents builders** reçoivent chacun **une seule tâche précise + une Definition of Done**.
- **Consignation permanente** obligatoire (voir AGENTS.md) : la session peut disparaître à tout moment.
- Le commanditaire ne lira sûrement aucun fichier → les docs sont optimisées pour la reprise par un agent.
