import { describe, expect, it } from 'vitest';

import {
  POWER_UPGRADE_COST,
  addPlayerXp,
  advanceTraining,
  allocateStatPoint,
  availableStatPoints,
  buyTrainingPower,
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

    expect(next.playerXp - initialGameState.playerXp).toBeCloseTo(100 / 26, 5);
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

  it('spends Essence—not XP progress—on Training Power', () => {
    const state = { ...initialGameState, essence: POWER_UPGRADE_COST, playerXp: 37 };
    const next = buyTrainingPower(state);

    expect(next.trainingPower).toBe(initialGameState.trainingPower + 10);
    expect(next.essence).toBe(0);
    expect(next.playerXp).toBe(37);
  });
});

describe('dungeon combat', () => {
  it('starts with full player and enemy health', () => {
    const started = startCombat(initialGameState);
    expect(started.combat.status).toBe('fighting');
    expect(started.combat.playerHp).toBe(playerStats(initialGameState).maxHp);
    expect(started.combat.enemyHp).toBe(enemyForFloor(1).maxHp);
  });

  it('rewards XP and Essence once and unlocks the next floor', () => {
    const base = { ...initialGameState, playerXp: 0, essence: 0 };
    const started = startCombat(base);
    const victory = resolveCombatTick(started, started.combat.enemyHp, 999);
    const repeated = resolveCombatTick(victory, 999, 999);
    const enemy = enemyForFloor(1);

    expect(victory.combat.status).toBe('victory');
    expect(victory.playerXp).toBe(enemy.xpReward);
    expect(victory.essence).toBe(enemy.essenceReward);
    expect(victory.highestFloor).toBe(2);
    expect(repeated.playerXp).toBe(victory.playerXp);
    expect(repeated.essence).toBe(victory.essence);
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

    expect(migrated.saveVersion).toBe(2);
    expect(migrated.playerLevel).toBe(3);
    expect(migrated.attackPoints + migrated.healthPoints).toBe(2);
    expect(migrated.essence).toBe(80);
    expect(migrated.trainingPower).toBe(110);
  });

  it('falls back safely when saved data is invalid', () => {
    expect(loadGame('{broken')).toEqual(initialGameState);
  });

  it('never restores an active fight', () => {
    const fighting = startCombat(initialGameState);
    expect(loadGame(JSON.stringify(fighting)).combat.status).toBe('idle');
  });
});
