/** Appels HTTP au serveur (hors WebSocket). */

import { buildCreateRoomUrl } from './wsUrl';

/** Crée une salle via `POST /api/rooms`. Renvoie le code (4 lettres). */
export async function createRoom(): Promise<string> {
  const res = await fetch(buildCreateRoomUrl(), { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Création de salle impossible (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as { code?: unknown };
  if (typeof data.code !== 'string' || !/^[A-Z]{4}$/.test(data.code)) {
    throw new Error('Réponse serveur invalide (code de salle manquant).');
  }
  return data.code;
}
