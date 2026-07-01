import { describe, expect, it } from 'vitest';
import { createEchoRequest } from './index';

describe('createEchoRequest', () => {
  it('construit un message echo bien formé', () => {
    expect(createEchoRequest('bonjour')).toEqual({ type: 'echo', text: 'bonjour' });
  });
});
