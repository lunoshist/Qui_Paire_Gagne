import { describe, expect, it } from 'vitest';
import {
  computeRoundResult,
  computeRoundResultDuo,
  DUO_PAIR_POINTS,
  DUO_POMME_BONUS,
  duoTeamPoints,
  normalizePair,
  pairKey,
  scorePaire,
  scorePommePourrie,
} from './scoring';
import type { PairResult, PlayerSubmission, PommePourrieResult } from './domain';

// Helpers ------------------------------------------------------------------

function sub(playerId: string, paires: [string, string][], pommePourrie = ''): PlayerSubmission {
  return { playerId, paires, pommePourrie };
}

/** Retrouve un résultat de paire par sa clé normalisée (ordre-insensible). */
function findPair(results: PairResult[], a: string, b: string): PairResult | undefined {
  const key = pairKey([a, b]);
  return results.find((r) => pairKey(r.pair) === key);
}

function findPomme(results: PommePourrieResult[], cardId: string): PommePourrieResult | undefined {
  return results.find((r) => r.cardId === cardId);
}

// --------------------------------------------------------------------------
// Primitives : normalizePair / pairKey
// --------------------------------------------------------------------------

describe('normalizePair', () => {
  it('trie les deux cardIds', () => {
    expect(normalizePair(['b', 'a'])).toEqual(['a', 'b']);
    expect(normalizePair(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('produit la même clé quel que soit l’ordre', () => {
    expect(pairKey(['x', 'y'])).toBe(pairKey(['y', 'x']));
  });

  it('distingue des paires réellement différentes', () => {
    expect(pairKey(['a', 'b'])).not.toBe(pairKey(['a', 'c']));
  });
});

// --------------------------------------------------------------------------
// Règles centralisées : scorePaire
// --------------------------------------------------------------------------

describe('scorePaire', () => {
  it('solo (1 maker) = 0', () => {
    expect(scorePaire(1, 5)).toBe(0);
  });
  it('unanime (tous les joueurs) = 0', () => {
    expect(scorePaire(5, 5)).toBe(0);
  });
  it('2 makers = 2', () => {
    expect(scorePaire(2, 5)).toBe(2);
  });
  it('3 makers = 3', () => {
    expect(scorePaire(3, 5)).toBe(3);
  });
  it('N (majorité non unanime) = N', () => {
    expect(scorePaire(4, 5)).toBe(4);
    expect(scorePaire(7, 8)).toBe(7);
  });
  it('0 maker = 0 (garde)', () => {
    expect(scorePaire(0, 5)).toBe(0);
  });
});

// --------------------------------------------------------------------------
// Règles centralisées : scorePommePourrie (double)
// --------------------------------------------------------------------------

describe('scorePommePourrie', () => {
  it('solo (1 sharer) = 0', () => {
    expect(scorePommePourrie(1, 5)).toBe(0);
  });
  it('partagée = double du nombre de sharers', () => {
    expect(scorePommePourrie(2, 5)).toBe(4);
    expect(scorePommePourrie(3, 5)).toBe(6);
  });
  it('unanime = 0 (⚠️ à confirmer au livret)', () => {
    expect(scorePommePourrie(5, 5)).toBe(0);
  });
  it('0 sharer = 0 (garde)', () => {
    expect(scorePommePourrie(0, 5)).toBe(0);
  });
});

// --------------------------------------------------------------------------
// computeRoundResult — paires
// --------------------------------------------------------------------------

describe('computeRoundResult — paires', () => {
  it('paire solo = 0 point', () => {
    const players = ['p1', 'p2', 'p3'];
    const res = computeRoundResult([sub('p1', [['a', 'b']])], players);
    const pr = findPair(res.parPaire, 'a', 'b')!;
    expect(pr.makers).toEqual(['p1']);
    expect(pr.pointsParMaker).toBe(0);
    expect(res.deltaScores).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it('paire unanime (3/3) = 0 point (D-003)', () => {
    const players = ['p1', 'p2', 'p3'];
    const res = computeRoundResult(
      [sub('p1', [['a', 'b']]), sub('p2', [['a', 'b']]), sub('p3', [['a', 'b']])],
      players,
    );
    const pr = findPair(res.parPaire, 'a', 'b')!;
    expect(pr.makers.sort()).toEqual(['p1', 'p2', 'p3']);
    expect(pr.pointsParMaker).toBe(0);
    expect(res.deltaScores).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it('paire à 2 makers sur 3 = 2 points chacun', () => {
    const players = ['p1', 'p2', 'p3'];
    const res = computeRoundResult([sub('p1', [['a', 'b']]), sub('p2', [['a', 'b']])], players);
    const pr = findPair(res.parPaire, 'a', 'b')!;
    expect(pr.pointsParMaker).toBe(2);
    expect(res.deltaScores).toEqual({ p1: 2, p2: 2, p3: 0 });
  });

  it('paire à 3 makers sur 4 = 3 points chacun', () => {
    const players = ['p1', 'p2', 'p3', 'p4'];
    const res = computeRoundResult(
      [sub('p1', [['a', 'b']]), sub('p2', [['a', 'b']]), sub('p3', [['a', 'b']])],
      players,
    );
    const pr = findPair(res.parPaire, 'a', 'b')!;
    expect(pr.pointsParMaker).toBe(3);
    expect(res.deltaScores).toEqual({ p1: 3, p2: 3, p3: 3, p4: 0 });
  });

  it('paire à N=7 makers sur 8 = 7 points chacun', () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const makers = players.slice(0, 7);
    const res = computeRoundResult(
      makers.map((id) => sub(id, [['a', 'b']])),
      players,
    );
    const pr = findPair(res.parPaire, 'a', 'b')!;
    expect(pr.pointsParMaker).toBe(7);
    for (const id of makers) expect(res.deltaScores[id]).toBe(7);
    expect(res.deltaScores.p8).toBe(0);
  });

  it('ordre des cartes inversé traité identiquement', () => {
    const players = ['p1', 'p2', 'p3'];
    const res = computeRoundResult([sub('p1', [['a', 'b']]), sub('p2', [['b', 'a']])], players);
    // Une SEULE paire agrégée, malgré l'ordre inversé.
    expect(res.parPaire).toHaveLength(1);
    const pr = res.parPaire[0];
    expect(pr.pair).toEqual(['a', 'b']); // normalisée
    expect(pr.makers.sort()).toEqual(['p1', 'p2']);
    expect(pr.pointsParMaker).toBe(2);
    expect(res.deltaScores).toEqual({ p1: 2, p2: 2, p3: 0 });
  });

  it('plusieurs paires distinctes agrégées indépendamment', () => {
    const players = ['p1', 'p2', 'p3'];
    const res = computeRoundResult(
      [
        sub('p1', [
          ['a', 'b'],
          ['c', 'd'],
        ]),
        sub('p2', [
          ['a', 'b'],
          ['e', 'f'],
        ]),
        sub('p3', [
          ['c', 'd'],
          ['e', 'f'],
        ]),
      ],
      players,
    );
    expect(findPair(res.parPaire, 'a', 'b')!.pointsParMaker).toBe(2); // p1,p2
    expect(findPair(res.parPaire, 'c', 'd')!.pointsParMaker).toBe(2); // p1,p3
    expect(findPair(res.parPaire, 'e', 'f')!.pointsParMaker).toBe(2); // p2,p3
    // Chaque joueur est dans 2 paires à 2 points => 4 points.
    expect(res.deltaScores).toEqual({ p1: 4, p2: 4, p3: 4 });
  });

  it('doublon de paire chez un même joueur ne compte qu’une fois', () => {
    const players = ['p1', 'p2', 'p3'];
    const res = computeRoundResult(
      [
        sub('p1', [
          ['a', 'b'],
          ['b', 'a'],
        ]),
      ],
      players,
    );
    const pr = findPair(res.parPaire, 'a', 'b')!;
    expect(pr.makers).toEqual(['p1']); // un seul maker malgré le doublon
    expect(pr.pointsParMaker).toBe(0); // solo
  });
});

// --------------------------------------------------------------------------
// computeRoundResult — pommes pourries
// --------------------------------------------------------------------------

describe('computeRoundResult — pommes pourries', () => {
  it('pomme pourrie solo = 0', () => {
    const players = ['p1', 'p2', 'p3'];
    const res = computeRoundResult([sub('p1', [], 'z')], players);
    const pp = findPomme(res.pommesPourries, 'z')!;
    expect(pp.sharers).toEqual(['p1']);
    expect(pp.pointsParSharer).toBe(0);
    expect(res.deltaScores).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it('pomme pourrie partagée = double (2 sharers => 4)', () => {
    const players = ['p1', 'p2', 'p3'];
    const res = computeRoundResult([sub('p1', [], 'z'), sub('p2', [], 'z')], players);
    const pp = findPomme(res.pommesPourries, 'z')!;
    expect(pp.pointsParSharer).toBe(4);
    expect(res.deltaScores).toEqual({ p1: 4, p2: 4, p3: 0 });
  });

  it('pomme pourrie partagée par 3/4 = 6 chacun', () => {
    const players = ['p1', 'p2', 'p3', 'p4'];
    const res = computeRoundResult(
      [sub('p1', [], 'z'), sub('p2', [], 'z'), sub('p3', [], 'z')],
      players,
    );
    const pp = findPomme(res.pommesPourries, 'z')!;
    expect(pp.pointsParSharer).toBe(6);
    expect(res.deltaScores).toEqual({ p1: 6, p2: 6, p3: 6, p4: 0 });
  });

  it('pomme pourrie unanime = 0 (⚠️ à confirmer au livret)', () => {
    const players = ['p1', 'p2', 'p3'];
    const res = computeRoundResult(
      [sub('p1', [], 'z'), sub('p2', [], 'z'), sub('p3', [], 'z')],
      players,
    );
    const pp = findPomme(res.pommesPourries, 'z')!;
    expect(pp.pointsParSharer).toBe(0);
    expect(res.deltaScores).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it('pommes pourries différentes ne se rencontrent pas', () => {
    const players = ['p1', 'p2', 'p3'];
    const res = computeRoundResult(
      [sub('p1', [], 'y'), sub('p2', [], 'z'), sub('p3', [], 'z')],
      players,
    );
    expect(findPomme(res.pommesPourries, 'y')!.pointsParSharer).toBe(0); // solo
    expect(findPomme(res.pommesPourries, 'z')!.pointsParSharer).toBe(4); // 2 sharers
    expect(res.deltaScores).toEqual({ p1: 0, p2: 4, p3: 4 });
  });
});

// --------------------------------------------------------------------------
// computeRoundResult — agrégation & cas limites
// --------------------------------------------------------------------------

describe('computeRoundResult — deltaScores agrégés', () => {
  it('additionne paires ET pommes pourries pour un même joueur', () => {
    const players = ['p1', 'p2', 'p3'];
    const res = computeRoundResult(
      [sub('p1', [['a', 'b']], 'z'), sub('p2', [['a', 'b']], 'z'), sub('p3', [['c', 'd']], 'w')],
      players,
    );
    // Paire a-b : p1,p2 => 2 pts chacun. Pomme z : p1,p2 => 4 pts chacun.
    // Paire c-d : p3 solo => 0. Pomme w : p3 solo => 0.
    expect(res.deltaScores).toEqual({ p1: 6, p2: 6, p3: 0 });
  });
});

describe('computeRoundResult — cas limites', () => {
  it('aucune soumission => tous les deltaScores à 0, listes vides', () => {
    const players = ['p1', 'p2', 'p3'];
    const res = computeRoundResult([], players);
    expect(res.parPaire).toEqual([]);
    expect(res.pommesPourries).toEqual([]);
    expect(res.deltaScores).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it('aucun joueur ET aucune soumission => tout vide', () => {
    const res = computeRoundResult([], []);
    expect(res.parPaire).toEqual([]);
    expect(res.pommesPourries).toEqual([]);
    expect(res.deltaScores).toEqual({});
  });

  it('3 joueurs (minimum) — scénario complet mixte', () => {
    const players = ['p1', 'p2', 'p3'];
    const res = computeRoundResult(
      [
        sub(
          'p1',
          [
            ['a', 'b'],
            ['c', 'd'],
          ],
          'x',
        ),
        sub(
          'p2',
          [
            ['b', 'a'], // même paire a-b, ordre inversé
            ['e', 'f'],
          ],
          'x',
        ),
        sub(
          'p3',
          [
            ['a', 'b'], // unanimité sur a-b => 0
            ['g', 'h'],
          ],
          'y',
        ),
      ],
      players,
    );
    // a-b : 3/3 unanime => 0
    expect(findPair(res.parPaire, 'a', 'b')!.pointsParMaker).toBe(0);
    // pomme x : p1,p2 (2/3) => 4 ; pomme y : p3 solo => 0
    expect(findPomme(res.pommesPourries, 'x')!.pointsParSharer).toBe(4);
    expect(findPomme(res.pommesPourries, 'y')!.pointsParSharer).toBe(0);
    expect(res.deltaScores).toEqual({ p1: 4, p2: 4, p3: 0 });
  });

  it('est pur & déterministe (mêmes entrées => mêmes sorties, entrées non mutées)', () => {
    const players = ['p1', 'p2'];
    const submissions = [sub('p1', [['a', 'b']], 'z'), sub('p2', [['a', 'b']], 'z')];
    const snapshot = JSON.stringify(submissions);
    const r1 = computeRoundResult(submissions, players);
    const r2 = computeRoundResult(submissions, players);
    expect(r1).toEqual(r2);
    // entrées non mutées
    expect(JSON.stringify(submissions)).toBe(snapshot);
  });

  it('soumission déclarant un playerId hors liste : compté dans les makers mais pas dans deltaScores initiaux', () => {
    const players = ['p1', 'p2', 'p3'];
    // p1 & un intrus "pX" ont la même paire -> 2 makers -> 2 pts.
    const res = computeRoundResult([sub('p1', [['a', 'b']]), sub('pX', [['a', 'b']])], players);
    const pr = findPair(res.parPaire, 'a', 'b')!;
    expect(pr.pointsParMaker).toBe(2);
    expect(res.deltaScores.p1).toBe(2);
    expect(res.deltaScores.pX).toBe(2); // ajouté dynamiquement
    expect(res.deltaScores.p2).toBe(0);
  });
});

// --------------------------------------------------------------------------
// MODE DUO — barème coopératif (TASK-013)
// --------------------------------------------------------------------------

/** Construit 5 paires distinctes ; les `common` premières sont partagées par les 2. */
function duoPairs(common: number): { a: [string, string][]; b: [string, string][] } {
  const shared: [string, string][] = [
    ['a', 'b'],
    ['c', 'd'],
    ['e', 'f'],
    ['g', 'h'],
    ['i', 'j'],
  ];
  // A garde toujours les 5 paires de référence.
  const a = shared.map((p) => [...p] as [string, string]);
  // B garde les `common` premières, puis des paires DIFFÉRENTES pour le reste.
  const b: [string, string][] = shared.slice(0, common).map((p) => [...p] as [string, string]);
  const fillers: [string, string][] = [
    ['a', 'c'],
    ['b', 'd'],
    ['e', 'g'],
    ['f', 'h'],
    ['i', 'k'],
  ];
  for (let i = common; i < 5; i++) b.push(fillers[i]);
  return { a, b };
}

describe('duoTeamPoints — barème', () => {
  it('respecte 0→0, 1→1, 2→2, 3→4, 4→8, 5→13', () => {
    expect(DUO_PAIR_POINTS).toEqual([0, 1, 2, 4, 8, 13]);
    for (let c = 0; c <= 5; c++) expect(duoTeamPoints(c, false)).toBe(DUO_PAIR_POINTS[c]);
  });
  it('ajoute le bonus pomme commune (+2)', () => {
    expect(duoTeamPoints(3, true)).toBe(4 + DUO_POMME_BONUS);
    expect(duoTeamPoints(0, true)).toBe(DUO_POMME_BONUS);
  });
  it('borne le nombre de paires communes (garde)', () => {
    expect(duoTeamPoints(9, false)).toBe(13);
    expect(duoTeamPoints(-1, false)).toBe(0);
  });
});

describe('computeRoundResultDuo — C = 0..5 (pomme non commune)', () => {
  for (let c = 0; c <= 5; c++) {
    it(`C=${c} → équipe ${DUO_PAIR_POINTS[c]} points aux DEUX joueurs`, () => {
      const { a, b } = duoPairs(c);
      const res = computeRoundResultDuo(sub('p1', a, 'X'), sub('p2', b, 'Y'));
      const expected = DUO_PAIR_POINTS[c];
      expect(res.deltaScores).toEqual({ p1: expected, p2: expected });
      // TOUTES les paires sont révélées : communes (makers = 2) + uniques de chacun (makers = 1, 0 pt).
      // Chaque joueur a 5 paires distinctes → total = 10 - c.
      expect(res.parPaire).toHaveLength(10 - c);
      const communes = res.parPaire.filter((pr) => pr.makers.length === 2);
      expect(communes).toHaveLength(c);
      for (const pr of communes) expect(pr.makers.slice().sort()).toEqual(['p1', 'p2']);
      const uniques = res.parPaire.filter((pr) => pr.makers.length === 1);
      for (const pr of uniques) expect(pr.pointsParMaker).toBe(0);
      // La somme des points marginaux des paires communes reconstitue le total d'équipe (reveal cohérent).
      const somme = communes.reduce((s, pr) => s + pr.pointsParMaker, 0);
      expect(somme).toBe(expected);
    });
  }

  it('révèle AUSSI les paires non communes (makers = un seul joueur, 0 point)', () => {
    const { a, b } = duoPairs(2); // 2 communes, 3 uniques par joueur
    const res = computeRoundResultDuo(sub('p1', a, 'X'), sub('p2', b, 'Y'));
    const uniquesA = res.parPaire.filter((pr) => pr.makers.length === 1 && pr.makers[0] === 'p1');
    const uniquesB = res.parPaire.filter((pr) => pr.makers.length === 1 && pr.makers[0] === 'p2');
    expect(uniquesA).toHaveLength(3);
    expect(uniquesB).toHaveLength(3);
    for (const pr of [...uniquesA, ...uniquesB]) expect(pr.pointsParMaker).toBe(0);
  });
});

describe('computeRoundResultDuo — pomme pourrie', () => {
  it('pomme commune → +2 d’équipe et une entrée partagée', () => {
    const { a, b } = duoPairs(2); // 2 paires communes → 2 pts, + pomme commune → 4
    const res = computeRoundResultDuo(sub('p1', a, 'Z'), sub('p2', b, 'Z'));
    expect(res.deltaScores).toEqual({ p1: 4, p2: 4 });
    const pomme = res.pommesPourries.find((pp) => pp.cardId === 'Z')!;
    expect(pomme.sharers.sort()).toEqual(['p1', 'p2']);
    expect(pomme.pointsParSharer).toBe(DUO_POMME_BONUS);
  });

  it('pommes différentes → aucun bonus, deux entrées à 0', () => {
    const { a, b } = duoPairs(5); // 5 communes → 13, pas de bonus pomme
    const res = computeRoundResultDuo(sub('p1', a, 'Z'), sub('p2', b, 'W'));
    expect(res.deltaScores).toEqual({ p1: 13, p2: 13 });
    expect(res.pommesPourries).toHaveLength(2);
    for (const pp of res.pommesPourries) expect(pp.pointsParSharer).toBe(0);
  });

  it('C=5 + pomme commune → 15 chacun (max)', () => {
    const { a, b } = duoPairs(5);
    const res = computeRoundResultDuo(sub('p1', a, 'Z'), sub('p2', b, 'Z'));
    expect(res.deltaScores).toEqual({ p1: 15, p2: 15 });
  });
});

describe('computeRoundResultDuo — robustesse', () => {
  it('ordre des cartes inversé dans une paire compte comme commune', () => {
    const res = computeRoundResultDuo(sub('p1', [['a', 'b']], 'X'), sub('p2', [['b', 'a']], 'Y'));
    expect(res.deltaScores).toEqual({ p1: 1, p2: 1 });
    expect(res.parPaire).toHaveLength(1);
    expect(res.parPaire[0].pair).toEqual(['a', 'b']); // normalisée
  });

  it('doublon interne à un joueur ne gonfle pas le compte de paires communes', () => {
    const res = computeRoundResultDuo(
      sub('p1', [
        ['a', 'b'],
        ['b', 'a'],
      ]),
      sub('p2', [['a', 'b']]),
    );
    expect(res.parPaire).toHaveLength(1);
    expect(res.deltaScores).toEqual({ p1: 1, p2: 1 });
  });

  it('est pur (entrées non mutées, sortie identique)', () => {
    const { a, b } = duoPairs(3);
    const sA = sub('p1', a, 'Z');
    const sB = sub('p2', b, 'Z');
    const snap = JSON.stringify([sA, sB]);
    const r1 = computeRoundResultDuo(sA, sB);
    const r2 = computeRoundResultDuo(sA, sB);
    expect(r1).toEqual(r2);
    expect(JSON.stringify([sA, sB])).toBe(snap);
  });
});
