/**
 * Composants présentiels spécifiques au jeu (Formation / Révélation / Scores).
 * Purement visuels : aucune logique de store, aucun drag&drop (branchés par les
 * écrans). Réutilisent le design system D-007 (voir styles.css).
 */

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Player } from '@qpg/shared';
import type { CatalogMap } from '../catalog';
import { cardImage, cardSubject } from '../catalog';
import { couleurStyle } from './colors';

/** Illustration d'une carte (repli : le sujet en toutes lettres si pas d'image). */
export function CardFace({
  id,
  catalog,
  size = 'md',
}: {
  id: string;
  catalog: CatalogMap;
  size?: 'sm' | 'md' | 'lg';
}) {
  const url = cardImage(catalog, id);
  const subject = cardSubject(catalog, id);
  return (
    <div className={`card-face card-face-${size}`} title={subject}>
      {url ? (
        <img className="card-img" src={url} alt={subject} draggable={false} />
      ) : (
        <span className="card-fallback">{subject}</span>
      )}
    </div>
  );
}

/**
 * Zoom plein écran (lightbox) d'une carte, pour en voir les détails sur mobile.
 * Fermeture : clic sur le fond, bouton ✕, ou touche Échap. Ne participe à aucun
 * appariement (rendu hors du DndContext, au niveau de l'écran).
 */
export function Lightbox({
  id,
  catalog,
  onClose,
}: {
  id: string;
  catalog: CatalogMap;
  onClose: () => void;
}) {
  const subject = cardSubject(catalog, id);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Carte agrandie : ${subject}`}
      onClick={onClose}
    >
      <button
        type="button"
        className="lightbox-close"
        onClick={onClose}
        aria-label="Fermer le zoom"
      >
        ✕
      </button>
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <CardFace id={id} catalog={catalog} size="lg" />
        <span className="lightbox-subject">{subject}</span>
      </div>
    </div>
  );
}

/** Jeton coloré d'un joueur (pastille couleur + symbole daltonisme-safe + pseudo). */
export function PlayerToken({
  player,
  showName = true,
  suffix,
}: {
  player: Player;
  showName?: boolean;
  suffix?: ReactNode;
}) {
  const s = couleurStyle(player.couleur);
  const initial = player.pseudo.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="player-token" title={player.pseudo}>
      <span className="player-token-dot" style={{ background: s.hex, color: s.text }}>
        {initial}
        <span className="player-token-symbol" aria-hidden="true">
          {s.symbol}
        </span>
      </span>
      {showName && <span className="player-token-name">{player.pseudo}</span>}
      {suffix}
    </span>
  );
}

/** Compte à rebours du sablier (affichage m:ss + état d'urgence sous 10 s). */
export function Countdown({ remainingMs }: { remainingMs: number }) {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const urgent = totalSec <= 10 && totalSec > 0;
  const over = totalSec === 0;
  return (
    <span
      className={`countdown ${urgent ? 'is-urgent' : ''} ${over ? 'is-over' : ''}`.trim()}
      role="timer"
      aria-live={urgent ? 'assertive' : 'off'}
    >
      ⏳ {m}:{String(s).padStart(2, '0')}
    </span>
  );
}
