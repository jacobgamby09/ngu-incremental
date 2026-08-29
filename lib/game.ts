import { resolveCombat } from './engine/combat';
import { floorDefinition } from './engine/floors';
import type { CombatEvent, IntegerRange } from './engine/types';

export { canFloorDamagePlayer, resolveCombat } from './engine/combat';
export { floorDefinition } from './engine/floors';
export type {
  CombatEvent,
  FloorDefinition,
  IntegerRange,
} from './engine/types';

export const SAVE_KEY = 'ironbound-save-v1';
export const SAVE_VERSION = 6;
export const STAT_TRAINING_PER_POINT = 9;

export type StatKind = 'attack' | 'health';
export type RunStatus = 'idle' | 'fighting' | 'results';

export type CombatState = {
  status: 'idle' | 'fighting' | 'defeat';
  playerHp: number;
  playerMaxHp: number;
  playerDamage: IntegerRange;
  enemyHp: number;
  enemyMaxHp: number;
  enemyDamage: IntegerRange;
  enemyName: string;
  lastPlayerDamage: number | null;
  lastEnemyDamage: number | null;
};

export type RunState = {
  status: RunStatus;
  seed: string;
  floor: number;
  playerHp: number;
  xpGained: number;
  levelsGained: number;
  startingPlayerLevel: number;
  events: CombatEvent[];
  eventIndex: number;
};

export type GameState = {
  saveVersion: number;
  playerLevel: number;
  playerXp: number;
  attackPoints: number;
  healthPoints: number;
  attackLevel: number;
  attackProgress: number;
  healthLevel: number;
  healthProgress: number;
  highestFloor: number;
  run: RunState;
  combat: CombatState;
};

function emptyRun(): RunState {
  return {
    status: 'idle',
    seed: '',
    floor: 0,
    playerHp: 0,
    xpGained: 0,
    levelsGained: 0,
    startingPlayerLevel: 0,
    events: [],
    eventIndex: 0,
  };
}

function emptyCombat(maxHp: number, damage: IntegerRange): CombatState {
  return {
    status: 'idle',
    playerHp: maxHp,
    playerMaxHp: maxHp,
    playerDamage: damage,
    enemyHp: 0,
    enemyMaxHp: 0,
    enemyDamage: { min: 0, max: 0 },
    enemyName: '',
    lastPlayerDamage: null,
    lastEnemyDamage: null,
  };
}

export const initialGameState: GameState = {
  saveVersion: SAVE_VERSION,
  playerLevel: 3,
  playerXp: 20,
  attackPoints: 1,
  healthPoints: 1,
  attackLevel: 1,
  attackProgress: 0,
  healthLevel: 1,
  healthProgress: 0,
  highestFloor: 1,
  run: emptyRun(),
  combat: emptyCombat(30, { min: 1, max: 8 }),
};

export function xpNeeded(level: number) {
  return Math.round(44 * Math.pow(level, 1.28));
}

export function statXpNeeded(level: number) {
  return Math.round(28 * Math.pow(Math.max(0, level) + 1, 1.24));
}

export function earnedStatPoints(state: Pick<GameState, 'playerLevel'>) {
  return Math.max(0, state.playerLevel - 1);
}

export function availableStatPoints(
  state: Pick<GameState, 'playerLevel' | 'attackPoints' | 'healthPoints'>,
) {
  return Math.max(
    0,
    earnedStatPoints(state) - state.attackPoints - state.healthPoints,
  );
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

function advanceStat(
  level: number,
  progress: number,
  points: number,
  seconds: number,
) {
  if (points <= 0) return { level, progress };
  let nextLevel = level;
  let nextProgress = progress + points * STAT_TRAINING_PER_POINT * seconds;
  let required = statXpNeeded(nextLevel);
  while (nextProgress >= required) {
    nextProgress -= required;
    nextLevel += 1;
    required = statXpNeeded(nextLevel);
  }
  return { level: nextLevel, progress: nextProgress };
}

export function runIsActive(state: Pick<GameState, 'run'>) {
  return state.run.status === 'fighting';
}

export function advanceTraining(state: GameState, seconds: number): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const elapsed = Math.min(seconds, 2);
  const attack = advanceStat(
    state.attackLevel,
    state.attackProgress,
    state.attackPoints,
    elapsed,
  );
  const health = advanceStat(
    state.healthLevel,
    state.healthProgress,
    state.healthPoints,
    elapsed,
  );
  return {
    ...state,
    attackLevel: attack.level,
    attackProgress: attack.progress,
    healthLevel: health.level,
    healthProgress: health.progress,
  };
}

