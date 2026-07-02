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

### D-013 · Catalogue = VOLUME + curation par le commanditaire (annule la sur-curation par l'agent)
- **Date** : 2026-07-02
- **Contexte / erreurs déclencheuses** : l'agent a (1) raté son QC (ambulance défectueuse validée, 2 avants), (2)
  trop filtré (« hors-sujet » rejeté à tort), (3) **perdu des images validées** (ballons, boussole) car stockées
  seulement dans le scratchpad éphémère. Le commanditaire était mécontent, à juste titre.
- **Choix** :
  1. **Objectif VOLUME : 3000+ images.** L'agent **collecte massivement** (IA créées + libres de droit trouvées),
     **sans filtrer** (paysages/images imparfaites OK). Le **commanditaire cure lui-même** (supprime ce qui ne va pas).
  2. **Zéro QC de rejet par l'agent** sur le pool (jugement esthétique de l'agent jugé non fiable). L'agent peut
     seulement écarter un fichier corrompu/vide.
  3. **Tout va dans `catalog/pool/`** (dossier LOCAL persistant, gitignoré car volumineux + curé). Sous-dossiers par
     source/concept. Provenance+licence conservées pour le libre de droit (`_sources.jsonl`).
  4. **Process fix critique** : ne JAMAIS laisser l'unique copie d'images dans `/tmp` (éphémère) → toujours écrire
     dans le répertoire de travail persistant.
  5. **Illustrations IA** : demander un **fond/contexte/décor** (pas de fond uni).
  6. Le catalogue jouable final (`catalog/images/` + `manifest.json`) sera construit **à partir des survivants**
     après curation par le commanditaire.
- **Statut** : acté (annule l'approche de curation par l'agent de D-012 ; le multi-sources + traçabilité de D-012 tient).

### D-014 · Retours playtest #1 + backlog priorisé
- **Date** : 2026-07-02
- **Contexte** : 1er playtest de la version en ligne. Jeu fonctionnel, mais liste de peaufinage.
- **Retours (tous à traiter, pas seulement les exemples cités)** :
  1. **[PRIO 1] Cartes trop petites** → les images doivent occuper la majeure partie de l'écran (surtout mobile),
     paires secondaires + **zoom**. → TASK-009 (en cours).
  2. **Design pas beau** (subjectif) → revoir style/design. **NON prioritaire.** → tâche design ultérieure.
  3. **Flows & scénarios manquants** (important, « tout envisager », pas que les exemples) : fin de partie sans
     recréer une room (rejouer/relancer) ; **rejoindre une partie en cours** ; **reconnexion en pleine manche** (ne
     pas rester bloqué sur « La partie démarre… ») ; **relancer/recommencer** pour inclure qqn ou changer un réglage ;
     + tous les autres cas limites (hôte qui part en jeu, joueur qui quitte, etc.). → TASK-010.
  4. **Révélation** : trop rapide + les 3 modes ne diffèrent pas. Attendu : **par défaut, paires révélées UNE PAR UNE,
     l'HÔTE passe à la suivante** (laisser le temps de s'expliquer) ; **mode rapide** = l'auto actuel. **Reveal des
     scores / fin de partie plus impactant et soigné.** → TASK-011.
  5. **Pas assez d'illustrations** → générer **en boucle**, 3 styles : très détaillé / **fond uni couleur** / contexte
     sobre. → génération continue lancée (`harvest_ai3.py` → `catalog/pool/ai-*`).
  6. **Automatisation / CI-CD** : que le commanditaire ajoute des images sans que l'agent redéploie. → `scripts/deploy.sh`
     (self-service, dispo maintenant) ; **CI/CD complet** (GitHub Actions / Pages Git) = TASK-012 (nécessite repo GitHub).
- **Ordre retenu** : TASK-009 (cartes en grand) → TASK-010 (flows/reconnexion/rejouer) → TASK-011 (révélation) →
  design + TASK-012 (CI/CD). Génération d'images + curation en continu en parallèle.
- **Statut** : acté (backlog).

### D-015 · Retours playtest #2 + CI/CD
- **Date** : 2026-07-02
- **CI/CD** : repo GitHub confirmé (`git@github.com:lunoshist/Qui_Paire_Gagne.git`). GitHub Actions
  (`.github/workflows/deploy.yml`) : sur push `main` → build-manifest + vérifs + build client + deploy Pages & Worker.
  Provenance committée (`catalog/sources.jsonl`) pour que la CI régénère le manifeste avec licences. **Secrets requis
  côté GitHub** : `CLOUDFLARE_API_TOKEN` (à créer par le commanditaire) + `CLOUDFLARE_ACCOUNT_ID` (049327e1f82b31adaae285895bd8cb89).
  `scripts/deploy.sh` reste le déploiement self-service local.
- **Retours playtest #2 (backlog)** :
  1. **Mode 2 joueurs coopératif** + barème bonus (paires communes 1→1/2→2/3→4/4→8/5→13, +2 poubelle commune) → TASK-013 (en cours).
  2. **Temps illimité** (sablier infini) → TASK-013.
  3. **Images croppées** (`object-fit: cover`) → passer en `contain` → passe design (TASK-014).
  4. **Reveal : la paire courante doit être en GROS**, plus visible que les autres → TASK-014.
  5. **Design** (maintenant prioritaire) : **espacements** (padding/marges/bordures incohérents) + **hiérarchie**
     visuelle entre contenus → TASK-014 (passe design).
- **Ordre** : CI/CD (fait, secrets à ajouter) ‖ TASK-013 (modes, en cours) → TASK-014 (design + crop + reveal-emphasis).
- **Statut** : acté.

---

## Décisions en attente
- _(aucune bloquante — en attente que le commanditaire ajoute les 2 secrets GitHub pour activer le CI/CD.)_
