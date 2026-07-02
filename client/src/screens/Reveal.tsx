/**
 * Écran Révélation (phase `reveal`) — mise en scène pas-à-pas (TASK-011).
 *
 * Deux modes VRAIMENT distincts (réglage `vitesseReveal`) :
 *  - **meneur** (défaut) : les éléments sont dévoilés UN PAR UN, **synchronisés
 *    par le serveur** via le curseur `revealStep`. L'HÔTE clique « Suivante »
 *    (`onRevealNext` → message `revealNext`) ; les autres suivent la même
 *    progression (« le meneur dévoile… »). À la fin, l'hôte fait `advance`.
 *  - **rapide** : enchaînement AUTOMATIQUE côté client (timer local), sans aucun
 *    message par étape.
 *
 * Dans les deux cas : chaque paire dévoilée fait « tomber » ses points sur les
 * scores (animation), avec gags pour les cas 0 point (solo / unanime), puis la
 * finale des pommes pourries. Le panneau de scores affiche le cumul EN COURS
 * (il monte au fil des révélations), pas le total final d'emblée.
 */

import { useEffect, useMemo, useState } from 'react';
import type {
  PairResult,
  Player,
  PommePourrieResult,
  RevealPayloadMessage,
  VitesseReveal,
} from '@qpg/shared';
import { useCatalog } from '../catalog';
import { Banner, Button, Panel } from '../ui/components';
import { CardFace, Lightbox, PlayerToken } from '../ui/gameComponents';

/** Cadence d'auto-révélation (ms/étape) en mode `rapide`. */
const RAPIDE_STEP_MS = 1200;

/** Vignette de carte cliquable qui ouvre le zoom plein écran (lightbox). */
function ZoomableCard({
  id,
  catalog,
  size,
  onZoom,
}: {
  id: string;
  catalog: ReturnType<typeof useCatalog>;
  size?: 'sm' | 'md' | 'lg';
  onZoom: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className="zoomable-card"
      title="Agrandir la carte"
      aria-label="Agrandir la carte"
      onClick={() => onZoom(id)}
    >
      <CardFace id={id} catalog={catalog} size={size} />
    </button>
  );
}

