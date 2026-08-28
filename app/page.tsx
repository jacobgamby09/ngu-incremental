'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Heart,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Skull,
  Star,
  Square,
  Swords,
  Trophy,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  SAVE_KEY,
  advanceTraining,
  allocateStatPoint,
  availableStatPoints,
  enemyForFloor,
  initialGameState,
  loadGame,
  playerStats,
  randomDamage,
  resetCombat,
  returnStatPoint,
  resolveCombatTick,
  saveableState,
  startCombat,
  xpNeeded,
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
  const derived = playerStats(state);
  const Icon = isAttack ? Swords : Heart;

  return (
    <Card className={`training-stat ${isAttack ? 'attack-stat' : 'hp-stat'}`}>
      <CardHeader>
        <div className="stat-title-row">
          <div className="stat-icon"><Icon aria-hidden="true" /></div>
          <div><p className="eyebrow">{isAttack ? 'Attack points' : 'Health points'}</p><CardTitle>{isAttack ? 'Strike harder' : 'Endure longer'}</CardTitle></div>
          <div className="stat-level"><span>PTS</span>{points}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="stat-metric-row">
          <div><span>{isAttack ? 'Damage' : 'Max health'}</span><strong>{isAttack ? `${derived.minDamage}–${derived.maxDamage}` : derived.maxHp}</strong></div>
          <div className="rate"><span>Each point</span><strong>{isAttack ? '+3' : '+10'}<small> {isAttack ? 'MAX DMG' : 'HP'}</small></strong></div>
        </div>
        <div className="point-controls">
          <button type="button" className="point-button return-point" aria-label={`Remove one ${kind} point`} disabled={points === 0} onClick={() => dispatch({ type: 'return-point', kind })}><Minus aria-hidden="true" /></button>
          <button type="button" className="point-button allocate-point" aria-label={`Add one ${kind} point`} disabled={available === 0} onClick={() => dispatch({ type: 'allocate-point', kind })}><Plus aria-hidden="true" /></button>
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
          <div><Swords aria-hidden="true" /><span>ATK +{state.attackPoints}</span><strong>{stats.minDamage}–{stats.maxDamage}</strong></div>
          <div><Heart aria-hidden="true" /><span>HP +{state.healthPoints}</span><strong>{stats.maxHp}</strong></div>
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
      <p className="training-note"><Activity aria-hidden="true" /> Training earns player XP automatically. Points can always be moved for free.</p>
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

function DungeonScreen({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Action> }) {
  const enemy = enemyForFloor(state.selectedFloor);
  const player = playerStats(state);
  const fighting = state.combat.status === 'fighting';
  const canGoDown = state.selectedFloor > 1 && !fighting;
  const canGoUp = state.selectedFloor < state.highestFloor && !fighting;

  return (
    <div className="screen dungeon-screen">
      <header className="dungeon-header">
        <div><p className="eyebrow">The descent</p><h1>DUNGEON</h1></div>
        <div className="floor-badge"><span>FLOOR</span><strong>{state.selectedFloor}</strong></div>
      </header>

      <Card className="combat-card">
        <CardContent>
          <Fighter side="enemy" name={enemy.name} title={enemy.title} hp={state.combat.enemyHp} maxHp={enemy.maxHp} damage={`${enemy.minDamage}–${enemy.maxDamage}`} hit={state.combat.lastPlayerDamage} />

          <div className={`battlefield ${fighting ? 'battlefield-active' : ''}`} aria-hidden="true">
            <span className="battle-line" /><Swords /><span className="battle-state">{fighting ? 'CLASHING' : state.combat.status.toUpperCase()}</span>
          </div>

          <Fighter side="player" name="The Wanderer" title={`Level ${state.playerLevel} · ATK +${state.attackPoints}`} hp={state.combat.playerHp} maxHp={player.maxHp} damage={`${player.minDamage}–${player.maxDamage}`} hit={state.combat.lastEnemyDamage} />
        </CardContent>
      </Card>

      <section className="combat-controls" aria-label="Dungeon controls">
        <div className="floor-selector">
          <button className="floor-button" type="button" aria-label="Previous floor" disabled={!canGoDown} onClick={() => dispatch({ type: 'select-floor', floor: state.selectedFloor - 1 })}><ChevronLeft /></button>
          <div><span>Selected floor</span><strong>{state.selectedFloor}</strong><small>{enemy.xpReward} XP</small></div>
          <button className="floor-button" type="button" aria-label="Next floor" disabled={!canGoUp} onClick={() => dispatch({ type: 'select-floor', floor: state.selectedFloor + 1 })}><ChevronRight /></button>
        </div>

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
