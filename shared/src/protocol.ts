/**
 * Protocole WebSocket client ↔ serveur (voir `docs/architecture.md`).
 *
 * Unions discriminées par la propriété `type`. Les messages ENTRANTS
 * (`ClientMessage`) sont rares et discrets (contrainte de frugalité, D-005) ;
 * les messages SORTANTS (`ServerMessage`) sont des broadcasts libres.
 */

import type {
  Couleur,
  Pair,
  PairResult,
  PlayerSubmission,
  PommePourrieResult,
  PublicRoomState,
  RoomSettings,
  Scoreboard,
} from './domain';

// ---------------------------------------------------------------------------
// Écho (scaffold — prouve la tuyauterie temps réel ; conservé le temps de la
// bascule vers le protocole de jeu, cf. TASK-001).
// ---------------------------------------------------------------------------

/** Message d'écho envoyé par le client. */
export interface EchoRequest {
  type: 'echo';
  text: string;
}

/** Réponse d'écho renvoyée par le serveur. */
export interface EchoResponse {
  type: 'echo';
  text: string;
  /** Timestamp (ms) auquel le serveur a reçu le message. */
  receivedAt: number;
}

/** Construit un message d'écho côté client. */
export function createEchoRequest(text: string): EchoRequest {
  return { type: 'echo', text };
}

// ---------------------------------------------------------------------------
// Client → Serveur (entrants, rares, comptés au plafond Cloudflare)
// ---------------------------------------------------------------------------

/** L'hôte crée une salle. */
export interface CreateRoomMessage {
  type: 'createRoom';
  pseudo: string;
  couleur: Couleur;
  avatar?: string;
}

/** Un joueur rejoint une salle existante via son code. */
export interface JoinRoomMessage {
  type: 'joinRoom';
  roomCode: string;
  pseudo: string;
  couleur: Couleur;
  avatar?: string;
}

/** L'hôte modifie les réglages (en lobby). */
export interface UpdateSettingsMessage {
  type: 'updateSettings';
  settings: RoomSettings;
}

/** L'hôte lance la partie (≥ MIN_PLAYERS). */
export interface StartGameMessage {
  type: 'startGame';
}

/** Un joueur soumet ses paires + sa pomme pourrie (UN seul message / manche). */
export interface SubmitPairsMessage {
  type: 'submitPairs';
  paires: Pair[];
  pommePourrie: string;
}

/** Passage à la manche suivante depuis l'écran de scores (hôte ou auto). */
export interface AdvanceMessage {
  type: 'advance';
}

/** Un joueur quitte la salle (+ fermeture du WebSocket). */
export interface LeaveRoomMessage {
  type: 'leaveRoom';
}

/** Union des messages Client → Serveur. */
export type ClientMessage =
  | EchoRequest
  | CreateRoomMessage
  | JoinRoomMessage
  | UpdateSettingsMessage
  | StartGameMessage
  | SubmitPairsMessage
  | AdvanceMessage
  | LeaveRoomMessage;

/** Discriminant `type` des messages Client → Serveur. */
export type ClientMessageType = ClientMessage['type'];

// ---------------------------------------------------------------------------
// Serveur → Client (broadcasts/targeted, libres)
// ---------------------------------------------------------------------------

/** Snapshot agrégé de l'état public de la salle, à chaque changement. */
export interface RoomStateMessage {
  type: 'roomState';
  state: PublicRoomState;
}

/** Début de manche : les 11 cartes + la deadline (le sablier tourne côté client). */
export interface RoundStartMessage {
  type: 'roundStart';
  manche: number;
  /** Les 11 cardIds tirés pour la manche. */
  cards: string[];
  /** Timestamp (ms) de fin de la phase `forming`. */
  deadline: number;
}

/** Notification légère « X a soumis » (SANS le contenu des paires). */
export interface PlayerSubmittedMessage {
  type: 'playerSubmitted';
  playerId: string;
}

/**
 * Payload unique de révélation : le client joue toute la mise en scène en
 * animation à partir de ce seul message (contrainte de frugalité).
 */
export interface RevealPayloadMessage {
  type: 'revealPayload';
  parPaire: PairResult[];
  pommesPourries: PommePourrieResult[];
  /** Les soumissions de chaque joueur, révélées au moment du reveal. */
  soumissionsParJoueur: Record<string, PlayerSubmission>;
  /** Points gagnés dans la manche, par joueur. */
  deltaScores: Record<string, number>;
  /** Score cumulé après la manche, par joueur. */
  cumul: Record<string, number>;
}

/** Fin de partie : classement final. */
export interface GameOverMessage {
  type: 'gameOver';
  classement: Scoreboard;
  scoresFinaux: Record<string, number>;
}

/** Erreur applicative renvoyée au client fautif. */
export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

/** Union des messages Serveur → Client. */
export type ServerMessage =
  | EchoResponse
  | RoomStateMessage
  | RoundStartMessage
  | PlayerSubmittedMessage
  | RevealPayloadMessage
  | GameOverMessage
  | ErrorMessage;

/** Discriminant `type` des messages Serveur → Client. */
export type ServerMessageType = ServerMessage['type'];
