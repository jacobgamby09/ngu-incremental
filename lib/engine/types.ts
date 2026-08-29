export type IntegerRange = {
  min: number;
  max: number;
};

export type EnemyDefinition = {
  id: string;
  name: string;
  hp: IntegerRange;
  damage: IntegerRange;
};

export type FloorDefinition = {
  floor: number;
  encounter: EnemyDefinition;
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
