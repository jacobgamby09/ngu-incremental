'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Heart,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Square,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  POWER_UPGRADE_AMOUNT,
  POWER_UPGRADE_COST,
  SAVE_KEY,
  advanceTraining,
  buyTrainingPower,
  enemyForFloor,
  initialGameState,
  loadGame,
  playerStats,
  randomDamage,
  resetCombat,
  resolveCombatTick,
  saveableState,
  startCombat,
  xpNeeded,
  type GameState,
} from '@/lib/game';

type Page = 'training' | 'dungeon';

function GameProgress({ value, label, className = '' }: { value: number; label: string; className?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return <progress className={`game-progress ${className}`} aria-label={label} max={100} value={safeValue} />;
}

type Action =
  | { type: 'hydrate'; state: GameState }
  | { type: 'train'; seconds: number }
  | { type: 'set-share'; attackShare: number }
  | { type: 'buy-power' }
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
    case 'set-share':
      return { ...state, attackShare: Math.max(0, Math.min(100, action.attackShare)) };
    case 'buy-power':
      return buyTrainingPower(state);
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

function StatCard({ kind, state }: { kind: 'attack' | 'health'; state: GameState }) {
  const isAttack = kind === 'attack';
  const stat = isAttack ? state.attack : state.health;
  const power = Math.round(state.trainingPower * (isAttack ? state.attackShare : 100 - state.attackShare) / 100);
  const required = xpNeeded(stat.level);
  const percent = Math.min(100, (stat.progress / required) * 100);
  const derived = playerStats(state);
  const Icon = isAttack ? Swords : Heart;

  return (
    <Card className={`training-stat ${isAttack ? 'attack-stat' : 'hp-stat'}`}>
      <CardHeader>
        <div className="stat-title-row">
          <div className="stat-icon"><Icon aria-hidden="true" /></div>
          <div><p className="eyebrow">{isAttack ? 'Attack training' : 'Vitality training'}</p><CardTitle>{isAttack ? 'Strike harder' : 'Endure longer'}</CardTitle></div>
          <div className="stat-level"><span>LV.</span>{stat.level}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="stat-metric-row">
          <div><span>{isAttack ? 'Damage' : 'Max health'}</span><strong>{isAttack ? `${derived.minDamage}–${derived.maxDamage}` : derived.maxHp}</strong></div>
          <div className="rate"><span>Allocated</span><strong>{power}<small> PWR</small></strong></div>
        </div>
        <div className="progress-copy"><span>Level progress</span><span>{Math.floor(stat.progress)} / {required}</span></div>
        <GameProgress label={`${kind} level progress`} value={percent} />
      </CardContent>
    </Card>
  );
}

function TrainingScreen({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Action> }) {
  const healthShare = 100 - state.attackShare;
  const stats = playerStats(state);
  const canBuy = state.xp >= POWER_UPGRADE_COST;

  return (
    <div className="screen training-screen">
      <header className="game-header">
        <div><p className="eyebrow">Training grounds</p><h1>IRONBOUND</h1></div>
        <div className="rank-mark" aria-label="Rank: Initiate"><Shield aria-hidden="true" /><span>INITIATE</span></div>
      </header>

      <section className="player-summary" aria-labelledby="player-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Player</p><h2 id="player-heading">The Wanderer</h2></div>
          <div className="xp-pill"><Sparkles aria-hidden="true" /><span>{state.xp} XP</span></div>
        </div>
        <div className="summary-grid">
          <div><Swords aria-hidden="true" /><span>ATK LV. {state.attack.level}</span><strong>{stats.minDamage}–{stats.maxDamage}</strong></div>
          <div><Heart aria-hidden="true" /><span>HP LV. {state.health.level}</span><strong>{stats.maxHp}</strong></div>
          <div><Activity aria-hidden="true" /><span>BEST FLOOR</span><strong>{state.highestFloor}</strong></div>
        </div>
      </section>

      <Card className="power-card">
        <CardHeader>
          <div className="power-heading">
            <div><p className="eyebrow">Training power</p><CardTitle>Power fuels every second</CardTitle></div>
            <Zap aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent>
          <div><div className="power-value">{state.trainingPower}</div><p className="power-caption">TOTAL POWER</p></div>
          <button className="power-button" type="button" disabled={!canBuy} onClick={() => dispatch({ type: 'buy-power' })}>
            <span>Increase power</span><strong>+{POWER_UPGRADE_AMOUNT}</strong><small>{POWER_UPGRADE_COST} XP</small>
          </button>
        </CardContent>
      </Card>

      <Card className="allocation-card">
        <CardHeader><p className="eyebrow">Power allocation</p><CardTitle>Choose your edge</CardTitle></CardHeader>
        <CardContent>
          <div className="allocation-values">
            <div className="attack-value"><span>ATK</span><strong>{state.attackShare}%</strong><small>{Math.round(state.trainingPower * state.attackShare / 100)} power</small></div>
            <div className="hp-value"><span>HP</span><strong>{healthShare}%</strong><small>{Math.round(state.trainingPower * healthShare / 100)} power</small></div>
          </div>
          <input
            type="range"
            aria-label="Balance training power. Left favors attack; right favors health."
            className="allocation-slider"
            value={healthShare}
            min={0}
            max={100}
            step={5}
            onChange={(event) => dispatch({ type: 'set-share', attackShare: 100 - Number(event.currentTarget.value) })}
          />
          <div className="slider-labels"><span>← More attack</span><span>More health →</span></div>
        </CardContent>
      </Card>

      <StatCard kind="attack" state={state} />
      <StatCard kind="health" state={state} />
      <p className="training-note"><Zap aria-hidden="true" /> Training continues automatically while the game is open.</p>
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

          <Fighter side="player" name="The Wanderer" title={`ATK level ${state.attack.level}`} hp={state.combat.playerHp} maxHp={player.maxHp} damage={`${player.minDamage}–${player.maxDamage}`} hit={state.combat.lastEnemyDamage} />
        </CardContent>
      </Card>

      <section className="combat-controls" aria-label="Dungeon controls">
        <div className="floor-selector">
          <button className="floor-button" type="button" aria-label="Previous floor" disabled={!canGoDown} onClick={() => dispatch({ type: 'select-floor', floor: state.selectedFloor - 1 })}><ChevronLeft /></button>
          <div><span>Selected floor</span><strong>{state.selectedFloor}</strong><small>{enemy.reward} XP reward</small></div>
          <button className="floor-button" type="button" aria-label="Next floor" disabled={!canGoUp} onClick={() => dispatch({ type: 'select-floor', floor: state.selectedFloor + 1 })}><ChevronRight /></button>
        </div>

        {state.combat.status === 'victory' && <div className="result-banner victory"><Trophy aria-hidden="true" /><span>Floor cleared</span><strong>+{enemy.reward} XP</strong></div>}
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
