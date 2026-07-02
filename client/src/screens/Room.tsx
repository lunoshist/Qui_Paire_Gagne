/**
 * Écran Salle d'attente (lobby) : liste des joueurs en direct, copie du lien
 * d'invitation, réglages (éditables par l'hôte seulement) et bouton Lancer.
 *
 * Se connecte via `useRoom`. Si l'utilisateur arrive par lien direct sans pseudo
 * (ni playerId stocké pour reconnexion), un mini-formulaire de join est affiché
 * avant la connexion.
 */

import { useState } from 'react';
import type { Couleur, Mode, RoomSettings, VitesseReveal } from '@qpg/shared';
import { maxPlayers, minPlayers, MODES } from '@qpg/shared';
import { Banner, Button, ColorPicker, Input, Panel, PlayerBadge, Select } from '../ui/components';
import { canStartGame, isHost, missingPlayers } from '../store/roomStore';
import { useRoom } from '../store/useRoom';
import type { JoinInfo } from '../store/useRoom';
import { Formation } from './Formation';
import { Reveal } from './Reveal';
import { Victory } from './Victory';
import {
  getStoredCouleur,
  getStoredPlayerId,
  getStoredPseudo,
  rememberIdentity,
  takeJoinIntent,
} from '../storage';

const SABLIER_PRESETS = [30, 45, 60, 90, 120, 180, 300, 600];
const VITESSES: VitesseReveal[] = ['meneur', 'rapide'];
const VITESSE_LABEL: Record<VitesseReveal, string> = {
  meneur: 'Meneur (pas à pas)',
  rapide: 'Rapide (auto)',
};
const MODE_LABEL: Record<Mode, string> = {
  classique: 'Classique (3–8 joueurs)',
  duo: 'Duo coopératif (2 joueurs)',
};

/** Détermine l'intention de join initiale : intent Accueil, ou reconnexion. */
function initialJoinInfo(code: string): JoinInfo | null {
  const intent = takeJoinIntent();
  if (intent) return intent;
  // Reconnexion : place déjà connue pour cette salle.
  if (getStoredPlayerId(code)) {
    return { pseudo: getStoredPseudo() || 'Joueur', couleur: getStoredCouleur() };
  }
  return null;
}

export function Room({ code, navigate }: { code: string; navigate: (path: string) => void }) {
  const [joinInfo, setJoinInfo] = useState<JoinInfo | null>(() => initialJoinInfo(code));

  if (!joinInfo) {
    return <JoinGate code={code} navigate={navigate} onJoin={setJoinInfo} />;
  }
  return <RoomInner code={code} navigate={navigate} joinInfo={joinInfo} />;
}

/** Mini-formulaire quand on arrive par lien direct sans identité. */
function JoinGate({
  code,
  navigate,
  onJoin,
}: {
  code: string;
  navigate: (path: string) => void;
  onJoin: (info: JoinInfo) => void;
}) {
  const [pseudo, setPseudo] = useState(getStoredPseudo);
  const [couleur, setCouleur] = useState<Couleur | undefined>(getStoredCouleur);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (pseudo.trim() === '') {
      setError('Choisis un pseudo pour rejoindre.');
      return;
    }
    rememberIdentity(pseudo.trim(), couleur);
    onJoin({ pseudo: pseudo.trim(), couleur });
  };

  return (
    <main className="screen">
      <div className="panel home-card stack">
        <h1 className="room-code">
          Rejoindre la salle <strong>{code}</strong>
        </h1>
        {error && <Banner kind="error">{error}</Banner>}
        <Input
          id="pseudo-join"
          label="Ton pseudo"
          placeholder="Ex. Sam"
          maxLength={24}
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
        />
        <div className="field">
          <span className="field-label">Ta couleur (facultatif)</span>
          <ColorPicker value={couleur} onChange={setCouleur} />
        </div>
        <Button size="lg" block onClick={submit}>
          Rejoindre →
        </Button>
        <Button variant="ghost" block onClick={() => navigate('/')}>
          ← Retour à l’accueil
        </Button>
      </div>
    </main>
  );
}

