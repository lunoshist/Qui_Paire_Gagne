import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Player } from '@qpg/shared';
import { Formation } from './Formation';
import type { RoundInfo } from '../store/roomStore';

/**
 * Smoke test de l'écran Formation : rendu des 11 cartes, formation des 5 paires
 * en tap-to-pair, activation de Valider, et émission d'un unique `submitPairs`
 * (5 paires + pomme pourrie). Le catalogue n'est pas servi en jsdom : les cartes
 * dégradent en affichant leur identifiant (repli), ce qui suffit au smoke test.
 */

const CARDS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'];

const PLAYERS: Player[] = [
  { id: 'p1', pseudo: 'Moi', couleur: 'bleu', connecte: true, scoreCumul: 0 },
  { id: 'p2', pseudo: 'Sam', couleur: 'rouge', connecte: true, scoreCumul: 0 },
  { id: 'p3', pseudo: 'Lou', couleur: 'vert', connecte: true, scoreCumul: 0 },
];

function round(): RoundInfo {
  // Deadline loin dans le futur : pas d'auto-soumission pendant le test.
  return { manche: 1, cards: CARDS, deadline: Date.now() + 5 * 60_000 };
}

beforeEach(() => {
  // fetch du manifeste échoue proprement en jsdom → catalogue vide (repli id).
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('no network in test'))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function tapCard(id: string) {
  const el = screen.getAllByText(id)[0];
  const btn = el.closest('button');
  if (!btn) throw new Error(`carte ${id} sans bouton`);
  fireEvent.click(btn);
}

describe('Écran Formation', () => {
  it('affiche la manche et les 11 cartes', () => {
    render(
      <Formation round={round()} players={PLAYERS} myId="p1" submitted={[]} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText(/Manche 1/)).toBeTruthy();
    for (const id of CARDS) {
      expect(screen.getAllByText(id).length).toBeGreaterThan(0);
    }
    const valider = screen.getByRole('button', {
      name: /Forme les .* paires/i,
    }) as HTMLButtonElement;
    expect(valider.disabled).toBe(true);
  });

  it('forme 5 paires en tap-to-pair puis soumet 5 paires + pomme pourrie', () => {
    const onSubmit = vi.fn();
    render(
      <Formation round={round()} players={PLAYERS} myId="p1" submitted={[]} onSubmit={onSubmit} />,
    );

    const pairs: [string, string][] = [
      ['c0', 'c1'],
      ['c2', 'c3'],
      ['c4', 'c5'],
      ['c6', 'c7'],
      ['c8', 'c9'],
    ];
    for (const [a, b] of pairs) {
      tapCard(a);
      tapCard(b);
    }

    const valider = screen.getByRole('button', {
      name: /Valider mes paires/i,
    }) as HTMLButtonElement;
    expect(valider.disabled).toBe(false);
    fireEvent.click(valider);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [paires, pomme] = onSubmit.mock.calls[0];
    expect(paires).toHaveLength(5);
    expect(pomme).toBe('c10');
  });

  it('affiche l’état d’attente une fois soumis', () => {
    render(
      <Formation
        round={round()}
        players={PLAYERS}
        myId="p1"
        submitted={['p1']}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText(/En attente des autres joueurs/i)).toBeTruthy();
  });
});
