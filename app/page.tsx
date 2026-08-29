'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Activity,
  Backpack,
  ChevronDown,
  Dumbbell,
  Heart,
  HomeIcon,
  LockKeyhole,
  Map,
  Minus,
  PackageOpen,
  Play,
  Plus,
  Shield,
  SkipForward,
  Skull,
  Star,
  Swords,
  Trophy,
  X,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  SAVE_KEY,
  STAT_TRAINING_PER_POINT,
  advanceCombatEvent,
  advanceTraining,
  allocateStatPoint,
  availableStatPoints,
  bankRun,
  continueRun,
  equipRunItem,
  floorDefinition,
  floorPreviewForState,
  formatRange,
  initialGameState,
  loadGame,
  lootValue,
  playerStats,
  playerDamageRange,
  resetCombat,
  resetRun,
  returnStatPoint,
  runIsActive,
  saveableState,
  skipCombat,
  startRun,
  statXpNeeded,
  xpNeeded,
  type FloorDefinition,
  type GameState,
  type LootStack,
  type StatKind,
} from '@/lib/game';

type Page = 'training' | 'dungeon';

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
  | { type: 'select-floor'; floor: number }
  | { type: 'start-run'; seed: string }
  | { type: 'combat-event' }
  | { type: 'skip-combat' }
  | { type: 'continue-run' }
  | { type: 'bank-run' }
  | { type: 'equip-run-item'; itemId: string }
  | { type: 'reset-run' };

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
    case 'select-floor': {
      if (runIsActive(state)) return state;
      return resetCombat({
        ...state,
        selectedFloor: Math.max(1, Math.min(state.highestFloor, action.floor)),
      });
    }
    case 'start-run':
      return startRun(state, action.seed);
    case 'combat-event':
      return advanceCombatEvent(state);
    case 'skip-combat':
      return skipCombat(state);
    case 'continue-run':
      return continueRun(state);
    case 'bank-run':
      return bankRun(state);
    case 'equip-run-item':
      return equipRunItem(state, action.itemId);
    case 'reset-run':
      return resetRun(state);
  }
}

