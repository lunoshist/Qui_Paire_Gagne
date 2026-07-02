/**
 * Logique PURE du store de salle (sans WebSocket, sans React).
 *
 * Séparée du hook `useRoom` pour être testable en isolation : un réducteur
 * `reduce(state, action)` qui applique les messages serveur + les changements
 * d'état de connexion, plus des gardes dérivées (hôte, démarrage possible).
 */

import { MIN_PLAYERS } from '@qpg/shared';
import type { PublicRoomState, ServerMessage } from '@qpg/shared';

/** Statut de la connexion WebSocket, tel qu'affiché à l'utilisateur. */
export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

/** Erreur applicative reçue du serveur (message `error`). */
export interface RoomError {
  code: string;
  message: string;
}

/** État observable de la salle côté client. */
export interface RoomStoreState {
  connection: ConnectionStatus;
  playerId: string | null;
  roomState: PublicRoomState | null;
  lastError: RoomError | null;
}

export const initialRoomState: RoomStoreState = {
  connection: 'idle',
  playerId: null,
  roomState: null,
  lastError: null,
};

/** Actions du réducteur : changements de connexion + messages serveur. */
export type RoomAction =
  | { type: 'connection'; status: ConnectionStatus }
  | { type: 'server'; message: ServerMessage }
  | { type: 'clearError' };

/**
 * Réducteur pur. Ne traite (côté lobby) que `joined`, `roomState` et `error` ;
 * les autres messages serveur (jeu) sont ignorés ici — hors périmètre TASK-004.
 * `joined` porte le `playerId` autoritatif (à persister par l'appelant).
 */
export function reduce(state: RoomStoreState, action: RoomAction): RoomStoreState {
  switch (action.type) {
    case 'connection':
      return { ...state, connection: action.status };

    case 'clearError':
      return state.lastError === null ? state : { ...state, lastError: null };

    case 'server': {
      const msg = action.message;
      switch (msg.type) {
        case 'joined':
          return {
            ...state,
            playerId: msg.playerId,
            roomState: msg.state,
            lastError: null,
          };
        case 'roomState':
          return { ...state, roomState: msg.state };
        case 'error':
          return { ...state, lastError: { code: msg.code, message: msg.message } };
        default:
          // Messages de jeu (roundStart, revealPayload, …) : ignorés en lobby.
          return state;
      }
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Gardes dérivées (pures)
// ---------------------------------------------------------------------------

/** Le joueur courant est-il l'hôte de la salle ? */
export function isHost(roomState: PublicRoomState | null, playerId: string | null): boolean {
  return !!roomState && !!playerId && roomState.hostId === playerId;
}

/** Nombre de joueurs manquants pour atteindre le minimum (0 si atteint). */
export function missingPlayers(roomState: PublicRoomState | null): number {
  const count = roomState?.players.length ?? 0;
  return Math.max(0, MIN_PLAYERS - count);
}

/**
 * L'hôte peut-il lancer la partie ?
 * → phase lobby + hôte + au moins MIN_PLAYERS joueurs.
 */
export function canStartGame(roomState: PublicRoomState | null, playerId: string | null): boolean {
  if (!roomState || roomState.phase !== 'lobby') return false;
  if (!isHost(roomState, playerId)) return false;
  return roomState.players.length >= MIN_PLAYERS;
}