function RoomInner({
  code,
  navigate,
  joinInfo,
}: {
  code: string;
  navigate: (path: string) => void;
  joinInfo: JoinInfo;
}) {
  const room = useRoom(code, joinInfo);
  const [copied, setCopied] = useState(false);

  const state = room.roomState;
  const myId = room.playerId;
  const iAmHost = isHost(state, myId);

  const copyLink = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : `/room/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponible : on affiche l'URL brute en repli.
      window.prompt('Copie ce lien :', url);
    }
  };

  const changeSettings = (patch: Partial<RoomSettings>) => {
    if (!state) return;
    room.updateSettings({ ...state.settings, ...patch });
  };

  // --- États transitoires (connexion, phase de jeu) ---
  const connLabel =
    room.connection === 'open'
      ? 'En ligne'
      : room.connection === 'reconnecting'
        ? 'Reconnexion…'
        : room.connection === 'closed'
          ? 'Déconnecté'
          : 'Connexion…';
  const connClass =
    room.connection === 'open'
      ? 'is-open'
      : room.connection === 'reconnecting' || room.connection === 'closed'
        ? 'is-down'
        : '';

  return (
    <main className="screen">
      <div className="room-shell">
        <div className="room-header">
          <span className="room-code">
            Salle <strong>{state?.code ?? code}</strong>
          </span>
          <div className="row">
            <span className={`status-pill ${connClass}`}>{connLabel}</span>
            <Button variant="accent" onClick={copyLink}>
              🔗 Copier le lien
            </Button>
            {copied && <span className="copied-hint">Copié !</span>}
          </div>
        </div>

        {room.lastError && (
          <Banner kind="error">
            {room.lastError.message} <em>({room.lastError.code})</em>
          </Banner>
        )}

        {!state ? (
          <Panel>
            <p>Connexion à la salle…</p>
          </Panel>
        ) : state.phase === 'dealing' ? (
          <Panel className="placeholder-card">
            <div className="placeholder-emoji" aria-hidden="true">
              🎬
            </div>
            <h2>La partie démarre…</h2>
            <p>Distribution des cartes…</p>
          </Panel>
        ) : state.phase === 'forming' ? (
          // Participant → écran Formation (le round courant m'a été (re)synchronisé).
          // Spectateur (rejoint en cours) → aucun round courant : écran d'attente clair.
          room.round && room.round.manche === state.mancheCourante ? (
            <Formation
              round={room.round}
              players={state.players}
              myId={myId}
              submitted={room.submitted}
              onSubmit={room.submitPairs}
            />
          ) : (
            <SpectatorPanel manche={state.mancheCourante} />
          )
        ) : (state.phase === 'reveal' || state.phase === 'scores') && room.reveal ? (
          <Reveal
            reveal={room.reveal}
            players={state.players}
            iAmHost={iAmHost}
            mode={state.settings.vitesseReveal}
            duo={state.settings.mode === 'duo'}
            revealStep={room.revealStep}
            onRevealNext={room.revealNext}
            onAdvance={room.advance}
          />
        ) : state.phase === 'finished' && room.gameOver ? (
          <Victory
            gameOver={room.gameOver}
            players={state.players}
            iAmHost={iAmHost}
            onReturnToLobby={room.returnToLobby}
            navigate={navigate}
          />
        ) : state.phase !== 'lobby' ? (
          // Transition brève (résolution en cours / resync en vol) : pas de blocage.
          <Panel className="placeholder-card">
            <div className="placeholder-emoji" aria-hidden="true">
              ⏳
            </div>
            <h2>Un instant…</h2>
            <p>Synchronisation de la manche en cours.</p>
          </Panel>
        ) : (
          <>
            <div className="room-grid">
              <Panel title={`Joueurs (${state.players.length}/${maxPlayers(state.settings.mode)})`}>
                <ul className="player-list">
                  {state.players.map((p) => (
                    <PlayerBadge
                      key={p.id}
                      player={p}
                      isHost={p.id === state.hostId}
                      isMe={p.id === myId}
                    />
                  ))}
                </ul>
              </Panel>

              <SettingsPanel
                settings={state.settings}
                editable={iAmHost}
                onChange={changeSettings}
              />
            </div>

            {missingPlayers(state) > 0 && (
              <Banner kind="warn">
                Il faut au moins {minPlayers(state.settings.mode)} joueurs pour démarrer (encore{' '}
                {missingPlayers(state)}).
              </Banner>
            )}
            {state.settings.mode === 'duo' && state.players.length > maxPlayers('duo') && (
              <Banner kind="warn">
                Le mode duo se joue à {maxPlayers('duo')} joueurs exactement (actuellement{' '}
                {state.players.length}).
              </Banner>
            )}

            {iAmHost ? (
              <Button
                size="lg"
                block
                onClick={room.startGame}
                disabled={!canStartGame(state, myId)}
              >
                ▶ Lancer la partie
              </Button>
            ) : (
              <Banner kind="info">En attente que l’hôte lance la partie…</Banner>
            )}

            <Button variant="ghost" onClick={() => navigate('/')}>
              ← Quitter
            </Button>
          </>
        )}
      </div>
    </main>
  );
}

/** Écran d'attente du joueur ayant rejoint une partie déjà lancée. */
function SpectatorPanel({ manche }: { manche: number }) {
  return (
    <Panel className="placeholder-card">
      <div className="placeholder-emoji" aria-hidden="true">
        👀
      </div>
      <h2>Partie en cours</h2>
      <p>
        La manche {manche} est déjà lancée. Tu es <strong>spectateur</strong> le temps qu'elle se
        termine, puis tu joueras dès la <strong>manche suivante</strong>.
      </p>
    </Panel>
  );
}

function SettingsPanel({
  settings,
  editable,
  onChange,
}: {
  settings: RoomSettings;
  editable: boolean;
  onChange: (patch: Partial<RoomSettings>) => void;
}) {
  return (
    <Panel className="panel-muted" title={`Réglages ${editable ? '' : '(hôte seul)'}`.trim()}>
      <div className="setting-row">
        <span className="field-label">Mode</span>
        {editable ? (
          <Select
            className="setting-control"
            aria-label="Mode de jeu"
            value={settings.mode}
            onChange={(e) => onChange({ mode: e.target.value as Mode })}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </Select>
        ) : (
          <span className="setting-static">{MODE_LABEL[settings.mode]}</span>
        )}
      </div>

      <div className="setting-row">
        <span className="field-label">Manches</span>
        {editable ? (
          <input
            className="input setting-control"
            type="number"
            min={1}
            max={20}
            aria-label="Nombre de manches"
            value={settings.nbManches}
            onChange={(e) => {
              const n = Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 1)));
              onChange({ nbManches: n });
            }}
          />
        ) : (
          <span className="setting-static">{settings.nbManches}</span>
        )}
      </div>

      <div className="setting-row">
        <span className="field-label">Temps illimité</span>
        {editable ? (
          <label className="setting-control setting-toggle">
            <input
              type="checkbox"
              aria-label="Temps illimité"
              checked={settings.sablierIllimite}
              onChange={(e) => onChange({ sablierIllimite: e.target.checked })}
            />
            <span>{settings.sablierIllimite ? 'Activé (pas de sablier)' : 'Désactivé'}</span>
          </label>
        ) : (
          <span className="setting-static">{settings.sablierIllimite ? 'Oui' : 'Non'}</span>
        )}
      </div>

      <div className="setting-row">
        <span className="field-label">Sablier</span>
        {editable && !settings.sablierIllimite ? (
          <Select
            className="setting-control"
            aria-label="Durée du sablier"
            value={settings.dureeSablier}
            onChange={(e) => onChange({ dureeSablier: Number(e.target.value) })}
          >
            {SABLIER_PRESETS.map((s) => (
              <option key={s} value={s}>
                {s} s
              </option>
            ))}
          </Select>
        ) : (
          <span className="setting-static">
            {settings.sablierIllimite ? '∞ (illimité)' : `${settings.dureeSablier} s`}
          </span>
        )}
      </div>

      <div className="setting-row">
        <span className="field-label">Révélation</span>
        {editable ? (
          <Select
            className="setting-control"
            aria-label="Vitesse de révélation"
            value={settings.vitesseReveal}
            onChange={(e) => onChange({ vitesseReveal: e.target.value as VitesseReveal })}
          >
            {VITESSES.map((v) => (
              <option key={v} value={v}>
                {VITESSE_LABEL[v]}
              </option>
            ))}
          </Select>
        ) : (
          <span className="setting-static">{VITESSE_LABEL[settings.vitesseReveal]}</span>
        )}
      </div>
    </Panel>
  );
}
