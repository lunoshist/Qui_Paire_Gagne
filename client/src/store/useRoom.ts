/**
 * Hook `useRoom` : gère UNE connexion WebSocket à une salle et expose l'état
 * synchronisé + des émetteurs typés de `ClientMessage`.
 *
 * Responsabilités :
 * - ouvrir un seul WebSocket par salle (`/api/ws?room=CODE`) ;
 * - envoyer `joinRoom` (avec `playerId` stocké → reconnexion) dès l'ouverture ;
 * - persister le `playerId` reçu dans `joined` (localStorage) ;
 * - alimenter le réducteur pur `reduce` avec les messages entrants ;
 * - reconnecter automatiquement avec backoff en cas de coupure.
 *
 * La logique d'état est déléguée à `roomStore.ts` (pure, testée à part).
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { ClientMessage, Couleur, Pair, RoomSettings, ServerMessage } from '@qpg/shared';
import { getStoredPlayerId, setStoredPlayerId } from '../storage';
import { buildRoomWsUrl } from '../wsUrl';
import { initialRoomState, reduce } from './roomStore';
import type { RoomStoreState } from './roomStore';

/** Infos nécessaires pour émettre le `joinRoom` initial. */
export interface JoinInfo {
  pseudo: string;
  couleur?: Couleur;
}

export interface UseRoom extends RoomStoreState {
  updateSettings: (settings: RoomSettings) => void;
  startGame: () => void;
  /** Soumet les 5 paires + la pomme pourrie (un seul message par manche). */
  submitPairs: (paires: Pair[], pommePourrie: string) => void;
  /** Hôte : passe de la révélation à la manche suivante (ou à la fin). */
  advance: () => void;
  clearError: () => void;
}

/** Backoff de reconnexion (ms), plafonné. */
const RECONNECT_DELAYS = [500, 1000, 2000, 4000, 8000];

/**
 * @param code    Code de la salle (4 lettres).
 * @param joinInfo Pseudo/couleur pour le join ; `null` = ne pas se connecter
 *                 (l'utilisateur n'a pas encore saisi son pseudo).
 */
export function useRoom(code: string, joinInfo: JoinInfo | null): UseRoom {
  const [state, dispatch] = useReducer(reduce, initialRoomState);

  const wsRef = useRef<WebSocket | null>(null);
  const closedByUsRef = useRef(false);
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Garde le dernier joinInfo accessible aux callbacks (open/reconnect).
  const joinInfoRef = useRef<JoinInfo | null>(joinInfo);
  joinInfoRef.current = joinInfo;

  // Connexion à `code` ; se relance si le pseudo devient disponible.
  const hasJoinInfo = joinInfo !== null;

  useEffect(() => {
    if (!code || !hasJoinInfo) return;

    closedByUsRef.current = false;

    const connect = () => {
      dispatch({
        type: 'connection',
        status: attemptRef.current === 0 ? 'connecting' : 'reconnecting',
      });

      const ws = new WebSocket(buildRoomWsUrl(code));
      wsRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
        dispatch({ type: 'connection', status: 'open' });
        const info = joinInfoRef.current;
        const join: ClientMessage = {
          type: 'joinRoom',
          pseudo: info?.pseudo ?? '',
          couleur: info?.couleur,
          playerId: getStoredPlayerId(code) ?? undefined,
        };
        ws.send(JSON.stringify(join));
      };

      ws.onmessage = (event: MessageEvent) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data as string) as ServerMessage;
        } catch {
          return; // trame illisible : on ignore (frugalité, pas de bruit)
        }
        if (msg.type === 'joined') {
          setStoredPlayerId(code, msg.playerId);
        }
        dispatch({ type: 'server', message: msg });
      };

      ws.onclose = () => {
        if (closedByUsRef.current) {
          dispatch({ type: 'connection', status: 'closed' });
          return;
        }
        // Reconnexion auto (la place est reprise via playerId stocké).
        const delay = RECONNECT_DELAYS[Math.min(attemptRef.current, RECONNECT_DELAYS.length - 1)];
        attemptRef.current += 1;
        dispatch({ type: 'connection', status: 'reconnecting' });
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // La fermeture suivra (`onclose`) et déclenchera la reconnexion.
        try {
          ws.close();
        } catch {
          // déjà fermé
        }
      };
    };

    connect();

    return () => {
      closedByUsRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      attemptRef.current = 0;
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        try {
          ws.close();
        } catch {
          // déjà fermé
        }
      }
    };
  }, [code, hasJoinInfo]);

  const sendMessage = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const updateSettings = useCallback(
    (settings: RoomSettings) => sendMessage({ type: 'updateSettings', settings }),
    [sendMessage],
  );
  const startGame = useCallback(() => sendMessage({ type: 'startGame' }), [sendMessage]);
  const submitPairs = useCallback(
    (paires: Pair[], pommePourrie: string) =>
      sendMessage({ type: 'submitPairs', paires, pommePourrie }),
    [sendMessage],
  );
  const advance = useCallback(() => sendMessage({ type: 'advance' }), [sendMessage]);
  const clearError = useCallback(() => dispatch({ type: 'clearError' }), []);

  return { ...state, updateSettings, startGame, submitPairs, advance, clearError };
}
