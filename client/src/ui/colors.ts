/**
 * Palette des couleurs joueurs (D-007) : vives, distinctes et daltonisme-safe.
 * Chaque couleur porte un **secours non-couleur** (`symbol`, une forme/picto) en
 * plus de la teinte, pour rester lisible sans perception des couleurs.
 */

import type { Couleur } from '@qpg/shared';

export interface CouleurStyle {
  /** Teinte de fond de la pastille. */
  hex: string;
  /** Couleur de texte lisible sur `hex`. */
  text: string;
  /** Libellé humain (FR). */
  label: string;
  /** Secours non-couleur : forme/picto distinctif. */
  symbol: string;
}

export const COULEUR_STYLES: Record<Couleur, CouleurStyle> = {
  rouge: { hex: '#EF5350', text: '#ffffff', label: 'Rouge', symbol: '●' },
  orange: { hex: '#F59331', text: '#ffffff', label: 'Orange', symbol: '▲' },
  jaune: { hex: '#F4C430', text: '#3a2f00', label: 'Jaune', symbol: '★' },
  vert: { hex: '#4CAF6D', text: '#ffffff', label: 'Vert', symbol: '■' },
  bleu: { hex: '#3E8EDE', text: '#ffffff', label: 'Bleu', symbol: '◆' },
  violet: { hex: '#9B6DD6', text: '#ffffff', label: 'Violet', symbol: '⬟' },
  rose: { hex: '#E86AA6', text: '#ffffff', label: 'Rose', symbol: '♥' },
  turquoise: { hex: '#26B5AC', text: '#083b38', label: 'Turquoise', symbol: '◐' },
};

export function couleurStyle(couleur: Couleur): CouleurStyle {
  return COULEUR_STYLES[couleur];
}
