'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  Dumbbell,
  Heart,
  LockKeyhole,
  Map,
  Minus,
  PackageOpen,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Skull,
  Star,
  Square,
  Swords,
  Trophy,
  X,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  SAVE_KEY,
  STAT_TRAINING_PER_POINT,
  advanceTraining,
  allocateStatPoint,
  availableStatPoints,
  enemyForFloor,
  floorDefinition,
  initialGameState,
  loadGame,
  playerStats,
  randomDamage,
  resetCombat,
  returnStatPoint,
  resolveCombatTick,
  saveableState,
  startCombat,
  statXpNeeded,
  xpNeeded,
  type FloorDefinition,
  type GameState,
  type StatKind,
} from '@/lib/game';

type Page = 'training' | 'dungeon';

function GameProgress({ value, label, className = '' }: { value: number; label: string; className?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return <progress className={`game-progress ${className}`} aria-label={label} max={100} value={safeValue} />;
}

type Action =
  | { type: 'hydrate'; state: GameState }
  | { type: 'train'; seconds: number }
  | { type: 'allocate-point'; kind: StatKind }
  | { type: 'return-point'; kind: StatKind }
  | { type: 'select-floor'; floor: number }
  | { type: 'start-combat' }
  | { type: 'combat-tick'; playerDamage: number; enemyDamage: number }
  | { type: 'reset-combat' };

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
      if (state.combat.status === 'fighting') return state;
      const selectedFloor = Math.max(1, Math.min(state.highestFloor, action.floor));
      return resetCombat({ ...state, selectedFloor });
    }
    case 'start-combat':
      return startCombat(state);
    case 'combat-tick':
      return resolveCombatTick(state, action.playerDamage, action.enemyDamage);
    case 'reset-combat':
      return resetCombat(state);
  }
}

