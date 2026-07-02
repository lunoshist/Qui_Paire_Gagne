import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { DEFAULT_SETTINGS } from '@qpg/shared';
import type { PublicRoomState, ServerMessage } from '@qpg/shared';
import { Home } from './Home';
import { Room } from './Room';
import { setJoinIntent } from '../storage';

/**
 * WebSocket factice : capture les instances créées et permet de simuler
 * `onopen` / `onmessage` depuis le test (jsdom n'implémente pas WebSocket).
 */
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
  }
}

const originalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  MockWebSocket.instances = [];
  // @ts-expect-error — remplacement contrôlé pour le test.
  globalThis.WebSocket = MockWebSocket;
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  globalThis.WebSocket = originalWebSocket;
});

describe('Accueil', () => {
  it('affiche le titre et les actions créer / rejoindre', () => {
    render(<Home navigate={vi.fn()} />);
    expect(screen.getByText(/Qui Paire/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Créer une partie/i })).toBeTruthy();
    expect(screen.getByLabelText(/Ton pseudo/i)).toBeTruthy();
    expect(screen.getByLabelText(/Code de la salle/i)).toBeTruthy();
  });
});

describe('Salle d’attente', () => {
  function roomWith(count: number): PublicRoomState {
    const couleurs = ['bleu', 'rouge', 'vert'] as const;
    return {
      code: 'ABCD',
      hostId: 'p1',
      players: Array.from({ length: count }, (_, i) => ({
        id: `p${i + 1}`,
        pseudo: `Joueur${i + 1}`,
        couleur: couleurs[i % couleurs.length],
        connecte: true,
        scoreCumul: 0,
      })),
      settings: DEFAULT_SETTINGS,
      phase: 'lobby',
      mancheCourante: 0,
    };
  }

  function connectAndJoin(state: PublicRoomState) {
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
    });
    const joined: ServerMessage = { type: 'joined', playerId: 'p1', state };
    act(() => {
      ws.onmessage?.({ data: JSON.stringify(joined) });
    });
  }

  it('rend la salle, la liste des joueurs et le bouton Lancer désactivé sous MIN_PLAYERS', () => {
    setJoinIntent({ pseudo: 'Joueur1', couleur: 'bleu' });
    render(<Room code="ABCD" navigate={vi.fn()} />);

    // Un WebSocket a bien été ouvert vers la bonne salle.
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain('room=ABCD');

    connectAndJoin(roomWith(1));

    expect(screen.getByText(/Joueurs \(1\/8\)/)).toBeTruthy();
    const launch = screen.getByRole('button', { name: /Lancer la partie/i }) as HTMLButtonElement;
    expect(launch.disabled).toBe(true);
    expect(screen.getByText(/au moins 3 joueurs/i)).toBeTruthy();
  });

  it('active Lancer à MIN_PLAYERS pour l’hôte', () => {
    setJoinIntent({ pseudo: 'Joueur1', couleur: 'bleu' });
    render(<Room code="ABCD" navigate={vi.fn()} />);
    connectAndJoin(roomWith(3));

    expect(screen.getByText(/Joueurs \(3\/8\)/)).toBeTruthy();
    const launch = screen.getByRole('button', { name: /Lancer la partie/i }) as HTMLButtonElement;
    expect(launch.disabled).toBe(false);
  });

  it('affiche le placeholder de transition hors lobby', () => {
    setJoinIntent({ pseudo: 'Joueur1', couleur: 'bleu' });
    render(<Room code="ABCD" navigate={vi.fn()} />);
    connectAndJoin({ ...roomWith(3), phase: 'dealing' });

    expect(screen.getByText(/La partie démarre/i)).toBeTruthy();
  });
});
