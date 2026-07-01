import { describe, expect, it } from 'vitest';
import { resolveWsUrl, DEFAULT_WS_URL } from './wsUrl';

describe('resolveWsUrl', () => {
  it('retourne une URL WebSocket valide (défaut local sans env)', () => {
    const url = resolveWsUrl();
    expect(url).toMatch(/^wss?:\/\//);
    expect(url).toBe(DEFAULT_WS_URL);
  });
});
