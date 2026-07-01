# Architecture (brouillon de travail)

_MàJ : 2026-07-01. Statut : proposition à valider en Phase 1._

## Contrainte dure
Temps réel multijoueur **+ hébergement gratuit disponible 24/24** (pas de cold start / mise en veille).
C'est le critère qui élimine la plupart des offres « free » (Render/Railway s'endorment ; Fly.io a réduit son free tier).

## Proposition forte : écosystème Cloudflare
- **Cloudflare Pages** : hébergement du front statique (illimité, gratuit, CDN mondial).
- **Cloudflare Workers + Durable Objects (DO)** : un DO = **une salle de jeu** = état autoritatif d'une room,
  avec WebSocket (API *hibernation* → pas de coût quand la room dort, réveil instantané, pas de mise en veille
  façon serveur classique). Modèle « une room = un objet » idéal pour ce jeu.
  ✅ **VÉRIFIÉ (2026-07-01)** : DO dispo en gratuit **uniquement en backend SQLite** (le backend KV est payant →
  on écrit nos DO en `new_sqlite_classes` / `ctx.storage.sql`). WebSocket Hibernation utilisable (les joueurs
  restent connectés même DO hors mémoire, pas de GB-s facturés en veille, réhydratation auto au 1er message →
  cold start de l'ordre de la ms, imperceptible pour un lobby).
- **Cloudflare R2** (ou Images) : stockage des illustrations du catalogue (free tier ~10 Go, egress gratuit via CDN CF).
- Avantage : tout dans un seul écosystème gratuit, edge, **toujours disponible** → répond à « 24/24 ».

### Alternatives de repli (si DO free tier insuffisant)
- **PartyKit / partyserver** (surcouche DX au-dessus de DO) — même socle.
- **Supabase Realtime** (free tier, Postgres + channels) — plus DB-centric, viable.
- **Serveur Node (ws) sur un VPS gratuit** — risque de veille, à éviter.

## Front (proposition, décision de l'agent, non bloquante)
- **React + Vite + TypeScript**. Écosystème le plus riche pour ce dont on a besoin :
  - **dnd-kit** : drag & drop accessible, **support tactile natif** (mobile) + fallback tap-to-pair.
  - **Motion (ex-Framer Motion)** : animations de la révélation / micro-interactions.
- Alternative légère : Svelte (perf/anim excellentes) — à arbitrer si bundle/perf devient un enjeu.

## Modèle d'état d'une salle (autoritatif côté serveur / DO)
```
Room {
  code, hostId,
  players: [{ id, pseudo, couleur, avatar, connecté:bool, scoreCumul }],
  settings: { nbManches, dureeSablier, vitesseReveal:'lent'|'normal'|'rapide', variantesScoring },
  phase: lobby | dealing | forming | reveal | scores | finished,
  mancheCourante,
  tirage: [11 cardIds],               // les 11 photos de la manche
  soumissions: { playerId -> { paires:[[a,b]x5], pommePourrie:cardId } }, // SECRET jusqu'à reveal
  deadlineTimer,
  resultatsManche, scores
}
```

## Machine à états d'une partie
`lobby` → (hôte lance, ≥3 joueurs) → `dealing` (serveur tire 11 cartes) → `forming` (sablier ; chacun soumet
ses 5 paires + pomme pourrie ; passage anticipé si tous ont soumis, sinon à l'expiration) → `reveal` (le serveur
calcule les correspondances et pilote la révélation mise en scène) → `scores` (manche + cumul) →
si `mancheCourante < nbManches` : `dealing` (nouvelle manche) sinon `finished` (écran de victoire).

## Règle de sécurité / anti-triche (importante)
Pendant `forming`, les paires sont **secrètes**. Le serveur (DO) stocke les soumissions **en privé** et ne les
diffuse **jamais** aux autres clients avant la phase `reveal`. Toute la logique de scoring est **côté serveur**
(le client ne calcule pas les scores ni ne voit les cartes des autres avant l'heure).

## Verdict free tier (2026-07-01) — voir recherche consignée
- **Pages** : bande passante/requêtes sur assets statiques **illimitées** (gratuit). Builds 500/mois.
- **Durable Objects (SQLite)** : gratuit. Plafond clé = **100 000 requêtes/jour PARTAGÉ** (Workers + Pages
  Functions + DO), reset 00:00 UTC, dépassement = erreur dure. **Chaque message WS entrant = 1 requête.**
  Autres limites larges : 13 000 GB-s/j (hors hibernation), 5 GB storage total, 1 GB/objet.
- **Workers AI** : 10 000 neurons/j gratuits → **~231 images/j** avec Flux schnell (512×512, 4 steps ≈ 43 neurons).
  (Coût neurons de SDXL non confirmé → on part sur **Flux schnell**.)
- **R2** : 10 GB gratuits, **egress gratuit**, 1M ops A / 10M ops B par mois.
- **Verdict** : **OUI, viable en gratuit 24/24**, sous réserve de la frugalité des messages ci-dessous.

## ⭐ Principe de frugalité des messages (contrainte d'archi issue du plafond 100k req/j)
Le jeu est **par phases, pas temps réel haute fréquence**. On tient très largement sous le plafond en respectant :
- **Interactions locales** : le drag & drop / tap-to-pair se résout **entièrement côté client**. **AUCUN**
  message par mouvement de carte. Un seul message quand le joueur **soumet** ses 5 paires.
- **Timer par deadline** : le serveur envoie **une fois** un timestamp de fin de manche ; le compte à rebours
  tourne **côté client**. Pas de tick serveur par seconde.
- **Révélation en un payload** : à la fin de `forming`, le serveur envoie **un seul** payload de résultats ;
  la mise en scène (paire par paire) est **jouée côté client** en animation. Pas un message par étape.
- **État agrégé** : diffuser des snapshots d'état plutôt qu'un message par micro-événement.
→ Une partie complète (4 manches, 8 joueurs) ≈ quelques centaines de messages → **centaines de parties/jour**
   possibles en gratuit. Repli si succès : Workers Paid 5 $/mois (10M req).

## Protocole client ↔ serveur (WebSocket)
> ⚠️ Seuls les messages **entrants** (client→serveur) comptent dans le plafond 100k req/j. Les **broadcasts**
> serveur→clients sont « gratuits » (sends depuis le DO déjà en mémoire). → on garde les **entrants** rares et
> discrets ; on peut diffuser librement des snapshots riches.

**Client → Serveur** (rares, discrets) :
- `createRoom {pseudo, avatar, couleur}` → renvoie `roomCode`, `playerId`
- `joinRoom {roomCode, pseudo, avatar, couleur}`
- `updateSettings {settings}` (hôte, en lobby)
- `startGame {}` (hôte, ≥3 joueurs)
- `submitPairs {paires:[[a,b]×5], pommePourrie}` (**un seul** message par manche/joueur)
- `advance {}` (passer des scores à la manche suivante — hôte, ou auto après délai)
- `leaveRoom {}` (+ close WS)

**Serveur → Client** (broadcasts/targeted, libres) :
- `roomState {players, settings, phase, manche}` (snapshot agrégé à chaque changement)
- `roundStart {manche, cards:[11 ids], deadline:ts}` (le client fait tourner le sablier localement)
- `playerSubmitted {playerId}` (léger, **sans** le contenu des paires — juste « X a fini »)
- `revealPayload {parPaire:[…], soumissionsParJoueur, deltaScores, cumul}` (**un seul** payload → le client
  joue toute la mise en scène en animation)
- `gameOver {classement, scoresFinaux}`
- `error {code, message}`

## Résilience (à spécifier en détail)
- **Reconnexion joueur** : `playerId` conservé côté client (localStorage) → reprise de la place/score si retour
  pendant la partie. Le DO garde l'état.
- **Bascule d'hôte** : si l'hôte quitte, promouvoir le joueur suivant (ou plus ancien connecté).
- **Fin de room** : DO nettoyé quand vide depuis un certain temps.

## Points restants (Phase 1)
- [ ] Détailler reconnexion / bascule d'hôte / room vide.
- [ ] Où servir les images (R2 vs assets Pages) selon le volume du catalogue.
