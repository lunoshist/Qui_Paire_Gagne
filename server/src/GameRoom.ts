import {
  CARDS_PER_ROUND,
  COULEURS,
  computeRoundResult,
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PAIRS_PER_ROUND,
} from '@qpg/shared';
import type {
  ClientMessage,
  Couleur,
  Pair,
  Player,
  PlayerSubmission,
  PublicRoomState,
  RoomSettings,
  RoundResult,
  Scoreboard,
  ServerMessage,
  VitesseReveal,
} from '@qpg/shared';
import { CARD_IDS } from './cards';

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

/** L'état persisté PUBLIC = exactement le snapshot public (aucun secret). */
type RoomData = PublicRoomState;

/**
 * État SECRET d'une manche en cours, persisté à part (clé `round`) pour garantir
 * qu'il ne fuit JAMAIS dans un `roomState` (le snapshot public ne le contient pas).
 * Les `submissions` ne sont diffusées qu'au moment du `revealPayload`.
 */
interface RoundData {
  /** Les 11 cartes tirées pour la manche. */
  tirage: string[];
  /** Timestamp (ms) de fin de la phase `forming` (arme aussi l'alarme DO). */
  deadline: number;
  /** Soumissions secrètes par joueur (JAMAIS diffusées avant `reveal`). */
  submissions: Record<string, PlayerSubmission>;
  /** Résultat calculé, mémorisé une fois la manche résolue (phase `reveal`). */
  reveal: RoundResult | null;
}

interface SocketAttachment {
  playerId: string;
}

const STORAGE_KEY_ROOM = 'room';
const STORAGE_KEY_CODE = 'code';
const STORAGE_KEY_ROUND = 'round';

const VITESSES: readonly VitesseReveal[] = ['lent', 'normal', 'rapide'];

