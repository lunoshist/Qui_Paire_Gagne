/**
 * Logique PURE de la formation des paires (phase `forming`), sans React ni DOM.
 *
 * Modèle : 11 cartes → 5 emplacements de paire (0 à 2 cartes chacun) + un pool
 * des cartes non placées. Quand les 5 emplacements sont pleins (10 cartes), la
 * 11e carte restée au pool est la **pomme pourrie** (automatique).
 *
 * Toutes les opérations sont des transformations immuables (entrée -> nouvelle
 * sortie), faciles à tester et à piloter aussi bien en drag&drop qu'en tap.
 */

import type { Pair } from '@qpg/shared';
import { PAIRS_PER_ROUND } from '@qpg/shared';

/** État de formation : les cartes de la manche + le contenu des 5 emplacements. */
export interface FormationState {
  /** Les 11 identifiants de cartes de la manche (ordre stable pour l'affichage). */
  readonly cards: readonly string[];
  /** 5 emplacements de paire, chacun contenant 0, 1 ou 2 cardIds. */
  readonly slots: readonly (readonly string[])[];
}

/** Crée un état vierge : toutes les cartes au pool, 5 emplacements vides. */
export function createFormation(cards: readonly string[]): FormationState {
  return {
    cards: [...cards],
    slots: Array.from({ length: PAIRS_PER_ROUND }, () => []),
  };
}

/** Toutes les cartes actuellement placées dans un emplacement. */
export function placedCards(state: FormationState): string[] {
  return state.slots.flatMap((s) => [...s]);
}

/** Cartes non placées (dans l'ordre stable de `cards`). */
export function poolCards(state: FormationState): string[] {
  const placed = new Set(placedCards(state));
  return state.cards.filter((c) => !placed.has(c));
}

/** Index de l'emplacement contenant `cardId`, ou -1 s'il est au pool. */
export function slotOf(state: FormationState, cardId: string): number {
  return state.slots.findIndex((s) => s.includes(cardId));
}

/** Retire une carte de tous les emplacements (helper interne immuable). */
function withoutCard(slots: readonly (readonly string[])[], cardId: string): string[][] {
  return slots.map((s) => s.filter((c) => c !== cardId));
}

/**
 * Place `cardId` dans l'emplacement `slotIndex`.
 * No-op si l'emplacement est déjà plein (2 cartes) ou l'index invalide.
 */
export function placeCard(
  state: FormationState,
  cardId: string,
  slotIndex: number,
): FormationState {
  if (slotIndex < 0 || slotIndex >= state.slots.length) return state;
  if (!state.cards.includes(cardId)) return state;
  const already = slotOf(state, cardId);
  // Déjà dans l'emplacement cible : rien à faire.
  if (already === slotIndex) return state;
  const slots = withoutCard(state.slots, cardId);
  if (slots[slotIndex].length >= 2) return state; // emplacement plein
  slots[slotIndex] = [...slots[slotIndex], cardId];
  return { ...state, slots };
}

/** Renvoie `cardId` au pool (le retire de tout emplacement). */
export function unplaceCard(state: FormationState, cardId: string): FormationState {
  if (slotOf(state, cardId) === -1) return state;
  return { ...state, slots: withoutCard(state.slots, cardId) };
}

/**
 * Apparie deux cartes (tap-to-pair) : les place ensemble dans le 1er emplacement
 * libre. No-op si `a === b` ou si aucun emplacement vide n'est disponible.
 */
export function pairCards(state: FormationState, a: string, b: string): FormationState {
  if (a === b) return state;
  if (!state.cards.includes(a) || !state.cards.includes(b)) return state;
  const slots = withoutCard(withoutCard(state.slots, a), b);
  const emptyIdx = slots.findIndex((s) => s.length === 0);
  if (emptyIdx === -1) return state; // pas d'emplacement libre pour une paire
  slots[emptyIdx] = [a, b];
  return { ...state, slots };
}

/** Vide entièrement un emplacement (ses cartes retournent au pool). */
export function clearSlot(state: FormationState, slotIndex: number): FormationState {
  if (slotIndex < 0 || slotIndex >= state.slots.length) return state;
  if (state.slots[slotIndex].length === 0) return state;
  const slots = state.slots.map((s, i) => (i === slotIndex ? [] : [...s]));
  return { ...state, slots };
}

/** Vrai si les 5 emplacements contiennent exactement 2 cartes (10 placées). */
export function isComplete(state: FormationState): boolean {
  return state.slots.every((s) => s.length === 2);
}

/** La pomme pourrie = l'unique carte restée au pool quand tout est complet. */
export function pommePourrie(state: FormationState): string | null {
  if (!isComplete(state)) return null;
  const pool = poolCards(state);
  return pool.length === 1 ? pool[0] : null;
}

/**
 * Convertit l'état en soumission serveur ({ paires, pommePourrie }), ou `null`
 * si la formation est incomplète (pas les 5 paires + 1 pomme pourrie).
 */
export function toSubmission(
  state: FormationState,
): { paires: Pair[]; pommePourrie: string } | null {
  const pp = pommePourrie(state);
  if (!pp) return null;
  const paires = state.slots.map((s) => [s[0], s[1]] as Pair);
  return { paires, pommePourrie: pp };
}
