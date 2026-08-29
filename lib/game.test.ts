import { describe, expect, it } from 'vitest';

import {
  SAVE_VERSION,
  STAT_TRAINING_PER_POINT,
  addPlayerXp,
  advanceCombatEvent,
  advanceTraining,
  allocateStatPoint,
  availableStatPoints,
  initialGameState,
  loadGame,
  playerStats,
  returnStatPoint,
  saveableState,
  startRun,
  statXpNeeded,
  xpNeeded,
  type GameState,
} from './game';

function finishRun(state: GameState) {
  let next = state;
  for (let event = 0; event < 20_000; event += 1) {
    if (next.run.status === 'results') return next;
    next = advanceCombatEvent(next);
  }
  throw new Error('Run did not finish');
}

describe('player progression', () => {
  it('advances both stat bars without granting player XP', () => {
    const next = advanceTraining(initialGameState, 1);
    expect(next.playerXp).toBe(initialGameState.playerXp);
    expect(next.playerLevel).toBe(initialGameState.playerLevel);
    expect(next.attackProgress).toBe(STAT_TRAINING_PER_POINT);
    expect(next.healthProgress).toBe(STAT_TRAINING_PER_POINT);
  });

  it('grants and freely reallocates one point per player level', () => {
    const nearLevel = {
      ...initialGameState,
      playerXp: xpNeeded(initialGameState.playerLevel) - 2,
    };
    const leveled = addPlayerXp(nearLevel, 5);
    const allocated = allocateStatPoint(leveled, 'attack');
    const returned = returnStatPoint(allocated, 'attack');
    expect(leveled.playerXp).toBe(3);
    expect(availableStatPoints(leveled)).toBe(1);
    expect(availableStatPoints(allocated)).toBe(0);
    expect(availableStatPoints(returned)).toBe(1);
  });

  it('levels stats directly when their live bars complete', () => {
    const state = {
      ...initialGameState,
      attackProgress: statXpNeeded(initialGameState.attackLevel) - 2,
      healthPoints: 0,
    };
    const next = advanceTraining(state, 1);
    expect(next.attackLevel).toBe(initialGameState.attackLevel + 1);
    expect(next.attackProgress).toBe(STAT_TRAINING_PER_POINT - 2);
    expect(next.healthProgress).toBe(state.healthProgress);
  });

  it('continues live stat progress while combat is active', () => {
    const running = startRun(initialGameState, 'active-training-test');
    const next = advanceTraining(running, 1);
    expect(next.attackProgress - running.attackProgress).toBe(
      STAT_TRAINING_PER_POINT,
    );
    expect(next.healthProgress - running.healthProgress).toBe(
      STAT_TRAINING_PER_POINT,
    );
    expect(next.run).toEqual(running.run);
  });

  it('derives combat stats from permanent stat levels', () => {
    expect(playerStats({ attackLevel: 3, healthLevel: 4 })).toEqual({
      minDamage: 3,
      maxDamage: 14,
      maxHp: 60,
      armor: 0,
    });
  });
});

describe('automatic dungeon run', () => {
  it('always starts directly in combat on floor 1', () => {
    const started = startRun(initialGameState, 'first-run');
    expect(started.run.status).toBe('fighting');
    expect(started.run.floor).toBe(1);
    expect(started.combat.status).toBe('fighting');
    expect(started.run.events.length).toBeGreaterThan(0);
  });

  it('continues automatically after a victory with remaining HP', () => {
    let state = startRun(
      {
        ...initialGameState,
        attackLevel: 20,
        healthLevel: 20,
      },
      'auto-next-floor',
    );
    const startingHp = state.run.playerHp;
    while (state.run.floor === 1) state = advanceCombatEvent(state);
    expect(state.run.status).toBe('fighting');
    expect(state.run.floor).toBe(2);
    expect(state.run.xpGained).toBeGreaterThan(0);
    expect(state.run.playerHp).toBeLessThanOrEqual(startingHp);
  });

  it('awards accumulated Dungeon XP only when the run ends', () => {
    const started = startRun(initialGameState, 'xp-on-death');
    let progressed = started;
    while (progressed.run.floor === 1) {
      progressed = advanceCombatEvent(progressed);
    }
    expect(progressed.playerXp).toBe(started.playerXp);
    expect(progressed.run.xpGained).toBeGreaterThan(0);

    const finished = finishRun(progressed);
    expect(finished.run.status).toBe('results');
    expect(finished.playerXp).not.toBe(started.playerXp);
    expect(finished.run.floor).toBeGreaterThanOrEqual(2);
    expect(finished.highestFloor).toBeGreaterThanOrEqual(finished.run.floor);
  });

  it('stores the levels gained for the result overview', () => {
    const boosted = {
      ...initialGameState,
      playerXp: xpNeeded(initialGameState.playerLevel) - 1,
      attackLevel: 8,
      healthLevel: 8,
    };
    const finished = finishRun(startRun(boosted, 'level-summary'));
    expect(finished.run.levelsGained).toBeGreaterThan(0);
    expect(finished.playerLevel).toBe(
      finished.run.startingPlayerLevel + finished.run.levelsGained,
    );
  });
});

describe('save handling', () => {
  it('migrates the previous save without loot or floor selection state', () => {
    const migrated = loadGame(
      JSON.stringify({
        saveVersion: 5,
        playerLevel: 7,
        playerXp: 35,
        attackPoints: 4,
        healthPoints: 2,
        attackLevel: 9,
        attackProgress: 12,
        healthLevel: 8,
        healthProgress: 7,
        highestFloor: 5,
        selectedFloor: 4,
        inventory: [{ id: 'gold', quantity: 10 }],
      }),
    );
    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    expect(migrated.attackLevel).toBe(9);
    expect(migrated.healthLevel).toBe(8);
    expect(migrated.highestFloor).toBe(4);
    expect(migrated.run.status).toBe('idle');
    expect(migrated).not.toHaveProperty('inventory');
    expect(migrated).not.toHaveProperty('selectedFloor');
  });

  it('preserves an active seeded run and its event position on reload', () => {
    const progressed = advanceCombatEvent(
      startRun(initialGameState, 'reload-test'),
    );
    const restored = loadGame(JSON.stringify(saveableState(progressed)));
    expect(restored.run.status).toBe('fighting');
    expect(restored.run.seed).toBe('reload-test');
    expect(restored.run.eventIndex).toBe(1);
    expect(restored.run.events).toEqual(progressed.run.events);
  });

  it('falls back safely when saved data is invalid', () => {
    expect(loadGame('{broken')).toEqual(initialGameState);
  });
});
