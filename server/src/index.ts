import { EchoRoom } from './EchoRoom';

export { EchoRoom };

export interface Env {
  ECHO_ROOM: DurableObjectNamespace;
}

/**
 * Worker d'entrée : route les upgrades WebSocket vers le Durable Object `EchoRoom`.
 * Pour le scaffold, un seul DO nommé « global » ; la logique « une room = un DO »
 * (idFromName(roomCode)) viendra avec le lobby.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      const id = env.ECHO_ROOM.idFromName('global');
      const stub = env.ECHO_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response('Qui Paire Gagne — echo server. Connect a WebSocket to /ws.', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
} satisfies ExportedHandler<Env>;
