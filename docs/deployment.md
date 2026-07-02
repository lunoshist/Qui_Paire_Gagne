# Déploiement (production)

_MàJ : 2026-07-02. Statut : 1er déploiement en ligne réussi et vérifié._

## URLs de production
- **Front (jeu)** : https://qui-paire-gagne.pages.dev  ← à partager pour jouer
- **Worker (API + WebSocket)** : https://qui-paire-gagne-server.lunoshist.workers.dev
  - `POST /api/rooms` → `{code}` ; `wss://…/api/ws?room=CODE`

## Compte & accès
- Compte Cloudflare : **lunoshist@gmail.com** (Account ID `049327e1f82b31adaae285895bd8cb89`).
- Auth : **wrangler OAuth** (`wrangler login` fait par le commanditaire le 2026-07-02). Les commandes `wrangler`
  lancées par l'agent utilisent ce jeton stocké localement. Révocable via `wrangler logout` / dashboard.
- Sous-domaine workers.dev : `lunoshist.workers.dev`.
- Projet Pages : `qui-paire-gagne` (branche de prod = `main`).

## Procédure de (re)déploiement — manuelle pour l'instant
### Serveur (Worker + Durable Object)
```
cd server && npx wrangler deploy
```
### Client (front → Pages)
```
# 1) build avec l'URL du worker de prod (client/.env.production)
npm run build --workspace client
# 2) déployer le dossier buildé
npx wrangler pages deploy client/dist --project-name qui-paire-gagne --branch main --commit-dirty=true
```
- `client/.env.production` (committé) contient `VITE_API_URL` / `VITE_WS_URL` de prod → **bakés dans le bundle au build**.
- CORS serveur = `*` (le front Pages appelle le worker cross-origin) ; WS cross-origin OK.

## Vérification prod (2026-07-02)
- Page Pages : `HTTP/2 200`, `content-type text/html`.
- E2E WebSocket contre le worker déployé : `POST /api/rooms` → code, connexion WS + `joinRoom` → `joined` (playerId+host). **PASS.**

## TODO déploiement (plus tard)
- **CI/CD** : automatiser `push → deploy` (GitHub Actions + wrangler, ou intégration Git de Pages). Aujourd'hui = manuel.
- Éventuel **domaine custom** si souhaité.
- Re-tester la dispo 24/24 après quelques jours (hibernation DO).
