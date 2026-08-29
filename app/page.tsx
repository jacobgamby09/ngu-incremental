'use client';

import { useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import { Dumbbell, Minus, Plus, RotateCcw, Skull, Swords } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import {
  SAVE_KEY,
  advanceCombatEvent,
  advanceTraining,
  allocateStatPoint,
  availableStatPoints,
  formatRange,
  initialGameState,
  loadGame,
  returnStatPoint,
  saveableState,
  startRun,
  statXpNeeded,
  type GameState,
  type IntegerRange,
  type StatKind,
} from '@/lib/game';

type Page = 'training' | 'combat';

function GameProgress({
  value,
  label,
  className = '',
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <progress
      className={`game-progress ${className}`}
      aria-label={label}
      max={100}
      value={Math.max(0, Math.min(100, value))}
    />
  );
}

type Action =
  | { type: 'hydrate'; state: GameState }
  | { type: 'train'; seconds: number }
  | { type: 'allocate-point'; kind: StatKind }
  | { type: 'return-point'; kind: StatKind }
  | { type: 'start-run'; seed: string }
  | { type: 'combat-event' };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'train':
      return advanceTraining(state, action.seconds);
    case 'allocate-point':
      return allocateStatPoint(state, action.kind);
    case 'return-point':
      return returnStatPoint(state, action.kind);
    case 'start-run':
      return startRun(state, action.seed);
    case 'combat-event':
      return advanceCombatEvent(state);
  }
}

function StatCard({
  kind,
  state,
  dispatch,
}: {
  kind: StatKind;
  state: GameState;
  dispatch: Dispatch<Action>;
}) {
  const isAttack = kind === 'attack';
  const label = isAttack ? 'ATK' : 'HP';
  const points = isAttack ? state.attackPoints : state.healthPoints;
  const level = isAttack ? state.attackLevel : state.healthLevel;
  const progress = isAttack ? state.attackProgress : state.healthProgress;
  const required = statXpNeeded(level);

  return (
    <Card className={`training-stat ${isAttack ? 'attack-stat' : 'hp-stat'}`}>
      <CardContent>
        <div className="compact-stat-heading">
          <div className="compact-stat-title">
            <strong>{label}</strong>
            <span>Level {level}</span>
          </div>
          <div className="point-controls">
            <button
              type="button"
              className="point-button return-point"
              aria-label={`Remove one ${label} skill point`}
              disabled={points === 0}
              onClick={() => dispatch({ type: 'return-point', kind })}
            >
              <Minus aria-hidden="true" />
            </button>
            <button
              type="button"
              className="point-button allocate-point"
              aria-label={`Add one ${label} skill point`}
              disabled={availableStatPoints(state) === 0}
              onClick={() => dispatch({ type: 'allocate-point', kind })}
            >
              <Plus aria-hidden="true" />
            </button>
          </div>
        </div>
        <GameProgress
          label={`${label} progress to level ${level + 1}`}
          value={(progress / required) * 100}
        />
      </CardContent>
    </Card>
  );
}

function TrainingScreen({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: Dispatch<Action>;
}) {
  const available = availableStatPoints(state);

  return (
    <div className="screen training-screen">
      <header className="training-overview" aria-label="Player progress">
        <div>
          <span>Player level</span>
          <strong>{state.playerLevel}</strong>
        </div>
        <div>
          <span>Deepest floor</span>
          <strong>{state.highestFloor}</strong>
        </div>
      </header>
      <div className={`unspent-points ${available > 0 ? 'has-points' : ''}`}>
        <span>Unspent skill points</span>
        <strong>{available}</strong>
      </div>
      <section className="compact-stat-list" aria-label="Attributes">
        <StatCard kind="attack" state={state} dispatch={dispatch} />
        <StatCard kind="health" state={state} dispatch={dispatch} />
      </section>
    </div>
  );
}

function CombatantPanel({
  side,
  label,
  name,
  hp,
  maxHp,
  damage,
  hit,
}: {
  side: 'enemy' | 'player';
  label: string;
  name: string;
  hp: number;
  maxHp: number;
  damage: IntegerRange;
  hit: number | null;
}) {
  return (
    <section
      className={`combatant-panel ${side}`}
      aria-label={`${name}, ${hp} of ${maxHp} HP, ${formatRange(damage)} ATK`}
    >
      <div className="combatant-heading">
        <div>
          <span>{label}</span>
          <h2>{name}</h2>
        </div>
        <div className="attack-range">
          <span>ATK</span>
          <strong>{formatRange(damage)}</strong>
        </div>
      </div>
      <div className="combat-hp-copy">
        <span>HP</span>
        <strong>
          {hp} / {maxHp}
        </strong>
      </div>
      <GameProgress
        className="combat-health"
        label={`${name} HP`}
        value={maxHp === 0 ? 0 : (hp / maxHp) * 100}
      />
      {hit !== null ? (
        <output key={`${hit}-${hp}`} className="combat-hit">
          −{hit}
        </output>
      ) : null}
    </section>
  );
}

