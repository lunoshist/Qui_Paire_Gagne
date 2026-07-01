import { useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage } from '@qpg/shared';
import { resolveWsUrl } from './wsUrl';

type ConnStatus = 'connecting' | 'open' | 'closed';

interface LogEntry {
  direction: 'sent' | 'echo';
  text: string;
}

/**
 * Scaffold « hello world » temps réel : ouvre un WebSocket vers le Durable Object,
 * envoie un message, affiche l'écho reçu. Aucune logique de jeu ici.
 */
export function App() {
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [input, setInput] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(resolveWsUrl());
    wsRef.current = ws;

    ws.onopen = () => setStatus('open');
    ws.onclose = () => setStatus('closed');
    ws.onerror = () => setStatus('closed');
    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        // Scaffold : seul l'écho porte un champ `text` (l'union protocolaire
        // s'est élargie côté @qpg/shared → on restreint au type 'echo').
        const text = msg.type === 'echo' ? msg.text : String(event.data);
        setLog((prev) => [...prev, { direction: 'echo', text }]);
      } catch {
        setLog((prev) => [...prev, { direction: 'echo', text: String(event.data) }]);
      }
    };

    return () => ws.close();
  }, []);

  const send = () => {
    const ws = wsRef.current;
    const text = input.trim();
    if (!ws || ws.readyState !== WebSocket.OPEN || text === '') return;
    const msg: ClientMessage = { type: 'echo', text };
    ws.send(JSON.stringify(msg));
    setLog((prev) => [...prev, { direction: 'sent', text }]);
    setInput('');
  };

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 640,
        margin: '2rem auto',
        padding: '0 1rem',
      }}
    >
      <h1>Qui Paire Gagne — écho WebSocket</h1>
      <p>
        Statut connexion : <strong>{status}</strong> (<code>{resolveWsUrl()}</code>)
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tape un message…"
          aria-label="Message à envoyer"
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <button type="submit" disabled={status !== 'open'}>
          Envoyer
        </button>
      </form>

      <ul aria-label="Journal des messages">
        {log.map((entry, i) => (
          <li key={i}>
            {entry.direction === 'sent' ? '→ envoyé : ' : '← écho : '}
            {entry.text}
          </li>
        ))}
      </ul>
    </main>
  );
}