function StatCard({
  kind,
  state,
  dispatch,
}: {
  kind: StatKind;
  state: GameState;
  dispatch: React.Dispatch<Action>;
}) {
  const isAttack = kind === 'attack';
  const points = isAttack ? state.attackPoints : state.healthPoints;
  const level = isAttack ? state.attackLevel : state.healthLevel;
  const progress = isAttack ? state.attackProgress : state.healthProgress;
  const required = statXpNeeded(level);
  const derived = playerStats(state);
  const Icon = isAttack ? Swords : Heart;

  return (
    <Card className={`training-stat ${isAttack ? 'attack-stat' : 'hp-stat'}`}>
      <CardHeader>
        <div className="stat-title-row">
          <div className="stat-icon">
            <Icon aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">
              {isAttack ? 'Attack training' : 'Health training'}
            </p>
            <CardTitle>
              {isAttack ? 'Strike harder' : 'Endure longer'}
            </CardTitle>
          </div>
          <div className="stat-level">
            <span>LV.</span>
            {level}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="stat-metric-row">
          <div>
            <span>{isAttack ? 'Damage' : 'Max health'}</span>
            <strong>
              {isAttack
                ? `${derived.minDamage}–${derived.maxDamage}`
                : derived.maxHp}
            </strong>
          </div>
          <div className="rate">
            <span>Training speed</span>
            <strong>
              {points * STAT_TRAINING_PER_POINT}
              <small> / SEC</small>
            </strong>
          </div>
        </div>
        <div className="progress-copy stat-progress-copy">
          <span>Next level</span>
          <strong>
            {Math.floor(progress)} / {required}
          </strong>
        </div>
        <GameProgress
          label={`${isAttack ? 'Attack' : 'Health'} progress to level ${level + 1}`}
          value={(progress / required) * 100}
        />
        <div className="point-allocation-row">
          <div className="assigned-points">
            <span>Assigned</span>
            <strong>{points}</strong>
            <small>{points === 0 ? 'Paused' : 'Training'}</small>
          </div>
          <div className="point-controls">
            <button
              type="button"
              className="point-button return-point"
              aria-label={`Remove one ${kind} point`}
              disabled={points === 0}
              onClick={() => dispatch({ type: 'return-point', kind })}
            >
              <Minus aria-hidden="true" />
            </button>
            <button
              type="button"
              className="point-button allocate-point"
              aria-label={`Add one ${kind} point`}
              disabled={availableStatPoints(state) === 0}
              onClick={() => dispatch({ type: 'allocate-point', kind })}
            >
              <Plus aria-hidden="true" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrainingScreen({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<Action>;
}) {
  const stats = playerStats(state);
  const requiredXp = xpNeeded(state.playerLevel);
  const available = availableStatPoints(state);
  const active = runIsActive(state);

  return (
    <div className="screen training-screen">
      <header className="game-header">
        <div>
          <p className="eyebrow">Training grounds</p>
          <h1>IRONBOUND</h1>
        </div>
        <div className="rank-mark" aria-label="Rank: Initiate">
          <Shield aria-hidden="true" />
          <span>INITIATE</span>
        </div>
      </header>
      <section className="player-summary" aria-labelledby="player-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Player</p>
            <h2 id="player-heading">The Wanderer</h2>
          </div>
        </div>
        <div className="summary-grid">
          <div>
            <Swords aria-hidden="true" />
            <span>ATK LV {state.attackLevel}</span>
            <strong>
              {stats.minDamage}–{stats.maxDamage}
            </strong>
          </div>
          <div>
            <Heart aria-hidden="true" />
            <span>HP LV {state.healthLevel}</span>
            <strong>{stats.maxHp}</strong>
          </div>
          <div>
            <Activity aria-hidden="true" />
            <span>DEEPEST FLOOR</span>
            <strong>{Math.max(1, state.highestFloor - 1)}</strong>
          </div>
        </div>
      </section>
      {active && (
        <div className="training-paused">
          <Activity aria-hidden="true" />
          <span>Training paused while your dungeon run is active.</span>
        </div>
      )}
      <Card className="level-card">
        <CardHeader>
          <div className="level-heading">
            <div className="level-emblem">
              <Star aria-hidden="true" />
            </div>
            <div>
              <p className="eyebrow">Player level</p>
              <CardTitle>Every level grants one stat point</CardTitle>
            </div>
            <div className="level-number">
              <span>LV.</span>
              {state.playerLevel}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="level-progress-copy">
            <span>Next stat point</span>
            <strong>
              {Math.floor(state.playerXp)} / {requiredXp} XP
            </strong>
          </div>
          <GameProgress
            label="Player level progress"
            value={(state.playerXp / requiredXp) * 100}
          />
          <div className={`point-pool ${available > 0 ? 'has-points' : ''}`}>
            <span>Available points</span>
            <strong>{available}</strong>
            <small>
              {available > 0 ? 'Allocate below' : 'Level up for another'}
            </small>
          </div>
        </CardContent>
      </Card>
      <div className="allocation-intro">
        <div>
          <p className="eyebrow">Stat allocation</p>
          <h2>Build your fighter</h2>
        </div>
        <span>Free respec</span>
      </div>
      <StatCard kind="attack" state={state} dispatch={dispatch} />
      <StatCard kind="health" state={state} dispatch={dispatch} />
      <p className="training-note">
        <PackageOpen aria-hidden="true" /> Banked loot:{' '}
        {state.inventory.reduce((sum, item) => sum + item.quantity, 0)} items ·{' '}
        {lootValue(state.inventory)} known value
      </p>
    </div>
  );
}

function Fighter({
  side,
  name,
  title,
  hp,
  maxHp,
  damage,
  hit,
}: {
  side: 'enemy' | 'player';
  name: string;
  title: string;
  hp: number;
  maxHp: number;
  damage: string;
  hit: number | null;
}) {
  const isEnemy = side === 'enemy';
  const Icon = isEnemy ? Skull : Shield;
  return (
    <section
      className={`fighter ${side}-fighter`}
      aria-label={`${name}, ${hp} of ${maxHp} health`}
    >
      <div className="fighter-info">
        <div>
          <p className="eyebrow">{side}</p>
          <h2>{name}</h2>
          <span>{title}</span>
        </div>
        <div className="fighter-damage">
          <span>DMG</span>
          <strong>{damage}</strong>
        </div>
      </div>
      <div className="fighter-stage">
        <div className="sigil">
          <span />
          <Icon aria-hidden="true" />
        </div>
        {hit !== null && (
          <output
            key={`${hit}-${hp}`}
            className={`damage-number ${isEnemy ? 'damage-up' : 'damage-down'}`}
          >
            −{hit}
          </output>
        )}
      </div>
      <div className="hp-copy">
        <span>HP</span>
        <strong>
          {hp} / {maxHp}
        </strong>
      </div>
      <GameProgress
        className="combat-health"
        label={`${name} health`}
        value={maxHp === 0 ? 0 : (hp / maxHp) * 100}
      />
    </section>
  );
}

function FloorIntel({
  floor,
  nextFloor,
  playerDamage,
  armor,
}: {
  floor: FloorDefinition;
  nextFloor: boolean;
  playerDamage: { min: number; max: number };
  armor: number;
}) {
  const enemy = floor.encounter;
  const effectiveDamage = {
    min: Math.max(0, enemy.damage.min - armor),
    max: Math.max(0, enemy.damage.max - armor),
  };
  return (
    <Card className="floor-intel">
      <CardHeader>
        <div className="floor-intel-heading">
          <div>
            <p className="eyebrow">
              {nextFloor ? 'Next floor' : `Floor ${floor.floor}`}
            </p>
            <CardTitle>{floor.name}</CardTitle>
          </div>
          <span>Full intel</span>
        </div>
        <p className="floor-description">{floor.description}</p>
        <div className="combat-facts">
          <div>
            <span>Enemies</span>
            <strong>{formatRange(enemy.count)}</strong>
          </div>
          <div>
            <span>HP each</span>
            <strong>{formatRange(enemy.hp)}</strong>
          </div>
          <div>
            <span>Raw damage</span>
            <strong>{formatRange(enemy.damage)}</strong>
          </div>
          <div>
            <span>After armor</span>
            <strong>{formatRange(effectiveDamage)}</strong>
          </div>
          <div>
            <span>Your damage</span>
            <strong>{formatRange(playerDamage)}</strong>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <section className="intel-section" aria-labelledby="mob-list-heading">
          <div className="intel-section-heading">
            <Map aria-hidden="true" />
            <h3 id="mob-list-heading">Encounter</h3>
            <small>{enemy.role}</small>
          </div>
          <div className="encounter-copy">
            <strong>{enemy.name}</strong>
            <small>{enemy.title}</small>
          </div>
          <ul className="rule-list">
            {enemy.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
        <section
          className="intel-section loot-section"
          aria-labelledby="loot-table-heading"
        >
          <div className="intel-section-heading">
            <PackageOpen aria-hidden="true" />
            <h3 id="loot-table-heading">Loot table</h3>
            <small>Per victory</small>
          </div>
          <ul className="loot-list">
            {floor.lootTable.map((loot) => (
              <li key={loot.id}>
                <span className={`loot-rarity ${loot.rarity.toLowerCase()}`} />
                <strong>{loot.name}</strong>
                <small>
                  {formatRange(loot.quantity)} · {loot.rarity}
                </small>
                <b>{loot.dropChance}%</b>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}

function LootList({ entries, empty }: { entries: LootStack[]; empty: string }) {
  if (entries.length === 0) return <p className="empty-bag">{empty}</p>;
  return (
    <ul className="bag-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className={`loot-rarity ${entry.rarity.toLowerCase()}`} />
          <div>
            <strong>{entry.name}</strong>
            <small>
              {entry.rarity} · {entry.knownValue} each
            </small>
          </div>
          <b>×{entry.quantity}</b>
        </li>
      ))}
    </ul>
  );
}

function BagCard({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<Action>;
}) {
  const lost = state.run.status === 'dead';
  const hasAxe = state.run.bag.some((item) => item.id === 'rusted-war-axe');
  const axeEquipped = state.run.equippedItemId === 'rusted-war-axe';
  const stableDamage = playerStats(state);
  return (
    <Card className={`bag-card ${lost ? 'bag-lost' : ''}`}>
      <CardHeader>
        <div className="bag-heading">
          <div>
            <Backpack aria-hidden="true" />
            <span>
              <p className="eyebrow">At risk</p>
              <CardTitle>{lost ? 'The bag was lost' : 'Run bag'}</CardTitle>
            </span>
          </div>
          <strong>{lootValue(state.run.bag)} value</strong>
        </div>
      </CardHeader>
      <CardContent>
        <LootList
          entries={state.run.bag}
          empty={lost ? 'Nothing survived the descent.' : 'The bag is empty.'}
        />
        {hasAxe && state.run.status === 'decision' ? (
          <div className="run-gear-choice">
            <div>
              <strong>Rusted War Axe</strong>
              <small>
                Current {stableDamage.minDamage}–{stableDamage.maxDamage} → axe
                2–24 damage
              </small>
            </div>
            <button
              type="button"
              disabled={axeEquipped}
              onClick={() =>
                dispatch({ type: 'equip-run-item', itemId: 'rusted-war-axe' })
              }
            >
              {axeEquipped ? 'EQUIPPED' : 'EQUIP UNBANKED'}
            </button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DungeonControls({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<Action>;
}) {
  const status = state.run.status;
  if (status === 'fighting')
    return (
      <div className="combat-controls">
        <button
          type="button"
          className="secondary-combat-button"
          onClick={() => dispatch({ type: 'skip-combat' })}
        >
          <SkipForward aria-hidden="true" />
          SKIP COMBAT
        </button>
      </div>
    );
  if (status === 'decision')
    return (
      <section className="decision-panel" aria-label="Choose what happens next">
        <div className="decision-copy">
          <span>Floor {state.run.floor} cleared</span>
          <strong>
            {state.run.playerHp} HP remains · {lootValue(state.run.bag)} value
            at risk
          </strong>
        </div>
        <div className="decision-actions">
          <button
            type="button"
            className="return-home-button"
            onClick={() => dispatch({ type: 'bank-run' })}
          >
            <HomeIcon aria-hidden="true" />
            VEND HJEM
          </button>
          <button
            type="button"
            className="combat-button"
            onClick={() => dispatch({ type: 'continue-run' })}
          >
            <ChevronDown aria-hidden="true" />
            NÆSTE ETAGE
          </button>
        </div>
      </section>
    );
  if (status === 'dead')
    return (
      <div className="combat-controls">
        <div className="result-banner defeat">
          <Skull aria-hidden="true" />
          <span>Defeated</span>
          <strong>Unbanked loot lost</strong>
        </div>
        <button
          type="button"
          className="combat-button"
          onClick={() => dispatch({ type: 'reset-run' })}
        >
          TILBAGE TIL LEJREN
        </button>
      </div>
    );
  if (status === 'returned')
    return (
      <div className="combat-controls">
        <div className="result-banner victory">
          <Trophy aria-hidden="true" />
          <span>Loot secured</span>
          <strong>Permanent</strong>
        </div>
        <button
          type="button"
          className="combat-button"
          onClick={() => dispatch({ type: 'reset-run' })}
        >
          AFSLUT RUN
        </button>
      </div>
    );
  return (
    <div className="combat-controls">
      <button
        type="button"
        className="combat-button"
        onClick={() =>
          dispatch({ type: 'start-run', seed: crypto.randomUUID() })
        }
      >
        <Play aria-hidden="true" />
        START RUN · FLOOR 1
      </button>
    </div>
  );
}

function DungeonScreen({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<Action>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const floor = floorPreviewForState(state);
  const player = playerStats(state);
  const damage = playerDamageRange(state);
  const fighting = state.run.status === 'fighting';
  const active = runIsActive(state);
  const showBag =
    fighting || state.run.status === 'decision' || state.run.status === 'dead';
  const visibleFloors = useMemo(
    () =>
      Array.from({ length: Math.max(6, state.highestFloor + 1) }, (_, index) =>
        floorDefinition(index + 1),
      ),
    [state.highestFloor],
  );
  const combatFloor =
    state.run.status === 'fighting' ||
    state.run.status === 'decision' ||
    state.run.status === 'dead'
      ? state.run.floor
      : floor.floor;
  const enemyDamage = floorDefinition(combatFloor).encounter.damage;

  return (
    <div className="screen dungeon-screen">
      <header className="dungeon-header">
        <div>
          <p className="eyebrow">The descent</p>
          <h1>DUNGEON</h1>
        </div>
        <button
          className="floor-badge"
          type="button"
          disabled={active}
          onClick={() => setPickerOpen(true)}
        >
          <span>FLOOR</span>
          <strong>{floor.floor}</strong>
          <ChevronDown aria-hidden="true" />
        </button>
      </header>
      <FloorIntel
        floor={floor}
        nextFloor={state.run.status === 'decision'}
        playerDamage={damage}
        armor={player.armor}
      />
      {showBag ? <BagCard state={state} dispatch={dispatch} /> : null}
      <Card className="combat-card">
        <CardContent>
          <Fighter
            side="enemy"
            name={state.combat.enemyName}
            title={`${state.combat.enemyCount}× ${state.combat.enemyTitle}`}
            hp={state.combat.enemyHp}
            maxHp={state.combat.enemyMaxHp}
            damage={formatRange(enemyDamage)}
            hit={state.combat.lastPlayerDamage}
          />
          <div
            className={`battlefield ${fighting ? 'battlefield-active' : ''}`}
            aria-hidden="true"
          >
            <span className="battle-line" />
            <Swords />
            <span className="battle-state">
              {fighting ? 'CLASHING' : state.combat.status.toUpperCase()}
            </span>
          </div>
          <Fighter
            side="player"
            name="The Wanderer"
            title={`Player ${state.playerLevel} · ATK LV ${state.attackLevel}`}
            hp={state.combat.playerHp}
            maxHp={player.maxHp}
            damage={formatRange(damage)}
            hit={state.combat.lastEnemyDamage}
          />
        </CardContent>
      </Card>
      <DungeonControls state={state} dispatch={dispatch} />
      <details className="combat-log">
        <summary>
          Combat log <ChevronDown aria-hidden="true" />
        </summary>
        <ol>
          {state.combat.log.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ol>
      </details>
      {pickerOpen && (
        <dialog
          open
          className="floor-picker-dialog"
          aria-labelledby="floor-picker-title"
          onCancel={() => setPickerOpen(false)}
        >
          <section className="floor-picker">
            <header>
              <div>
                <p className="eyebrow">Dungeon map</p>
                <h2 id="floor-picker-title">Browse floor intel</h2>
              </div>
              <button
                type="button"
                aria-label="Close floor selector"
                onClick={() => setPickerOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="floor-picker-list">
              {visibleFloors.map((option) => {
                const unlocked = option.floor <= state.highestFloor;
                const selected = option.floor === state.selectedFloor;
                return (
                  <button
                    key={option.floor}
                    type="button"
                    className={`floor-option ${selected ? 'selected' : ''}`}
                    disabled={!unlocked}
                    onClick={() => {
                      dispatch({ type: 'select-floor', floor: option.floor });
                      setPickerOpen(false);
                    }}
                  >
                    <span className="floor-option-number">
                      {unlocked ? (
                        option.floor
                      ) : (
                        <LockKeyhole aria-hidden="true" />
                      )}
                    </span>
                    <span className="floor-option-copy">
                      <strong>{option.name}</strong>
                      <small>
                        {unlocked
                          ? `${formatRange(option.encounter.count)} ${option.encounter.name} · ${option.lootTable.length} drops`
                          : 'Locked'}
                      </small>
                    </span>
                    {selected && (
                      <span className="floor-option-status">Selected</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </dialog>
      )}
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
      dispatch({
        type: 'hydrate',
        state: loadGame(window.localStorage.getItem(SAVE_KEY)),
      });
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

  return (
    <main className={`game-shell ${page === 'dungeon' ? 'dungeon-mode' : ''}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="game-content">
        {page === 'training' ? (
          <TrainingScreen state={state} dispatch={dispatch} />
        ) : (
          <DungeonScreen state={state} dispatch={dispatch} />
        )}
      </div>
      <nav className="bottom-nav" aria-label="Primary navigation">
        <button
          className={`nav-item ${page === 'training' ? 'active' : ''}`}
          type="button"
          aria-current={page === 'training' ? 'page' : undefined}
          onClick={() => setPage('training')}
        >
          <Dumbbell aria-hidden="true" />
          <span>Training</span>
        </button>
        <button
          className={`nav-item ${page === 'dungeon' ? 'active' : ''}`}
          type="button"
          aria-current={page === 'dungeon' ? 'page' : undefined}
          onClick={() => setPage('dungeon')}
        >
          <Swords aria-hidden="true" />
          <span>Dungeon</span>
        </button>
      </nav>
    </main>
  );
}
