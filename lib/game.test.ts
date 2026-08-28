import { describe, expect, it } from 'vitest';

import {
  POWER_UPGRADE_COST,
  addStatProgress,
  advanceTraining,
  buyTrainingPower,
  enemyForFloor,
  initialGameState,
  loadGame,
  playerStats,
  resolveCombatTick,
  startCombat,
  xpNeeded,
} from './game';

describe('training progression', () => {
  it('splits every training tick using one complementary allocation', () => {
    const state = { ...initialGameState, attackShare: 70, trainingPower: 100 };
    const next = advanceTraining(state, 1);
    const totalGain = next.attack.progress - state.attack.progress + next.health.progress - state.health.progress;
    const attackGain = next.attack.progress - state.attack.progress;

    expect(totalGain).toBeCloseTo(100 / 26, 5);
    expect(attackGain / totalGain).toBeCloseTo(0.7, 5);
  });

  it('carries progress through a level-up', () => {
    const required = xpNeeded(1);
    expect(addStatProgress({ level: 1, progress: required - 2 }, 5)).toEqual({ level: 2, progress: 3 });
  });

  it('only buys power when the player can afford it', () => {
    const rich = { ...initialGameState, xp: POWER_UPGRADE_COST };
    const poor = { ...initialGameState, xp: POWER_UPGRADE_COST - 1 };

    expect(buyTrainingPower(rich).trainingPower).toBe(initialGameState.trainingPower + 10);
    expect(buyTrainingPower(rich).xp).toBe(0);
    expect(buyTrainingPower(poor)).toBe(poor);
  });
});

describe('dungeon combat', () => {
  it('starts with full player and enemy health', () => {
    const started = startCombat(initialGameState);
    expect(started.combat.status).toBe('fighting');
    expect(started.combat.playerHp).toBe(playerStats(initialGameState).maxHp);
    expect(started.combat.enemyHp).toBe(enemyForFloor(1).maxHp);
  });

  it('rewards a victory once and unlocks the next floor', () => {
    const started = startCombat({ ...initialGameState, xp: 0 });
    const victory = resolveCombatTick(started, started.combat.enemyHp, 999);
    const repeated = resolveCombatTick(victory, 999, 999);

    expect(victory.combat.status).toBe('victory');
    expect(victory.xp).toBe(enemyForFloor(1).reward);
    expect(victory.highestFloor).toBe(2);
    expect(victory.selectedFloor).toBe(1);
    expect(repeated.xp).toBe(victory.xp);
  });
});

describe('save handling', () => {
  it('falls back safely when saved data is invalid', () => {
    expect(loadGame('{broken')).toEqual(initialGameState);
  });

  it('never restores an active fight', () => {
    const fighting = startCombat(initialGameState);
    expect(loadGame(JSON.stringify(fighting)).combat.status).toBe('idle');
  });
});
