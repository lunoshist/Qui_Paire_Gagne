/**
 * Écran Victoire (phase `finished`) — célébration soignée (TASK-011).
 * Podium animé (les marches montent, médailles qui rebondissent, couronne sur le
 * champion), pluie de confettis, puis classement complet depuis
 * `gameOver.classement` (déjà trié par score décroissant). Boutons Rejouer /
 * Retour à l'accueil.
 */

import { useMemo } from 'react';
import type { GameOverMessage, Player } from '@qpg/shared';
import { Banner, Button, Panel } from '../ui/components';
import { PlayerToken } from '../ui/gameComponents';

/** Palette des confettis (accents D-007). */
const CONFETTI_COLORS = ['#ff6f61', '#2fb8b0', '#f4c430', '#9b6dd6', '#4caf6d', '#ff9f43'];
const CONFETTI_COUNT = 80;

/** Pluie de confettis en pur CSS (positions/couleurs/délais pseudo-aléatoires figés au montage). */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 2.4 + Math.random() * 2.2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rounded: Math.random() > 0.5,
        drift: (Math.random() * 2 - 1) * 40,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`confetti-piece ${p.rounded ? 'is-round' : ''}`.trim()}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

export function Victory({
  gameOver,
  players,
  iAmHost,
  onReturnToLobby,
  navigate,
}: {
  gameOver: GameOverMessage;
  players: Player[];
  iAmHost: boolean;
  onReturnToLobby: () => void;
  navigate: (path: string) => void;
}) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const classement = gameOver.classement;
  const top3 = classement.slice(0, 3);
  const winner = classement[0] ? byId.get(classement[0].playerId) : undefined;

  // Ordre d'affichage du podium : 2e · 1er · 3e (le 1er surélevé au centre).
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <div className="game-shell victory-shell">
      <Confetti />

      <header className="victory-header">
        <div className="victory-crown" aria-hidden="true">
          👑
        </div>
        <h1>Victoire&nbsp;!</h1>
        {winner && (
          <p className="victory-winner">
            <PlayerToken player={winner} />
          </p>
        )}
      </header>

      <section className="podium" aria-label="Podium">
        {podiumOrder.map((entry) => {
          const p = byId.get(entry.playerId);
          const rank = classement.findIndex((e) => e.playerId === entry.playerId) + 1;
          return (
            <div key={entry.playerId} className={`podium-step podium-${rank}`}>
              <span className="podium-medal" aria-hidden="true">
                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
              </span>
              {p && <PlayerToken player={p} />}
              <span className="podium-score">{entry.score}</span>
              <span className="podium-plinth" aria-hidden="true">
                {rank}
              </span>
            </div>
          );
        })}
      </section>

      <Panel title="Classement final">
        <ol className="score-list">
          {classement.map((entry, i) => {
            const p = byId.get(entry.playerId);
            return (
              <li key={entry.playerId} className={`score-row ${i === 0 ? 'is-winner' : ''}`.trim()}>
                <span className="score-rank">{i + 1}</span>
                {p ? <PlayerToken player={p} /> : <span>{entry.playerId}</span>}
                <span className="score-total">{entry.score}</span>
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="game-actions row">
        {iAmHost ? (
          <Button size="lg" onClick={onReturnToLobby}>
            🔄 Rejouer (même salle)
          </Button>
        ) : (
          <Banner kind="info">En attente que l’hôte relance une partie…</Banner>
        )}
        <Button variant="ghost" size="lg" onClick={() => navigate('/')}>
          ← Retour à l’accueil
        </Button>
      </div>
    </div>
  );
}
