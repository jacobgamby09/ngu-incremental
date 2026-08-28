export const SAVE_KEY = 'ironbound-save-v1';
export const SAVE_VERSION = 1;
export const POWER_UPGRADE_AMOUNT = 10;
export const POWER_UPGRADE_COST = 50;

export type StatProgress = {
  level: number;
  progress: number;
};

export type CombatState = {
  status: 'idle' | 'fighting' | 'victory' | 'defeat';
  playerHp: number;
  enemyHp: number;
  lastPlayerDamage: number | null;
  lastEnemyDamage: number | null;
  log: string[];
};

export type GameState = {
  saveVersion: number;
  xp: number;
  trainingPower: number;
  attackShare: number;
  attack: StatProgress;
  health: StatProgress;
  highestFloor: number;
  selectedFloor: number;
  combat: CombatState;
};

export type Enemy = {
  name: string;
  title: string;
  maxHp: number;
  minDamage: number;
  maxDamage: number;
  reward: number;
};

export const initialGameState: GameState = {
  saveVersion: SAVE_VERSION,
  xp: 80,
  trainingPower: 100,
  attackShare: 70,
  attack: { level: 1, progress: 18 },
  health: { level: 1, progress: 12 },
  highestFloor: 1,
  selectedFloor: 1,
  combat: {
    status: 'idle',
    playerHp: 30,
    enemyHp: 35,
    lastPlayerDamage: null,
    lastEnemyDamage: null,
    log: ['The dungeon waits.'],
  },
};

export function xpNeeded(level: number) {
  return Math.round(42 * Math.pow(level, 1.32));
}

export function addStatProgress(stat: StatProgress, amount: number): StatProgress {
  let level = stat.level;
  let progress = stat.progress + amount;
  let required = xpNeeded(level);

  while (progress >= required) {
    progress -= required;
    level += 1;
    required = xpNeeded(level);
  }

  return { level, progress };
}

export function advanceTraining(state: GameState, seconds: number): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const points = (state.trainingPower / 26) * Math.min(seconds, 2);
  const attackPoints = points * (state.attackShare / 100);
  const healthPoints = points - attackPoints;

  return {
    ...state,
    attack: addStatProgress(state.attack, attackPoints),
    health: addStatProgress(state.health, healthPoints),
  };
}

export function playerStats(state: GameState) {
  return {
    minDamage: 1 + Math.floor(state.attack.level * 0.7),
    maxDamage: 5 + state.attack.level * 3,
    maxHp: 20 + state.health.level * 10,
  };
}

const enemyNames = [
  ['Ash Goblin', 'Tunnel scavenger'],
  ['Hollow Guard', 'Oathless sentinel'],
  ['Mire Hound', 'Feral stalker'],
  ['Crypt Warden', 'Keeper of bones'],
  ['Ember Knight', 'The scorched blade'],
  ['Voidcaller', 'Voice below'],
];

export function enemyForFloor(floor: number): Enemy {
  const safeFloor = Math.max(1, Math.floor(floor));
  const [name, title] = enemyNames[(safeFloor - 1) % enemyNames.length];
  return {
    name,
    title,
    maxHp: 22 + safeFloor * 12 + Math.floor(safeFloor ** 1.45),
    minDamage: 1 + Math.floor(safeFloor * 0.8),
    maxDamage: 3 + Math.floor(safeFloor * 1.55),
    reward: 20 + safeFloor * 10,
  };
}

export function randomDamage(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function startCombat(state: GameState): GameState {
  const player = playerStats(state);
  const enemy = enemyForFloor(state.selectedFloor);
  return {
    ...state,
    combat: {
      status: 'fighting',
      playerHp: player.maxHp,
      enemyHp: enemy.maxHp,
      lastPlayerDamage: null,
      lastEnemyDamage: null,
      log: [`Floor ${state.selectedFloor}: ${enemy.name} approaches.`],
    },
  };
}

export function resolveCombatTick(state: GameState, playerDamage: number, enemyDamage: number): GameState {
  if (state.combat.status !== 'fighting') return state;
  const enemy = enemyForFloor(state.selectedFloor);
  const enemyHp = Math.max(0, state.combat.enemyHp - playerDamage);
  const playerHit = `${enemy.name} takes ${playerDamage} damage.`;

  if (enemyHp === 0) {
    const clearedFloor = state.selectedFloor;
    const highestFloor = Math.max(state.highestFloor, clearedFloor + 1);
    return {
      ...state,
      xp: state.xp + enemy.reward,
      highestFloor,
      combat: {
        ...state.combat,
        status: 'victory',
        enemyHp: 0,
        lastPlayerDamage: playerDamage,
        lastEnemyDamage: null,
        log: [`Victory. +${enemy.reward} XP`, playerHit, ...state.combat.log].slice(0, 8),
      },
    };
  }

  const playerHp = Math.max(0, state.combat.playerHp - enemyDamage);
  const enemyHit = `You take ${enemyDamage} damage.`;
  return {
    ...state,
    combat: {
      ...state.combat,
      status: playerHp === 0 ? 'defeat' : 'fighting',
      enemyHp,
      playerHp,
      lastPlayerDamage: playerDamage,
      lastEnemyDamage: enemyDamage,
      log: [playerHp === 0 ? 'Defeated. Train and return.' : enemyHit, playerHit, ...state.combat.log].slice(0, 8),
    },
  };
}

export function resetCombat(state: GameState): GameState {
  const player = playerStats(state);
  const enemy = enemyForFloor(state.selectedFloor);
  return {
    ...state,
    combat: {
      status: 'idle',
      playerHp: player.maxHp,
      enemyHp: enemy.maxHp,
      lastPlayerDamage: null,
      lastEnemyDamage: null,
      log: ['The dungeon waits.'],
    },
  };
}

export function buyTrainingPower(state: GameState): GameState {
  if (state.xp < POWER_UPGRADE_COST) return state;
  return {
    ...state,
    xp: state.xp - POWER_UPGRADE_COST,
    trainingPower: state.trainingPower + POWER_UPGRADE_AMOUNT,
  };
}

export function loadGame(raw: string | null): GameState {
  if (!raw) return initialGameState;
  try {
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (parsed.saveVersion !== SAVE_VERSION) return initialGameState;
    const merged: GameState = {
      ...initialGameState,
      ...parsed,
      attack: { ...initialGameState.attack, ...parsed.attack },
      health: { ...initialGameState.health, ...parsed.health },
      combat: initialGameState.combat,
    };
    merged.attackShare = Math.max(0, Math.min(100, merged.attackShare));
    merged.selectedFloor = Math.max(1, Math.min(merged.highestFloor, merged.selectedFloor));
    return resetCombat(merged);
  } catch {
    return initialGameState;
  }
}

export function saveableState(state: GameState): GameState {
  return resetCombat({ ...state, selectedFloor: Math.min(state.selectedFloor, state.highestFloor) });
}
