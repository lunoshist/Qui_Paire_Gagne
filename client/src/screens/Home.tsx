/**
 * Écran Accueil : saisir un pseudo + couleur, puis créer une partie
 * (`POST /api/rooms`) ou rejoindre par code. L'identité est mémorisée puis
 * transmise à la salle via une « intention de join » (sessionStorage).
 */

import { useState } from 'react';
import type { Couleur } from '@qpg/shared';
import { createRoom } from '../api';
import { Banner, Button, ColorPicker, Input } from '../ui/components';
import { getStoredCouleur, getStoredPseudo, rememberIdentity, setJoinIntent } from '../storage';

export function Home({ navigate }: { navigate: (path: string) => void }) {
  const [pseudo, setPseudo] = useState(getStoredPseudo);
  const [couleur, setCouleur] = useState<Couleur | undefined>(getStoredCouleur);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const goToRoom = (roomCode: string) => {
    rememberIdentity(pseudo.trim(), couleur);
    setJoinIntent({ pseudo: pseudo.trim(), couleur });
    navigate(`/room/${roomCode.toUpperCase()}`);
  };

  const validatePseudo = (): boolean => {
    if (pseudo.trim() === '') {
      setError('Choisis un pseudo pour jouer.');
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    setError(null);
    if (!validatePseudo()) return;
    setBusy(true);
    try {
      const roomCode = await createRoom();
      goToRoom(roomCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible.');
      setBusy(false);
    }
  };

  const handleJoin = () => {
    setError(null);
    if (!validatePseudo()) return;
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(clean)) {
      setError('Le code doit faire 4 lettres.');
      return;
    }
    goToRoom(clean);
  };

  return (
    <main className="screen">
      <header className="stack">
        <h1 className="brand">
          Qui Paire <span className="brand-accent">Gagne</span> 🎴
        </h1>
        <p className="brand-sub">Formez les bonnes paires. Partagez un lien. Jouez !</p>
      </header>

      <div className="panel home-card stack">
        {error && <Banner kind="error">{error}</Banner>}

        <Input
          id="pseudo"
          label="Ton pseudo"
          placeholder="Ex. Alex"
          maxLength={24}
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
        />

        <div className="field">
          <span className="field-label">Ta couleur (facultatif)</span>
          <ColorPicker value={couleur} onChange={setCouleur} />
        </div>

        <Button size="lg" block onClick={handleCreate} disabled={busy}>
          {busy ? 'Création…' : '➕ Créer une partie'}
        </Button>

        <div className="divider">ou</div>

        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            handleJoin();
          }}
        >
          <input
            className="input input-code"
            aria-label="Code de la salle"
            placeholder="CODE"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <Button type="submit" variant="accent">
            Go →
          </Button>
        </form>
      </div>
    </main>
  );
}
