import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@qpg/shared';
import type { PublicRoomState } from '@qpg/shared';
import { canStartGame, initialRoomState, isHost, missingPlayers, reduce } from './roomStore';

function makeRoom(overrides: Partial<PublicRoomState> = {}): PublicRoomState {
  return {
    code: 'ABCD',
    hostId: 'p1',
    players: [{ id: 'p1', pseudo: 'Alex', couleur: 'bleu', connecte: true, scoreCumul: 0 }],
    settings: DEFAULT_SETTINGS,
    phase: 'lobby',
    mancheCourante: 0,
    ...overrides,
  };
}

describe('reduce — connexion', () => {
  it('met à jour le statut de connexion', () => {
    const s = reduce(initialRoomState, { type: 'connection', status: 'open' });
    expect(s.connection).toBe('open');
  });
});

describe('reduce — messages serveur', () => {
  it('joined pose playerId + roomState et efface l’erreur', () => {
    const withError = { ...initialRoomState, lastError: { code: 'X', message: 'y' } };
    const s = reduce(withError, {
      type: 'server',
      message: { type: 'joined', playerId: 'p1', state: makeRoom() },
    });
    expect(s.playerId).toBe('p1');
    expect(s.roomState?.code).toBe('ABCD');
    expect(s.lastError).toBeNull();
  });

  it('roomState remplace l’état sans toucher au playerId', () => {
    const base = reduce(initialRoomState, {
      type: 'server',
      message: { type: 'joined', playerId: 'p1', state: makeRoom() },
    });
    const updated = makeRoom({
      players: [
        { id: 'p1', pseudo: 'Alex', couleur: 'bleu', connecte: true, scoreCumul: 0 },
        { id: 'p2', pseudo: 'Sam', couleur: 'rouge', connecte: true, scoreCumul: 0 },
      ],
    });
    const s = reduce(base, { type: 'server', message: { type: 'roomState', state: updated } });
    expect(s.playerId).toBe('p1');
    expect(s.roomState?.players).toHaveLength(2);
  });

  it('error renseigne lastError', () => {
    const s = reduce(initialRoomState, {
      type: 'server',
      message: { type: 'error', code: 'ROOM_FULL', message: 'Salle pleine.' },
    });
    expect(s.lastError).toEqual({ code: 'ROOM_FULL', message: 'Salle pleine.' });
  });

  it('clearError remet lastError à null', () => {
    const withError = { ...initialRoomState, lastError: { code: 'X', message: 'y' } };
    expect(reduce(withError, { type: 'clearError' }).lastError).toBeNull();
  });
});

describe('reduce — messages de jeu', () => {
  const withPlayer = reduce(initialRoomState, {
    type: 'server',
    message: { type: 'joined', playerId: 'p1', state: makeRoom() },
  });

  it('roundStart stocke la manche/cartes/deadline et remet à zéro l’ardoise', () => {
    const dirty = {
      ...withPlayer,
      submitted: ['x'],
      reveal: { type: 'revealPayload' } as never,
      gameOver: { type: 'gameOver' } as never,
    };
    const s = reduce(dirty, {
      type: 'server',
      message: { type: 'roundStart', manche: 2, cards: ['a', 'b', 'c'], deadline: 123 },
    });
    expect(s.round).toEqual({ manche: 2, cards: ['a', 'b', 'c'], deadline: 123 });
    expect(s.submitted).toEqual([]);
    expect(s.reveal).toBeNull();
    expect(s.gameOver).toBeNull();
  });

  it('playerSubmitted ajoute (sans doublon) au set des joueurs ayant fini', () => {
    const s1 = reduce(withPlayer, {
      type: 'server',
      message: { type: 'playerSubmitted', playerId: 'p2' },
    });
    expect(s1.submitted).toEqual(['p2']);
    const s2 = reduce(s1, { type: 'server', message: { type: 'playerSubmitted', playerId: 'p2' } });
    expect(s2).toBe(s1); // idempotent : pas de doublon, pas de nouvel objet
    const s3 = reduce(s1, { type: 'server', message: { type: 'playerSubmitted', playerId: 'p3' } });
    expect(s3.submitted).toEqual(['p2', 'p3']);
  });

  it('revealPayload stocke le payload de révélation', () => {
    const msg = {
      type: 'revealPayload' as const,
      parPaire: [],
      pommesPourries: [],
      soumissionsParJoueur: {},
      deltaScores: { p1: 3 },
      cumul: { p1: 3 },
    };
    const s = reduce(withPlayer, { type: 'server', message: msg });
    expect(s.reveal).toBe(msg);
  });

  it('gameOver stocke le classement final', () => {
    const msg = {
      type: 'gameOver' as const,
      classement: [{ playerId: 'p1', score: 7 }],
      scoresFinaux: { p1: 7 },
    };
    const s = reduce(withPlayer, { type: 'server', message: msg });
    expect(s.gameOver).toBe(msg);
  });
});

describe('gardes dérivées', () => {
  it('isHost compare hostId et playerId', () => {
    expect(isHost(makeRoom(), 'p1')).toBe(true);
    expect(isHost(makeRoom(), 'p2')).toBe(false);
    expect(isHost(null, 'p1')).toBe(false);
  });

  it('missingPlayers reflète le manque vis-à-vis de MIN_PLAYERS', () => {
    expect(missingPlayers(makeRoom())).toBe(2); // 1 joueur, min 3
    expect(missingPlayers(null)).toBe(3);
  });

  it('canStartGame : faux sous MIN_PLAYERS, vrai à MIN_PLAYERS pour l’hôte', () => {
    const one = makeRoom();
    expect(canStartGame(one, 'p1')).toBe(false);

    const three = makeRoom({
      players: [
        { id: 'p1', pseudo: 'Alex', couleur: 'bleu', connecte: true, scoreCumul: 0 },
        { id: 'p2', pseudo: 'Sam', couleur: 'rouge', connecte: true, scoreCumul: 0 },
        { id: 'p3', pseudo: 'Lou', couleur: 'vert', connecte: true, scoreCumul: 0 },
      ],
    });
    expect(canStartGame(three, 'p1')).toBe(true); // hôte
    expect(canStartGame(three, 'p2')).toBe(false); // non-hôte
  });

  it('canStartGame : faux hors phase lobby', () => {
    const started = makeRoom({
      phase: 'dealing',
      players: [
        { id: 'p1', pseudo: 'Alex', couleur: 'bleu', connecte: true, scoreCumul: 0 },
        { id: 'p2', pseudo: 'Sam', couleur: 'rouge', connecte: true, scoreCumul: 0 },
        { id: 'p3', pseudo: 'Lou', couleur: 'vert', connecte: true, scoreCumul: 0 },
      ],
    });
    expect(canStartGame(started, 'p1')).toBe(false);
  });
});