function StatCard({ kind, state, dispatch }: { kind: StatKind; state: GameState; dispatch: React.Dispatch<Action> }) {
  const isAttack = kind === 'attack';
  const points = isAttack ? state.attackPoints : state.healthPoints;
  const available = availableStatPoints(state);
  const level = isAttack ? state.attackLevel : state.healthLevel;
  const progress = isAttack ? state.attackProgress : state.healthProgress;
  const required = statXpNeeded(level);
  const derived = playerStats(state);
  const Icon = isAttack ? Swords : Heart;

  return (
    <Card className={`training-stat ${isAttack ? 'attack-stat' : 'hp-stat'}`}>
      <CardHeader>
        <div className="stat-title-row">
          <div className="stat-icon"><Icon aria-hidden="true" /></div>
          <div><p className="eyebrow">{isAttack ? 'Attack training' : 'Health training'}</p><CardTitle>{isAttack ? 'Strike harder' : 'Endure longer'}</CardTitle></div>
          <div className="stat-level"><span>LV.</span>{level}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="stat-metric-row">
          <div><span>{isAttack ? 'Damage' : 'Max health'}</span><strong>{isAttack ? `${derived.minDamage}–${derived.maxDamage}` : derived.maxHp}</strong></div>
          <div className="rate"><span>Training speed</span><strong>{points * STAT_TRAINING_PER_POINT}<small> / SEC</small></strong></div>
        </div>
        <div className="progress-copy stat-progress-copy"><span>Next level</span><strong>{Math.floor(progress)} / {required}</strong></div>
        <GameProgress label={`${isAttack ? 'Attack' : 'Health'} progress to level ${level + 1}`} value={progress / required * 100} />
        <div className="point-allocation-row">
          <div className="assigned-points"><span>Assigned</span><strong>{points}</strong><small>{points === 0 ? 'Paused' : 'Training'}</small></div>
          <div className="point-controls">
            <button type="button" className="point-button return-point" aria-label={`Remove one ${kind} point`} disabled={points === 0} onClick={() => dispatch({ type: 'return-point', kind })}><Minus aria-hidden="true" /></button>
            <button type="button" className="point-button allocate-point" aria-label={`Add one ${kind} point`} disabled={available === 0} onClick={() => dispatch({ type: 'allocate-point', kind })}><Plus aria-hidden="true" /></button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrainingScreen({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Action> }) {
  const stats = playerStats(state);
  const requiredXp = xpNeeded(state.playerLevel);
  const levelProgress = state.playerXp / requiredXp * 100;
  const available = availableStatPoints(state);

  return (
    <div className="screen training-screen">
      <header className="game-header">
        <div><p className="eyebrow">Training grounds</p><h1>IRONBOUND</h1></div>
        <div className="rank-mark" aria-label="Rank: Initiate"><Shield aria-hidden="true" /><span>INITIATE</span></div>
      </header>

      <section className="player-summary" aria-labelledby="player-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Player</p><h2 id="player-heading">The Wanderer</h2></div>
        </div>
        <div className="summary-grid">
          <div><Swords aria-hidden="true" /><span>ATK LV {state.attackLevel}</span><strong>{stats.minDamage}–{stats.maxDamage}</strong></div>
          <div><Heart aria-hidden="true" /><span>HP LV {state.healthLevel}</span><strong>{stats.maxHp}</strong></div>
          <div><Activity aria-hidden="true" /><span>BEST FLOOR</span><strong>{state.highestFloor}</strong></div>
        </div>
      </section>

      <Card className="level-card">
        <CardHeader>
          <div className="level-heading">
            <div className="level-emblem"><Star aria-hidden="true" /></div>
            <div><p className="eyebrow">Player level</p><CardTitle>Every level grants one stat point</CardTitle></div>
            <div className="level-number"><span>LV.</span>{state.playerLevel}</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="level-progress-copy"><span>Next stat point</span><strong>{Math.floor(state.playerXp)} / {requiredXp} XP</strong></div>
          <GameProgress label="Player level progress" value={levelProgress} />
          <div className={`point-pool ${available > 0 ? 'has-points' : ''}`}>
            <span>Available points</span><strong>{available}</strong><small>{available > 0 ? 'Allocate below' : 'Level up for another'}</small>
          </div>
        </CardContent>
      </Card>

      <div className="allocation-intro"><div><p className="eyebrow">Stat allocation</p><h2>Build your fighter</h2></div><span>Free respec</span></div>
      <StatCard kind="attack" state={state} dispatch={dispatch} />
      <StatCard kind="health" state={state} dispatch={dispatch} />
      <p className="training-note"><Activity aria-hidden="true" /> Assigned points train stats continuously. Move them freely without losing levels.</p>
    </div>
  );
}

function Fighter({ side, name, title, hp, maxHp, damage, hit }: { side: 'enemy' | 'player'; name: string; title: string; hp: number; maxHp: number; damage: string; hit: number | null }) {
  const isEnemy = side === 'enemy';
  const percent = maxHp === 0 ? 0 : Math.max(0, (hp / maxHp) * 100);
  const Icon = isEnemy ? Skull : Shield;
  return (
    <section className={`fighter ${side}-fighter`} aria-label={`${name}, ${hp} of ${maxHp} health`}>
      <div className="fighter-info">
        <div><p className="eyebrow">{side}</p><h2>{name}</h2><span>{title}</span></div>
        <div className="fighter-damage"><span>DMG</span><strong>{damage}</strong></div>
      </div>
      <div className="fighter-stage">
        <div className="sigil"><span /><Icon aria-hidden="true" /></div>
        {hit !== null && <output key={`${hit}-${hp}`} className={`damage-number ${isEnemy ? 'damage-up' : 'damage-down'}`}>−{hit}</output>}
      </div>
      <div className="hp-copy"><span>HP</span><strong>{hp} / {maxHp}</strong></div>
      <GameProgress className="combat-health" label={`${name} health`} value={percent} />
    </section>
  );
}

function FloorIntel({ floor }: { floor: FloorDefinition }) {
  return (
    <Card className="floor-intel">
      <CardHeader>
        <div className="floor-intel-heading">
          <div><p className="eyebrow">Floor {floor.floor}</p><CardTitle>{floor.name}</CardTitle></div>
          <span>Intel</span>
        </div>
        <p className="floor-description">{floor.description}</p>
        <div className="recommended-stats">
          <span><Swords aria-hidden="true" /> ATK LV {floor.recommendedAttack}</span>
          <span><Heart aria-hidden="true" /> HP LV {floor.recommendedHealth}</span>
        </div>
      </CardHeader>
      <CardContent>
        <section className="intel-section" aria-labelledby="mob-list-heading">
          <div className="intel-section-heading"><Map aria-hidden="true" /><h3 id="mob-list-heading">Mobs</h3><small>{floor.mobs.length} known</small></div>
          <ul className="mob-list">
            {floor.mobs.map((mob) => <li key={mob.name}><div><strong>{mob.name}</strong><small>{mob.title}</small></div><span className={`mob-role ${mob.role.toLowerCase()}`}>{mob.role}</span></li>)}
          </ul>
        </section>
        <section className="intel-section loot-section" aria-labelledby="loot-table-heading">
          <div className="intel-section-heading"><PackageOpen aria-hidden="true" /><h3 id="loot-table-heading">Loot table</h3><small>Preview</small></div>
          <ul className="loot-list">
            {floor.lootTable.length > 0 ? floor.lootTable.map((loot) => <li key={loot.id}><span className={`loot-rarity ${loot.rarity.toLowerCase()}`} /><strong>{loot.name}</strong><small>{loot.rarity}</small><b>{loot.dropChance}%</b></li>) : <li className="empty-loot">No loot configured yet</li>}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}

function DungeonScreen({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Action> }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const enemy = enemyForFloor(state.selectedFloor);
  const floor = useMemo(() => floorDefinition(state.selectedFloor), [state.selectedFloor]);
  const player = playerStats(state);
  const fighting = state.combat.status === 'fighting';
  const visibleFloors = useMemo(() => Array.from({ length: Math.max(6, state.highestFloor + 1) }, (_, index) => floorDefinition(index + 1)), [state.highestFloor]);

  return (
    <div className="screen dungeon-screen">
      <header className="dungeon-header">
        <div><p className="eyebrow">The descent</p><h1>DUNGEON</h1></div>
        <button className="floor-badge" type="button" disabled={fighting} onClick={() => setPickerOpen(true)}><span>FLOOR</span><strong>{state.selectedFloor}</strong><ChevronDown aria-hidden="true" /></button>
      </header>

      <FloorIntel floor={floor} />

      <Card className="combat-card">
        <CardContent>
          <Fighter side="enemy" name={enemy.name} title={enemy.title} hp={state.combat.enemyHp} maxHp={enemy.maxHp} damage={`${enemy.minDamage}–${enemy.maxDamage}`} hit={state.combat.lastPlayerDamage} />

          <div className={`battlefield ${fighting ? 'battlefield-active' : ''}`} aria-hidden="true">
            <span className="battle-line" /><Swords /><span className="battle-state">{fighting ? 'CLASHING' : state.combat.status.toUpperCase()}</span>
          </div>

          <Fighter side="player" name="The Wanderer" title={`Player ${state.playerLevel} · ATK LV ${state.attackLevel}`} hp={state.combat.playerHp} maxHp={player.maxHp} damage={`${player.minDamage}–${player.maxDamage}`} hit={state.combat.lastEnemyDamage} />
        </CardContent>
      </Card>

      <section className="combat-controls" aria-label="Dungeon controls">
        {state.combat.status === 'victory' && <div className="result-banner victory"><Trophy aria-hidden="true" /><span>Floor cleared</span><strong>+{enemy.xpReward} XP</strong></div>}
        {state.combat.status === 'defeat' && <div className="result-banner defeat"><Skull aria-hidden="true" /><span>Defeated</span><strong>Train and return</strong></div>}

        <button type="button" className={`combat-button ${fighting ? 'stop-button' : ''}`} onClick={() => dispatch({ type: fighting ? 'reset-combat' : 'start-combat' })}>
          {fighting ? <Square aria-hidden="true" /> : state.combat.status === 'idle' ? <Play aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
          {fighting ? 'STOP COMBAT' : state.combat.status === 'idle' ? 'START DUNGEON' : 'FIGHT AGAIN'}
        </button>

        <details className="combat-log">
          <summary>Combat log <ChevronDown aria-hidden="true" /></summary>
          <ol>{state.combat.log.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}</ol>
        </details>
      </section>

      {pickerOpen && <dialog open className="floor-picker-dialog" aria-labelledby="floor-picker-title" onCancel={() => setPickerOpen(false)}>
        <section className="floor-picker">
          <header><div><p className="eyebrow">Dungeon map</p><h2 id="floor-picker-title">Choose a floor</h2></div><button type="button" aria-label="Close floor selector" onClick={() => setPickerOpen(false)}><X aria-hidden="true" /></button></header>
          <div className="floor-picker-list">
            {visibleFloors.map((option) => {
              const unlocked = option.floor <= state.highestFloor;
              const selected = option.floor === state.selectedFloor;
              return <button key={option.floor} type="button" className={`floor-option ${selected ? 'selected' : ''}`} disabled={!unlocked} onClick={() => { dispatch({ type: 'select-floor', floor: option.floor }); setPickerOpen(false); }}>
                <span className="floor-option-number">{unlocked ? option.floor : <LockKeyhole aria-hidden="true" />}</span>
                <span className="floor-option-copy"><strong>{option.name}</strong><small>{unlocked ? `${option.mobs.length} mobs · ${option.lootTable.length} drops` : 'Locked'}</small></span>
                {selected && <span className="floor-option-status">Selected</span>}
              </button>;
            })}
          </div>
        </section>
      </dialog>}
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
      dispatch({ type: 'hydrate', state: loadGame(window.localStorage.getItem(SAVE_KEY)) });
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!hydrated) return;
    const persist = () => window.localStorage.setItem(SAVE_KEY, JSON.stringify(saveableState(stateRef.current)));
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
    if (state.combat.status !== 'fighting') return;
    const interval = window.setInterval(() => {
      const current = stateRef.current;
      const player = playerStats(current);
      const enemy = enemyForFloor(current.selectedFloor);
      dispatch({
        type: 'combat-tick',
        playerDamage: randomDamage(player.minDamage, player.maxDamage),
        enemyDamage: randomDamage(enemy.minDamage, enemy.maxDamage),
      });
    }, 850);
    return () => window.clearInterval(interval);
  }, [state.combat.status]);

  const changePage = (nextPage: Page) => {
    if (state.combat.status === 'fighting') dispatch({ type: 'reset-combat' });
    setPage(nextPage);
  };

  return (
    <main className={`game-shell ${page === 'dungeon' ? 'dungeon-mode' : ''}`}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <div className="game-content">
        {page === 'training' ? <TrainingScreen state={state} dispatch={dispatch} /> : <DungeonScreen state={state} dispatch={dispatch} />}
      </div>
      <nav className="bottom-nav" aria-label="Primary navigation">
        <button className={`nav-item ${page === 'training' ? 'active' : ''}`} type="button" aria-current={page === 'training' ? 'page' : undefined} onClick={() => changePage('training')}><Dumbbell aria-hidden="true" /><span>Training</span></button>
        <button className={`nav-item ${page === 'dungeon' ? 'active' : ''}`} type="button" aria-current={page === 'dungeon' ? 'page' : undefined} onClick={() => changePage('dungeon')}><Swords aria-hidden="true" /><span>Dungeon</span></button>
      </nav>
    </main>
  );
}
