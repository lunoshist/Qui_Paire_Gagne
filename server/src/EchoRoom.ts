import type { ClientMessage, ServerMessage } from '@qpg/shared';

/**
 * Durable Object « écho » utilisant l'API WebSocket Hibernation :
 * - `state.acceptWebSocket(server)` délègue la gestion du socket au runtime
 *   (le DO peut être évincé de la mémoire et réhydraté au message suivant) ;
 * - les handlers `webSocketMessage` / `webSocketClose` sont appelés par le runtime.
 * On n'utilise PAS `addEventListener('message')` (qui empêcherait l'hibernation).
 */
export class EchoRoom implements DurableObject {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket Upgrade request.', { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // Hibernation : le runtime garde la connexion même DO hors mémoire.
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);

    let text = raw;
    try {
      const parsed = JSON.parse(raw) as ClientMessage;
      if (parsed && parsed.type === 'echo' && typeof parsed.text === 'string') {
        text = parsed.text;
      }
    } catch {
      // Message non-JSON : on renvoie le texte brut tel quel.
    }

    const response: ServerMessage = { type: 'echo', text, receivedAt: Date.now() };
    ws.send(JSON.stringify(response));
  }

  webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean): void {
    // 1000 = fermeture normale ; on ferme proprement le côté serveur.
    ws.close(code === 1006 ? 1000 : code, 'EchoRoom closing');
  }
}
