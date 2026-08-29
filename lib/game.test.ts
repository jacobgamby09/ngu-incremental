import { describe, expect, it } from 'vitest';

import {
  SAVE_VERSION,
  STAT_TRAINING_PER_POINT,
  TRAINING_XP_PER_SECOND,
  addPlayerXp,
  advanceCombatEvent,
  advanceTraining,
  allocateStatPoint,
  availableStatPoints,
  bankRun,
  equipRunItem,
  floorDefinition,
  initialGameState,
  loadGame,
  lootValue,
  playerStats,
  playerDamageRange,
  returnStatPoint,
  saveableState,
  skipCombat,
  startRun,
  statXpNeeded,
  xpNeeded,
} from './game';

describe('player progression', () => {
  it('advances player XP and both allocated stat training bars', () => {
    const next = advanceTraining(initialGameState, 1);
    expect(next.playerXp - initialGameState.playerXp).toBeCloseTo(
      TRAINING_XP_PER_SECOND,
      5,
    );
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

  it('continues live stat progress while a run is active', () => {
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

describe('floor information', () => {
  it('declares complete encounter and loot ranges without recommendations', () => {
    const floor = floorDefinition(1);
    expect(floor.encounter.count).toEqual({ min: 1, max: 2 });
    expect(floor.encounter.hp.min).toBeGreaterThan(0);
    expect(floor.encounter.damage.max).toBeGreaterThanOrEqual(
      floor.encounter.damage.min,
    );
    expect(
      floor.lootTable.every(
        (entry) => entry.quantity.min > 0 && entry.dropChance > 0,
      ),
    ).toBe(true);
    expect(floor).not.toHaveProperty('recommendedAttack');
  });

  it('scales authored floors into later depths', () => {
    const first = floorDefinition(1);
    const later = floorDefinition(6);
    expect(later.name).toContain('Depth 2');
    expect(later.encounter.hp.min).toBeGreaterThan(first.encounter.hp.min);
  });
});

describe('run loop', () => {
  it('resolves an authored event list into a stop/go decision', () => {
    const started = startRun(initialGameState, 'first-run');
    expect(started.run.status).toBe('fighting');
    expect(started.run.events.length).toBeGreaterThan(0);
    const resolved = skipCombat(started);
    expect(resolved.run.status).toBe('decision');
    expect(resolved.highestFloor).toBe(2);
    expect(resolved.run.bag.find((item) => item.id === 'gold')).toBeDefined();
    expect(resolved.run.playerHp).toBeLessThanOrEqual(
      playerStats(resolved).maxHp,
    );
  });

  it('plays the pre-resolved result one immutable event at a time', () => {
    const started = startRun(initialGameState, 'event-playback');
    const next = advanceCombatEvent(started);
    expect(next.run.eventIndex).toBe(1);
    expect(started.run.eventIndex).toBe(0);
    expect(next.run.events).toEqual(started.run.events);
  });

  it('banks the concrete bag permanently', () => {
    const won = skipCombat(startRun(initialGameState, 'bank-test'));
    const valueAtRisk = lootValue(won.run.bag);
    const banked = bankRun(won);
    expect(banked.run.status).toBe('returned');
    expect(banked.run.bag).toEqual([]);
    expect(lootValue(banked.inventory)).toBe(valueAtRisk);
  });

  it('lets a found unbanked axe change the next combat damage profile', () => {
    const won = skipCombat(startRun(initialGameState, 'gear-test'));
    const withAxe = {
      ...won,
      run: {
        ...won.run,
        bag: [
          ...won.run.bag,
          {
            id: 'rusted-war-axe',
            name: 'Rusted War Axe',
            rarity: 'Rare' as const,
            quantity: 1,
            knownValue: 120,
          },
        ],
      },
    };
    const equipped = equipRunItem(withAxe, 'rusted-war-axe');
    expect(equipped.run.equippedItemId).toBe('rusted-war-axe');
    expect(playerDamageRange(equipped)).toEqual({ min: 2, max: 24 });
    expect(won.run.equippedItemId).toBeNull();
  });
});

describe('save handling', () => {
  it('migrates the existing v4 save without losing permanent stat levels', () => {
    const migrated = loadGame(
      JSON.stringify({
        saveVersion: 4,
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
      }),
    );
    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    expect(migrated.attackLevel).toBe(9);
    expect(migrated.healthLevel).toBe(8);
    expect(migrated.inventory).toEqual([]);
    expect(migrated.run.status).toBe('idle');
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
