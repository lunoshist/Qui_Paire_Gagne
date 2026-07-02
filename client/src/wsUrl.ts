/**
 * Résolution des URLs serveur (HTTP + WebSocket) à partir des variables d'env
 * Vite, avec défauts locaux (wrangler dev écoute sur le port 8787).
 *
 * Contrat serveur figé (voir `docs/state.md`) :
 * - Créer une salle : `POST {API}/api/rooms` → `{ code }`.
 * - Rejoindre       : WebSocket `GET {WS}/api/ws?room=CODE`.
 */

/** Base HTTP par défaut en local. */
export const DEFAULT_API_URL = 'http://localhost:8787';
/** Base WebSocket par défaut en local. */
export const DEFAULT_WS_URL = 'ws://localhost:8787';

/** Retire un éventuel `/` final pour composer des chemins proprement. */
function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Base HTTP de l'API : `VITE_API_URL` sinon défaut local. */
export function resolveApiBaseUrl(): string {
  return trimTrailingSlash(import.meta.env.VITE_API_URL ?? DEFAULT_API_URL);
}

/** Base WebSocket : `VITE_WS_URL` sinon défaut local. */
export function resolveWsBaseUrl(): string {
  return trimTrailingSlash(import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL);
}

/** URL POST de création d'une salle. */
export function buildCreateRoomUrl(): string {
  return `${resolveApiBaseUrl()}/api/rooms`;
}

/**
 * URL WebSocket de connexion à une salle donnée.
 * Le code est normalisé (majuscules) — le serveur attend 4 lettres A–Z.
 */
export function buildRoomWsUrl(code: string): string {
  const normalized = code.trim().toUpperCase();
  return `${resolveWsBaseUrl()}/api/ws?room=${encodeURIComponent(normalized)}`;
}
