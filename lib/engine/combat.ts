import { createRng } from './rng';
import type {
  Combatant,
  CombatEvent,
  CombatResult,
  FloorDefinition,
} from './types';

const MAX_ROUNDS = 500;

export function resolveCombat(input: {
  seed: string;
  player: Combatant;
  floor: FloorDefinition;
}): CombatResult {
  const { seed, player, floor } = input;
  const rng = createRng(`${seed}:combat`);
  const enemyCount = rng.integer(
    floor.encounter.count.min,
    floor.encounter.count.max,
  );
  const enemyHp = Array.from({ length: enemyCount }, () =>
    rng.integer(floor.encounter.hp.min, floor.encounter.hp.max),
  );
  const initialEnemyHp = [...enemyHp];
  const events: CombatEvent[] = [];
  let playerHp = Math.max(0, Math.min(player.currentHp, player.maxHp));

  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    const target = enemyHp.findIndex((hp) => hp > 0);
    if (target === -1) {
      events.push({ type: 'victory', round, playerHp });
      return {
        seed,
        outcome: 'victory',
        enemyCount,
        initialEnemyHp,
        remainingHp: playerHp,
        events,
      };
    }

    const playerDamage = rng.integer(player.damage.min, player.damage.max);
    enemyHp[target] = Math.max(0, enemyHp[target] - playerDamage);
    events.push({
      type: 'player-attack',
      round,
      target,
      damage: playerDamage,
      targetHp: enemyHp[target],
    });

    if (enemyHp.every((hp) => hp === 0)) {
      events.push({ type: 'victory', round, playerHp });
      return {
        seed,
        outcome: 'victory',
        enemyCount,
        initialEnemyHp,
        remainingHp: playerHp,
        events,
      };
    }

    for (let source = 0; source < enemyHp.length; source += 1) {
      if (enemyHp[source] === 0) continue;
      const rawDamage = rng.integer(
        floor.encounter.damage.min,
        floor.encounter.damage.max,
      );
      const damage = Math.max(0, rawDamage - player.armor);
      playerHp = Math.max(0, playerHp - damage);
      events.push({
        type: 'enemy-attack',
        round,
        source,
        rawDamage,
        damage,
        playerHp,
      });
      if (playerHp === 0) {
        events.push({ type: 'defeat', round });
        return {
          seed,
          outcome: 'defeat',
          enemyCount,
          initialEnemyHp,
          remainingHp: 0,
          events,
        };
      }
    }
  }

  throw new Error(`Combat exceeded ${MAX_ROUNDS} rounds`);
}

export function canFloorDamagePlayer(
  player: Combatant,
  floor: FloorDefinition,
) {
  if (Math.max(0, floor.encounter.damage.max - player.armor) === 0)
    return false;
  return !(
    floor.encounter.count.max === 1 &&
    player.damage.min >= floor.encounter.hp.max
  );
}
