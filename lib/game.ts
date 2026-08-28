export const SAVE_KEY = 'ironbound-save-v1';
export const SAVE_VERSION = 3;
export const TRAINING_XP_PER_SECOND = 4;

export type StatKind = 'attack' | 'health';

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
  playerLevel: number;
  playerXp: number;
  attackPoints: number;
  healthPoints: number;
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
  xpReward: number;
};

export const initialGameState: GameState = {
  saveVersion: SAVE_VERSION,
  playerLevel: 3,
  playerXp: 20,
  attackPoints: 1,
  healthPoints: 1,
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
  return Math.round(44 * Math.pow(level, 1.28));
}

export function earnedStatPoints(state: Pick<GameState, 'playerLevel'>) {
  return Math.max(0, state.playerLevel - 1);
}

export function availableStatPoints(state: Pick<GameState, 'playerLevel' | 'attackPoints' | 'healthPoints'>) {
  return Math.max(0, earnedStatPoints(state) - state.attackPoints - state.healthPoints);
}

export function addPlayerXp(state: GameState, amount: number): GameState {
  if (!Number.isFinite(amount) || amount <= 0) return state;
  let playerLevel = state.playerLevel;
  let playerXp = state.playerXp + amount;
  let required = xpNeeded(playerLevel);

  while (playerXp >= required) {
    playerXp -= required;
    playerLevel += 1;
    required = xpNeeded(playerLevel);
  }

  return { ...state, playerLevel, playerXp };
}

export function advanceTraining(state: GameState, seconds: number): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const gainedXp = TRAINING_XP_PER_SECOND * Math.min(seconds, 2);
  return addPlayerXp(state, gainedXp);
}

export function allocateStatPoint(state: GameState, kind: StatKind): GameState {
  if (availableStatPoints(state) === 0) return state;
  return kind === 'attack'
    ? { ...state, attackPoints: state.attackPoints + 1 }
    : { ...state, healthPoints: state.healthPoints + 1 };
}

export function returnStatPoint(state: GameState, kind: StatKind): GameState {
  if (kind === 'attack' && state.attackPoints > 0) return { ...state, attackPoints: state.attackPoints - 1 };
  if (kind === 'health' && state.healthPoints > 0) return { ...state, healthPoints: state.healthPoints - 1 };
  return state;
}

export function playerStats(state: Pick<GameState, 'attackPoints' | 'healthPoints'>) {
  return {
    minDamage: 1 + Math.floor(state.attackPoints * 0.7),
    maxDamage: 5 + state.attackPoints * 3,
    maxHp: 20 + state.healthPoints * 10,
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
    xpReward: 18 + safeFloor * 8,
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
    const highestFloor = Math.max(state.highestFloor, state.selectedFloor + 1);
    const rewarded = addPlayerXp(state, enemy.xpReward);
    return {
      ...rewarded,
      highestFloor,
      combat: {
        ...state.combat,
        status: 'victory',
        enemyHp: 0,
        lastPlayerDamage: playerDamage,
        lastEnemyDamage: null,
        log: [`Victory. +${enemy.xpReward} XP`, playerHit, ...state.combat.log].slice(0, 8),
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

type LegacySave = {
  saveVersion?: number;
  xp?: number;
  trainingPower?: number;
  attackShare?: number;
  attack?: { level?: number; progress?: number };
  health?: { level?: number; progress?: number };
  highestFloor?: number;
  selectedFloor?: number;
};

type LevelSaveV2 = {
  saveVersion?: number;
  playerLevel?: number;
  playerXp?: number;
  attackPoints?: number;
  healthPoints?: number;
  highestFloor?: number;
  selectedFloor?: number;
};

function migrateLegacySave(legacy: LegacySave): GameState {
  const attackLevel = Math.max(1, Math.floor(legacy.attack?.level ?? 1));
  const healthLevel = Math.max(1, Math.floor(legacy.health?.level ?? 1));
  const playerLevel = Math.max(3, attackLevel + healthLevel - 1);
  const earned = playerLevel - 1;
  const attackShare = Math.max(0, Math.min(100, legacy.attackShare ?? 50));
  const attackPoints = Math.round(earned * attackShare / 100);
  const healthPoints = earned - attackPoints;
  const combinedProgress = Math.max(0, (legacy.attack?.progress ?? 0) + (legacy.health?.progress ?? 0));

  return resetCombat({
    ...initialGameState,
    playerLevel,
    playerXp: Math.min(combinedProgress, xpNeeded(playerLevel) - 1),
    attackPoints,
    healthPoints,
    highestFloor: Math.max(1, Math.floor(legacy.highestFloor ?? 1)),
    selectedFloor: Math.max(1, Math.floor(legacy.selectedFloor ?? 1)),
  });
}

function migrateLevelSave(save: LevelSaveV2): GameState {
  return resetCombat({
    ...initialGameState,
    playerLevel: save.playerLevel ?? initialGameState.playerLevel,
    playerXp: save.playerXp ?? initialGameState.playerXp,
    attackPoints: save.attackPoints ?? initialGameState.attackPoints,
    healthPoints: save.healthPoints ?? initialGameState.healthPoints,
    highestFloor: save.highestFloor ?? initialGameState.highestFloor,
    selectedFloor: save.selectedFloor ?? initialGameState.selectedFloor,
  });
}

export function loadGame(raw: string | null): GameState {
  if (!raw) return initialGameState;
  try {
    const parsed = JSON.parse(raw) as Partial<GameState> & LegacySave;
    if (parsed.saveVersion === 1) return migrateLegacySave(parsed);
    if (parsed.saveVersion === 2) return normalizeSave(migrateLevelSave(parsed));
    if (parsed.saveVersion !== SAVE_VERSION) return initialGameState;

    const merged: GameState = {
      ...initialGameState,
      ...parsed,
      combat: initialGameState.combat,
    };
    return normalizeSave(merged);
  } catch {
    return initialGameState;
  }
}

function normalizeSave(state: GameState): GameState {
  const normalized = { ...state, saveVersion: SAVE_VERSION };
  normalized.playerLevel = Math.max(1, Math.floor(normalized.playerLevel));
  normalized.playerXp = Math.max(0, Math.min(normalized.playerXp, xpNeeded(normalized.playerLevel) - 1));
  normalized.attackPoints = Math.max(0, Math.floor(normalized.attackPoints));
  normalized.healthPoints = Math.max(0, Math.floor(normalized.healthPoints));
  const earned = earnedStatPoints(normalized);
  if (normalized.attackPoints + normalized.healthPoints > earned) {
    normalized.healthPoints = Math.min(normalized.healthPoints, earned);
    normalized.attackPoints = Math.min(normalized.attackPoints, earned - normalized.healthPoints);
  }
  normalized.highestFloor = Math.max(1, Math.floor(normalized.highestFloor));
  normalized.selectedFloor = Math.max(1, Math.min(normalized.highestFloor, Math.floor(normalized.selectedFloor)));
  return resetCombat(normalized);
}

export function saveableState(state: GameState): GameState {
  return resetCombat({ ...state, selectedFloor: Math.min(state.selectedFloor, state.highestFloor) });
}