export class GameRoom implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly storage: DurableObjectStorage;
  /** Vue mémoire de l'état autoritatif ; `null` tant que personne n'a rejoint. */
  private room: RoomData | null = null;
  /** Vue mémoire de l'état SECRET de la manche ; `null` hors partie. */
  private round: RoundData | null = null;
  /** Code de la salle, connu dès l'upgrade WS (avant même le 1er `joinRoom`). */
  private code: string | null = null;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
    this.storage = state.storage;
    // Réhydratation au réveil : recharge l'état avant tout traitement de message.
    this.state.blockConcurrencyWhile(async () => {
      this.room = (await this.storage.get<RoomData>(STORAGE_KEY_ROOM)) ?? null;
      this.round = (await this.storage.get<RoundData>(STORAGE_KEY_ROUND)) ?? null;
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
      case 'submitPairs':
        await this.handleSubmitPairs(ws, msg);
        return;
      case 'advance':
        await this.handleAdvance(ws);
        return;
      case 'leaveRoom':
        await this.handleLeave(ws);
        return;
      default:
        this.sendError(ws, 'UNSUPPORTED', `Message « ${String(msg.type)} » non géré.`);
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
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

  private async handleJoin(
    ws: WebSocket,
    msg: Extract<ClientMessage, { type: 'joinRoom' }>,
  ): Promise<void> {
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
        settings: {
          ...DEFAULT_SETTINGS,
          variantesScoring: { ...DEFAULT_SETTINGS.variantesScoring },
        },
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
    if (CARD_IDS.length < CARDS_PER_ROUND) {
      this.sendError(
        ws,
        'CATALOG_TOO_SMALL',
        `Catalogue insuffisant : ${CARD_IDS.length} cartes pour ${CARDS_PER_ROUND} requises.`,
      );
      return;
    }

    this.room.mancheCourante = 1;
    await this.beginRound();
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
  // Manche : dealing → forming → reveal → scores → enchaînement / fin
  // -------------------------------------------------------------------------

  /**
   * Démarre la manche `mancheCourante` : tirage des 11 cartes, passage en
   * `forming`, diffusion de `roundStart` et armement de l'alarme d'échéance.
   */
  private async beginRound(): Promise<void> {
    if (!this.room) return;

    // Phase transitoire `dealing` (le serveur tire les cartes).
    this.room.phase = 'dealing';
    this.broadcast();

    const tirage = this.drawTirage();
    const deadline = Date.now() + this.room.settings.dureeSablier * 1000;
    this.round = { tirage, deadline, submissions: {}, reveal: null };
    this.room.phase = 'forming';

    // Alarme DO : résout la manche à l'échéance même si le DO hiberne entre-temps.
    await this.storage.setAlarm(deadline);
    await this.persist();

    this.broadcast();
    this.broadcastRoundStart();
  }

  /**
   * Tire 11 identifiants de cartes DISTINCTS du pool bundlé.
   *
   * v1 SIMPLE : tirage purement aléatoire (Fisher–Yates partiel, RNG crypto).
   * TODO (catalogue plus grand) : remplacer par l'algo d'« ambiguïté contrôlée »
   * de `docs/catalog.md` (graphe d'association tags, scoring de candidats) afin
   * d'éviter les paires triviales et les cartes isolées.
   */
  private drawTirage(): string[] {
    const pool = [...CARD_IDS];
    const n = pool.length;
    for (let i = 0; i < CARDS_PER_ROUND; i++) {
      const rand = crypto.getRandomValues(new Uint32Array(1))[0];
      const j = i + (rand % (n - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, CARDS_PER_ROUND);
  }

  private async handleSubmitPairs(
    ws: WebSocket,
    msg: Extract<ClientMessage, { type: 'submitPairs' }>,
  ): Promise<void> {
    const playerId = this.requireJoined(ws);
    if (!playerId || !this.room) return;
    if (this.room.phase !== 'forming' || !this.round) {
      this.sendError(ws, 'NOT_FORMING', 'Aucune soumission attendue hors de la phase forming.');
      return;
    }
    if (this.round.submissions[playerId]) {
      this.sendError(ws, 'ALREADY_SUBMITTED', 'Vous avez déjà soumis pour cette manche.');
      return;
    }

    const submission = this.validateSubmission(playerId, msg);
    if (!submission) {
      this.sendError(ws, 'INVALID_SUBMISSION', '5 paires + 1 pomme pourrie couvrant le tirage.');
      return;
    }

    // Stockage SECRET : jamais diffusé avant le reveal.
    this.round.submissions[playerId] = submission;
    await this.persist();

    // Notification légère, SANS contenu.
    this.broadcastServer({ type: 'playerSubmitted', playerId });

    if (this.allConnectedSubmitted()) {
      await this.resolveRound();
    }
  }

  /**
   * Valide une soumission : exactement 5 paires de 2 cartes, une pomme pourrie,
   * les 11 identifiants distincts couvrant EXACTEMENT le tirage de la manche.
   * Renvoie la soumission normalisée, ou `null` si invalide.
   */
  private validateSubmission(
    playerId: string,
    msg: Extract<ClientMessage, { type: 'submitPairs' }>,
  ): PlayerSubmission | null {
    if (!this.round) return null;
    const { paires, pommePourrie } = msg;
    if (!Array.isArray(paires) || paires.length !== PAIRS_PER_ROUND) return null;
    if (typeof pommePourrie !== 'string' || !pommePourrie) return null;

    const tirage = new Set(this.round.tirage);
    if (!tirage.has(pommePourrie)) return null;

    const seen = new Set<string>([pommePourrie]);
    const cleanPaires: Pair[] = [];
    for (const p of paires) {
      if (!Array.isArray(p) || p.length !== 2) return null;
      const [a, b] = p;
      if (typeof a !== 'string' || typeof b !== 'string') return null;
      if (a === b || !tirage.has(a) || !tirage.has(b)) return null;
      if (seen.has(a) || seen.has(b)) return null; // carte réutilisée
      seen.add(a);
      seen.add(b);
      cleanPaires.push([a, b]);
    }
    // 5 paires (10 cartes) + pomme pourrie = 11 cartes distinctes = le tirage.
    if (seen.size !== CARDS_PER_ROUND) return null;
    return { playerId, paires: cleanPaires, pommePourrie };
  }

  /** Vrai si tous les joueurs CONNECTÉS ont soumis (déclenche la résolution). */
  private allConnectedSubmitted(): boolean {
    if (!this.room || !this.round) return false;
    const connected = this.room.players.filter((p) => p.connecte);
    if (connected.length === 0) return false;
    return connected.every((p) => this.round?.submissions[p.id]);
  }

  /**
   * Résout la manche (déclenchée par « tous soumis » OU par l'alarme).
   * Calcule les scores, cumule, passe en `reveal` et diffuse `revealPayload`.
   * Les joueurs connectés sans soumission comptent comme soumission vide (0 pt).
   */
  private async resolveRound(): Promise<void> {
    if (!this.room || !this.round || this.room.phase !== 'forming') return;

    // Annule l'alarme (résolution anticipée) — sans effet si déjà déclenchée.
    await this.storage.deleteAlarm();

    const connectedIds = this.room.players.filter((p) => p.connecte).map((p) => p.id);
    const submissions = connectedIds
      .map((id) => this.round?.submissions[id])
      .filter((s): s is PlayerSubmission => Boolean(s));

    const result = computeRoundResult(submissions, connectedIds);

    // Cumul des scores sur l'ensemble des joueurs.
    for (const player of this.room.players) {
      player.scoreCumul += result.deltaScores[player.id] ?? 0;
    }

    this.round.reveal = result;
    this.room.phase = 'reveal';
    await this.persist();

    this.broadcast();
    this.broadcastReveal(result, submissions);
  }

  private async handleAdvance(ws: WebSocket): Promise<void> {
    const playerId = this.requireJoined(ws);
    if (!playerId || !this.room) return;
    if (playerId !== this.room.hostId) {
      this.sendError(ws, 'NOT_HOST', 'Seul l’hôte peut passer à la suite.');
      return;
    }
    if (this.room.phase !== 'reveal') {
      this.sendError(ws, 'NOT_IN_REVEAL', 'On ne peut avancer que depuis la révélation.');
      return;
    }

    if (this.room.mancheCourante < this.room.settings.nbManches) {
      this.room.mancheCourante += 1;
      await this.beginRound();
      return;
    }

    // Fin de partie.
    this.room.phase = 'finished';
    this.round = null;
    await this.storage.delete(STORAGE_KEY_ROUND);
    await this.persist();

    this.broadcast();
    this.broadcastGameOver();
  }

  /**
   * Handler d'alarme DO : résout la manche à l'échéance du sablier, même si le
   * DO a hiberné entre-temps (l'état est réhydraté dans le constructeur).
   */
  async alarm(): Promise<void> {
    if (this.room && this.round && this.room.phase === 'forming') {
      await this.resolveRound();
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
      this.round = null;
      this.code = null;
      await this.storage.deleteAlarm();
      await this.storage.deleteAll();
      return;
    }

    if (wasHost) {
      this.promoteHost();
    }
    await this.persist();
    this.broadcast();
    // Un départ peut rendre « tous connectés soumis » vrai → résoudre.
    if (this.allConnectedSubmitted()) await this.resolveRound();
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
    // La déconnexion d'un joueur en attente peut débloquer la résolution.
    if (this.allConnectedSubmitted()) await this.resolveRound();
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
    if (this.round) {
      await this.storage.put(STORAGE_KEY_ROUND, this.round);
    } else {
      await this.storage.delete(STORAGE_KEY_ROUND);
    }
  }

  private snapshot(): PublicRoomState {
    // La salle existe forcément quand on diffuse (au moins 1 joueur).
    // ⚠️ N'inclut JAMAIS `round` (soumissions secrètes) : c'est le garde anti-fuite.
    return this.room as PublicRoomState;
  }

  /** Diffuse un snapshot public à tous les sockets (jamais de secret). */
  private broadcast(): void {
    if (!this.room) return;
    this.broadcastServer({ type: 'roomState', state: this.snapshot() });
  }

  /** Diffuse un message serveur arbitraire à tous les sockets connectés. */
  private broadcastServer(payload: ServerMessage): void {
    const data = JSON.stringify(payload);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // socket en cours de fermeture
      }
    }
  }

  /** `roundStart` : les 11 cartes + la deadline (le sablier tourne côté client). */
  private broadcastRoundStart(): void {
    if (!this.room || !this.round) return;
    this.broadcastServer({
      type: 'roundStart',
      manche: this.room.mancheCourante,
      cards: this.round.tirage,
      deadline: this.round.deadline,
    });
  }

  /** `revealPayload` : résultats + soumissions révélées + deltas + cumul. */
  private broadcastReveal(result: RoundResult, submissions: PlayerSubmission[]): void {
    if (!this.room) return;
    const soumissionsParJoueur: Record<string, PlayerSubmission> = {};
    for (const s of submissions) soumissionsParJoueur[s.playerId] = s;
    const cumul: Record<string, number> = {};
    for (const p of this.room.players) cumul[p.id] = p.scoreCumul;
    this.broadcastServer({
      type: 'revealPayload',
      parPaire: result.parPaire,
      pommesPourries: result.pommesPourries,
      soumissionsParJoueur,
      deltaScores: result.deltaScores,
      cumul,
    });
  }

  /** `gameOver` : classement trié par score décroissant. */
  private broadcastGameOver(): void {
    if (!this.room) return;
    const scoresFinaux: Record<string, number> = {};
    for (const p of this.room.players) scoresFinaux[p.id] = p.scoreCumul;
    const classement: Scoreboard = [...this.room.players]
      .map((p) => ({ playerId: p.id, score: p.scoreCumul }))
      .sort((a, b) => b.score - a.score);
    this.broadcastServer({ type: 'gameOver', classement, scoresFinaux });
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
