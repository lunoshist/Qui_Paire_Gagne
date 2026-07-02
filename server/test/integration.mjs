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
        vitesseReveal: 'normal',
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
        vitesseReveal: 'normal',
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
