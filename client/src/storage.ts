/**
 * Persistance légère côté navigateur.
 * - `playerId` par salle (localStorage) → reprise de place à la reconnexion.
 * - Dernier pseudo / couleur (localStorage) → confort de saisie.
 * - Intention de join (sessionStorage) → transfert Accueil → Salle d'attente.
 */

import type { Couleur } from '@qpg/shared';

const PLAYER_ID_PREFIX = 'qpg:playerId:';
const PSEUDO_KEY = 'qpg:pseudo';
const COULEUR_KEY = 'qpg:couleur';
const INTENT_KEY = 'qpg:joinIntent';

/** Accès sûr au storage (jsdom/SSR/quota) — dégrade silencieusement. */
function safeGet(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function safeSet(store: Storage | undefined, key: string, value: string): void {
  try {
    store?.setItem(key, value);
  } catch {
    // storage indisponible / plein : on ignore.
  }
}
function safeRemove(store: Storage | undefined, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    // ignore
  }
}

const local = typeof localStorage !== 'undefined' ? localStorage : undefined;
const session = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined;

export function getStoredPlayerId(code: string): string | null {
  return safeGet(local, PLAYER_ID_PREFIX + code.toUpperCase());
}
export function setStoredPlayerId(code: string, playerId: string): void {
  safeSet(local, PLAYER_ID_PREFIX + code.toUpperCase(), playerId);
}

export function getStoredPseudo(): string {
  return safeGet(local, PSEUDO_KEY) ?? '';
}
export function getStoredCouleur(): Couleur | undefined {
  return (safeGet(local, COULEUR_KEY) as Couleur | null) ?? undefined;
}
export function rememberIdentity(pseudo: string, couleur?: Couleur): void {
  safeSet(local, PSEUDO_KEY, pseudo);
  if (couleur) safeSet(local, COULEUR_KEY, couleur);
}

/** Intention de rejoindre, posée par l'Accueil avant navigation vers la salle. */
export interface JoinIntent {
  pseudo: string;
  couleur?: Couleur;
}

export function setJoinIntent(intent: JoinIntent): void {
  safeSet(session, INTENT_KEY, JSON.stringify(intent));
}
export function takeJoinIntent(): JoinIntent | null {
  const raw = safeGet(session, INTENT_KEY);
  if (!raw) return null;
  safeRemove(session, INTENT_KEY);
  try {
    const parsed = JSON.parse(raw) as JoinIntent;
    if (parsed && typeof parsed.pseudo === 'string') return parsed;
  } catch {
    // ignore
  }
  return null;
}
