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
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
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

  console.log("\n==== Résultats test d'intégration lobby ====");
  for (const r of results) console.log(r);
  console.log(`\n${passed} PASS / ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
