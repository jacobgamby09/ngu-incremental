import { describe, expect, it } from 'vitest';

import {
  SAVE_VERSION,
  TRAINING_XP_PER_SECOND,
  addPlayerXp,
  advanceTraining,
  allocateStatPoint,
  availableStatPoints,
  enemyForFloor,
  initialGameState,
  loadGame,
  playerStats,
  resolveCombatTick,
  returnStatPoint,
  startCombat,
  xpNeeded,
} from './game';

describe('player level progression', () => {
  it('sends all automatic training into one player XP bar', () => {
    const next = advanceTraining(initialGameState, 1);

    expect(next.playerXp - initialGameState.playerXp).toBeCloseTo(TRAINING_XP_PER_SECOND, 5);
    expect(next.attackPoints).toBe(initialGameState.attackPoints);
    expect(next.healthPoints).toBe(initialGameState.healthPoints);
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

  it('derives combat stats only from allocated points', () => {
    expect(playerStats({ attackPoints: 3, healthPoints: 4 })).toEqual({
      minDamage: 3,
      maxDamage: 14,
      maxHp: 60,
    });
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
  });

  it('preserves levels and allocated points from the previous level save', () => {
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
