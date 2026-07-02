/**
 * Composants réutilisables du design system (D-007).
 * Minimalistes, sans dépendance : Button, Panel, Input, Select, ColorPicker,
 * PlayerBadge, Banner.
 */

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import type { Couleur, Player } from '@qpg/shared';
import { COULEURS } from '@qpg/shared';
import { couleurStyle } from './colors';

// --- Button ---------------------------------------------------------------
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'accent' | 'ghost';
  size?: 'md' | 'lg';
  block?: boolean;
};
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className = '',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'lg' ? 'btn-lg' : '',
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button className={classes} {...rest} />;
}

// --- Panel ----------------------------------------------------------------
export function Panel({
  title,
  children,
  className = '',
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      {title != null && <h2 className="panel-title">{title}</h2>}
      {children}
    </section>
  );
}

// --- Input ----------------------------------------------------------------
type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string };
export function Input({ label, id, className = '', ...rest }: InputProps) {
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      <input id={id} className={`input ${className}`.trim()} {...rest} />
    </div>
  );
}

// --- Select ---------------------------------------------------------------
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string };
export function Select({ label, id, className = '', children, ...rest }: SelectProps) {
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      <select id={id} className={`select ${className}`.trim()} {...rest}>
        {children}
      </select>
    </div>
  );
}

// --- ColorPicker ----------------------------------------------------------
export function ColorPicker({
  value,
  onChange,
  taken = [],
}: {
  value: Couleur | undefined;
  onChange: (c: Couleur) => void;
  /** Couleurs déjà prises (désactivées, sauf celle du joueur courant). */
  taken?: Couleur[];
}) {
  return (
    <div className="color-grid" role="group" aria-label="Choix de la couleur">
      {COULEURS.map((c) => {
        const s = couleurStyle(c);
        const isTaken = taken.includes(c) && c !== value;
        return (
          <button
            key={c}
            type="button"
            className="color-swatch"
            style={{ background: s.hex, color: s.text }}
            aria-pressed={value === c}
            aria-label={`${s.label}${isTaken ? ' (déjà pris)' : ''}`}
            title={s.label}
            disabled={isTaken}
            onClick={() => onChange(c)}
          >
            <span aria-hidden="true">{s.symbol}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- PlayerBadge ----------------------------------------------------------
export function PlayerBadge({
  player,
  isHost,
  isMe,
}: {
  player: Player;
  isHost: boolean;
  isMe: boolean;
}) {
  const s = couleurStyle(player.couleur);
  const initial = player.pseudo.trim().charAt(0).toUpperCase() || '?';
  return (
    <li
      className={['player-badge', isMe ? 'is-me' : '', player.connecte ? '' : 'is-offline']
        .filter(Boolean)
        .join(' ')}
    >
      <span className="player-avatar" style={{ background: s.hex, color: s.text }}>
        {initial}
        <span className="player-symbol" aria-hidden="true">
          {s.symbol}
        </span>
      </span>
      <span className="player-name">
        {player.pseudo}
        {isMe && ' (vous)'}
      </span>
      {isHost && <span className="tag tag-host">Hôte</span>}
      {player.connecte ? (
        <span className="dot-online" aria-label="connecté" title="connecté" />
      ) : (
        <span className="tag tag-offline">Hors ligne</span>
      )}
    </li>
  );
}

// --- Banner ---------------------------------------------------------------
export function Banner({
  kind = 'info',
  children,
}: {
  kind?: 'error' | 'warn' | 'info';
  children: ReactNode;
}) {
  const icon = kind === 'error' ? '⚠️' : kind === 'warn' ? '⏳' : 'ℹ️';
  return (
    <div className={`banner banner-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