function RunResults({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: Dispatch<Action>;
}) {
  return (
    <section className="run-results" aria-labelledby="run-result-title">
      <div className="result-icon">
        <Skull aria-hidden="true" />
      </div>
      <p>Run complete</p>
      <h1 id="run-result-title">Defeated</h1>
      <div className="result-stats">
        <div>
          <span>Floor reached</span>
          <strong>{state.run.floor}</strong>
        </div>
        <div>
          <span>XP gained</span>
          <strong>+{state.run.xpGained}</strong>
        </div>
      </div>
      <div className="level-result">
        <span>Player level</span>
        <strong>
          {state.run.startingPlayerLevel} → {state.playerLevel}
        </strong>
        {state.run.levelsGained > 0 ? (
          <small>
            +{state.run.levelsGained} level
            {state.run.levelsGained === 1 ? '' : 's'} · +
            {state.run.levelsGained} skill point
            {state.run.levelsGained === 1 ? '' : 's'}
          </small>
        ) : (
          <small>No new skill points this run</small>
        )}
      </div>
      <button
        type="button"
        className="new-run-button"
        onClick={() =>
          dispatch({ type: 'start-run', seed: crypto.randomUUID() })
        }
      >
        <RotateCcw aria-hidden="true" />
        Start new run
      </button>
    </section>
  );
}

function CombatScreen({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: Dispatch<Action>;
}) {
  if (state.run.status === 'results') {
    return <RunResults state={state} dispatch={dispatch} />;
  }

  return (
    <div className="screen combat-screen">
      <header className="floor-heading">
        <span>Floor</span>
        <strong>{state.run.floor}</strong>
      </header>
      <div className="combat-stack">
        <CombatantPanel
          side="enemy"
          label="Enemy"
          name={state.combat.enemyName}
          hp={state.combat.enemyHp}
          maxHp={state.combat.enemyMaxHp}
          damage={state.combat.enemyDamage}
          hit={state.combat.lastPlayerDamage}
        />
        <div className="combat-arena" aria-hidden="true">
          <span />
          <Swords />
          <small>Fighting</small>
          <span />
        </div>
        <CombatantPanel
          side="player"
          label="Player"
          name="The Wanderer"
          hp={state.combat.playerHp}
          maxHp={state.combat.playerMaxHp}
          damage={state.combat.playerDamage}
          hit={state.combat.lastEnemyDamage}
        />
      </div>
    </div>
  );
}

export default function Home() {
  const [page, setPage] = useState<Page>('training');
  const [state, dispatch] = useReducer(reducer, initialGameState);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    queueMicrotask(() => {
      const loaded = loadGame(window.localStorage.getItem(SAVE_KEY));
      dispatch({
        type: 'hydrate',
        state: loaded,
      });
      if (loaded.run.status !== 'idle') setPage('combat');
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!hydrated) return;
    const persist = () =>
      window.localStorage.setItem(
        SAVE_KEY,
        JSON.stringify(saveableState(stateRef.current)),
      );
    const interval = window.setInterval(persist, 1000);
    window.addEventListener('pagehide', persist);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', persist);
      persist();
    };
  }, [hydrated]);

  useEffect(() => {
    let previous = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      dispatch({ type: 'train', seconds: (now - previous) / 1000 });
      previous = now;
    }, 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (state.run.status !== 'fighting') return;
    const interval = window.setInterval(
      () => dispatch({ type: 'combat-event' }),
      520,
    );
    return () => window.clearInterval(interval);
  }, [state.run.status]);

  const enterCombat = () => {
    if (page === 'combat') return;
    if (state.run.status !== 'fighting') {
      dispatch({ type: 'start-run', seed: crypto.randomUUID() });
    }
    setPage('combat');
  };

  return (
    <main className={`game-shell ${page === 'combat' ? 'combat-mode' : ''}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="game-content">
        {page === 'training' ? (
          <TrainingScreen state={state} dispatch={dispatch} />
        ) : (
          <CombatScreen state={state} dispatch={dispatch} />
        )}
      </div>
      <nav className="bottom-nav" aria-label="Primary navigation">
        <button
          className={`nav-item ${page === 'training' ? 'active' : ''}`}
          type="button"
          disabled={state.run.status === 'fighting'}
          aria-current={page === 'training' ? 'page' : undefined}
          onClick={() => setPage('training')}
        >
          <Dumbbell aria-hidden="true" />
          <span>Training</span>
        </button>
        <button
          className={`nav-item ${page === 'combat' ? 'active' : ''}`}
          type="button"
          aria-current={page === 'combat' ? 'page' : undefined}
          onClick={enterCombat}
        >
          <Swords aria-hidden="true" />
          <span>Dungeon</span>
        </button>
      </nav>
    </main>
  );
}
