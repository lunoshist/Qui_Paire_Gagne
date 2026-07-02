import { describe, expect, it } from 'vitest';
import {
  DEFAULT_API_URL,
  DEFAULT_WS_URL,
  buildCreateRoomUrl,
  buildRoomWsUrl,
  resolveApiBaseUrl,
  resolveWsBaseUrl,
} from './wsUrl';

describe('résolution des URLs serveur', () => {
  it('utilise les défauts locaux sans variable d’env', () => {
    expect(resolveApiBaseUrl()).toBe(DEFAULT_API_URL);
    expect(resolveWsBaseUrl()).toBe(DEFAULT_WS_URL);
  });

  it('construit l’URL de création de salle', () => {
    expect(buildCreateRoomUrl()).toBe('http://localhost:8787/api/rooms');
  });

  it('construit l’URL WebSocket d’une salle en normalisant le code', () => {
    expect(buildRoomWsUrl('abcd')).toBe('ws://localhost:8787/api/ws?room=ABCD');
    expect(buildRoomWsUrl('  wxyz ')).toBe('ws://localhost:8787/api/ws?room=WXYZ');
  });

  it('produit des bases WebSocket valides', () => {
    expect(resolveWsBaseUrl()).toMatch(/^wss?:\/\//);
  });
});
