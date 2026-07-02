/**
 * Logique PURE du store de salle (sans WebSocket, sans React).
 *
 * Séparée du hook `useRoom` pour être testable en isolation : un réducteur
 * `reduce(state, action)` qui applique les messages serveur + les changements
 * d'état de connexion, plus des gardes dérivées (hôte, démarrage possible).
 */

import { MIN_PLAYERS } from '@qpg/shared';
import type {
  GameOverMessage,
  PublicRoomState,
  RevealPayloadMessage,
  ServerMessage,
} from '@qpg/shared';

/** Statut de la connexion WebSocket, tel qu'affiché à l'utilisateur. */
export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

/** Erreur applicative reçue du serveur (message `error`). */
export interface RoomError {
  code: string;
  message: string;
}

/** État de la manche en cours, alimenté par `roundStart` (le sablier tourne côté client). */
export interface RoundInfo {
  manche: number;
  /** Les 11 cardIds tirés pour la manche. */
  cards: string[];
  /** Timestamp (ms) de fin de la phase `forming`. */
  deadline: number;
}

/** État observable de la salle côté client. */
export interface RoomStoreState {
  connection: ConnectionStatus;
  playerId: string | null;
  roomState: PublicRoomState | null;
  lastError: RoomError | null;
  /** Manche courante (cartes + deadline), `null` hors partie. */
  round: RoundInfo | null;
  /** Identifiants des joueurs ayant soumis leurs paires pour la manche. */
  submitted: string[];
  /** Payload de révélation de la manche (résultats + soumissions + scores), `null` sinon. */
  reveal: RevealPayloadMessage | null;
  /** Résultat de fin de partie (classement final), `null` tant que la partie n'est pas finie. */
  gameOver: GameOverMessage | null;
}

export const initialRoomState: RoomStoreState = {
  connection: 'idle',
  playerId: null,
  roomState: null,
  lastError: null,
  round: null,
  submitted: [],
  reveal: null,
  gameOver: null,
};

/** Remise à zéro des champs de manche (retour au lobby / relance). */
const CLEARED_ROUND = {
  round: null,
  submitted: [] as string[],
  reveal: null,
  gameOver: null,
} satisfies Partial<RoomStoreState>;

/** Actions du réducteur : changements de connexion + messages serveur. */
export type RoomAction =
  | { type: 'connection'; status: ConnectionStatus }
  | { type: 'server'; message: ServerMessage }
  | { type: 'clearError' };

/**
 * Réducteur pur. Traite les messages de connexion, de lobby (`joined`,
 * `roomState`, `error`) ET de jeu (`roundStart`, `playerSubmitted`,
 * `revealPayload`, `gameOver`). `joined` porte le `playerId` autoritatif
 * (à persister par l'appelant).
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
            // Retour au lobby (ex. reconnexion après `returnToLobby`) → ardoise nette.
            ...(msg.state.phase === 'lobby' ? CLEARED_ROUND : null),
          };
        case 'roomState':
          return {
            ...state,
            roomState: msg.state,
            // `returnToLobby` ramène la salle en lobby : on efface manche/reveal/fin
            // pour éviter tout écran fantôme d'une partie précédente.
            ...(msg.state.phase === 'lobby' ? CLEARED_ROUND : null),
          };
        case 'error':
          return { ...state, lastError: { code: msg.code, message: msg.message } };

        case 'roundStart':
          // Nouvelle manche : on repart d'une ardoise propre (soumissions/reveal).
          return {
            ...state,
            round: { manche: msg.manche, cards: msg.cards, deadline: msg.deadline },
            submitted: [],
            reveal: null,
            gameOver: null,
          };

        case 'playerSubmitted':
          return state.submitted.includes(msg.playerId)
            ? state
            : { ...state, submitted: [...state.submitted, msg.playerId] };

        case 'revealPayload':
          return { ...state, reveal: msg };

        case 'gameOver':
          return { ...state, gameOver: msg };

        default:
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