export function Reveal({
  reveal,
  players,
  iAmHost,
  mode,
  duo = false,
  revealStep,
  onRevealNext,
  onAdvance,
}: {
  reveal: RevealPayloadMessage;
  players: Player[];
  iAmHost: boolean;
  mode: VitesseReveal;
  /** Mode `duo` coopératif : les paires listées sont les paires COMMUNES (score d'équipe). */
  duo?: boolean;
  /** Curseur synchronisé (mode meneur). Ignoré en mode rapide. */
  revealStep: number;
  onRevealNext: () => void;
  onAdvance: () => void;
}) {
  const catalog = useCatalog();
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [zoomed, setZoomed] = useState<string | null>(null);

  // Ordre à crescendo : les 0 point d'abord, puis par nombre d'auteurs croissant.
  const paires = useMemo(
    () =>
      [...reveal.parPaire].sort(
        (a, b) => a.pointsParMaker - b.pointsParMaker || a.makers.length - b.makers.length,
      ),
    [reveal.parPaire],
  );
  const pommes = reveal.pommesPourries;

  const hasPommes = pommes.length > 0;
  // Étapes : 1 par paire + 1 étape finale pour le bloc des pommes pourries.
  const totalSteps = paires.length + (hasPommes ? 1 : 0);

  // --- Curseur d'affichage : serveur (meneur) OU timer local (rapide) ---
  const [autoStep, setAutoStep] = useState(0);
  useEffect(() => {
    if (mode !== 'rapide') return;
    if (autoStep >= totalSteps) return;
    const t = setTimeout(() => setAutoStep((s) => Math.min(s + 1, totalSteps)), RAPIDE_STEP_MS);
    return () => clearTimeout(t);
  }, [mode, autoStep, totalSteps]);

  const visibleCount =
    mode === 'rapide' ? Math.min(autoStep, totalSteps) : Math.min(revealStep, totalSteps);

  const visiblePairs = Math.min(visibleCount, paires.length);
  const pommesVisible = hasPommes && visibleCount >= totalSteps;
  const done = visibleCount >= totalSteps;

  // --- Scores EN COURS : montent au fil des révélations ---
  const running = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const p of players)
      acc[p.id] = (reveal.cumul[p.id] ?? 0) - (reveal.deltaScores[p.id] ?? 0);
    for (let i = 0; i < visiblePairs; i++) {
      const pr = paires[i];
      if (pr.pointsParMaker > 0)
        for (const id of pr.makers) acc[id] = (acc[id] ?? 0) + pr.pointsParMaker;
    }
    if (pommesVisible) {
      for (const pp of pommes) {
        if (pp.pointsParSharer > 0)
          for (const id of pp.sharers) acc[id] = (acc[id] ?? 0) + pp.pointsParSharer;
      }
    }
    return acc;
  }, [players, reveal.cumul, reveal.deltaScores, paires, pommes, visiblePairs, pommesVisible]);

  const classement = useMemo(
    () =>
      [...players]
        .map((p) => ({
          player: p,
          cumul: running[p.id] ?? 0,
          delta:
            (running[p.id] ?? 0) - ((reveal.cumul[p.id] ?? 0) - (reveal.deltaScores[p.id] ?? 0)),
        }))
        .sort((a, b) => b.cumul - a.cumul || a.player.pseudo.localeCompare(b.player.pseudo)),
    [players, running, reveal.cumul, reveal.deltaScores],
  );

  return (
    <div className="game-shell reveal-shell">
      <header className="reveal-header">
        <h2>🎬 Révélation</h2>
        {duo && (
          <Banner kind="info">
            🤝 Duo coopératif —{' '}
            <strong>
              {reveal.parPaire.filter((pr) => pr.makers.length >= 2).length} paire(s) en commun
            </strong>{' '}
            · score d’équipe <strong>+{reveal.deltaScores[players[0]?.id] ?? 0}</strong> pour vous
            deux.
          </Banner>
        )}
        {mode === 'meneur' ? (
          <p className="reveal-sub">
            {iAmHost
              ? 'Tu es le meneur : dévoile les paires une à une, laisse les auteurs s’expliquer.'
              : '🎙️ Le meneur dévoile les paires une à une…'}
          </p>
        ) : (
          <p className="reveal-sub">Révélation express — tout s’enchaîne automatiquement.</p>
        )}
        {totalSteps > 0 && (
          <div
            className="reveal-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalSteps}
            aria-valuenow={visibleCount}
          >
            <div
              className="reveal-progress-bar"
              style={{ width: `${(visibleCount / totalSteps) * 100}%` }}
            />
            <span className="reveal-progress-label">
              {visibleCount} / {totalSteps}
            </span>
          </div>
        )}
      </header>

      <section className="reveal-stage" aria-label="Paires révélées">
        {visiblePairs === 0 && !pommesVisible ? (
          <p className="reveal-waiting">
            {mode === 'meneur' && !iAmHost
              ? 'Le meneur va commencer…'
              : 'La révélation va commencer…'}
          </p>
        ) : (
          <>
            {/* Historique compact : les paires déjà révélées, réduites et en retrait. */}
            {visiblePairs > 1 && (
              <div className="reveal-history" aria-label="Paires déjà révélées">
                {paires.slice(0, visiblePairs - 1).map((pr, i) => (
                  <PairReveal
                    key={i}
                    pr={pr}
                    variant="history"
                    duo={duo}
                    byId={byId}
                    catalog={catalog}
                    onZoom={setZoomed}
                  />
                ))}
              </div>
            )}
            {/* Paire COURANTE (dernière révélée) : point focal, en grand. */}
            {visiblePairs > 0 && (
              <PairReveal
                key={visiblePairs - 1}
                pr={paires[visiblePairs - 1]}
                variant="hero"
                duo={duo}
                byId={byId}
                catalog={catalog}
                onZoom={setZoomed}
              />
            )}
          </>
        )}
      </section>

      {pommesVisible && (
        <section className="reveal-pommes" aria-label="Pommes pourries">
          <h3>🍎 Pommes pourries</h3>
          <div className="pommes-grid">
            {pommes.map((pp) => (
              <PommeReveal
                key={pp.cardId}
                pp={pp}
                byId={byId}
                catalog={catalog}
                onZoom={setZoomed}
              />
            ))}
          </div>
        </section>
      )}

      <Panel title="Scores (en direct)">
        <ol className="score-list">
          {classement.map(({ player, cumul, delta }, i) => (
            <li key={player.id} className="score-row">
              <span className="score-rank">{i + 1}</span>
              <PlayerToken player={player} />
              <span key={cumul} className="score-total score-bump">
                {cumul}
              </span>
              <span className={`score-delta ${delta > 0 ? 'is-plus' : ''}`.trim()}>
                {delta > 0 ? `+${delta}` : '+0'}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="game-actions">
        {mode === 'meneur' ? (
          iAmHost ? (
            done ? (
              <Button size="lg" block onClick={onAdvance}>
                Continuer →
              </Button>
            ) : (
              <Button size="lg" block onClick={onRevealNext}>
                {visibleCount === 0 ? 'Dévoiler la 1re paire 🎬' : 'Suivante →'}
              </Button>
            )
          ) : done ? (
            <Banner kind="info">En attente que l’hôte continue…</Banner>
          ) : (
            <Banner kind="info">
              🎙️ Le meneur dévoile… ({visibleCount}/{totalSteps})
            </Banner>
          )
        ) : iAmHost ? (
          done ? (
            <Button size="lg" block onClick={onAdvance}>
              Continuer →
            </Button>
          ) : (
            <Button variant="ghost" size="lg" block onClick={() => setAutoStep(totalSteps)}>
              Passer ⏭
            </Button>
          )
        ) : done ? (
          <Banner kind="info">En attente que l’hôte continue…</Banner>
        ) : (
          <Banner kind="info">Révélation en cours…</Banner>
        )}
      </div>

      {zoomed ? <Lightbox id={zoomed} catalog={catalog} onClose={() => setZoomed(null)} /> : null}
    </div>
  );
}

/** Verdict d'une paire : distingue solo (dégonflé) et unanime (trop évident). */
function pairVerdict(makers: number, points: number): { text: string; kind: string } {
  if (makers <= 1) return { text: 'Personne d’autre… 0 point 😬', kind: 'solo' };
  if (points === 0) return { text: 'Trop évident ! Tout le monde → 0 point 🤪', kind: 'unanime' };
  return { text: `+${points} chacun`, kind: 'plus' };
}

function PairReveal({
  pr,
  variant = 'hero',
  duo = false,
  byId,
  catalog,
  onZoom,
}: {
  pr: PairResult;
  /** `hero` = paire courante en grand (focal) ; `history` = miniature déjà révélée. */
  variant?: 'hero' | 'history';
  duo?: boolean;
  byId: Map<string, Player>;
  catalog: ReturnType<typeof useCatalog>;
  onZoom: (id: string) => void;
}) {
  // En duo : une paire COMMUNE (2 auteurs) fait marquer l'équipe ; une paire faite par
  // un seul (non commune) est révélée aussi, mais à 0 point.
  const verdict = duo
    ? pr.makers.length >= 2
      ? { text: `Paire en commun · +${pr.pointsParMaker} 💞`, kind: 'plus' }
      : { text: 'Pas en commun · 0 point 😬', kind: 'solo' }
    : pairVerdict(pr.makers.length, pr.pointsParMaker);
  const history = variant === 'history';
  const cardSize = history ? 'sm' : 'md';
  return (
    <article className={`pair-reveal reveal-pop pair-reveal-${variant} is-${verdict.kind}`}>
      <div className="pair-reveal-cards">
        <ZoomableCard id={pr.pair[0]} catalog={catalog} size={cardSize} onZoom={onZoom} />
        <span className="pair-heart" aria-hidden="true">
          💞
        </span>
        <ZoomableCard id={pr.pair[1]} catalog={catalog} size={cardSize} onZoom={onZoom} />
      </div>
      <div className="pair-reveal-makers">
        {pr.makers.length === 0 ? (
          <span className="makers-none">Personne</span>
        ) : (
          pr.makers.map((id) => {
            const p = byId.get(id);
            return p ? <PlayerToken key={id} player={p} showName={!history} /> : null;
          })
        )}
      </div>
      <span className={`pair-reveal-points is-${verdict.kind}`}>
        {/* Le « +N » ne s'envole que sur la paire courante (pas sur l'historique). */}
        {verdict.kind === 'plus' && !history && (
          <span className="points-fly" aria-hidden="true">
            +{pr.pointsParMaker}
          </span>
        )}
        {verdict.text}
      </span>
    </article>
  );
}

function PommeReveal({
  pp,
  byId,
  catalog,
  onZoom,
}: {
  pp: PommePourrieResult;
  byId: Map<string, Player>;
  catalog: ReturnType<typeof useCatalog>;
  onZoom: (id: string) => void;
}) {
  const shared = pp.sharers.length > 1;
  const label = !shared
    ? 'Pomme pourrie solo · 0 point'
    : pp.pointsParSharer === 0
      ? 'Tous la même 🤪 · 0 point'
      : `+${pp.pointsParSharer} chacun (double 🍎)`;
  return (
    <article
      className={`pomme-reveal reveal-pop ${pp.pointsParSharer > 0 ? 'is-gold' : 'is-zero'}`}
    >
      <ZoomableCard id={pp.cardId} catalog={catalog} size="md" onZoom={onZoom} />
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
