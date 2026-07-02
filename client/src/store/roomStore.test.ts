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

  it('ignore les messages de jeu (hors lobby)', () => {
    const s = reduce(initialRoomState, {
      type: 'server',
      message: { type: 'roundStart', manche: 1, cards: [], deadline: 0 },
    });
    expect(s).toBe(initialRoomState);
  });

  it('clearError remet lastError à null', () => {
    const withError = { ...initialRoomState, lastError: { code: 'X', message: 'y' } };
    expect(reduce(withError, { type: 'clearError' }).lastError).toBeNull();
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
