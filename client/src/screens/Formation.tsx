/**
 * Écran Formation (phase `forming`).
 *
 * Affiche les 11 cartes de la manche ; le joueur forme ses 5 paires + sa pomme
 * pourrie via **drag&drop** (dnd-kit : souris, tactile, clavier) ET **tap-to-pair**
 * (taper deux cartes = une paire). Le sablier tourne en LOCAL depuis la deadline
 * (aucun tick serveur). « Valider » envoie un unique `submitPairs` ; une fois
 * l'échéance atteinte, l'arrangement complet est auto-soumis.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Pair, Player } from '@qpg/shared';
import { PAIRS_PER_ROUND } from '@qpg/shared';
import type { RoundInfo } from '../store/roomStore';
import { useCatalog } from '../catalog';
import { Banner, Button } from '../ui/components';
import { CardFace, Countdown, PlayerToken } from '../ui/gameComponents';
import {
  createFormation,
  isComplete,
  pairCards,
  placeCard,
  poolCards,
  pommePourrie,
  slotOf,
  toSubmission,
  unplaceCard,
} from '../game/formation';
import type { FormationState } from '../game/formation';

export function Formation({
  round,
  players,
  myId,
  submitted,
  onSubmit,
}: {
  round: RoundInfo;
  players: Player[];
  myId: string | null;
  submitted: string[];
  onSubmit: (paires: Pair[], pommePourrie: string) => void;
}) {
  const catalog = useCatalog();

  // État de formation, réinitialisé à chaque nouvelle manche (clé = cartes).
  const cardsKey = round.cards.join(',');
  const [formation, setFormation] = useState<FormationState>(() => createFormation(round.cards));
  useEffect(() => {
    setFormation(createFormation(round.cards));
    setSelected(null);
    setSubmittedLocally(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardsKey]);

  const [selected, setSelected] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  const [submittedLocally, setSubmittedLocally] = useState(false);

  const iHaveSubmitted = submittedLocally || (myId != null && submitted.includes(myId));
  const complete = isComplete(formation);
  const pool = poolCards(formation);
  const pp = pommePourrie(formation);

  // --- Sablier LOCAL basé sur la deadline (pas de tick serveur) -----------
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const remainingMs = round.deadline - now;

  const submit = useCallback(() => {
    if (iHaveSubmitted) return;
    const sub = toSubmission(formation);
    if (!sub) return;
    setSubmittedLocally(true);
    onSubmit(sub.paires, sub.pommePourrie);
  }, [formation, iHaveSubmitted, onSubmit]);

  // Auto-soumission à l'échéance si l'arrangement est complet.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const expiredHandled = useRef(false);
  useEffect(() => {
    if (remainingMs > 0) return;
    if (expiredHandled.current) return;
    expiredHandled.current = true;
    submitRef.current();
  }, [remainingMs]);
  useEffect(() => {
    expiredHandled.current = false;
  }, [cardsKey]);

  // --- Interactions tap-to-pair ------------------------------------------
  const onCardTap = useCallback(
    (id: string) => {
      if (iHaveSubmitted) return;
      const inSlot = slotOf(formation, id) !== -1;
      if (inSlot) {
        // Taper une carte placée la renvoie au pool.
        setFormation((f) => unplaceCard(f, id));
        setSelected(null);
        return;
      }
      // Carte au pool : sélection puis appariement.
      setSelected((cur) => {
        if (cur === null) return id;
        if (cur === id) return null;
        setFormation((f) => pairCards(f, cur, id));
        return null;
      });
    },
    [formation, iHaveSubmitted],
  );

  const onSlotTap = useCallback(
    (slotIndex: number) => {
      if (iHaveSubmitted || selected === null) return;
      setFormation((f) => placeCard(f, selected, slotIndex));
      setSelected(null);
    },
    [iHaveSubmitted, selected],
  );

  // --- Drag & drop (dnd-kit) ---------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = useCallback((e: DragStartEvent) => {
    setActiveDrag(String(e.active.id));
    setSelected(null);
  }, []);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDrag(null);
      if (iHaveSubmitted) return;
      const cardId = String(e.active.id);
      const over = e.over?.id;
      if (over == null) return;
      const overId = String(over);
      if (overId === 'pool') {
        setFormation((f) => unplaceCard(f, cardId));
      } else if (overId.startsWith('slot-')) {
        const idx = Number(overId.slice('slot-'.length));
        setFormation((f) => placeCard(f, cardId, idx));
      } else if (overId.startsWith('card-')) {
        const target = overId.slice('card-'.length);
        setFormation((f) => pairCards(f, cardId, target));
      }
    },
    [iHaveSubmitted],
  );

  const finishers = useMemo(
    () =>
      submitted
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => Boolean(p)),
    [submitted, players],
  );

  const connectedCount = players.filter((p) => p.connecte).length;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="game-shell">
        <header className="game-topbar">
          <span className="game-manche">Manche {round.manche}</span>
          <Countdown remainingMs={remainingMs} />
          <span className="finishers" aria-live="polite">
            {finishers.length > 0 ? (
              <>
                <span className="finishers-label">Ont fini :</span>
                {finishers.map((p) => (
                  <PlayerToken key={p.id} player={p} showName={false} />
                ))}
                <span className="finishers-count">
                  {finishers.length}/{connectedCount}
                </span>
              </>
            ) : (
              <span className="finishers-label">En cours…</span>
            )}
          </span>
        </header>

        {iHaveSubmitted ? (
          <Banner kind="info">
            Paires envoyées ! En attente des autres joueurs… ({finishers.length}/{connectedCount}{' '}
            ont fini)
          </Banner>
        ) : remainingMs <= 0 ? (
          <Banner kind="warn">
            Temps écoulé.{' '}
            {complete ? 'Envoi de tes paires…' : 'Arrangement incomplet : 0 point cette manche.'}
          </Banner>
        ) : (
          <Banner kind="info">
            Forme <strong>5 paires</strong> — glisse les cartes ou tape-en deux pour les associer.
            La carte restante devient ta <strong>🍎 pomme pourrie</strong> (vaut double !).
          </Banner>
        )}

        {/* --- Emplacements de paires + pomme pourrie --- */}
        <section className="pairs-area" aria-label="Mes paires">
          {formation.slots.map((slot, i) => (
            <PairSlot
              key={i}
              index={i}
              cards={slot}
              disabled={iHaveSubmitted}
              onTapSlot={() => onSlotTap(i)}
              renderCard={(id) => (
                <PlayableCard
                  key={id}
                  id={id}
                  selected={selected === id}
                  disabled={iHaveSubmitted}
                  droppable={false}
                  onTap={() => onCardTap(id)}
                  catalog={catalog}
                />
              )}
            />
          ))}
          <div className="pomme-slot">
            <span className="slot-label">🍎 Pomme pourrie</span>
            <div className="pomme-drop">
              {pp ? (
                <PlayableCard
                  id={pp}
                  selected={false}
                  disabled
                  droppable={false}
                  onTap={() => undefined}
                  catalog={catalog}
                />
              ) : (
                <span className="slot-empty">carte restante (auto)</span>
              )}
            </div>
          </div>
        </section>

        {/* --- Pool des cartes non placées --- */}
        <PoolArea>
          {pool.length === 0 ? (
            <span className="slot-empty">Toutes les cartes sont placées.</span>
          ) : (
            pool.map((id) => (
              <PlayableCard
                key={id}
                id={id}
                selected={selected === id}
                disabled={iHaveSubmitted}
                droppable
                onTap={() => onCardTap(id)}
                catalog={catalog}
              />
            ))
          )}
        </PoolArea>

        <div className="game-actions">
          <Button size="lg" block onClick={submit} disabled={iHaveSubmitted || !complete}>
            {iHaveSubmitted
              ? '✓ Paires envoyées'
              : complete
                ? '✓ Valider mes paires'
                : `Forme les ${PAIRS_PER_ROUND} paires…`}
          </Button>
        </div>
      </div>

      <DragOverlay>
        {activeDrag ? <CardFace id={activeDrag} catalog={catalog} size="md" /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Emplacement de paire (droppable), avec ses 0-2 cartes. */
function PairSlot({
  index,
  cards,
  disabled,
  onTapSlot,
  renderCard,
}: {
  index: number;
  cards: readonly string[];
  disabled: boolean;
  onTapSlot: () => void;
  renderCard: (id: string) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}`, disabled });
  return (
    <div
      ref={setNodeRef}
      className={`pair-slot ${isOver ? 'is-over' : ''} ${cards.length === 2 ? 'is-full' : ''}`.trim()}
      onClick={onTapSlot}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Emplacement paire ${index + 1}`}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onTapSlot();
        }
      }}
    >
      <span className="slot-index">{index + 1}</span>
      <div className="slot-cards">
        {cards.map((id) => renderCard(id))}
        {Array.from({ length: 2 - cards.length }).map((_, k) => (
          <span key={`empty-${k}`} className="slot-hole" aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}

/** Zone pool (droppable) où retombent les cartes non placées. */
function PoolArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' });
  return (
    <section
      ref={setNodeRef}
      className={`pool-area ${isOver ? 'is-over' : ''}`.trim()}
      aria-label="Cartes à apparier"
    >
      {children}
    </section>
  );
}

/** Carte jouable : draggable (+ droppable si au pool) + tap-to-pair. */
function PlayableCard({
  id,
  selected,
  disabled,
  droppable,
  onTap,
  catalog,
}: {
  id: string;
  selected: boolean;
  disabled: boolean;
  droppable: boolean;
  onTap: () => void;
  catalog: ReturnType<typeof useCatalog>;
}) {
  const drag = useDraggable({ id, disabled });
  const drop = useDroppable({ id: `card-${id}`, disabled: disabled || !droppable });

  const setRef = (node: HTMLElement | null) => {
    drag.setNodeRef(node);
    if (droppable) drop.setNodeRef(node);
  };

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(drag.transform),
    opacity: drag.isDragging ? 0.4 : 1,
    touchAction: 'none',
  };

  return (
    <button
      ref={setRef}
      type="button"
      className={`playable-card ${selected ? 'is-selected' : ''} ${drop.isOver ? 'is-pair-target' : ''}`.trim()}
      style={style}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
      {...drag.listeners}
      {...drag.attributes}
      aria-pressed={selected}
    >
      <CardFace id={id} catalog={catalog} size="md" />
    </button>
  );
}
