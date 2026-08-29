import { createRng } from './rng';
import type { FloorDefinition, LootStack } from './types';

export function resolveLoot(seed: string, floor: FloorDefinition): LootStack[] {
  const rng = createRng(`${seed}:loot`);
  return floor.lootTable.flatMap((entry) => {
    if (!rng.chance(entry.dropChance)) return [];
    return [
      {
        id: entry.id,
        name: entry.name,
        rarity: entry.rarity,
        quantity: rng.integer(entry.quantity.min, entry.quantity.max),
        knownValue: entry.knownValue,
      },
    ];
  });
}

export function mergeLoot(left: LootStack[], right: LootStack[]) {
  const merged = left.map((entry) => ({ ...entry }));
  for (const entry of right) {
    const existing = merged.find((candidate) => candidate.id === entry.id);
    if (existing) existing.quantity += entry.quantity;
    else merged.push({ ...entry });
  }
  return merged;
}

export function lootValue(entries: LootStack[]) {
  return entries.reduce(
    (total, entry) => total + entry.knownValue * entry.quantity,
    0,
  );
}
