# TASK-014 · Passe design : espacements cohérents + hiérarchie visuelle (+ crop + reveal emphasis)

- **Statut** : dispatché
- **Date** : 2026-07-02
- **Dépend de** : tous les écrans client existants

## Objectif (une seule tâche)
Refondre la **cohérence visuelle** du client : un **système d'espacement** appliqué partout (fini les
padding/marges/bordures incohérents) et une **hiérarchie** claire entre les contenus. Inclure : le **fix des images
croppées** (`object-fit: contain`) et, en révélation, la **paire courante affichée en GROS** (plus visible que les
autres). **Client uniquement.** Ne change AUCUNE logique de jeu.

## Retours commanditaire (exacts)
- « On va revoir le design. Notamment les **espaces** car parfois entre les padding/marges et les bordures c'est plus
  possible. Et **surtout de hiérarchie** : le design doit refléter une certaine hiérarchie entre les différents contenus. »
- « Certaines images sont **crop**, c'est dommage. » → montrer l'image **entière**.
- « Pour le reveal, la **paire qui vient d'être révélée doit être en gros**, plus visible que les autres. »

## Direction (à appliquer partout — `client/src/styles.css` + écrans + `ui/`)
### 1. Système d'espacement (tokens) — LE point clé
- Définir une **échelle d'espacement** en variables CSS (ex. `--space-1:4px … --space-6:32px`) et **s'en servir
  PARTOUT** (padding, marges, gaps). Supprimer les valeurs ad hoc et les empilements padding+marge+bordure redondants.
- Rationaliser les **bordures/rayons** : ne pas encadrer chaque bloc ; préférer **espacement + fonds subtils** pour
  séparer. Un jeu de radius cohérent (ex. `--radius-sm/md/lg`).
- Rythme vertical régulier ; aligner les gouttières.

### 2. Hiérarchie visuelle
- **Échelle typographique** claire (titre / sous-titre / corps / légende) en variables, appliquée de façon cohérente.
- Sur chaque écran, un **point focal évident** : le contenu principal domine (taille/poids/contraste), le secondaire
  est visuellement en retrait (plus petit, atténué/muté). Ex : en Formation, les **cartes** dominent, le panneau de
  paires est clairement secondaire ; en Salle d'attente, la liste des joueurs vs les réglages ; etc.
- Utiliser la couleur/le contraste pour guider l'œil (actions primaires vs secondaires déjà là — renforcer la distinction).

### 3. Images non croppées
- Les cartes-images doivent montrer l'**image entière** : `object-fit: contain` (avec un fond neutre pour le
  letterbox) là où l'image est un point focal (grandes cartes Formation, zoom, cartes de Révélation). Les toutes
  petites miniatures peuvent rester en `cover` si nécessaire, mais privilégier `contain` dès que l'image compte.

### 4. Révélation — paire courante en avant
- La paire **en cours de révélation** (mode meneur) ou la dernière apparue s'affiche **nettement plus grande** et
  mise en avant ; les paires déjà révélées se **réduisent** et passent en arrière-plan (historique compact).

## Contraintes
- Garder l'esprit **fun/coloré** (D-007) mais plus **propre et hiérarchisé**. Pas de refonte fonctionnelle.
- Responsive mobile + desktop préservé. Ne pas casser drag&drop/tap-to-pair, timer, flows, modes (duo/illimité), zoom.
- Réutiliser/étendre les tokens existants ; harmoniser, ne pas dupliquer.

