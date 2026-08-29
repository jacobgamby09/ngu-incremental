export const SAVE_KEY = 'ironbound-save-v1';
export const SAVE_VERSION = 4;
export const TRAINING_XP_PER_SECOND = 4;
export const STAT_TRAINING_PER_POINT = 9;

export type StatKind = 'attack' | 'health';
export type MobRole = 'Common' | 'Elite' | 'Boss';
export type LootRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic';

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
  attackLevel: number;
  attackProgress: number;
  healthLevel: number;
  healthProgress: number;
  highestFloor: number;
  selectedFloor: number;
  combat: CombatState;
};

export type FloorMob = {
  name: string;
  title: string;
  role: MobRole;
};

export type LootEntry = {
  id: string;
  name: string;
  rarity: LootRarity;
  dropChance: number;
};

export type FloorDefinition = {
  floor: number;
  name: string;
  description: string;
  recommendedAttack: number;
  recommendedHealth: number;
  mobs: FloorMob[];
  lootTable: LootEntry[];
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
  attackLevel: 1,
  attackProgress: 0,
  healthLevel: 1,
  healthProgress: 0,
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

export function statXpNeeded(level: number) {
  return Math.round(28 * Math.pow(Math.max(0, level) + 1, 1.24));
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

function advanceStat(level: number, progress: number, points: number, seconds: number) {
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

export function advanceTraining(state: GameState, seconds: number): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const elapsed = Math.min(seconds, 2);
  const attack = advanceStat(state.attackLevel, state.attackProgress, state.attackPoints, elapsed);
  const health = advanceStat(state.healthLevel, state.healthProgress, state.healthPoints, elapsed);
  const trained = addPlayerXp({
    ...state,
    attackLevel: attack.level,
    attackProgress: attack.progress,
    healthLevel: health.level,
    healthProgress: health.progress,
  }, TRAINING_XP_PER_SECOND * elapsed);
  return state.combat.status === 'idle' ? resetCombat(trained) : trained;
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

export function playerStats(state: Pick<GameState, 'attackLevel' | 'healthLevel'>) {
  return {
    minDamage: 1 + Math.floor(state.attackLevel * 0.7),
    maxDamage: 5 + state.attackLevel * 3,
    maxHp: 20 + state.healthLevel * 10,
  };
}

type FloorTemplate = Omit<FloorDefinition, 'floor' | 'recommendedAttack' | 'recommendedHealth'>;

const floorTemplates: FloorTemplate[] = [
  {
    name: 'Ashen Tunnels',
    description: 'Collapsed mine shafts where scavengers gather around the last warm embers.',
    mobs: [
      { name: 'Ash Goblin', title: 'Tunnel scavenger', role: 'Common' },
      { name: 'Cinder Rat', title: 'Ember-fed vermin', role: 'Common' },
      { name: 'Tunnel Brute', title: 'Warden of the lower shaft', role: 'Boss' },
    ],
    lootTable: [
      { id: 'frayed-wraps', name: 'Frayed Wraps', rarity: 'Common', dropChance: 32 },
      { id: 'goblin-shiv', name: 'Goblin Shiv', rarity: 'Uncommon', dropChance: 12 },
      { id: 'ashen-token', name: 'Ashen Token', rarity: 'Rare', dropChance: 4 },
    ],
  },
  {
    name: 'Forsaken Gate',
    description: 'A ruined checkpoint still defended by soldiers who no longer remember their oath.',
    mobs: [
      { name: 'Hollow Guard', title: 'Oathless sentinel', role: 'Common' },
      { name: 'Gate Archer', title: 'Watcher on the wall', role: 'Elite' },
      { name: 'Oathbreaker', title: 'Captain of the fallen gate', role: 'Boss' },
    ],
    lootTable: [
      { id: 'cracked-buckler', name: 'Cracked Buckler', rarity: 'Common', dropChance: 28 },
      { id: 'guard-signet', name: 'Guard Signet', rarity: 'Uncommon', dropChance: 11 },
      { id: 'oathless-blade', name: 'Oathless Blade', rarity: 'Rare', dropChance: 3.5 },
    ],
  },
  {
    name: 'Drowned Warrens',
    description: 'Black water fills the old passages, hiding packs that hunt by sound.',
    mobs: [
      { name: 'Mire Hound', title: 'Feral stalker', role: 'Common' },
      { name: 'Bog Lurker', title: 'Hunter beneath the water', role: 'Elite' },
      { name: 'Warren Matron', title: 'Mother of the drowned pack', role: 'Boss' },
    ],
    lootTable: [
      { id: 'mire-hide', name: 'Mire Hide', rarity: 'Common', dropChance: 30 },
      { id: 'lurker-fang', name: 'Lurker Fang', rarity: 'Uncommon', dropChance: 9 },
      { id: 'matron-heart', name: 'Matron Heart', rarity: 'Rare', dropChance: 3 },
    ],
  },
  {
    name: 'Bone Archive',
    description: 'Endless shelves of sealed remains watched over by an undying keeper.',
    mobs: [
      { name: 'Crypt Warden', title: 'Keeper of bones', role: 'Common' },
      { name: 'Bone Scribe', title: 'Recorder of the dead', role: 'Elite' },
      { name: 'Archive Keeper', title: 'The final curator', role: 'Boss' },
    ],
    lootTable: [
      { id: 'bone-charm', name: 'Bone Charm', rarity: 'Common', dropChance: 25 },
      { id: 'sealed-page', name: 'Sealed Page', rarity: 'Uncommon', dropChance: 10 },
      { id: 'keeper-key', name: 'Keeper Key', rarity: 'Epic', dropChance: 1.5 },
    ],
  },
  {
    name: 'Scorched Court',
    description: 'A royal hall consumed by a fire that refuses to fade.',
    mobs: [
      { name: 'Ember Knight', title: 'The scorched blade', role: 'Common' },
      { name: 'Ashen Herald', title: 'Voice of the burned king', role: 'Elite' },
      { name: 'Cinder Regent', title: 'Sovereign of flame', role: 'Boss' },
    ],
    lootTable: [
      { id: 'ember-plate', name: 'Ember Plate', rarity: 'Common', dropChance: 22 },
      { id: 'herald-crest', name: 'Herald Crest', rarity: 'Rare', dropChance: 6 },
      { id: 'regent-crown', name: 'Regent Crown', rarity: 'Epic', dropChance: 1 },
    ],
  },
  {
    name: 'The Quiet Below',
    description: 'A lightless chamber where the dungeon itself seems to whisper back.',
    mobs: [
      { name: 'Voidcaller', title: 'Voice below', role: 'Common' },
      { name: 'Silence Wraith', title: 'The soundless hunger', role: 'Elite' },
      { name: 'Deep Witness', title: 'That which watches', role: 'Boss' },
    ],
    lootTable: [
      { id: 'void-thread', name: 'Void Thread', rarity: 'Uncommon', dropChance: 15 },
      { id: 'silent-eye', name: 'Silent Eye', rarity: 'Rare', dropChance: 5 },
      { id: 'witness-shard', name: 'Witness Shard', rarity: 'Epic', dropChance: 0.8 },
    ],
  },
];

export function floorDefinition(floor: number): FloorDefinition {
  const safeFloor = Math.max(1, Math.floor(floor));
  const template = floorTemplates[(safeFloor - 1) % floorTemplates.length];
  const depth = Math.floor((safeFloor - 1) / floorTemplates.length) + 1;
  return {
    ...template,
    floor: safeFloor,
    name: depth === 1 ? template.name : `${template.name} · Depth ${depth}`,
    recommendedAttack: Math.max(1, safeFloor * 2 - 1),
    recommendedHealth: Math.max(1, safeFloor * 2),
    mobs: template.mobs.map((mob) => ({ ...mob })),
    lootTable: template.lootTable.map((loot) => ({ ...loot, id: `${loot.id}-${depth}` })),
  };
}

export function enemyForFloor(floor: number): Enemy {
  const safeFloor = Math.max(1, Math.floor(floor));
  const encounter = floorDefinition(safeFloor).mobs[0];
  return {
    name: encounter.name,
    title: encounter.title,
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

type LevelSave = {
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

  return normalizeSave({
    ...initialGameState,
    playerLevel,
    playerXp: Math.min(combinedProgress, xpNeeded(playerLevel) - 1),
    attackPoints,
    healthPoints,
    attackLevel,
    attackProgress: legacy.attack?.progress ?? 0,
    healthLevel,
    healthProgress: legacy.health?.progress ?? 0,
    highestFloor: Math.max(1, Math.floor(legacy.highestFloor ?? 1)),
    selectedFloor: Math.max(1, Math.floor(legacy.selectedFloor ?? 1)),
  });
}

function migrateLevelSave(save: LevelSave): GameState {
  const attackPoints = Math.max(0, Math.floor(save.attackPoints ?? initialGameState.attackPoints));
  const healthPoints = Math.max(0, Math.floor(save.healthPoints ?? initialGameState.healthPoints));
  return normalizeSave({
    ...initialGameState,
    playerLevel: save.playerLevel ?? initialGameState.playerLevel,
    playerXp: save.playerXp ?? initialGameState.playerXp,
    attackPoints,
    healthPoints,
    attackLevel: attackPoints,
    healthLevel: healthPoints,
    highestFloor: save.highestFloor ?? initialGameState.highestFloor,
    selectedFloor: save.selectedFloor ?? initialGameState.selectedFloor,
  });
}

export function loadGame(raw: string | null): GameState {
  if (!raw) return initialGameState;
  try {
    const parsed = JSON.parse(raw) as Partial<GameState> & LegacySave;
    if (parsed.saveVersion === 1) return migrateLegacySave(parsed);
    if (parsed.saveVersion === 2 || parsed.saveVersion === 3) return migrateLevelSave(parsed);
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
  normalized.attackLevel = Math.max(0, Math.floor(normalized.attackLevel));
  normalized.healthLevel = Math.max(0, Math.floor(normalized.healthLevel));
  normalized.attackProgress = Math.max(0, Math.min(normalized.attackProgress, statXpNeeded(normalized.attackLevel) - 1));
  normalized.healthProgress = Math.max(0, Math.min(normalized.healthProgress, statXpNeeded(normalized.healthLevel) - 1));
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
