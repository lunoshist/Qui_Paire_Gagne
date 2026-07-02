/**
 * Test d'intégration local du lobby (TASK-003).
 *
 * Lance `wrangler dev` en arrière-plan puis pilote des clients WebSocket (API
 * WebSocket globale de Node 24) contre le vrai Durable Object. Couvre :
 *  1. POST /api/rooms → code à 4 lettres
 *  2. 3 joueurs rejoignent : host = 1er, couleurs distinctes, playerId renvoyés
 *  3. updateSettings par l'hôte reflété dans le roomState diffusé
 *  4. updateSettings par un non-hôte → refusé (error NOT_HOST)
 *  5. startGame refusé à 2 joueurs / accepté à 3 (phase → dealing)
 *  6. un joueur (hôte) quitte → promotion d'hôte
 *  7. reconnexion via playerId
 *  8. manche complète : startGame → roundStart (11 cartes distinctes) → submit×3 →
 *     revealPayload (scores conformes) → advance → manche 2 → gameOver (classement trié)
 *  9. anti-fuite : aucune soumission (ni reveal) diffusée avant que tous aient soumis
 * 10. résolution par ALARME (échéance du sablier, sans soumission → 0 pt)
 * 11. (TASK-010) reconnexion mid-forming → re-reçoit roundStart (deadline en cours) + « a soumis »
 * 12. (TASK-010) reconnexion mid-reveal → re-reçoit revealPayload
 * 13. (TASK-010) rejoindre en cours → spectateur (SPECTATOR) puis intégré à la manche suivante
 * 14. (TASK-010) returnToLobby (hôte, depuis finished) → lobby scores à 0 + relance même salle
 * 15. (TASK-010) hôte quitte en jeu → promotion d'un joueur restant
 * 16. (TASK-011) revealNext (mode meneur) : curseur pas-à-pas synchronisé, borné,
 *     refus non-hôte, resync mid-reveal renvoie le step courant
 *
 * Usage : node server/test/integration.mjs   (depuis la racine du repo)
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const PORT = Number(process.env.QPG_TEST_PORT ?? 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const WS_BASE = `ws://127.0.0.1:${PORT}`;
const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;
const results = [];

function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    results.push(`PASS · ${name}`);
  } else {
    failed++;
    results.push(`FAIL · ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Petit wrapper WebSocket avec file de messages + attente conditionnelle. */
class Client {
  constructor(code) {
    this.ws = new WebSocket(`${WS_BASE}/api/ws?room=${code}`);
    this.queue = [];
    this.waiters = [];
    /** Journal brut de TOUS les messages reçus (jamais consommé) — pour le test anti-fuite. */
    this.raw = [];
    this.ws.addEventListener('message', (ev) => {
      const rawStr = typeof ev.data === 'string' ? ev.data : ev.data.toString();
      this.raw.push(rawStr);
      const msg = JSON.parse(rawStr);
      this.queue.push(msg);
      this._pump();
    });
  }
  _pump() {
    for (let i = 0; i < this.waiters.length; i++) {
      const w = this.waiters[i];
      const idx = this.queue.findIndex(w.pred);
      if (idx !== -1) {
        const [m] = this.queue.splice(idx, 1);
        this.waiters.splice(i, 1);
        clearTimeout(w.timer);
        w.resolve(m);
        i--;
      }
    }
  }
  open() {
    return new Promise((res, rej) => {
      this.ws.addEventListener('open', () => res(), { once: true });
      this.ws.addEventListener('error', (e) => rej(e), { once: true });
    });
  }
  send(obj) {
    this.ws.send(JSON.stringify(obj));
  }
  next(pred, label = 'message', ms = 4000) {
    const idx = this.queue.findIndex(pred);
    if (idx !== -1) {
      const [m] = this.queue.splice(idx, 1);
      return Promise.resolve(m);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const w = this.waiters.find((x) => x.timer === timer);
        if (w) this.waiters.splice(this.waiters.indexOf(w), 1);
        reject(new Error(`timeout waiting for ${label}`));
      }, ms);
      this.waiters.push({ pred, resolve, timer });
    });
  }
  ofType(type, ms) {
    return this.next((m) => m.type === type, type, ms);
  }
  /** Vide la file des messages déjà reçus (pour n'attendre QUE les suivants). */
  drain() {
    this.queue.length = 0;
  }
  close() {
    try {
      this.ws.close();
    } catch {
      /* noop */
    }
  }
}

