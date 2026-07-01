/**
 * `@qpg/shared` — source de vérité du domaine, du protocole WebSocket et de la
 * logique de score du jeu « Qui Paire Gagne ». Importable par le client ET le
 * serveur. Que du TypeScript pur : aucune infra, aucun réseau, aucune UI.
 *
 * - `domain`   : types du modèle d'état + constantes de jeu.
 * - `protocol` : unions discriminées Client↔Serveur (payloads WebSocket).
 * - `scoring`  : logique de score PURE et déterministe (`computeRoundResult`).
 */

export * from './domain';
export * from './protocol';
export * from './scoring';
