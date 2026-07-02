/**
 * Écran Victoire (phase `finished`). Podium des 3 premiers + classement complet
 * depuis `gameOver.classement` (déjà trié par score décroissant), et boutons
 * Rejouer / Retour à l'accueil.
 */

import { useMemo } from 'react';
import type { GameOverMessage, Player } from '@qpg/shared';
import { Button, Panel } from '../ui/components';
import { PlayerToken } from '../ui/gameComponents';

export function Victory({
  gameOver,
  players,
  navigate,
}: {
  gameOver: GameOverMessage;
  players: Player[];
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
      <header className="victory-header">
        <h1>🏆 Victoire 🏆</h1>
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
            </div>
          );
        })}
      </section>

      <Panel title="Classement final">
        <ol className="score-list">
          {classement.map((entry, i) => {
            const p = byId.get(entry.playerId);
            return (
              <li key={entry.playerId} className="score-row">
                <span className="score-rank">{i + 1}</span>
                {p ? <PlayerToken player={p} /> : <span>{entry.playerId}</span>}
                <span className="score-total">{entry.score}</span>
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="game-actions row">
        <Button size="lg" onClick={() => navigate('/')}>
          🔄 Rejouer
        </Button>
        <Button variant="ghost" size="lg" onClick={() => navigate('/')}>
          ← Retour à l’accueil
        </Button>
      </div>
    </div>
  );
}
