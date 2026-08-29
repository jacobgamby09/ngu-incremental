import { resolveCombat } from './engine/combat';
import { floorDefinition } from './engine/floors';
import { mergeLoot, resolveLoot } from './engine/loot';
import type { CombatEvent, FloorDefinition, LootStack } from './engine/types';

export { canFloorDamagePlayer, resolveCombat } from './engine/combat';
export { floorDefinition } from './engine/floors';
export { lootValue, mergeLoot, resolveLoot } from './engine/loot';
export type {
  CombatEvent,
  FloorDefinition,
  LootEntry,
  LootRarity,
  LootStack,
  MobRole,
} from './engine/types';

export const SAVE_KEY = 'ironbound-save-v1';
export const SAVE_VERSION = 5;
export const TRAINING_XP_PER_SECOND = 4;
export const STAT_TRAINING_PER_POINT = 9;

export type StatKind = 'attack' | 'health';
export type RunStatus = 'idle' | 'fighting' | 'decision' | 'dead' | 'returned';

export type CombatState = {
  status: 'idle' | 'fighting' | 'victory' | 'defeat';
  playerHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyCount: number;
  enemyName: string;
  enemyTitle: string;
  lastPlayerDamage: number | null;
  lastEnemyDamage: number | null;
  log: string[];
};

export type RunState = {
  status: RunStatus;
  seed: string;
  floor: number;
  playerHp: number;
  bag: LootStack[];
  events: CombatEvent[];
  eventIndex: number;
  pendingLoot: LootStack[];
  equippedItemId: string | null;
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
  selectedFloor: number;
  inventory: LootStack[];
  run: RunState;
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

function emptyRun(): RunState {
  return {
    status: 'idle',
    seed: '',
    floor: 0,
    playerHp: 0,
    bag: [],
    events: [],
    eventIndex: 0,
    pendingLoot: [],
    equippedItemId: null,
  };
}

function previewCombat(floorNumber: number, playerHp: number): CombatState {
  const floor = floorDefinition(floorNumber);
  return {
    status: 'idle',
    playerHp,
    enemyHp: floor.encounter.hp.max * floor.encounter.count.max,
    enemyMaxHp: floor.encounter.hp.max * floor.encounter.count.max,
    enemyCount: floor.encounter.count.max,
    enemyName: floor.encounter.name,
    enemyTitle: floor.encounter.title,
    lastPlayerDamage: null,
    lastEnemyDamage: null,
    log: ['The dungeon waits.'],
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
  selectedFloor: 1,
  inventory: [],
  run: emptyRun(),
  combat: previewCombat(1, 30),
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
  return state.run.status === 'fighting' || state.run.status === 'decision';
}

export function advanceTraining(state: GameState, seconds: number): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0 || runIsActive(state))
    return state;
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
  const trained = addPlayerXp(
    {
      ...state,
      attackLevel: attack.level,
      attackProgress: attack.progress,
      healthLevel: health.level,
      healthProgress: health.progress,
    },
    TRAINING_XP_PER_SECOND * elapsed,
  );
  return resetCombat(trained);
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

export function enemyForFloor(floorNumber: number): Enemy {
  const floor = floorDefinition(floorNumber);
  return {
    name: floor.encounter.name,
    title: floor.encounter.title,
    maxHp: floor.encounter.hp.max * floor.encounter.count.max,
    minDamage: floor.encounter.damage.min,
    maxDamage: floor.encounter.damage.max,
    xpReward: floor.xpReward,
  };
}

export function playerDamageRange(
  state: Pick<GameState, 'attackLevel' | 'healthLevel' | 'run'>,
) {
  if (state.run.equippedItemId === 'rusted-war-axe') return { min: 2, max: 24 };
  const player = playerStats(state);
  return { min: player.minDamage, max: player.maxDamage };
}

function prepareFloor(
  state: GameState,
  floorNumber: number,
  seed: string,
  currentHp: number,
  bag: LootStack[],
): GameState {
  const floor = floorDefinition(floorNumber);
  const player = playerStats(state);
  const damage = playerDamageRange(state);
  const result = resolveCombat({
    seed,
    floor,
    player: {
      currentHp,
      maxHp: player.maxHp,
      damage,
      armor: player.armor,
    },
  });
  const enemyMaxHp = result.initialEnemyHp.reduce((total, hp) => total + hp, 0);
  return {
    ...state,
    selectedFloor: floorNumber,
    run: {
      status: 'fighting',
      seed: state.run.seed || seed,
      floor: floorNumber,
      playerHp: currentHp,
      bag,
      events: result.events,
      eventIndex: 0,
      pendingLoot: result.outcome === 'victory' ? resolveLoot(seed, floor) : [],
      equippedItemId: state.run.equippedItemId,
    },
    combat: {
      status: 'fighting',
      playerHp: currentHp,
      enemyHp: enemyMaxHp,
      enemyMaxHp,
      enemyCount: result.enemyCount,
      enemyName: floor.encounter.name,
      enemyTitle: floor.encounter.title,
      lastPlayerDamage: null,
      lastEnemyDamage: null,
      log: [
        `Floor ${floorNumber}: ${result.enemyCount}× ${floor.encounter.name}.`,
      ],
    },
  };
}

export function startRun(state: GameState, seed: string): GameState {
  if (runIsActive(state)) return state;
  const player = playerStats(state);
  return prepareFloor(
    { ...state, run: { ...emptyRun(), seed } },
    1,
    `${seed}:floor:1`,
    player.maxHp,
    [],
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
        enemyHp: Math.max(0, state.combat.enemyHp - event.damage),
        lastPlayerDamage: event.damage,
        lastEnemyDamage: null,
        log: [`You deal ${event.damage} damage.`, ...state.combat.log].slice(
          0,
          12,
        ),
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
        log: [`You take ${event.damage} damage.`, ...state.combat.log].slice(
          0,
          12,
        ),
      },
    };
  }
  if (event.type === 'victory') {
    const floor = floorDefinition(state.run.floor);
    const bag = mergeLoot(state.run.bag, state.run.pendingLoot);
    const rewarded = addPlayerXp(state, floor.xpReward);
    return {
      ...rewarded,
      highestFloor: Math.max(state.highestFloor, state.run.floor + 1),
      selectedFloor: state.run.floor + 1,
      run: {
        ...state.run,
        status: 'decision',
        playerHp: event.playerHp,
        bag,
        pendingLoot: [],
        eventIndex: nextIndex,
      },
      combat: {
        ...state.combat,
        status: 'victory',
        enemyHp: 0,
        playerHp: event.playerHp,
        lastPlayerDamage: null,
        lastEnemyDamage: null,
        log: ['Victory. Loot added to the bag.', ...state.combat.log].slice(
          0,
          12,
        ),
      },
    };
  }
  return {
    ...state,
    run: {
      ...state.run,
      status: 'dead',
      playerHp: 0,
      bag: [],
      pendingLoot: [],
      equippedItemId: null,
      eventIndex: nextIndex,
    },
    combat: {
      ...state.combat,
      status: 'defeat',
      playerHp: 0,
      lastPlayerDamage: null,
      lastEnemyDamage: null,
      log: ['Defeated. The unbanked bag is lost.', ...state.combat.log].slice(
        0,
        12,
      ),
    },
  };
}

