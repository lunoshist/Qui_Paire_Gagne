import { COULEURS, DEFAULT_SETTINGS, MAX_PLAYERS, MIN_PLAYERS } from '@qpg/shared';
import type {
  ClientMessage,
  Couleur,
  Player,
  PublicRoomState,
  RoomSettings,
  ServerMessage,
  VitesseReveal,
} from '@qpg/shared';

/**
 * Durable Object autoritatif d'une salle « Qui Paire Gagne ».
 *
 * Périmètre de cette implémentation : **LOBBY uniquement** (create/join/leave/
 * settings + garde de démarrage). La logique de manche (distribution, formation,
 * révélation, scores) est ajoutée en TASK-005.
 *
 * Points clés d'infra :
 * - **WebSocket Hibernation** : `state.acceptWebSocket()` + handlers
 *   `webSocketMessage` / `webSocketClose` (jamais `addEventListener`), pour que
 *   le DO puisse être évincé de la mémoire sans perdre les connexions.
 * - **État persisté** dans `ctx.storage` (clé `room`) : survit à l'éviction ;
 *   rechargé dans le constructeur via `blockConcurrencyWhile`.
 * - **Identité socket** attachée via `serializeAttachment` / `deserializeAttachment`
 *   (persiste aussi à travers l'hibernation).
 */

/** L'état persisté = exactement le snapshot public (le lobby n'a aucun secret). */
type RoomData = PublicRoomState;

interface SocketAttachment {
  playerId: string;
}

const STORAGE_KEY_ROOM = 'room';
const STORAGE_KEY_CODE = 'code';

const VITESSES: readonly VitesseReveal[] = ['lent', 'normal', 'rapide'];

