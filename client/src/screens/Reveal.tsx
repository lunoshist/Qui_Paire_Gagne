/**
 * Écran Révélation (phase `reveal`) — FONCTIONNEL (la mise en scène animée riche
 * est l'objet de TASK-009). Rejoue le `revealPayload` : chaque paire distincte
 * (2 cartes), ses auteurs (jetons couleur) et ses points, avec traitement visuel
 * des cas 0 point (solo / unanime), puis les pommes pourries. Un panneau de scores
 * (cumul trié + delta) accompagne. L'hôte enchaîne avec « Continuer » (`advance`).
 */

import { useMemo } from 'react';
import type { PairResult, Player, PommePourrieResult, RevealPayloadMessage } from '@qpg/shared';
import { useCatalog } from '../catalog';
import { Banner, Button, Panel } from '../ui/components';
import { CardFace, PlayerToken } from '../ui/gameComponents';

export function Reveal({
  reveal,
  players,
  iAmHost,
  onAdvance,
}: {
  reveal: RevealPayloadMessage;
  players: Player[];
  iAmHost: boolean;
  onAdvance: () => void;
}) {
  const catalog = useCatalog();
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // Ordre à crescendo : les 0 point d'abord, puis par nombre d'auteurs croissant.
  const paires = useMemo(
    () =>
      [...reveal.parPaire].sort(
        (a, b) => a.pointsParMaker - b.pointsParMaker || a.makers.length - b.makers.length,
      ),
    [reveal.parPaire],
  );

  // Pommes pourries partagées (≥1 sharer) — l'ordre payload suffit.
  const pommes = reveal.pommesPourries;

  const classement = useMemo(
    () =>
      [...players]
        .map((p) => ({
          player: p,
          cumul: reveal.cumul[p.id] ?? p.scoreCumul,
          delta: reveal.deltaScores[p.id] ?? 0,
        }))
        .sort((a, b) => b.cumul - a.cumul),
    [players, reveal.cumul, reveal.deltaScores],
  );

  return (
    <div className="game-shell">
      <header className="reveal-header">
        <h2>🎬 Révélation</h2>
        <p className="reveal-sub">Voici les paires formées et les points de la manche.</p>
      </header>

      <section className="reveal-pairs" aria-label="Paires révélées">
        {paires.map((pr, i) => (
          <PairReveal key={i} pr={pr} byId={byId} catalog={catalog} />
        ))}
      </section>

      {pommes.length > 0 && (
        <section className="reveal-pommes" aria-label="Pommes pourries">
          <h3>🍎 Pommes pourries</h3>
          <div className="pommes-grid">
            {pommes.map((pp) => (
              <PommeReveal key={pp.cardId} pp={pp} byId={byId} catalog={catalog} />
            ))}
          </div>
        </section>
      )}

      <Panel title="Scores (cumul)">
        <ol className="score-list">
          {classement.map(({ player, cumul, delta }, i) => (
            <li key={player.id} className="score-row">
              <span className="score-rank">{i + 1}</span>
              <PlayerToken player={player} />
              <span className="score-total">{cumul}</span>
              <span className={`score-delta ${delta > 0 ? 'is-plus' : ''}`.trim()}>
                {delta > 0 ? `+${delta}` : '+0'}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="game-actions">
        {iAmHost ? (
          <Button size="lg" block onClick={onAdvance}>
            Continuer →
          </Button>
        ) : (
          <Banner kind="info">En attente que l’hôte continue…</Banner>
        )}
      </div>
    </div>
  );
}

function makersLabel(makers: number, points: number): { text: string; kind: string } {
  if (makers <= 1) return { text: 'Personne d’autre… 0 point 😬', kind: 'zero' };
  if (points === 0) return { text: 'Trop évident ! Tout le monde → 0 point 🤪', kind: 'zero' };
  return { text: `+${points} chacun`, kind: 'plus' };
}

function PairReveal({
  pr,
  byId,
  catalog,
}: {
  pr: PairResult;
  byId: Map<string, Player>;
  catalog: ReturnType<typeof useCatalog>;
}) {
  const label = makersLabel(pr.makers.length, pr.pointsParMaker);
  return (
    <article className={`pair-reveal is-${label.kind}`}>
      <div className="pair-reveal-cards">
        <CardFace id={pr.pair[0]} catalog={catalog} size="md" />
        <span className="pair-heart" aria-hidden="true">
          💞
        </span>
        <CardFace id={pr.pair[1]} catalog={catalog} size="md" />
      </div>
      <div className="pair-reveal-makers">
        {pr.makers.length === 0 ? (
          <span className="makers-none">Personne</span>
        ) : (
          pr.makers.map((id) => {
            const p = byId.get(id);
            return p ? <PlayerToken key={id} player={p} /> : null;
          })
        )}
      </div>
      <span className={`pair-reveal-points is-${label.kind}`}>{label.text}</span>
    </article>
  );
}

function PommeReveal({
  pp,
  byId,
  catalog,
}: {
  pp: PommePourrieResult;
  byId: Map<string, Player>;
  catalog: ReturnType<typeof useCatalog>;
}) {
  const shared = pp.sharers.length > 1;
  const label = !shared
    ? 'Pomme pourrie solo · 0 point'
    : pp.pointsParSharer === 0
      ? 'Tous la même 🤪 · 0 point'
      : `+${pp.pointsParSharer} chacun (double 🍎)`;
  return (
    <article className={`pomme-reveal ${pp.pointsParSharer > 0 ? 'is-gold' : 'is-zero'}`}>
      <CardFace id={pp.cardId} catalog={catalog} size="sm" />
      <div className="pomme-reveal-makers">
        {pp.sharers.map((id) => {
          const p = byId.get(id);
          return p ? <PlayerToken key={id} player={p} showName={false} /> : null;
        })}
      </div>
      <span className="pomme-reveal-points">{label}</span>
    </article>
  );
}