export function allocateStatPoint(state: GameState, kind: StatKind): GameState {
  if (availableStatPoints(state) === 0) return state;
  return kind === 'attack'
    ? { ...state, attackPoints: state.attackPoints + 1 }
    : { ...state, healthPoints: state.healthPoints + 1 };
}

export function returnStatPoint(state: GameState, kind: StatKind): GameState {
  if (kind === 'attack' && state.attackPoints > 0)
    return { ...state, attackPoints: state.attackPoints - 1 };
  if (kind === 'health' && state.healthPoints > 0)
    return { ...state, healthPoints: state.healthPoints - 1 };
  return state;
}

export function playerStats(
  state: Pick<GameState, 'attackLevel' | 'healthLevel'>,
) {
  return {
    minDamage: 1 + Math.floor(state.attackLevel * 0.7),
    maxDamage: 5 + state.attackLevel * 3,
    maxHp: 20 + state.healthLevel * 10,
    armor: 0,
  };
}

export function playerDamageRange(
  state: Pick<GameState, 'attackLevel' | 'healthLevel'>,
) {
  const player = playerStats(state);
  return { min: player.minDamage, max: player.maxDamage };
}

function prepareFloor(
  state: GameState,
  floorNumber: number,
  seed: string,
  currentHp: number,
): GameState {
  const floor = floorDefinition(floorNumber);
  const player = playerStats(state);
  const playerDamage = playerDamageRange(state);
  const result = resolveCombat({
    seed,
    floor,
    player: {
      currentHp,
      maxHp: player.maxHp,
      damage: playerDamage,
      armor: player.armor,
    },
  });
  const enemyMaxHp = result.initialEnemyHp[0] ?? 0;

  return {
    ...state,
    highestFloor: Math.max(state.highestFloor, floorNumber),
    run: {
      ...state.run,
      status: 'fighting',
      floor: floorNumber,
      playerHp: currentHp,
      events: result.events,
      eventIndex: 0,
    },
    combat: {
      status: 'fighting',
      playerHp: currentHp,
      playerMaxHp: player.maxHp,
      playerDamage,
      enemyHp: enemyMaxHp,
      enemyMaxHp,
      enemyDamage: floor.encounter.damage,
      enemyName: floor.encounter.name,
      lastPlayerDamage: null,
      lastEnemyDamage: null,
    },
  };
}

export function startRun(state: GameState, seed: string): GameState {
  if (runIsActive(state)) return state;
  const player = playerStats(state);
  return prepareFloor(
    {
      ...state,
      run: {
        ...emptyRun(),
        seed,
        startingPlayerLevel: state.playerLevel,
      },
    },
    1,
    `${seed}:floor:1`,
    player.maxHp,
  );
}

export function advanceCombatEvent(state: GameState): GameState {
  if (state.run.status !== 'fighting') return state;
  const event = state.run.events[state.run.eventIndex];
  if (!event) return state;
  const nextIndex = state.run.eventIndex + 1;

  if (event.type === 'player-attack') {
    return {
      ...state,
      run: { ...state.run, eventIndex: nextIndex },
      combat: {
        ...state.combat,
        enemyHp: event.targetHp,
        lastPlayerDamage: event.damage,
        lastEnemyDamage: null,
      },
    };
  }

  if (event.type === 'enemy-attack') {
    return {
      ...state,
      run: { ...state.run, eventIndex: nextIndex, playerHp: event.playerHp },
      combat: {
        ...state.combat,
        playerHp: event.playerHp,
        lastPlayerDamage: null,
        lastEnemyDamage: event.damage,
      },
    };
  }

  if (event.type === 'victory') {
    const nextFloor = state.run.floor + 1;
    const clearedFloor = floorDefinition(state.run.floor);
    const withXp = {
      ...state,
      run: {
        ...state.run,
        playerHp: event.playerHp,
        xpGained: state.run.xpGained + clearedFloor.xpReward,
        eventIndex: nextIndex,
      },
    };
    return prepareFloor(
      withXp,
      nextFloor,
      `${state.run.seed}:floor:${nextFloor}`,
      event.playerHp,
    );
  }

  const rewarded = addPlayerXp(state, state.run.xpGained);
  return {
    ...rewarded,
    run: {
      ...state.run,
      status: 'results',
      playerHp: 0,
      levelsGained: rewarded.playerLevel - state.run.startingPlayerLevel,
      events: [],
      eventIndex: 0,
    },
    combat: {
      ...state.combat,
      status: 'defeat',
      playerHp: 0,
      lastPlayerDamage: null,
      lastEnemyDamage: null,
    },
  };
}