async function waitServerReady(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/rooms`, { method: 'POST' });
      if (r.ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await sleep(500);
  }
  return false;
}

async function createRoom() {
  const r = await fetch(`${BASE}/api/rooms`, { method: 'POST' });
  const body = await r.json();
  return body.code;
}

async function joinAndAck(code, join) {
  const c = new Client(code);
  await c.open();
  c.send({ type: 'joinRoom', ...join });
  const joined = await c.ofType('joined');
  return { c, joined };
}

async function main() {
  console.log(`> starting wrangler dev on port ${PORT} ...`);
  const wrangler = spawn(
    'npx',
    ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--local'],
    { cwd: SERVER_DIR, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let wranglerLog = '';
  wrangler.stdout.on('data', (d) => (wranglerLog += d.toString()));
  wrangler.stderr.on('data', (d) => (wranglerLog += d.toString()));

  const clients = [];
  try {
    const ready = await waitServerReady();
    if (!ready) {
      console.error('wrangler dev never became ready. Log tail:\n' + wranglerLog.slice(-2000));
      check('server ready (wrangler dev up)', false, 'not ready within timeout');
      return;
    }
    check('server ready (wrangler dev up)', true);

    // --- 1. POST /api/rooms ---
    const codeA = await createRoom();
    check('POST /api/rooms → code 4 lettres', /^[A-Z]{4}$/.test(codeA), `got "${codeA}"`);

    // --- 2. 3 joueurs rejoignent room A ---
    const { c: c1, joined: j1 } = await joinAndAck(codeA, { pseudo: 'Alice' });
    clients.push(c1);
    const { c: c2, joined: j2 } = await joinAndAck(codeA, { pseudo: 'Bob' });
    clients.push(c2);
    const { c: c3, joined: j3 } = await joinAndAck(codeA, { pseudo: 'Carol' });
    clients.push(c3);

    check(
      'playerId renvoyé à chaque joueur (distinct)',
      j1.playerId &&
        j2.playerId &&
        j3.playerId &&
        new Set([j1.playerId, j2.playerId, j3.playerId]).size === 3,
      `${j1.playerId} / ${j2.playerId} / ${j3.playerId}`,
    );

    // Attendre le roomState final (3 joueurs) sur le socket 1.
    const st3 = await c1.next(
      (m) => m.type === 'roomState' && m.state.players.length === 3,
      'roomState(3)',
    );
    check('host = 1er joueur', st3.state.hostId === j1.playerId, `host=${st3.state.hostId}`);
    const couleurs = st3.state.players.map((p) => p.couleur);
    check('couleurs distinctes', new Set(couleurs).size === 3, couleurs.join(','));

    // --- 3. updateSettings par l'hôte reflété dans roomState ---
    c1.send({
      type: 'updateSettings',
      settings: {
        nbManches: 6,
        dureeSablier: 120,
        vitesseReveal: 'rapide',
        variantesScoring: { paireUnanimeZero: false, pommePourrieDouble: true },
      },
    });
    const stSettings = await c2.next(
      (m) => m.type === 'roomState' && m.state.settings.nbManches === 6,
      'roomState(settings)',
    );
    check(
      'updateSettings hôte reflété dans roomState',
      stSettings.state.settings.nbManches === 6 &&
        stSettings.state.settings.vitesseReveal === 'rapide' &&
        stSettings.state.settings.variantesScoring.paireUnanimeZero === false,
    );

    // --- 4. updateSettings par un non-hôte refusé ---
    c2.send({
      type: 'updateSettings',
      settings: { ...stSettings.state.settings, nbManches: 3 },
    });
    const errNotHost = await c2.ofType('error');
    check(
      'updateSettings non-hôte → error NOT_HOST',
      errNotHost.code === 'NOT_HOST',
      errNotHost.code,
    );

    // --- 5b. startGame refusé à 2 joueurs (room B) ---
    const codeB = await createRoom();
    const { c: b1, joined: jb1 } = await joinAndAck(codeB, { pseudo: 'Dan' });
    clients.push(b1);
    const { c: b2, joined: jb2 } = await joinAndAck(codeB, { pseudo: 'Eve' });
    clients.push(b2);
    await b1.next((m) => m.type === 'roomState' && m.state.players.length === 2, 'roomStateB(2)');
    b1.send({ type: 'startGame' });
    const errFew = await b1.ofType('error');
    check(
      'startGame à 2 joueurs → error NOT_ENOUGH_PLAYERS',
      errFew.code === 'NOT_ENOUGH_PLAYERS',
      errFew.code,
    );

    // --- 5a. startGame accepté à 3 joueurs (room A) ---
    c1.send({ type: 'startGame' });
    const stDealing = await c3.next(
      (m) => m.type === 'roomState' && m.state.phase === 'dealing',
      'roomState(dealing)',
    );
    check('startGame à 3 joueurs → phase dealing', stDealing.state.phase === 'dealing');

    // --- 6. Promotion d'hôte (room B) : l'hôte part ---
    b1.send({ type: 'leaveRoom' });
    const stPromo = await b2.next(
      (m) => m.type === 'roomState' && m.state.players.length === 1,
      'roomStateB(promo)',
    );
    check(
      'départ hôte → promotion (nouvel hôte = joueur restant)',
      stPromo.state.hostId === jb2.playerId,
      `host=${stPromo.state.hostId}, attendu=${jb2.playerId}`,
    );
    void jb1;

    // --- 7. Reconnexion via playerId (room A est en dealing) ---
    // Carol se déconnecte (socket close) : en partie, la place est conservée.
    c3.close();
    // Attendre que le serveur note la déconnexion.
    const stDisc = await c1.next(
      (m) =>
        m.type === 'roomState' &&
        m.state.players.some((p) => p.id === j3.playerId && p.connecte === false),
      'roomState(carol disconnected)',
      6000,
    );
    check('déconnexion en partie conserve la place (connecte=false)', !!stDisc);

    const c3b = new Client(codeA);
    await c3b.open();
    clients.push(c3b);
    c3b.send({ type: 'joinRoom', pseudo: 'Carol', playerId: j3.playerId });
    const rejoined = await c3b.ofType('joined');
    check(
      'reconnexion via playerId reprend la même place',
      rejoined.playerId === j3.playerId &&
        rejoined.state.players.find((p) => p.id === j3.playerId)?.connecte === true,
    );

    // =====================================================================
    // TASK-007 · Logique serveur d'une manche
    // =====================================================================

    /**
     * Construit 3 soumissions déterministes à partir des 11 cartes tirées
     * (indexées 0..10). Scores attendus (3 joueurs, variantes par défaut) :
     *  - paire (c0,c1) : P1+P2 (2 makers) → +2 chacun
     *  - paire (c2,c3) : P1+P2+P3 (unanime) → 0
     *  - pomme pourrie c10 : P1+P2 (2 sharers) → +4 chacun ; c9 (P3) solo → 0
     *  → deltas attendus : P1=6, P2=6, P3=0
     */
    function buildSubs(c) {
      return {
        p1: {
          paires: [
            [c[0], c[1]],
            [c[2], c[3]],
            [c[4], c[5]],
            [c[6], c[7]],
            [c[8], c[9]],
          ],
          pommePourrie: c[10],
        },
        p2: {
          paires: [
            [c[0], c[1]],
            [c[2], c[3]],
            [c[4], c[7]],
            [c[5], c[8]],
            [c[6], c[9]],
          ],
          pommePourrie: c[10],
        },
        p3: {
          paires: [
            [c[2], c[3]],
            [c[0], c[4]],
            [c[1], c[5]],
            [c[6], c[8]],
            [c[7], c[10]],
          ],
          pommePourrie: c[9],
        },
      };
    }

    // --- 8. Manche complète : start → roundStart → submit×3 → reveal → advance → gameOver ---
    const codeR = await createRoom();
    const { c: r1, joined: jr1 } = await joinAndAck(codeR, { pseudo: 'Rose' });
    clients.push(r1);
    const { c: r2, joined: jr2 } = await joinAndAck(codeR, { pseudo: 'Sam' });
    clients.push(r2);
    const { c: r3, joined: jr3 } = await joinAndAck(codeR, { pseudo: 'Tara' });
    clients.push(r3);
    await r1.next((m) => m.type === 'roomState' && m.state.players.length === 3, 'roomStateR(3)');

    // Réglages : 2 manches, sablier long (le test soumet manuellement, l'alarme ne doit pas tirer).
    r1.send({
      type: 'updateSettings',
      settings: {
        nbManches: 2,
        dureeSablier: 60,
        vitesseReveal: 'meneur',
        variantesScoring: { paireUnanimeZero: true, pommePourrieDouble: true },
      },
    });
    await r1.next(
      (m) => m.type === 'roomState' && m.state.settings.nbManches === 2,
      'roomStateR(settings)',
    );

    r1.send({ type: 'startGame' });
    const rs1 = await r3.ofType('roundStart', 6000);
    check(
      'roundStart manche 1 : 11 cartes DISTINCTES + deadline',
      rs1.manche === 1 &&
        Array.isArray(rs1.cards) &&
        rs1.cards.length === 11 &&
        new Set(rs1.cards).size === 11 &&
        typeof rs1.deadline === 'number' &&
        rs1.deadline > Date.now(),
      `manche=${rs1.manche} n=${rs1.cards?.length} distinct=${new Set(rs1.cards).size}`,
    );

    const subs1 = buildSubs(rs1.cards);
    // Deux joueurs soumettent d'abord (pour le test anti-fuite avant reveal).
    r1.send({ type: 'submitPairs', ...subs1.p1 });
    await r3.next(
      (m) => m.type === 'playerSubmitted' && m.playerId === jr1.playerId,
      'submitted(r1)',
    );
    r2.send({ type: 'submitPairs', ...subs1.p2 });
    await r3.next(
      (m) => m.type === 'playerSubmitted' && m.playerId === jr2.playerId,
      'submitted(r2)',
    );

    // --- 9. Anti-fuite : aucune soumission (ni reveal) diffusée avant que tous aient soumis ---
    const leakBeforeReveal = r3.raw.some(
      (s) =>
        s.includes('"revealPayload"') || s.includes('"paires"') || s.includes('"pommePourrie"'),
    );
    const submittedMsgs = r3.raw
      .filter((s) => s.includes('"playerSubmitted"'))
      .map((s) => JSON.parse(s));
    const submittedKeysClean = submittedMsgs.every(
      (m) => Object.keys(m).sort().join(',') === 'playerId,type',
    );
    check(
      'anti-fuite : aucune soumission/reveal diffusé avant reveal',
      !leakBeforeReveal && submittedMsgs.length >= 2 && submittedKeysClean,
      `leak=${leakBeforeReveal} playerSubmitted=${submittedMsgs.length} cleanKeys=${submittedKeysClean}`,
    );

    // Dernier joueur soumet → résolution immédiate (tous connectés soumis).
    r3.send({ type: 'submitPairs', ...subs1.p3 });
    const reveal1 = await r3.ofType('revealPayload', 6000);
    const okDelta1 =
      reveal1.deltaScores[jr1.playerId] === 6 &&
      reveal1.deltaScores[jr2.playerId] === 6 &&
      reveal1.deltaScores[jr3.playerId] === 0;
    const okCumul1 =
      reveal1.cumul[jr1.playerId] === 6 &&
      reveal1.cumul[jr2.playerId] === 6 &&
      reveal1.cumul[jr3.playerId] === 0;
    check(
      'revealPayload manche 1 : deltaScores conformes (6/6/0)',
      okDelta1,
      JSON.stringify(reveal1.deltaScores),
    );
    check(
      'revealPayload manche 1 : cumul conforme (6/6/0)',
      okCumul1,
      JSON.stringify(reveal1.cumul),
    );
    check(
      'revealPayload : soumissions révélées (au reveal seulement)',
      reveal1.soumissionsParJoueur &&
        reveal1.soumissionsParJoueur[jr1.playerId] &&
        Array.isArray(reveal1.soumissionsParJoueur[jr1.playerId].paires),
    );

    // Attendre la phase reveal côté état public, puis advance (hôte).
    await r1.next(
      (m) => m.type === 'roomState' && m.state.phase === 'reveal',
      'roomStateR(reveal1)',
    );
    r1.send({ type: 'advance' });
    const rs2 = await r3.ofType('roundStart', 6000);
    check(
      'advance → manche 2 démarrée (nouveau roundStart)',
      rs2.manche === 2 && rs2.cards.length === 11,
      `manche=${rs2.manche}`,
    );

    // Manche 2 : tous soumettent → reveal → advance → gameOver.
    const subs2 = buildSubs(rs2.cards);
    r1.send({ type: 'submitPairs', ...subs2.p1 });
    r2.send({ type: 'submitPairs', ...subs2.p2 });
    r3.send({ type: 'submitPairs', ...subs2.p3 });
    const reveal2 = await r3.ofType('revealPayload', 6000);
    check(
      'revealPayload manche 2 : cumul cumulé sur 2 manches (12/12/0)',
      reveal2.cumul[jr1.playerId] === 12 &&
        reveal2.cumul[jr2.playerId] === 12 &&
        reveal2.cumul[jr3.playerId] === 0,
      JSON.stringify(reveal2.cumul),
    );

    await r1.next(
      (m) => m.type === 'roomState' && m.state.phase === 'reveal',
      'roomStateR(reveal2)',
    );
    r1.send({ type: 'advance' });
    const over = await r3.ofType('gameOver', 6000);
    const sortedDesc = over.classement.every(
      (e, i) => i === 0 || over.classement[i - 1].score >= e.score,
    );
    check(
      'gameOver après nbManches : classement trié + scores finaux',
      over.classement.length === 3 &&
        sortedDesc &&
        over.classement[0].score === 12 &&
        over.classement[2].score === 0 &&
        over.scoresFinaux[jr3.playerId] === 0,
      JSON.stringify(over.classement),
    );
    const stFinished = await r1.next(
      (m) => m.type === 'roomState' && m.state.phase === 'finished',
      'roomStateR(finished)',
    );
    check('phase finished après gameOver', stFinished.state.phase === 'finished');
    void jr3;

    // --- 10. Résolution par ALARME (échéance du sablier, sans soumission) ---
    const codeAlarm = await createRoom();
    const { c: a1 } = await joinAndAck(codeAlarm, { pseudo: 'Ug' });
    clients.push(a1);
    const { c: a2, joined: ja2 } = await joinAndAck(codeAlarm, { pseudo: 'Vi' });
    clients.push(a2);
    const { c: a3, joined: ja3 } = await joinAndAck(codeAlarm, { pseudo: 'Wu' });
    clients.push(a3);
    await a1.next(
      (m) => m.type === 'roomState' && m.state.players.length === 3,
      'roomStateAlarm(3)',
    );
    // dureeSablier minimal accepté par le serveur (validation ≥ 10 s) ; 1 manche.
    a1.send({
      type: 'updateSettings',
      settings: {
        nbManches: 1,
        dureeSablier: 10,
        vitesseReveal: 'meneur',
        variantesScoring: { paireUnanimeZero: true, pommePourrieDouble: true },
      },
    });
    await a1.next(
      (m) => m.type === 'roomState' && m.state.settings.dureeSablier === 10,
      'roomStateAlarm(settings)',
    );
    a1.send({ type: 'startGame' });
    const rsA = await a1.ofType('roundStart', 6000);
    // Personne ne soumet : la résolution ne peut venir que de l'ALARME à l'échéance.
    const revealAlarm = await a3.ofType('revealPayload', 15000);
    const allZero =
      revealAlarm.deltaScores[ja2.playerId] === 0 && revealAlarm.deltaScores[ja3.playerId] === 0;
    check(
      'résolution par ALARME à l’échéance du sablier (aucune soumission → 0 pt)',
      allZero && Date.now() >= rsA.deadline,
      `deltas=${JSON.stringify(revealAlarm.deltaScores)}`,
    );

    // =====================================================================
    // TASK-010 · Flows & scénarios (reconnexion, join-in-progress, relance)
    // =====================================================================

    /** Monte une salle de 3 joueurs en `forming` (manche 1). */
    async function startedRoom(prefix, settings) {
      const code = await createRoom();
      const { c: q1, joined: jq1 } = await joinAndAck(code, { pseudo: `${prefix}1` });
      clients.push(q1);
      const { c: q2, joined: jq2 } = await joinAndAck(code, { pseudo: `${prefix}2` });
      clients.push(q2);
      const { c: q3, joined: jq3 } = await joinAndAck(code, { pseudo: `${prefix}3` });
      clients.push(q3);
      await q1.next(
        (m) => m.type === 'roomState' && m.state.players.length === 3,
        `roomState(${prefix}3)`,
      );
      if (settings) {
        q1.send({ type: 'updateSettings', settings });
        await q1.next(
          (m) => m.type === 'roomState' && m.state.settings.nbManches === settings.nbManches,
          `roomState(${prefix} settings)`,
        );
      }
      q1.send({ type: 'startGame' });
      const rs = await q1.ofType('roundStart', 6000);
      return { code, q1, q2, q3, jq1, jq2, jq3, rs };
    }

    // --- 11. Reconnexion en pleine FORMATION : re-reçoit roundStart + deadline + qui a soumis ---
    {
      const { code, q1, q2, q3, jq2, jq3, rs } = await startedRoom('Rc');
      const subs = buildSubs(rs.cards);
      // q2 soumet (pour vérifier la restauration de l'état « a fini »).
      q2.send({ type: 'submitPairs', ...subs.p2 });
      await q1.next(
        (m) => m.type === 'playerSubmitted' && m.playerId === jq2.playerId,
        'submitted(Rc q2)',
      );
      // q3 se déconnecte puis se reconnecte en pleine manche.
      q3.close();
      await q1.next(
        (m) =>
          m.type === 'roomState' &&
          m.state.players.some((p) => p.id === jq3.playerId && p.connecte === false),
        'roomState(Rc q3 disconnected)',
        6000,
      );
      const q3b = new Client(code);
      await q3b.open();
      clients.push(q3b);
      q3b.send({ type: 'joinRoom', pseudo: 'Rc3', playerId: jq3.playerId });
      await q3b.ofType('joined');
      const rsReco = await q3b.ofType('roundStart', 4000);
      check(
        'reconnexion mid-forming → re-reçoit roundStart (mêmes cartes + deadline en cours)',
        rsReco.manche === 1 &&
          rsReco.cards.length === 11 &&
          rsReco.deadline === rs.deadline &&
          rsReco.deadline > Date.now(),
        `manche=${rsReco.manche} deadlineEq=${rsReco.deadline === rs.deadline}`,
      );
      const psReco = await q3b.next(
        (m) => m.type === 'playerSubmitted' && m.playerId === jq2.playerId,
        'submitted(Rc reco q2)',
        4000,
      );
      check('reconnexion mid-forming → restaure l’état « a soumis » (playerSubmitted)', !!psReco);
    }

    // --- 12. Reconnexion en pleine RÉVÉLATION : re-reçoit revealPayload ---
    {
      const { code, q1, q2, q3, jq1, jq2, jq3, rs } = await startedRoom('Rv');
      const subs = buildSubs(rs.cards);
      q1.send({ type: 'submitPairs', ...subs.p1 });
      q2.send({ type: 'submitPairs', ...subs.p2 });
      q3.send({ type: 'submitPairs', ...subs.p3 });
      await q1.ofType('revealPayload', 6000);
      await q1.next(
        (m) => m.type === 'roomState' && m.state.phase === 'reveal',
        'roomState(Rv reveal)',
      );
      // q3 se reconnecte pendant la révélation.
      q3.close();
      await q1.next(
        (m) =>
          m.type === 'roomState' &&
          m.state.players.some((p) => p.id === jq3.playerId && p.connecte === false),
        'roomState(Rv q3 disconnected)',
        6000,
      );
      const q3b = new Client(code);
      await q3b.open();
      clients.push(q3b);
      q3b.send({ type: 'joinRoom', pseudo: 'Rv3', playerId: jq3.playerId });
      const joinedRv = await q3b.ofType('joined');
      const revReco = await q3b.ofType('revealPayload', 4000);
      check(
        'reconnexion mid-reveal → re-reçoit revealPayload (deltas + soumissions)',
        joinedRv.state.phase === 'reveal' &&
          revReco.deltaScores[jq1.playerId] === 6 &&
          revReco.deltaScores[jq2.playerId] === 6 &&
          !!revReco.soumissionsParJoueur[jq1.playerId],
        `phase=${joinedRv.state.phase} deltas=${JSON.stringify(revReco.deltaScores)}`,
      );
    }

    // --- 13. Rejoindre EN COURS : spectateur de la manche, intégré à la suivante ---
    {
      const { code, q1, q2, q3, rs } = await startedRoom('Sp', {
        nbManches: 2,
        dureeSablier: 90,
        vitesseReveal: 'meneur',
        variantesScoring: { paireUnanimeZero: true, pommePourrieDouble: true },
      });
      // Nouveau joueur pendant la manche 1.
      const { c: s4, joined: js4 } = await joinAndAck(code, { pseudo: 'Spec' });
      clients.push(s4);
      // Il ne reçoit PAS de roundStart pour la manche en cours.
      await sleep(300);
      const gotRoundStart = s4.raw.some((s) => s.includes('"roundStart"'));
      check(
        'join-in-progress : spectateur (aucun roundStart de la manche en cours)',
        !gotRoundStart,
      );
      // Toute soumission est refusée (SPECTATOR).
      s4.send({ type: 'submitPairs', ...buildSubs(rs.cards).p1 });
      const errSpec = await s4.ofType('error', 4000);
      check(
        'join-in-progress : soumission refusée (SPECTATOR)',
        errSpec.code === 'SPECTATOR',
        errSpec.code,
      );
      // Les 3 participants terminent la manche 1 → reveal.
      const subs = buildSubs(rs.cards);
      q1.send({ type: 'submitPairs', ...subs.p1 });
      q2.send({ type: 'submitPairs', ...subs.p2 });
      q3.send({ type: 'submitPairs', ...subs.p3 });
      await q1.ofType('revealPayload', 6000);
      await q1.next(
        (m) => m.type === 'roomState' && m.state.phase === 'reveal',
        'roomState(Sp reveal)',
      );
      // Manche suivante : le spectateur devient participant.
      q1.send({ type: 'advance' });
      const rs2 = await s4.ofType('roundStart', 6000);
      check(
        'join-in-progress : intégré dès la manche suivante (reçoit roundStart)',
        rs2.manche === 2,
      );
      s4.send({ type: 'submitPairs', ...buildSubs(rs2.cards).p1 });
      const psS4 = await q1.next(
        (m) => m.type === 'playerSubmitted' && m.playerId === js4.playerId,
        'submitted(Sp s4)',
        4000,
      );
      check('join-in-progress : le nouveau joueur peut soumettre à la manche suivante', !!psS4);
    }

    // --- 14. returnToLobby (hôte) depuis la fin → relance dans la même salle ---
    {
      const { q1, q2, q3, jq1, jq2, jq3, rs } = await startedRoom('Rl', {
        nbManches: 1,
        dureeSablier: 90,
        vitesseReveal: 'meneur',
        variantesScoring: { paireUnanimeZero: true, pommePourrieDouble: true },
      });
      const subs = buildSubs(rs.cards);
      q1.send({ type: 'submitPairs', ...subs.p1 });
      q2.send({ type: 'submitPairs', ...subs.p2 });
      q3.send({ type: 'submitPairs', ...subs.p3 });
      await q1.ofType('revealPayload', 6000);
      await q1.next(
        (m) => m.type === 'roomState' && m.state.phase === 'reveal',
        'roomState(Rl reveal)',
      );
      q1.send({ type: 'advance' });
      await q1.ofType('gameOver', 6000);
      await q1.next(
        (m) => m.type === 'roomState' && m.state.phase === 'finished',
        'roomState(Rl finished)',
      );
      // Non-hôte refusé.
      q2.send({ type: 'returnToLobby' });
      const errRl = await q2.ofType('error', 4000);
      check('returnToLobby non-hôte → error NOT_HOST', errRl.code === 'NOT_HOST', errRl.code);
      // Hôte : retour au lobby (scores remis à 0, joueurs conservés).
      q2.drain(); // ignore les roomState de lobby ANTÉRIEURS (phase de join)
      q1.send({ type: 'returnToLobby' });
      const stLobby = await q2.next(
        (m) => m.type === 'roomState' && m.state.phase === 'lobby',
        'roomState(Rl lobby)',
        4000,
      );
      check(
        'returnToLobby (hôte) → lobby, joueurs conservés, scores à 0, manche 0',
        stLobby.state.players.length === 3 &&
          stLobby.state.players.every((p) => p.scoreCumul === 0) &&
          stLobby.state.mancheCourante === 0 &&
          new Set([jq1.playerId, jq2.playerId, jq3.playerId]).size === 3,
        JSON.stringify(stLobby.state.players.map((p) => p.scoreCumul)),
      );
      // Relance : on change un réglage puis on repart (même salle).
      q1.send({
        type: 'updateSettings',
        settings: {
          nbManches: 2,
          dureeSablier: 90,
          vitesseReveal: 'meneur',
          variantesScoring: { paireUnanimeZero: true, pommePourrieDouble: true },
        },
      });
      await q1.next(
        (m) => m.type === 'roomState' && m.state.settings.nbManches === 2,
        'roomState(Rl resettings)',
      );
      q1.send({ type: 'startGame' });
      const rsRelance = await q3.ofType('roundStart', 6000);
      check(
        'returnToLobby → relance : nouvelle partie manche 1 (même salle)',
        rsRelance.manche === 1,
      );
    }

    // --- 15. Hôte quitte EN JEU (forming) → promotion d'un joueur restant ---
    {
      const { q1, q2, jq1, jq2 } = await startedRoom('Hq');
      // L'hôte (q1 = 1er joueur) quitte pendant la manche.
      q2.drain(); // ignore les roomState à 2 joueurs ANTÉRIEURS (phase de join)
      q1.send({ type: 'leaveRoom' });
      const stPromo = await q2.next(
        (m) =>
          m.type === 'roomState' &&
          m.state.players.length === 2 &&
          m.state.players.every((p) => p.id !== jq1.playerId),
        'roomState(Hq promo)',
        4000,
      );
      check(
        'hôte quitte en jeu → promotion (nouvel hôte ≠ ancien, partie non interrompue)',
        stPromo.state.hostId !== jq1.playerId &&
          stPromo.state.players.some((p) => p.id === stPromo.state.hostId) &&
          stPromo.state.phase === 'forming',
        `host=${stPromo.state.hostId} attenduParmi=[${jq2.playerId}] phase=${stPromo.state.phase}`,
      );
    }

    // --- 16. (TASK-011) revealNext : curseur pas-à-pas synchronisé (mode meneur) ---
    {
      const { code, q1, q2, q3, jq3, rs } = await startedRoom('Rn', {
        nbManches: 1,
        dureeSablier: 90,
        vitesseReveal: 'meneur',
        variantesScoring: { paireUnanimeZero: true, pommePourrieDouble: true },
      });
      const subs = buildSubs(rs.cards);
      q1.send({ type: 'submitPairs', ...subs.p1 });
      q2.send({ type: 'submitPairs', ...subs.p2 });
      q3.send({ type: 'submitPairs', ...subs.p3 });
      const rev = await q1.ofType('revealPayload', 6000);
      const total = rev.parPaire.length + (rev.pommesPourries.length > 0 ? 1 : 0);
      check(
        'revealPayload : curseur initial revealStep=0',
        rev.revealStep === 0,
        `step=${rev.revealStep}`,
      );
      check('revealNext : total d’étapes > 0 (paires + pommes)', total > 0, `total=${total}`);

      // Non-hôte refusé.
      q2.send({ type: 'revealNext' });
      const errRn = await q2.ofType('error', 4000);
      check('revealNext non-hôte → error NOT_HOST', errRn.code === 'NOT_HOST', errRn.code);

      // Hôte : 1er pas → revealStep=1 diffusé à TOUS (vu par q3).
      q1.send({ type: 'revealNext' });
      const step1 = await q3.next((m) => m.type === 'revealStep', 'revealStep(1)', 4000);
      check(
        'revealNext (hôte) → curseur incrémenté + diffusé à tous',
        step1.step === 1,
        `step=${step1.step}`,
      );

      // Avancer jusqu'au bout ; le curseur atteint exactement `total`.
      let last = step1.step;
      for (let i = last; i < total; i++) {
        q1.send({ type: 'revealNext' });
        const m = await q1.next(
          (x) => x.type === 'revealStep' && x.step > last,
          `revealStep(${last + 1})`,
          4000,
        );
        last = m.step;
      }
      check(
        'revealNext : curseur atteint le total des étapes',
        last === total,
        `last=${last} total=${total}`,
      );

      // Borne haute : au bout, un revealNext de plus n'émet AUCUNE nouvelle étape.
      q1.drain();
      q1.send({ type: 'revealNext' });
      let capped = true;
      try {
        await q1.next((m) => m.type === 'revealStep', 'revealStep(over)', 800);
        capped = false;
      } catch {
        /* attendu : timeout, curseur borné */
      }
      check('revealNext borné en haut (au bout, plus d’incrément)', capped);

      // Resync mid-reveal : une (re)connexion reçoit le revealStep COURANT.
      q3.close();
      await q1.next(
        (m) =>
          m.type === 'roomState' &&
          m.state.players.some((p) => p.id === jq3.playerId && p.connecte === false),
        'roomState(Rn q3 disconnected)',
        6000,
      );
      const q3b = new Client(code);
      await q3b.open();
      clients.push(q3b);
      q3b.send({ type: 'joinRoom', pseudo: 'Rn3', playerId: jq3.playerId });
      await q3b.ofType('joined');
      const revReco = await q3b.ofType('revealPayload', 4000);
      check(
        'resync mid-reveal → revealStep courant renvoyé dans le payload',
        revReco.revealStep === total,
        `step=${revReco.revealStep} total=${total}`,
      );
    }
  } catch (err) {
    check('exécution sans exception', false, String(err && err.stack ? err.stack : err));
  } finally {
    for (const c of clients) c.close();
    await sleep(200);
    wrangler.kill('SIGTERM');
    await sleep(300);
    try {
      wrangler.kill('SIGKILL');
    } catch {
      /* déjà mort */
    }
  }

  console.log("\n==== Résultats test d'intégration (lobby + manche TASK-007) ====");
  for (const r of results) console.log(r);
  console.log(`\n${passed} PASS / ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
