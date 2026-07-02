import { describe, expect, it } from 'vitest';
import { parseRoute } from './router';

describe('parseRoute', () => {
  it('reconnaît la racine comme Accueil', () => {
    expect(parseRoute('/')).toEqual({ name: 'home' });
    expect(parseRoute('/nimportequoi')).toEqual({ name: 'home' });
  });

  it('reconnaît /room/CODE et normalise en majuscules', () => {
    expect(parseRoute('/room/abcd')).toEqual({ name: 'room', code: 'ABCD' });
    expect(parseRoute('/room/WXYZ/')).toEqual({ name: 'room', code: 'WXYZ' });
  });

  it('rejette un code invalide (mauvaise longueur / chiffres)', () => {
    expect(parseRoute('/room/abc')).toEqual({ name: 'home' });
    expect(parseRoute('/room/ab12')).toEqual({ name: 'home' });
  });
});
