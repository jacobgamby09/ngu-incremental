export type IntegerRange = {
  min: number;
  max: number;
};

export type MobRole = 'Common' | 'Elite' | 'Boss';
export type LootRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic';

export type EnemyDefinition = {
  id: string;
  name: string;
  title: string;
  role: MobRole;
  count: IntegerRange;
  hp: IntegerRange;
  damage: IntegerRange;
  rules: string[];
};

export type LootEntry = {
  id: string;
  name: string;
  rarity: LootRarity;
  dropChance: number;
  quantity: IntegerRange;
  knownValue: number;
};

export type LootStack = {
  id: string;
  name: string;
  rarity: LootRarity;
  quantity: number;
  knownValue: number;
};

export type FloorDefinition = {
  floor: number;
  name: string;
  description: string;
  encounter: EnemyDefinition;
  lootTable: LootEntry[];
  xpReward: number;
};

export type Combatant = {
  currentHp: number;
  maxHp: number;
  damage: IntegerRange;
  armor: number;
};

export type CombatEvent =
  | {
      type: 'player-attack';
      round: number;
      target: number;
      damage: number;
      targetHp: number;
    }
  | {
      type: 'enemy-attack';
      round: number;
      source: number;
      rawDamage: number;
      damage: number;
      playerHp: number;
    }
  | { type: 'victory'; round: number; playerHp: number }
  | { type: 'defeat'; round: number };

export type CombatResult = {
  seed: string;
  outcome: 'victory' | 'defeat';
  enemyCount: number;
  initialEnemyHp: number[];
  remainingHp: number;
  events: CombatEvent[];
};
