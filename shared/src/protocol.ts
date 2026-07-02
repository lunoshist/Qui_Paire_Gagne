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

/** L'hôte crée une salle.
 *
 * NB : la création effective passe par `POST /api/rooms` (renvoie `{ code }`) —
 * cf. `docs/agents/003-server-room-lobby.md`. Ce message reste défini pour un
 * éventuel usage futur mais n'est plus traité par le serveur en lobby.
 */
export interface CreateRoomMessage {
  type: 'createRoom';
  pseudo: string;
  couleur: Couleur;
  avatar?: string;
}

/**
 * Premier message envoyé par un client après l'upgrade WebSocket
 * (`GET /api/ws?room=CODE` → le code est dans l'URL, pas dans le payload).
 * - `playerId` présent ⇒ tentative de **reconnexion** (reprise de la place).
 * - `couleur` absente ou déjà prise ⇒ le serveur assigne une couleur libre.
 */
export interface JoinRoomMessage {
  type: 'joinRoom';
  pseudo: string;
  couleur?: Couleur;
  avatar?: string;
  /** Fourni pour reprendre une place existante (reconnexion). */
  playerId?: string;
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

/**
 * (Mode `meneur`) L'hôte dévoile l'élément suivant de la révélation : le serveur
 * incrémente le curseur autoritatif `revealStep` (borné au nombre d'éléments) et
 * rediffuse l'étape courante à TOUS via `revealStep` — tout le monde voit la même
 * paire au même instant. Sans effet hors phase `reveal` ou si déjà au bout.
 */
export interface RevealNextMessage {
  type: 'revealNext';
}

/** Un joueur quitte la salle (+ fermeture du WebSocket). */
export interface LeaveRoomMessage {
  type: 'leaveRoom';
}

/**
 * L'hôte ramène la salle au lobby depuis l'écran de fin (`finished`) :
 * scores remis à zéro, joueurs conservés → on peut changer les réglages et
 * relancer une partie dans la **même** salle (pas de cul-de-sac « Rejouer »).
 */
export interface ReturnToLobbyMessage {
  type: 'returnToLobby';
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
  | RevealNextMessage
  | LeaveRoomMessage
  | ReturnToLobbyMessage;

/** Discriminant `type` des messages Client → Serveur. */
export type ClientMessageType = ClientMessage['type'];

// ---------------------------------------------------------------------------
// Serveur → Client (broadcasts/targeted, libres)
// ---------------------------------------------------------------------------

/**
 * Accusé de connexion **ciblé** (envoyé au seul socket qui vient de rejoindre) :
 * communique au client son `playerId` (généré serveur, à stocker pour la
 * reconnexion) et un premier snapshot de la salle.
 */
export interface JoinedMessage {
  type: 'joined';
  playerId: string;
  state: PublicRoomState;
}

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
  /**
   * Curseur de révélation courant (mode `meneur`) : nombre d'éléments déjà
   * dévoilés (0 à l'ouverture, valeur en cours lors d'un resync mid-reveal).
   * Ignoré en mode `rapide` (l'auto-play est piloté côté client).
   */
  revealStep: number;
}

/**
 * (Mode `meneur`) Nouvelle valeur du curseur de révélation, diffusée à tous après
 * un `revealNext` de l'hôte : synchronise l'affichage pas-à-pas entre clients.
 */
export interface RevealStepMessage {
  type: 'revealStep';
  step: number;
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
  | JoinedMessage
  | RoomStateMessage
  | RoundStartMessage
  | PlayerSubmittedMessage
  | RevealPayloadMessage
  | RevealStepMessage
  | GameOverMessage
  | ErrorMessage;

/** Discriminant `type` des messages Serveur → Client. */
export type ServerMessageType = ServerMessage['type'];
