import { GameRoom } from './GameRoom';

export { GameRoom };

export interface Env {
  GAME_ROOM: DurableObjectNamespace;
}

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

/** Génère un code de salle à 4 lettres majuscules (A–Z). */
function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  let code = '';
  for (const b of bytes) {
    code += alphabet[b % alphabet.length];
  }
  return code;
}

/**
 * Worker d'entrée : deux routes.
 * - `POST /api/rooms` → `{ code }` (4 lettres). Aucun état n'est créé ici : le
 *   Durable Object s'initialise à la 1re connexion WebSocket.
 * - `GET /api/ws?room=CODE` → upgrade WebSocket routé vers `GAME_ROOM.idFromName(CODE)`.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Création d'une salle.
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const code = generateRoomCode();
      return Response.json({ code }, { headers: { ...CORS_HEADERS } });
    }

    // Connexion WebSocket à une salle.
    if (url.pathname === '/api/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected a WebSocket Upgrade request.', { status: 426 });
      }
      const code = (url.searchParams.get('room') ?? '').toUpperCase();
      if (!/^[A-Z]{4}$/.test(code)) {
        return new Response('Missing or invalid ?room=CODE (4 uppercase letters).', {
          status: 400,
        });
      }
      const id = env.GAME_ROOM.idFromName(code);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response(
      'Qui Paire Gagne — game server. POST /api/rooms then GET /api/ws?room=CODE.',
      {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      },
    );
  },
} satisfies ExportedHandler<Env>;
