/**
 * Pool de cartes bundlé dans le Worker pour le tirage d'une manche.
 *
 * On importe le manifeste du catalogue (`catalog/manifest.json`) au build (esbuild
 * inline le JSON dans le bundle Worker) et on n'en garde que ce dont le serveur a
 * besoin : **id + tags**. Les illustrations (`file`) et métadonnées d'auteur ne sont
 * pas nécessaires côté serveur — le client possède le manifeste complet pour l'affichage.
 */

import type { Card } from '@qpg/shared';
import manifest from '../../catalog/manifest.json';

/** Le pool complet réduit à { id, tags } (ce que consomme l'algo de tirage). */
export const CARD_POOL: Card[] = manifest.cards.map((c) => ({
  id: c.id,
  tags: {
    concepts: c.tags.concepts,
    couleursDominantes: c.tags.couleursDominantes,
    categorie: c.tags.categorie,
    ambiance: c.tags.ambiance,
    formes: c.tags.formes,
  },
}));

/** Identifiants disponibles pour le tirage. */
export const CARD_IDS: readonly string[] = CARD_POOL.map((c) => c.id);
