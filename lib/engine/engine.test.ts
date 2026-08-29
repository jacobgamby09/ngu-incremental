import { describe, expect, it } from 'vitest';

import { canFloorDamagePlayer, resolveCombat } from './combat';
import { floorDefinition } from './floors';
import { resolveLoot } from './loot';
import { createRng } from './rng';

describe('seeded RNG', () => {
  it('produces an identical integer sequence for the same seed', () => {
    const first = createRng('same-seed');
    const second = createRng('same-seed');
    expect(Array.from({ length: 20 }, () => first.integer(1, 100))).toEqual(
      Array.from({ length: 20 }, () => second.integer(1, 100)),
    );
  });

  it('includes both endpoints of declared integer ranges over a large sample', () => {
    const rng = createRng('range-test');
    const values = new Set(
      Array.from({ length: 2000 }, () => rng.integer(3, 5)),
    );
    expect(values).toEqual(new Set([3, 4, 5]));
  });
});

describe('combat engine', () => {
  const player = {
    currentHp: 80,
    maxHp: 80,
    damage: { min: 5, max: 15 },
    armor: 0,
  };

  it('returns exactly the same event list for the same inputs', () => {
    const input = { seed: 'combat-replay', player, floor: floorDefinition(2) };
    expect(resolveCombat(input)).toEqual(resolveCombat(input));
  });

  it('always lets the player attack before surviving enemies answer', () => {
    const result = resolveCombat({
      seed: 'turn-order',
      player,
      floor: floorDefinition(2),
    });
    expect(result.events[0]?.type).toBe('player-attack');
    const firstEnemyAttack = result.events.findIndex(
      (event) => event.type === 'enemy-attack',
    );
    expect(firstEnemyAttack).toBeGreaterThan(0);
  });

  it('distinguishes provably harmless floors from floors that can deal damage', () => {
    const floor = floorDefinition(1);
    expect(
      canFloorDamagePlayer(
        { ...player, armor: floor.encounter.damage.max },
        floor,
      ),
    ).toBe(false);
    expect(canFloorDamagePlayer(player, floor)).toBe(true);
  });
});

describe('loot engine', () => {
  it('resolves concrete drops deterministically and within declared ranges', () => {
    const floor = floorDefinition(3);
    const first = resolveLoot('loot-seed', floor);
    expect(first).toEqual(resolveLoot('loot-seed', floor));
    for (const drop of first) {
      const declaration = floor.lootTable.find((entry) => entry.id === drop.id);
      expect(drop.quantity).toBeGreaterThanOrEqual(
        declaration?.quantity.min ?? 0,
      );
      expect(drop.quantity).toBeLessThanOrEqual(
        declaration?.quantity.max ?? Number.POSITIVE_INFINITY,
      );
    }
  });
});