export function resetRun(state: GameState): GameState {
  if (runIsActive(state)) return state;
  const player = playerStats(state);
  return {
    ...state,
    run: emptyRun(),
    combat: emptyCombat(player.maxHp, playerDamageRange(state)),
  };
}

type LegacySave = Partial<GameState> & {
  saveVersion?: number;
  attackShare?: number;
  attack?: { level?: number; progress?: number };
  health?: { level?: number; progress?: number };
  selectedFloor?: number;
};

function migrateOldSave(save: LegacySave): GameState {
  const highestFloor = Math.max(1, (save.highestFloor ?? 2) - 1);
  if (save.saveVersion === 1) {
    const attackLevel = Math.max(1, Math.floor(save.attack?.level ?? 1));
    const healthLevel = Math.max(1, Math.floor(save.health?.level ?? 1));
    const playerLevel = Math.max(3, attackLevel + healthLevel - 1);
    const earned = playerLevel - 1;
    const attackShare = Math.max(0, Math.min(100, save.attackShare ?? 50));
    const attackPoints = Math.round((earned * attackShare) / 100);
    return normalizeSave({
      ...initialGameState,
      playerLevel,
      attackPoints,
      healthPoints: earned - attackPoints,
      attackLevel,
      healthLevel,
      attackProgress: save.attack?.progress ?? 0,
      healthProgress: save.health?.progress ?? 0,
      highestFloor,
    });
  }

  const pointsAsLevels = save.saveVersion === 2 || save.saveVersion === 3;
  return normalizeSave({
    ...initialGameState,
    playerLevel: save.playerLevel ?? initialGameState.playerLevel,
    playerXp: save.playerXp ?? initialGameState.playerXp,
    attackPoints: save.attackPoints ?? initialGameState.attackPoints,
    healthPoints: save.healthPoints ?? initialGameState.healthPoints,
    attackLevel: pointsAsLevels
      ? (save.attackPoints ?? 1)
      : (save.attackLevel ?? 1),
    attackProgress: save.attackProgress ?? 0,
    healthLevel: pointsAsLevels
      ? (save.healthPoints ?? 1)
      : (save.healthLevel ?? 1),
    healthProgress: save.healthProgress ?? 0,
    highestFloor,
  });
}

export function loadGame(raw: string | null): GameState {
  if (!raw) return initialGameState;
  try {
    const parsed = JSON.parse(raw) as LegacySave;
    if (parsed.saveVersion !== SAVE_VERSION) return migrateOldSave(parsed);
    return normalizeSave({
      ...initialGameState,
      ...parsed,
      run: { ...emptyRun(), ...parsed.run },
      combat: { ...initialGameState.combat, ...parsed.combat },
    });
  } catch {
    return initialGameState;
  }
}

function normalizeSave(state: GameState): GameState {
  const normalized = { ...state, saveVersion: SAVE_VERSION };
  normalized.playerLevel = Math.max(1, Math.floor(normalized.playerLevel));
  normalized.playerXp = Math.max(
    0,
    Math.min(normalized.playerXp, xpNeeded(normalized.playerLevel) - 1),
  );
  normalized.attackPoints = Math.max(0, Math.floor(normalized.attackPoints));
  normalized.healthPoints = Math.max(0, Math.floor(normalized.healthPoints));
  normalized.attackLevel = Math.max(0, Math.floor(normalized.attackLevel));
  normalized.healthLevel = Math.max(0, Math.floor(normalized.healthLevel));
  normalized.attackProgress = Math.max(
    0,
    Math.min(
      normalized.attackProgress,
      statXpNeeded(normalized.attackLevel) - 1,
    ),
  );
  normalized.healthProgress = Math.max(
    0,
    Math.min(
      normalized.healthProgress,
      statXpNeeded(normalized.healthLevel) - 1,
    ),
  );
  const earned = earnedStatPoints(normalized);
  if (normalized.attackPoints + normalized.healthPoints > earned) {
    normalized.healthPoints = Math.min(normalized.healthPoints, earned);
    normalized.attackPoints = Math.min(
      normalized.attackPoints,
      earned - normalized.healthPoints,
    );
  }
  normalized.highestFloor = Math.max(1, Math.floor(normalized.highestFloor));
  normalized.run = { ...emptyRun(), ...normalized.run };
  normalized.run.events = Array.isArray(normalized.run.events)
    ? normalized.run.events
    : [];
  if (normalized.run.status === 'fighting') return normalized;
  if (normalized.run.status === 'results') {
    normalized.run.events = [];
    normalized.run.eventIndex = 0;
    return normalized;
  }
  return resetRun(normalized);
}

export function saveableState(state: GameState): GameState {
  return structuredClone(state);
}

export function formatRange(range: IntegerRange) {
  return range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`;
}
