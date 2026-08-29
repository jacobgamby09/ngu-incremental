import { describe, expect, it } from 'vitest';

import {
  SAVE_VERSION,
  STAT_TRAINING_PER_POINT,
  TRAINING_XP_PER_SECOND,
  addPlayerXp,
  advanceTraining,
  allocateStatPoint,
  availableStatPoints,
  enemyForFloor,
  floorDefinition,
  initialGameState,
  loadGame,
  playerStats,
  resolveCombatTick,
  returnStatPoint,
  startCombat,
  statXpNeeded,
  xpNeeded,
} from './game';

describe('player level progression', () => {
  it('advances player XP and both allocated stat training bars', () => {
    const next = advanceTraining(initialGameState, 1);

    expect(next.playerXp - initialGameState.playerXp).toBeCloseTo(TRAINING_XP_PER_SECOND, 5);
    expect(next.attackProgress).toBe(STAT_TRAINING_PER_POINT);
    expect(next.healthProgress).toBe(STAT_TRAINING_PER_POINT);
  });

  it('grants one available stat point on level-up and carries overflow XP', () => {
    const state = { ...initialGameState, playerXp: xpNeeded(initialGameState.playerLevel) - 2 };
    const next = addPlayerXp(state, 5);

    expect(next.playerLevel).toBe(initialGameState.playerLevel + 1);
    expect(next.playerXp).toBe(3);
    expect(availableStatPoints(next)).toBe(1);
  });

  it('allocates and returns points freely without exceeding earned points', () => {
    const leveled = { ...initialGameState, playerLevel: 4 };
    const allocated = allocateStatPoint(leveled, 'attack');
    const blocked = allocateStatPoint(allocated, 'health');
    const returned = returnStatPoint(allocated, 'attack');

    expect(allocated.attackPoints).toBe(2);
    expect(availableStatPoints(allocated)).toBe(0);
    expect(blocked).toBe(allocated);
    expect(returned.attackPoints).toBe(1);
    expect(availableStatPoints(returned)).toBe(1);
  });

  it('levels a stat directly when its live training bar completes', () => {
    const state = {
      ...initialGameState,
      attackProgress: statXpNeeded(initialGameState.attackLevel) - 2,
      healthPoints: 0,
    };
    const next = advanceTraining(state, 1);

    expect(next.attackLevel).toBe(initialGameState.attackLevel + 1);
    expect(next.attackProgress).toBe(STAT_TRAINING_PER_POINT - 2);
    expect(next.healthLevel).toBe(initialGameState.healthLevel);
    expect(next.healthProgress).toBe(initialGameState.healthProgress);
  });

  it('pauses a stat with no points and speeds up linearly with more points', () => {
    const state = { ...initialGameState, playerLevel: 5, attackPoints: 0, healthPoints: 3 };
    const next = advanceTraining(state, 1);

    expect(next.attackProgress).toBe(state.attackProgress);
    expect(next.healthProgress).toBe(STAT_TRAINING_PER_POINT * 3);
  });

  it('syncs idle combat health when health training raises max HP', () => {
    const state = {
      ...initialGameState,
      attackPoints: 0,
      healthProgress: statXpNeeded(initialGameState.healthLevel) - 2,
    };
    const next = advanceTraining(state, 1);

    expect(next.healthLevel).toBe(initialGameState.healthLevel + 1);
    expect(next.combat.playerHp).toBe(playerStats(next).maxHp);
  });

  it('derives combat stats from permanent stat levels, not allocated points', () => {
    expect(playerStats({ attackLevel: 3, healthLevel: 4 })).toEqual({
      minDamage: 3,
      maxDamage: 14,
      maxHp: 60,
    });
  });

});

describe('floor definitions', () => {
  it('provides mobs, recommendations and a future loot table for each floor', () => {
    const floor = floorDefinition(1);

    expect(floor.name).toBe('Ashen Tunnels');
    expect(floor.mobs.length).toBeGreaterThanOrEqual(3);
    expect(floor.lootTable.length).toBeGreaterThanOrEqual(3);
    expect(floor.recommendedAttack).toBeGreaterThan(0);
    expect(enemyForFloor(1).name).toBe(floor.mobs[0].name);
  });

  it('scales definitions beyond the authored floor set', () => {
    const floor = floorDefinition(7);

    expect(floor.floor).toBe(7);
    expect(floor.name).toContain('Depth 2');
    expect(floor.recommendedAttack).toBe(13);
  });
});

describe('dungeon combat', () => {
  it('starts with full player and enemy health', () => {
    const started = startCombat(initialGameState);
    expect(started.combat.status).toBe('fighting');
    expect(started.combat.playerHp).toBe(playerStats(initialGameState).maxHp);
    expect(started.combat.enemyHp).toBe(enemyForFloor(1).maxHp);
  });

  it('rewards XP once and unlocks the next floor', () => {
    const base = { ...initialGameState, playerXp: 0 };
    const started = startCombat(base);
    const victory = resolveCombatTick(started, started.combat.enemyHp, 999);
    const repeated = resolveCombatTick(victory, 999, 999);
    const enemy = enemyForFloor(1);

    expect(victory.combat.status).toBe('victory');
    expect(victory.playerXp).toBe(enemy.xpReward);
    expect(victory.highestFloor).toBe(2);
    expect(repeated.playerXp).toBe(victory.playerXp);
  });
});

describe('save handling', () => {
  it('migrates the previous percentage-allocation save into level points', () => {
    const migrated = loadGame(JSON.stringify({
      saveVersion: 1,
      xp: 80,
      trainingPower: 110,
      attackShare: 70,
      attack: { level: 1, progress: 18 },
      health: { level: 1, progress: 12 },
      highestFloor: 2,
      selectedFloor: 2,
    }));

    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    expect(migrated.playerLevel).toBe(3);
    expect(migrated.attackPoints + migrated.healthPoints).toBe(2);
    expect(migrated.attackLevel).toBe(1);
    expect(migrated.healthLevel).toBe(1);
  });

  it('preserves combat power and allocated points from the previous level save', () => {
    const migrated = loadGame(JSON.stringify({
      saveVersion: 2,
      playerLevel: 7,
      playerXp: 35,
      essence: 999,
      trainingPower: 180,
      attackPoints: 4,
      healthPoints: 2,
      highestFloor: 5,
      selectedFloor: 4,
    }));

    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    expect(migrated.playerLevel).toBe(7);
    expect(migrated.playerXp).toBe(35);
    expect(migrated.attackPoints).toBe(4);
    expect(migrated.healthPoints).toBe(2);
    expect(migrated.attackLevel).toBe(4);
    expect(migrated.healthLevel).toBe(2);
    expect(migrated.highestFloor).toBe(5);
    expect(migrated.selectedFloor).toBe(4);
    expect(migrated).not.toHaveProperty('essence');
    expect(migrated).not.toHaveProperty('trainingPower');
  });

  it('falls back safely when saved data is invalid', () => {
    expect(loadGame('{broken')).toEqual(initialGameState);
  });

  it('never restores an active fight', () => {
    const fighting = startCombat(initialGameState);
    expect(loadGame(JSON.stringify(fighting)).combat.status).toBe('idle');
  });
});
