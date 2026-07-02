/**
 * Modèle de domaine partagé — source de vérité de l'état d'une salle.
 *
 * Ces types décrivent le jeu « Qui Paire Gagne » (règles : `docs/brief.md`,
 * modèle d'état : `docs/architecture.md`). Aucune logique ici : que des
 * structures de données pures, importables par le client ET le serveur.
 */

// ---------------------------------------------------------------------------
// Joueurs & couleurs
// ---------------------------------------------------------------------------

/** Les 8 couleurs de série attribuées aux joueurs (distinctes & accessibles). */
export const COULEURS = [
  'rouge',
  'orange',
  'jaune',
  'vert',
  'bleu',
  'violet',
  'rose',
  'turquoise',
] as const;

/** Union des 8 couleurs joueurs. */
export type Couleur = (typeof COULEURS)[number];

/** Un joueur d'une salle (état autoritatif côté serveur). */
export interface Player {
  id: string;
  pseudo: string;
  couleur: Couleur;
  avatar?: string;
  /** `false` si le WebSocket est tombé mais la place est conservée (reconnexion). */
  connecte: boolean;
  /** Score cumulé sur l'ensemble des manches jouées. */
  scoreCumul: number;
}

// ---------------------------------------------------------------------------
// Phases & réglages
// ---------------------------------------------------------------------------

/** Machine à états d'une partie (voir `docs/architecture.md`). */
export type Phase = 'lobby' | 'dealing' | 'forming' | 'reveal' | 'scores' | 'finished';

/**
 * Mode de mise en scène de la révélation (D-008, révisé TASK-011).
 *
 * Les modes doivent VRAIMENT différer (retour commanditaire) — on est donc passé
 * de 3 tempos indistincts (`lent`/`normal`/`rapide`) à 2 modes au comportement
 * franchement distinct :
 * - `meneur` (DÉFAUT) : révélation **une paire à la fois**, **synchronisée pour
 *   tous par le serveur** ; l'hôte clique « Suivante » (message `revealNext`,
 *   curseur `revealStep` autoritatif) → laisse aux auteurs le temps de commenter.
 * - `rapide` : enchaînement **automatique côté client** (aucun message par étape).
 */
export type VitesseReveal = 'meneur' | 'rapide';

/**
 * Variantes de scoring configurables par l'hôte.
 * ⚠️ Les règles par défaut suivent D-003 (unanime = 0) — à recouper avec le livret officiel.
 */
export interface ScoringVariants {
  /** Une paire faite par TOUS les joueurs vaut 0 (D-003). */
  paireUnanimeZero: boolean;
  /** La pomme pourrie partagée rapporte le double. */
  pommePourrieDouble: boolean;
}

/** Réglages d'une salle, ajustables en lobby par l'hôte. */
export interface RoomSettings {
  nbManches: number;
  /** Durée du sablier de la phase `forming`, en secondes. */
  dureeSablier: number;
  vitesseReveal: VitesseReveal;
  variantesScoring: ScoringVariants;
}

/** Réglages par défaut d'une nouvelle salle (4 manches, sablier 90 s). */
export const DEFAULT_SETTINGS: RoomSettings = {
  nbManches: 4,
  dureeSablier: 90,
  vitesseReveal: 'meneur',
  variantesScoring: {
    paireUnanimeZero: true,
    pommePourrieDouble: true,
  },
};

// ---------------------------------------------------------------------------
// Cartes (catalogue — schéma de `docs/catalog.md`, contenu réel en Phase 3)
// ---------------------------------------------------------------------------

/** Métadonnées d'une carte, utilisées par l'algo de tirage pour l'ambiguïté. */
export interface CardTags {
  concepts: string[];
  couleursDominantes: string[];
  categorie: string;
  ambiance: string[];
  formes: string[];
}

/** Une carte du catalogue (illustration + tags). */
export interface Card {
  id: string;
  tags: CardTags;
}

// ---------------------------------------------------------------------------
// Soumissions d'une manche
// ---------------------------------------------------------------------------

/** Une paire = 2 identifiants de cartes (l'ordre n'est PAS significatif). */
export type Pair = [string, string];

/** Ce qu'un joueur soumet pour une manche : ses 5 paires + sa pomme pourrie. */
export interface PlayerSubmission {
  playerId: string;
  paires: Pair[];
  /** cardId de la carte laissée non appariée. */
  pommePourrie: string;
}

// ---------------------------------------------------------------------------
// Snapshot public d'une salle (diffusable — SANS les soumissions secrètes)
// ---------------------------------------------------------------------------

/** État d'une salle diffusable à tous les clients (aucune info secrète). */
export interface PublicRoomState {
  code: string;
  hostId: string;
  players: Player[];
  settings: RoomSettings;
  phase: Phase;
  mancheCourante: number;
}

// ---------------------------------------------------------------------------
// Résultats & scores
// ---------------------------------------------------------------------------

/** Résultat d'une paire distincte après décompte. */
export interface PairResult {
  /** Paire normalisée (les 2 cardIds triés). */
  pair: Pair;
  /** Identifiants des joueurs ayant formé cette paire. */
  makers: string[];
  /** Points attribués à CHAQUE maker (0 si solo ou unanime). */
  pointsParMaker: number;
}

/** Résultat d'une pomme pourrie distincte après décompte. */
export interface PommePourrieResult {
  cardId: string;
  /** Identifiants des joueurs ayant cette carte en pomme pourrie. */
  sharers: string[];
  /** Points attribués à CHAQUE sharer (0 si solo ou unanime, sinon 2×sharers). */
  pointsParSharer: number;
}

/** Résultat complet d'une manche (retour de `computeRoundResult`). */
export interface RoundResult {
  parPaire: PairResult[];
  pommesPourries: PommePourrieResult[];
  /** Points gagnés dans la manche, agrégés par joueur (0 pour ceux sans point). */
  deltaScores: Record<string, number>;
}

/** Une ligne de classement. */
export interface ScoreEntry {
  playerId: string;
  score: number;
}

/** Classement (typiquement trié par score décroissant). */
export type Scoreboard = ScoreEntry[];

// ---------------------------------------------------------------------------
// Constantes de jeu
// ---------------------------------------------------------------------------

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const CARDS_PER_ROUND = 11;
export const PAIRS_PER_ROUND = 5;
