# Journal des décisions (ADR léger)

Append-only. Une entrée = un choix structurant. Format :
`### D-NNN · Titre` / **Date** / **Choix** / **Pourquoi** / **Statut** (proposé | acté | révisé | abandonné).

---

### D-001 · Système de consignation repo-local pour la continuité
- **Date** : 2026-07-01
- **Choix** : Toute la mémoire projet vit dans `docs/` (+ `AGENTS.md` en point d'entrée). Format
  Markdown dense, machine-lisible. `docs/state.md` = source de vérité vivante du « où on en est ».
- **Pourquoi** : La session peut être coupée à tout moment ; un agent fresh doit reprendre sans perte.
  Le commanditaire ne lira pas les fichiers → optimisés pour agents.
- **Statut** : acté.

---

### D-002 · Style visuel des cartes
- **Date** : 2026-07-01
- **Choix** : **Illustrations détaillées et évocatrices, style Dixit** (dessins/illustrations, éventuellement
  photos réalistes). **PAS de pictos/icônes simples.** Le niveau de détail est fonctionnel : il empêche que
  tout le monde fasse les mêmes associations → préserve la mécanique de consensus.
- **Pourquoi** : Le commanditaire l'exige et c'est cohérent avec le jeu (ambiguïté = plusieurs lectures possibles).
- **Contrainte** : si images générées → **IA spécialisée capable d'un rendu illustratif riche** (type Flux /
  Midjourney / Ideogram / SDXL). **Pas de SVG bricolés.**
- **Statut** : acté.

### D-003 · Règle de scoring « paire faite par TOUS »
- **Date** : 2026-07-01
- **Choix** : Une paire réalisée par **TOUS** les joueurs = **0 point** (comme la paire solo). Le sweet spot =
  majorité **sans** unanimité. Points d'une paire = nombre de joueurs l'ayant faite (si ni solo ni unanime).
  Pomme pourrie = **double**.
- **Pourquoi** : Confirmé par le commanditaire (il y a joué récemment). Reste à recouper avec le livret officiel ;
  sera de toute façon un **réglage configurable**.
- **Statut** : acté (à recouper avec le PDF officiel).

### D-004 · Modèle de connexion des joueurs
- **Date** : 2026-07-01
- **Choix** : **Salles éphémères sans compte** (pseudo + code de salle, façon skribbl/Gartic Phone). Pas de
  base de comptes, pas d'historique persistant.
- **Pourquoi** : Zéro friction, plus simple à héberger gratuitement, aligné avec les références visées.
- **Statut** : acté.

---

### D-006 · Outillage de génération du catalogue
- **Date** : 2026-07-01
- **Choix** : **Coût minimal / gratuit.** Piste principale : **Cloudflare Workers AI** (Flux schnell / SDXL,
  free tier, même écosystème que l'hébergement). Lot pilote possible via générateurs gratuits sans clé
  (ex. Pollinations, basé Flux) pour valider le style vite. Production par petits lots.
- **Pourquoi** : Contrainte de gratuité du commanditaire ; cohérence avec la stack Cloudflare.
- **Statut** : acté (validation du rendu à faire sur lot pilote en Phase 3).

---

### D-005 · Stack technique & hébergement
- **Date** : 2026-07-01
- **Choix** : **Cloudflare** de bout en bout — **Pages** (front statique), **Workers + Durable Objects
  backend SQLite** (une room = un DO, WebSocket **Hibernation**), **Workers AI Flux schnell** (génération
  catalogue), **R2** (images). Front **React + Vite + TypeScript**, **dnd-kit** (drag&drop + tactile),
  **Motion** (animations).
- **Pourquoi** : Seule stack vérifiée **gratuite ET disponible 24/24** sans mise en veille (hibernation WS).
  Vérifié le 2026-07-01 (voir `docs/architecture.md` > Verdict free tier).
- **Contrainte imposée** : **frugalité des messages** (plafond 100k req/j partagé, 1 msg WS = 1 req).
  Interactions locales, timer par deadline, révélation en un payload. → principe d'archi non négociable.
- **Statut** : acté.

### D-007 · Ambiance visuelle de l'interface
- **Date** : 2026-07-01
- **Choix** : UI **fun / colorée / ludique** (esprit skribbl / Gartic Phone) — couleurs vives, formes rondes,
  accueillant et décontracté. **Contraste assumé** avec les cartes (illustrations oniriques détaillées, style
  Dixit) : le *chrome* de l'UI est joyeux et laisse les illustrations ressortir.
- **Contrainte de cohérence** : palette vive **mais pas criarde**, qui ne rentre pas en concurrence visuelle
  avec l'art des cartes ; couleurs joueurs distinctes et **accessibles (daltonisme)**.
- **Statut** : acté.

### D-008 · Tempo de la révélation
- **Date** : 2026-07-01
- **Choix** : **Configurable par l'hôte** (réglage `vitesseReveal` : lent / normal / rapide). Le storyboard est
  conçu pour supporter les deux extrêmes (suspense ↔ punchy).
- **Statut** : acté. → ajoute `vitesseReveal` aux `settings` de la room.

### D-009 · Structure du projet & outillage
- **Date** : 2026-07-01
- **Choix** : **Monorepo npm workspaces**, TypeScript partout.
  - `client/` : React + Vite + TS (front → Cloudflare Pages).
  - `server/` : Cloudflare Worker + **Durable Object** (WebSocket Hibernation, backend SQLite), via **Wrangler**.
  - `shared/` : types & constantes partagés (protocole, modèle d'état).
  - Qualité : ESLint + Prettier + **Vitest**.
  - DO en **raw Cloudflare** (pas de framework tiers type partyserver) pour le contrôle et zéro dépendance.
  - Client ↔ serveur : URL du Worker WS via variable d'env (`VITE_WS_URL`).
- **Pourquoi** : simple, standard, dans l'écosystème Cloudflare acté (D-005), sans dépendance superflue.
- **Statut** : acté.

---

## Décisions en attente
- _(aucune bloquante.)_
