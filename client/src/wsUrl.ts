/** URL WebSocket par défaut en local (wrangler dev écoute sur le port 8787). */
export const DEFAULT_WS_URL = 'ws://localhost:8787/ws';

/** Résout l'URL du WebSocket : variable d'env `VITE_WS_URL` sinon défaut local. */
export function resolveWsUrl(): string {
  return import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL;
}
