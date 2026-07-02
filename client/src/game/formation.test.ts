import { describe, expect, it } from 'vitest';
import {
  createFormation,
  isComplete,
  pairCards,
  placeCard,
  placedCards,
  poolCards,
  pommePourrie,
  slotOf,
  toSubmission,
  unplaceCard,
} from './formation';

const CARDS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'];

/** Construit un état complet : 5 paires (c0..c9) + c10 en pomme pourrie. */
function completed() {
  let f = createFormation(CARDS);
  f = pairCards(f, 'c0', 'c1');
  f = pairCards(f, 'c2', 'c3');
  f = pairCards(f, 'c4', 'c5');
  f = pairCards(f, 'c6', 'c7');
  f = pairCards(f, 'c8', 'c9');
  return f;
}

describe('formation — création', () => {
  it('démarre avec 5 emplacements vides et toutes les cartes au pool', () => {
    const f = createFormation(CARDS);
    expect(f.slots).toHaveLength(5);
    expect(placedCards(f)).toEqual([]);
    expect(poolCards(f)).toEqual(CARDS);
    expect(isComplete(f)).toBe(false);
    expect(pommePourrie(f)).toBeNull();
  });
});

describe('formation — placeCard', () => {
  it('place une carte et la retire du pool', () => {
    const f = placeCard(createFormation(CARDS), 'c0', 0);
    expect(f.slots[0]).toEqual(['c0']);
    expect(poolCards(f)).not.toContain('c0');
    expect(slotOf(f, 'c0')).toBe(0);
  });

  it('déplace une carte d’un emplacement à un autre', () => {
    let f = placeCard(createFormation(CARDS), 'c0', 0);
    f = placeCard(f, 'c0', 1);
    expect(f.slots[0]).toEqual([]);
    expect(f.slots[1]).toEqual(['c0']);
  });

  it('refuse un emplacement déjà plein (no-op)', () => {
    let f = placeCard(createFormation(CARDS), 'c0', 0);
    f = placeCard(f, 'c1', 0);
    const before = f;
    f = placeCard(f, 'c2', 0);
    expect(f).toBe(before);
    expect(f.slots[0]).toEqual(['c0', 'c1']);
  });

  it('ignore un index invalide ou une carte hors manche', () => {
    const f = createFormation(CARDS);
    expect(placeCard(f, 'c0', 9)).toBe(f);
    expect(placeCard(f, 'inconnu', 0)).toBe(f);
  });
});

describe('formation — pairCards (tap-to-pair)', () => {
  it('apparie deux cartes dans le 1er emplacement libre', () => {
    const f = pairCards(createFormation(CARDS), 'c3', 'c7');
    expect(f.slots[0]).toEqual(['c3', 'c7']);
  });

  it('ignore l’appariement d’une carte avec elle-même', () => {
    const f = createFormation(CARDS);
    expect(pairCards(f, 'c0', 'c0')).toBe(f);
  });

  it('sans emplacement libre → no-op', () => {
    const f = completed();
    const before = f;
    expect(pairCards(f, 'c0', 'c2')).toBe(before);
  });
});

describe('formation — unplaceCard', () => {
  it('renvoie une carte au pool', () => {
    let f = placeCard(createFormation(CARDS), 'c0', 0);
    f = unplaceCard(f, 'c0');
    expect(poolCards(f)).toContain('c0');
    expect(slotOf(f, 'c0')).toBe(-1);
  });
});

describe('formation — complétion & soumission', () => {
  it('détecte la complétion et déduit la pomme pourrie', () => {
    const f = completed();
    expect(isComplete(f)).toBe(true);
    expect(poolCards(f)).toEqual(['c10']);
    expect(pommePourrie(f)).toBe('c10');
  });

  it('toSubmission renvoie 5 paires + la pomme pourrie', () => {
    const sub = toSubmission(completed());
    expect(sub).not.toBeNull();
    expect(sub?.paires).toHaveLength(5);
    expect(sub?.pommePourrie).toBe('c10');
    expect(sub?.paires[0]).toEqual(['c0', 'c1']);
  });

  it('toSubmission renvoie null si incomplet', () => {
    const f = placeCard(createFormation(CARDS), 'c0', 0);
    expect(toSubmission(f)).toBeNull();
  });
});