export class GameRoom implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly storage: DurableObjectStorage;
  /** Vue mémoire de l'état autoritatif ; `null` tant que personne n'a rejoint. */
  private room: RoomData | null = null;
  /** Code de la salle, connu dès l'upgrade WS (avant même le 1er `joinRoom`). */
  private code: string | null = null;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
    this.storage = state.storage;
    // Réhydratation au réveil : recharge l'état avant tout traitement de message.
    this.state.blockConcurrencyWhile(async () => {
      this.room = (await this.storage.get<RoomData>(STORAGE_KEY_ROOM)) ?? null;
      this.code = (await this.storage.get<string>(STORAGE_KEY_CODE)) ?? this.room?.code ?? null;
    });
  }

  // -------------------------------------------------------------------------
  // Upgrade WebSocket
  // -------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket Upgrade request.', { status: 426 });
    }

    // Le code de salle voyage dans l'URL (`?room=CODE`). On le mémorise pour le
    // 1er `joinRoom` (qui, lui, ne le renvoie pas).
    const code = (new URL(request.url).searchParams.get('room') ?? '').toUpperCase();
    if (code && this.code === null) {
      this.code = code;
      await this.storage.put(STORAGE_KEY_CODE, code);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // Hibernation : le runtime conserve la connexion même DO hors mémoire.
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // -------------------------------------------------------------------------
  // Handlers Hibernation
  // -------------------------------------------------------------------------

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      this.sendError(ws, 'BAD_JSON', 'Message illisible (JSON attendu).');
      return;
    }

    switch (msg.type) {
      case 'joinRoom':
        await this.handleJoin(ws, msg);
        return;
      case 'updateSettings':
        await this.handleUpdateSettings(ws, msg.settings);
        return;
      case 'startGame':
        await this.handleStartGame(ws);
        return;
      case 'leaveRoom':
        await this.handleLeave(ws);
        return;
      default:
        this.sendError(ws, 'UNSUPPORTED', `Message « ${String(msg.type)} » non géré en lobby.`);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean): Promise<void> {
    const playerId = this.attachmentOf(ws);
    if (playerId) {
      // En lobby, une déconnexion retire la place ; en partie, on la conserve
      // (reconnexion possible) et on marque juste `connecte=false`.
      if (this.room && this.room.phase === 'lobby') {
        await this.removePlayer(playerId);
      } else {
        await this.markDisconnected(playerId);
      }
    }

    // Nettoyage d'une salle jamais rejointe / désormais vide et sans socket.
    if (!this.room && this.state.getWebSockets().length === 0) {
      await this.storage.deleteAll();
      this.code = null;
    }

    // 1006 = fermeture anormale ; on referme proprement côté serveur.
    try {
      ws.close(code === 1006 ? 1000 : code, 'GameRoom closing');
    } catch {
      // socket déjà fermé
    }
  }

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------

  private async handleJoin(ws: WebSocket, msg: Extract<ClientMessage, { type: 'joinRoom' }>): Promise<void> {
    if (this.attachmentOf(ws)) {
      this.sendError(ws, 'ALREADY_JOINED', 'Ce socket a déjà rejoint la salle.');
      return;
    }

    // --- Reconnexion : playerId connu ---
    if (msg.playerId && this.room) {
      const existing = this.room.players.find((p) => p.id === msg.playerId);
      if (existing) {
        existing.connecte = true;
        ws.serializeAttachment({ playerId: existing.id } satisfies SocketAttachment);
        await this.persist();
        this.sendJoined(ws, existing.id);
        this.broadcast();
        return;
      }
    }

    // --- Nouveau joueur : gardes ---
    if (this.room && this.room.phase !== 'lobby') {
      this.sendError(ws, 'GAME_STARTED', 'La partie est déjà lancée.');
      return;
    }
    if (this.room && this.room.players.length >= MAX_PLAYERS) {
      this.sendError(ws, 'ROOM_FULL', `Salle pleine (max ${MAX_PLAYERS} joueurs).`);
      return;
    }

    const pseudo = (msg.pseudo ?? '').trim();
    if (!pseudo) {
      this.sendError(ws, 'INVALID_PSEUDO', 'Un pseudo non vide est requis.');
      return;
    }

    // Initialise la salle à la 1re arrivée effective.
    if (!this.room) {
      this.room = {
        code: this.code ?? 'ROOM',
        hostId: '',
        players: [],
        settings: { ...DEFAULT_SETTINGS, variantesScoring: { ...DEFAULT_SETTINGS.variantesScoring } },
        phase: 'lobby',
        mancheCourante: 0,
      };
    }

    const playerId = crypto.randomUUID();
    const couleur = this.pickColor(msg.couleur);
    const isFirst = this.room.players.length === 0;

    const player: Player = {
      id: playerId,
      pseudo: pseudo.slice(0, 24),
      couleur,
      avatar: msg.avatar,
      connecte: true,
      scoreCumul: 0,
    };
    this.room.players.push(player);
    if (isFirst) {
      this.room.hostId = playerId;
    }

    ws.serializeAttachment({ playerId } satisfies SocketAttachment);
    await this.persist();
    this.sendJoined(ws, playerId);
    this.broadcast();
  }

  private async handleUpdateSettings(ws: WebSocket, settings: RoomSettings): Promise<void> {
    const playerId = this.requireJoined(ws);
    if (!playerId || !this.room) return;
    if (playerId !== this.room.hostId) {
      this.sendError(ws, 'NOT_HOST', 'Seul l’hôte peut modifier les réglages.');
      return;
    }
    if (this.room.phase !== 'lobby') {
      this.sendError(ws, 'NOT_IN_LOBBY', 'Réglages modifiables uniquement en lobby.');
      return;
    }
    const clean = sanitizeSettings(settings);
    if (!clean) {
      this.sendError(ws, 'INVALID_SETTINGS', 'Réglages invalides.');
      return;
    }
    this.room.settings = clean;
    await this.persist();
    this.broadcast();
  }

  private async handleStartGame(ws: WebSocket): Promise<void> {
    const playerId = this.requireJoined(ws);
    if (!playerId || !this.room) return;
    if (playerId !== this.room.hostId) {
      this.sendError(ws, 'NOT_HOST', 'Seul l’hôte peut lancer la partie.');
      return;
    }
    if (this.room.phase !== 'lobby') {
      this.sendError(ws, 'ALREADY_STARTED', 'La partie est déjà lancée.');
      return;
    }
    if (this.room.players.length < MIN_PLAYERS) {
      this.sendError(ws, 'NOT_ENOUGH_PLAYERS', `Il faut au moins ${MIN_PLAYERS} joueurs.`);
      return;
    }

    this.room.phase = 'dealing';
    // TODO TASK-005: démarrer la manche (tirage des 11 cartes, deadline, roundStart).
    await this.persist();
    this.broadcast();
  }

  private async handleLeave(ws: WebSocket): Promise<void> {
    const playerId = this.attachmentOf(ws);
    if (playerId) {
      await this.removePlayer(playerId);
    }
    try {
      ws.close(1000, 'left room');
    } catch {
      // déjà fermé
    }
  }

  // -------------------------------------------------------------------------
  // Mutations de population
  // -------------------------------------------------------------------------

  private async removePlayer(playerId: string): Promise<void> {
    if (!this.room) return;
    const wasHost = this.room.hostId === playerId;
    this.room.players = this.room.players.filter((p) => p.id !== playerId);

    if (this.room.players.length === 0) {
      // Salle vide → nettoyage complet de l'état stocké.
      this.room = null;
      this.code = null;
      await this.storage.deleteAll();
      return;
    }

    if (wasHost) {
      this.promoteHost();
    }
    await this.persist();
    this.broadcast();
  }

  private async markDisconnected(playerId: string): Promise<void> {
    if (!this.room) return;
    const player = this.room.players.find((p) => p.id === playerId);
    if (!player) return;
    player.connecte = false;
    if (this.room.hostId === playerId) {
      this.promoteHost();
    }
    await this.persist();
    this.broadcast();
  }

  /** Promeut un nouvel hôte : 1er joueur connecté, sinon 1er joueur restant. */
  private promoteHost(): void {
    if (!this.room || this.room.players.length === 0) return;
    const next = this.room.players.find((p) => p.connecte) ?? this.room.players[0];
    this.room.hostId = next.id;
  }

  // -------------------------------------------------------------------------
  // Utilitaires
  // -------------------------------------------------------------------------

  /** Renvoie une couleur libre (souhaitée si dispo, sinon 1re libre de COULEURS). */
  private pickColor(wanted?: Couleur): Couleur {
    const used = new Set(this.room?.players.map((p) => p.couleur) ?? []);
    if (wanted && COULEURS.includes(wanted) && !used.has(wanted)) {
      return wanted;
    }
    return COULEURS.find((c) => !used.has(c)) ?? COULEURS[0];
  }

  private attachmentOf(ws: WebSocket): string | null {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    return att?.playerId ?? null;
  }

  private requireJoined(ws: WebSocket): string | null {
    const playerId = this.attachmentOf(ws);
    if (!playerId) {
      this.sendError(ws, 'NOT_JOINED', 'Envoyez d’abord un message joinRoom.');
      return null;
    }
    return playerId;
  }

  private async persist(): Promise<void> {
    if (this.room) {
      await this.storage.put(STORAGE_KEY_ROOM, this.room);
    } else {
      await this.storage.delete(STORAGE_KEY_ROOM);
    }
  }

  private snapshot(): PublicRoomState {
    // La salle existe forcément quand on diffuse (au moins 1 joueur).
    return this.room as PublicRoomState;
  }

  private broadcast(): void {
    if (!this.room) return;
    const payload: ServerMessage = { type: 'roomState', state: this.snapshot() };
    const data = JSON.stringify(payload);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // socket en cours de fermeture
      }
    }
  }

  private sendJoined(ws: WebSocket, playerId: string): void {
    const payload: ServerMessage = { type: 'joined', playerId, state: this.snapshot() };
    this.send(ws, payload);
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, { type: 'error', code, message });
  }

  private send(ws: WebSocket, payload: ServerMessage): void {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // socket fermé
    }
  }
}

/** Valide/normalise des réglages reçus du client ; `null` si structurellement invalide. */
function sanitizeSettings(s: RoomSettings | undefined): RoomSettings | null {
  if (!s || typeof s !== 'object') return null;
  const { nbManches, dureeSablier, vitesseReveal, variantesScoring } = s;
  if (!Number.isInteger(nbManches) || nbManches < 1 || nbManches > 20) return null;
  if (!Number.isFinite(dureeSablier) || dureeSablier < 10 || dureeSablier > 600) return null;
  if (!VITESSES.includes(vitesseReveal)) return null;
  if (!variantesScoring || typeof variantesScoring !== 'object') return null;
  if (
    typeof variantesScoring.paireUnanimeZero !== 'boolean' ||
    typeof variantesScoring.pommePourrieDouble !== 'boolean'
  ) {
    return null;
  }
  return {
    nbManches,
    dureeSablier: Math.round(dureeSablier),
    vitesseReveal,
    variantesScoring: {
      paireUnanimeZero: variantesScoring.paireUnanimeZero,
      pommePourrieDouble: variantesScoring.pommePourrieDouble,
    },
  };
}
