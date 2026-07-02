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

### D-010 · Déploiement en production
- **Date** : 2026-07-02
- **Choix** : 1er déploiement en ligne sur Cloudflare (compte lunoshist@gmail.com, auth wrangler OAuth). Worker sur
  `qui-paire-gagne-server.lunoshist.workers.dev`, front sur `qui-paire-gagne.pages.dev` (Pages, branche `main`).
  Redéploiement **manuel** pour l'instant (CI/CD plus tard). Détails + commandes : `docs/deployment.md`.
- **Pourquoi** : valider tôt le pipeline « gratuit 24/24 » en réel (fait, chaîne WS vérifiée en prod) — choix de
  séquencement du commanditaire (déployer le lobby d'abord).
- **Statut** : acté.

### D-011 · Correction de la direction artistique des cartes (remplace le « Dixit » de D-002)
- **Date** : 2026-07-02
- **Contexte** : le pilote v1 (style Dixit onirique/surréaliste) a été **rejeté** par le commanditaire. Qualité
  d'image saluée, mais mauvaise approche : sujets flous/composites absurdes → illisibles → pas d'associations possibles.
- **Choix** : chaque carte = **un concept/objet central CLAIR et reconnaissable** dans un contexte lisible (comme le
  vrai jeu : ambulance, chiffres sur tableau noir…). Associations = attributs d'un sujet net (objet, formes, couleurs,
  contexte). **Grande variété** de concepts/ambiances/contextes/formes/palettes. On abandonne le Dixit/surréaliste.
- **Reste ouvert** : médium **illustration nette vs photo réaliste** → test A/B dans le pilote v2 (D-006/TASK-006).
- **Statut** : acté (annule le volet « Dixit » de D-002 ; le reste de D-002 — pas de pictos simples — tient).

### D-012 · Stratégie de production du catalogue (multi-sources + QC + licences)
- **Date** : 2026-07-02
- **Contexte** : pilote v2 validé (direction OK). Retour commanditaire : illustration en majorité, **réaliste quand ça
  sert mieux** (ex. boussole), **+ images libres de droit** du web pour compléter. Défauts constatés à filtrer
  (parapluie à double toile, fil de téléphone dans le vide, ambulance pas assez « française », sujet « tableau » à éviter).
- **Choix** :
  1. **3 sources, choisies au cas par cas par sujet** : (a) **illustration IA** (Pollinations/Flux), (b) **réaliste IA**,
     (c) **image libre de droit** via **Openverse** (filtre **CC0 / domaine public** → pas d'attribution obligatoire ;
     fallback Wikimedia). Méthode : récupérer plusieurs candidats/sujet → **je choisis le meilleur au QC**.
  2. **Contrôle qualité visuel (par le tracker)** : inspecter chaque image (vision) et **rejeter** défauts anatomiques/
     objets incohérents, dépictions inexactes (spécificité culturelle : ex. ambulance FR/EU), sujets illisibles ou
     **basés sur du texte/chiffres** (rendu IA médiocre → à éviter comme concept).
  3. **Traçabilité licence** : pour chaque image du web, stocker licence + provider + URL source (+ créateur si requis).
     Préférer CC0/PDM. Un `catalog/manifest.json` fait foi (source, licence, tags).
- **Statut** : acté.

---

## Décisions en attente
- _(aucune bloquante.)_