## Definition of Done (vérifiable)
- [x] Échelle d'espacement en variables, **appliquée sur tous les écrans** (plus de valeurs ad hoc criardes) ; bordures rationalisées.
- [x] Hiérarchie visuelle nette sur chaque écran (focal point + secondaire en retrait) ; échelle typographique cohérente.
- [x] Images en `contain` (entières) là où elles sont focales ; plus de crop gênant.
- [x] Révélation : la paire courante/dernière est clairement plus grande que les autres.
- [x] Responsive OK (mobile ~360px + desktop) ; aucune régression fonctionnelle (jeu, modes, zoom, flows).
- [x] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` PASS. Ne touche PAS `server/` ni `shared/` ni `docs/` (sauf ce brief).

## Résultat (2026-07-02)

**Fichiers modifiés** : `client/src/styles.css` (gros de la passe), `client/src/screens/Reveal.tsx`
(restructuration hero/historique), `client/src/screens/Room.tsx` (réglages en `panel-muted`).
Aucune logique de jeu touchée ; `server/` et `shared/` intacts.

### Tokens ajoutés
- **Échelle typo** (`--text-caption` 0.8 → `--text-display` clamp(2–3.2rem)) + poids
  (`--fw-regular/semibold/bold`) et interlignes. `h1/h2/h3` mappés sur `--text-2xl/xl/lg`.
- **Espacement** : ajout `--space-7` (48px) ; l'échelle `--space-1..7` sert désormais partout
  (padding/marge/gap, remplacement des `2px 12px`, `3px 10px`… par des tokens).
- **Bordures normalisées** : `--bw-hair` (1px, séparation discrète) / `--bw` (2px) / `--bw-strong`
  (3px, affordance interactive : cible de drop, carte sélectionnée). Les blocs purement
  présentiels (panel, topbar, badges, score-row, pomme-reveal, pairs-area) passent en liseré fin +
  ombre plutôt qu'un cadre 2px ; les 2px/3px sont réservés aux états interactifs.
- **Letterbox** : `--c-letterbox` (neutre) derrière les images en `contain`.

### Hiérarchie par écran
- **Accueil** : brand en `--text-display`, sous-titre atténué en `--text-lg`. Focal = titre +
  bouton « Créer » (primaire) ; « rejoindre par code » reste l'action secondaire.
- **Salle d'attente** : `room-grid` passe à `1.35fr / 1fr` → la **liste des joueurs domine** ; le
  panneau Réglages est `panel-muted` (fond neutre, sans ombre) donc clairement secondaire. Le
  bouton « Lancer » (primaire pleine largeur) reste l'action focale.
- **Formation** : structure déjà focalisée (grandes cartes dominantes / panneau paires compact)
  conservée ; bordures assainies (topbar/pairs-area en liseré fin), type sur tokens.
- **Révélation** : refonte du point focal — voir ci-dessous.
- **Scores / Victoire** : score-row en liseré fin, winner souligné en `--bw` doré ; podium et
  couronne restent le point focal de la victoire.

### Fix crop
`.card-img` passe de `object-fit: cover` à **`contain`** : l'illustration entière est montrée,
le carré de la carte fait le letterbox sur fond `--c-letterbox` neutre. S'applique aux cartes de
Formation, au zoom plein écran (lightbox), aux cartes de Révélation et aux pommes.

### Emphase Révélation
La section passe de grille égalitaire à une **scène** : la **paire courante (dernière révélée)**
est rendue en `.pair-reveal-hero` (max-width 520px, grandes cartes, ombre, cœur 2rem, verdict en
`--text-lg`) — point focal net ; les **paires déjà révélées** se réduisent en
`.pair-reveal-history` (miniatures 48px, en ligne, opacité 0.68, jetons sans pseudo). Le « +N » qui
s'envole n'anime que la paire courante. Logique de progression (`revealStep`, mode meneur/rapide,
auto-advance, zoom) **inchangée** — refonte purement visuelle du rendu.

### Vérifications (réel)
- `npm run typecheck` : **PASS** (shared + client + server).
- `npm run lint` : **PASS**.
- `npm test` : **PASS** — 6 fichiers, 45 tests (les warnings `act(...)` sont préexistants, non
  bloquants). Aucun test à modifier : aucun ne dépendait des classes réécrites.
- `npm run build` : **PASS** (vite, ~23.4 kB CSS).
- `prettier --check` : les fichiers touchés respectent le style.

### Points d'arbitrage
- Esprit fun/coloré (D-007) **gardé** (palette, radius généreux, animations, confettis) mais
  cadres allégés : on sépare par l'espacement + fonds subtils plutôt qu'un liseré 2px sur chaque
  bloc, conformément au retour commanditaire.
- La finale « pommes pourries » n'a pas reçu de traitement hero dédié (le brief cible la mise en
  avant des paires) ; elle reste une section distincte sous la scène. À rediscuter si on veut aussi
  la théâtraliser.
- `contain` peut créer des bandes sur des images non carrées : c'est le comportement voulu (montrer
  l'image entière) ; le fond letterbox est volontairement discret.
