# TASK-001 · Scaffolding du monorepo (fondations)

- **Statut** : livré (vérifié 2026-07-01)
- **Date** : 2026-07-01
- **Dépend de** : — (première tâche de build)

## Objectif (une seule tâche)
Mettre en place le squelette du monorepo (client + server + shared + outillage) avec un « hello world »
temps réel **fonctionnel en local** : un client React qui ouvre un WebSocket vers un Durable Object et reçoit un écho.

## Contexte utile
- Stack actée : voir `docs/decisions.md` D-005 (Cloudflare) et **D-009 (structure & outillage)**.
- Contrainte d'archi : **frugalité des messages** (`docs/architecture.md`) — mais pour ce scaffold, un simple
  écho suffit à prouver la tuyauterie.
- On ne déploie PAS encore (pas de compte Cloudflare requis) : tout doit tourner en **local** (`wrangler dev`,
  `vite dev`).

## Definition of Done (vérifiable)
- [x] Monorepo **npm workspaces** avec `client/`, `server/`, `shared/`, TypeScript partout.
- [x] `shared/` exporte au moins un type partagé importable par client ET server (ex. type de message WS).
- [x] `client/` : app **React + Vite + TS** qui démarre via `npm run dev` (dans client) et affiche une page.
- [x] `server/` : **Worker + Durable Object** (backend **SQLite** : `new_sqlite_classes` dans `wrangler.toml`)
      exposant un endpoint WebSocket ; le DO utilise l'**API WebSocket Hibernation** (`acceptWebSocket`,
      handlers `webSocketMessage`/`webSocketClose`).
- [x] Le DO fait un **écho** : tout message reçu est renvoyé au client.
- [x] Le client se connecte au WS (URL via `VITE_WS_URL`), envoie un message, **affiche l'écho** reçu.
- [x] `wrangler dev` (server) + `vite dev` (client) tournent **en local** et l'écho fonctionne bout-en-bout.
- [x] ESLint + Prettier + Vitest configurés ; `npm run lint` et `npm test` passent (même avec 1 test trivial).
- [x] Un `README.md` racine documente les commandes (dev client, dev server, lint, test).
- [x] Rien n'est déployé ; aucun secret/compte requis pour lancer en local.

## Livrables attendus
Arborescence du monorepo fonctionnelle + README. Pas de logique de jeu (viendra dans les tâches suivantes).

## Résultat (rempli au retour) — 2026-07-01

### Produit
Monorepo npm workspaces `shared/` + `client/` + `server/`, TypeScript partout, outillage ESLint 9 (flat
config) + Prettier + Vitest à la racine. Écho WebSocket bout-en-bout fonctionnel en local.

Arborescence (hors `node_modules/`, `dist/`, `.wrangler/`) :
```
package.json (workspaces)  tsconfig.base.json  eslint.config.mjs  .prettierrc.json  .prettierignore
.gitignore  README.md
shared/  package.json  tsconfig.json  src/index.ts (types EchoRequest/EchoResponse + ClientMessage/
         ServerMessage + createEchoRequest)  src/index.test.ts
client/  package.json  tsconfig.json  vite.config.ts  index.html  .env.example
         src/{main.tsx, App.tsx, wsUrl.ts, wsUrl.test.ts, vite-env.d.ts}
server/  package.json  tsconfig.json  wrangler.toml  src/index.ts (Worker, route /ws -> DO)
         src/EchoRoom.ts (Durable Object, WebSocket Hibernation)
```

Points d'archi respectés :
- `server/wrangler.toml` : DO `EchoRoom` en `new_sqlite_classes = ["EchoRoom"]` (backend SQLite, free tier).
- `EchoRoom` utilise `state.acceptWebSocket()` + handlers `webSocketMessage` / `webSocketClose`
  (API Hibernation, PAS `addEventListener('message')`).
- Worker route `GET /ws` -> `ECHO_ROOM.idFromName('global')` -> `stub.fetch(request)`.
- Type partagé `@qpg/shared` importé par le server (EchoRoom) ET le client (App.tsx) — prouvé au build
  (le bundle Vite transforme 29 modules incluant shared).
- Client : URL via `VITE_WS_URL` avec défaut `ws://localhost:8787/ws` (`client/src/wsUrl.ts`).

### Versions clés
node v24.12.0 · npm 11.8.0 · TypeScript 5.9.3 · Vite 6.4.3 (client) · @vitejs/plugin-react 4.x ·
React 19 · Vitest 3.2.6 · ESLint 9.39.4 · Prettier 3 · Wrangler 4.106.0 · @cloudflare/workers-types 4.x.

### Résultats de vérification (tous PASS)
- `npm install` : OK (247 paquets, 0 vulnérabilité).
- `npm run typecheck` (tsc --noEmit x3 workspaces) : **PASS**.
- `npm run lint` (eslint .) : **PASS** (0 erreur ; règle `no-unused-vars` configurée avec
  `argsIgnorePattern: '^_'`).
- `npm run format` (prettier --check) : **PASS** (docs/ et AGENTS.md exclus via `.prettierignore` —
  non touchés).
- `npm test` (vitest run x2 workspaces) : **PASS** — 2 fichiers, 2 tests (shared `createEchoRequest`,
  client `resolveWsUrl`).
- `npm run build` (tsc --noEmit + vite build) : **PASS** — `client/dist` généré (index ~196 kB / 61 kB gzip).
- `wrangler dev` (server) : **PASS** — « Ready on http://localhost:8787 », binding DO `EchoRoom` (local).
- `vite dev` (client) : **PASS** — « ready in 202 ms », http://localhost:5173.
- **Écho WS bout-en-bout** : **PASS** — testé automatiquement via client WebSocket Node 24 (global
  `WebSocket`) contre `wrangler dev`. Envoi `{"type":"echo","text":"ping-42"}` → réception
  `{"type":"echo","text":"ping-42","receivedAt":1782917326168}`. Round-trip validé.

### Procédure manuelle de validation de l'écho (rappel)
`npm run dev:server` (terminal 1) puis `npm run dev:client` (terminal 2) → ouvrir http://localhost:5173,
taper un message, l'écho du DO s'affiche dans le journal.

### Écarts / notes pour le tracker
- **Aucun écart bloquant.** Périmètre strictement respecté (aucune logique de jeu).
- Test client volontairement gardé trivial et pur (`resolveWsUrl`, env node) pour un PASS fiable sans
  jsdom/RTL ni mock WebSocket. À enrichir (RTL + rendu de composant) quand l'UI de jeu arrivera.
- `@qpg/shared` exporte directement `src/index.ts` (pas d'étape de build) : Vite (esbuild) et Wrangler
  (esbuild) transpilent le TS du workspace ; tsc résout les types via le champ `types`. Simple et sans
  friction pour le dev. Un vrai `build` (dist + .d.ts) reste dispo (`npm run build -w @qpg/shared`) si un
  besoin de publication apparaît.
- Un DO unique nommé `'global'` pour le scaffold ; la logique « une room = un DO »
  (`idFromName(roomCode)`) viendra avec la tâche lobby.
- `compatibility_date = "2025-06-01"` dans `wrangler.toml` (à réviser au besoin lors du déploiement).
- Pas de tests côté server (pas de `@cloudflare/vitest-pool-workers` pour rester léger) — l'écho est
  couvert par le test d'intégration WS ci-dessus. À ajouter si on veut du CI sans réseau workerd.