export function skipCombat(state: GameState): GameState {
  let next = state;
  while (next.run.status === 'fighting') next = advanceCombatEvent(next);
  return next;
}

export function continueRun(state: GameState): GameState {
  if (state.run.status !== 'decision') return state;
  const nextFloor = state.run.floor + 1;
  return prepareFloor(
    state,
    nextFloor,
    `${state.run.seed}:floor:${nextFloor}`,
    state.run.playerHp,
    state.run.bag,
  );
}

export function bankRun(state: GameState): GameState {
  if (state.run.status !== 'decision') return state;
  return {
    ...state,
    inventory: mergeLoot(state.inventory, state.run.bag),
    run: {
      ...state.run,
      status: 'returned',
      bag: [],
      pendingLoot: [],
      events: [],
      eventIndex: 0,
      equippedItemId: null,
    },
    combat: {
      ...state.combat,
      log: [
        'Everything in the bag is now permanent.',
        ...state.combat.log,
      ].slice(0, 12),
    },
  };
}

export function equipRunItem(state: GameState, itemId: string): GameState {
  if (state.run.status !== 'decision') return state;
  if (!state.run.bag.some((item) => item.id === itemId)) return state;
  if (itemId !== 'rusted-war-axe') return state;
  return { ...state, run: { ...state.run, equippedItemId: itemId } };
}

export function resetRun(state: GameState): GameState {
  if (runIsActive(state)) return state;
  return resetCombat({ ...state, run: emptyRun() });
}

export function resetCombat(state: GameState): GameState {
  if (runIsActive(state)) return state;
  const player = playerStats(state);
  return { ...state, combat: previewCombat(state.selectedFloor, player.maxHp) };
}

type LegacySave = {
  saveVersion?: number;
  attackShare?: number;
  attack?: { level?: number; progress?: number };
  health?: { level?: number; progress?: number };
  playerLevel?: number;
  playerXp?: number;
  attackPoints?: number;
  healthPoints?: number;
  attackLevel?: number;
  attackProgress?: number;
  healthLevel?: number;
  healthProgress?: number;
  highestFloor?: number;
  selectedFloor?: number;
};

function migrateOldSave(save: LegacySave): GameState {
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
      highestFloor: save.highestFloor ?? 1,
      selectedFloor: save.selectedFloor ?? 1,
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
    highestFloor: save.highestFloor ?? 1,
    selectedFloor: save.selectedFloor ?? 1,
  });
}

export function loadGame(raw: string | null): GameState {
  if (!raw) return initialGameState;
  try {
    const parsed = JSON.parse(raw) as Partial<GameState> & LegacySave;
    if (parsed.saveVersion !== SAVE_VERSION) return migrateOldSave(parsed);
    return normalizeSave({
      ...initialGameState,
      ...parsed,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
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
  normalized.selectedFloor = Math.max(
    1,
    Math.min(normalized.highestFloor, Math.floor(normalized.selectedFloor)),
  );
  normalized.inventory = Array.isArray(normalized.inventory)
    ? normalized.inventory
    : [];
  normalized.run = { ...emptyRun(), ...normalized.run };
  normalized.run.bag = Array.isArray(normalized.run.bag)
    ? normalized.run.bag
    : [];
  normalized.run.events = Array.isArray(normalized.run.events)
    ? normalized.run.events
    : [];
  normalized.run.pendingLoot = Array.isArray(normalized.run.pendingLoot)
    ? normalized.run.pendingLoot
    : [];
  return runIsActive(normalized) ? normalized : resetCombat(normalized);
}

export function saveableState(state: GameState): GameState {
  return structuredClone(state);
}

export function formatRange(range: { min: number; max: number }) {
  return range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`;
}

export function floorPreviewForState(state: GameState): FloorDefinition {
  if (state.run.status === 'decision')
    return floorDefinition(state.run.floor + 1);
  if (state.run.status === 'fighting') return floorDefinition(state.run.floor);
  return floorDefinition(state.selectedFloor);
}
