# Qui Paire Gagne — version en ligne

Adaptation web multijoueur temps réel du jeu de société **« Qui Paire Gagne »**.
Monorepo (npm workspaces) : `client/` (React + Vite + TS), `server/` (Cloudflare Worker + Durable Object,
WebSocket Hibernation, backend SQLite), `shared/` (types partagés TS).

> État actuel : **scaffold** uniquement — un écho WebSocket bout-en-bout prouve la tuyauterie temps réel.
> Aucune logique de jeu (lobby, cartes, scoring) n'est encore implémentée.
> Contexte, décisions et roadmap : voir `docs/` (commencer par `AGENTS.md`).

## Prérequis

- Node.js >= 20 (développé sous Node 24)
- npm >= 10 (workspaces)

## Installation

```bash
npm install
```

## Développement local

Deux terminaux (le serveur d'abord, pour que le port 8787 soit prêt) :

```bash
# 1) Worker + Durable Object en local (http://localhost:8787, WS sur /ws)
npm run dev:server

# 2) Front React + Vite (http://localhost:5173)
npm run dev:client
```

Le client lit l'URL du WebSocket dans `VITE_WS_URL` (défaut : `ws://localhost:8787/ws`).
Copier `client/.env.example` vers `client/.env` pour la surcharger si besoin.

Ouvrir http://localhost:5173, taper un message : l'écho renvoyé par le Durable Object s'affiche.

## Scripts (racine)

| Commande             | Effet                                                           |
| -------------------- | --------------------------------------------------------------- |
| `npm run dev:client` | Démarre le front Vite.                                          |
| `npm run dev:server` | Démarre le Worker/DO via `wrangler dev` (local).                |
| `npm run build`      | `tsc --noEmit` + build de production du client (`client/dist`). |
| `npm run typecheck`  | Vérifie les types de tous les workspaces.                       |
| `npm run lint`       | ESLint sur tout le monorepo.                                    |
| `npm run format`     | Vérifie le formatage (Prettier). `format:write` pour corriger.  |
| `npm test`           | Lance Vitest sur les workspaces qui ont des tests.              |

## Structure

```
.
├── client/   React + Vite + TS (front → Cloudflare Pages)
├── server/   Cloudflare Worker + Durable Object EchoRoom (Wrangler, SQLite)
├── shared/   Types & helpers partagés (protocole WebSocket)
└── docs/     Mémoire projet (brief, décisions, architecture, roadmap)
```

## Déploiement

Non couvert par ce scaffold (aucun compte Cloudflare requis pour le dev local).
Le déploiement (`wrangler deploy`, Cloudflare Pages) fera l'objet d'une tâche ultérieure.
