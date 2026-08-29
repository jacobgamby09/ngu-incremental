import type { FloorDefinition } from './types';

const floors: FloorDefinition[] = [
  {
    floor: 1,
    encounter: {
      id: 'cinder-rat',
      name: 'Cinder Rat',
      hp: { min: 12, max: 16 },
      damage: { min: 1, max: 3 },
    },
    xpReward: 14,
  },
  {
    floor: 2,
    encounter: {
      id: 'ash-goblin',
      name: 'Ash Goblin',
      hp: { min: 22, max: 28 },
      damage: { min: 2, max: 4 },
    },
    xpReward: 22,
  },
  {
    floor: 3,
    encounter: {
      id: 'tunnel-brute',
      name: 'Tunnel Brute',
      hp: { min: 38, max: 46 },
      damage: { min: 4, max: 7 },
    },
    xpReward: 34,
  },
  {
    floor: 4,
    encounter: {
      id: 'emberling',
      name: 'Emberling',
      hp: { min: 54, max: 64 },
      damage: { min: 5, max: 8 },
    },
    xpReward: 46,
  },
  {
    floor: 5,
    encounter: {
      id: 'cinder-warden',
      name: 'Cinder Warden',
      hp: { min: 72, max: 82 },
      damage: { min: 7, max: 11 },
    },
    xpReward: 80,
  },
];

function scaleRange(min: number, max: number, multiplier: number) {
  return {
    min: Math.max(1, Math.round(min * multiplier)),
    max: Math.max(1, Math.round(max * multiplier)),
  };
}

export function floorDefinition(floor: number): FloorDefinition {
  const safeFloor = Math.max(1, Math.floor(floor));
  const template = floors[(safeFloor - 1) % floors.length];
  const depth = Math.floor((safeFloor - 1) / floors.length);
  if (depth === 0) return structuredClone(template);

  const healthMultiplier = 1 + depth * 0.72;
  return {
    ...structuredClone(template),
    floor: safeFloor,
    encounter: {
      ...structuredClone(template.encounter),
      id: `${template.encounter.id}-${depth + 1}`,
      name: `${template.encounter.name} · ${depth + 1}`,
      hp: scaleRange(
        template.encounter.hp.min,
        template.encounter.hp.max,
        healthMultiplier,
      ),
      damage: scaleRange(
        template.encounter.damage.min,
        template.encounter.damage.max,
        1 + depth * 0.48,
      ),
    },
    xpReward: Math.round(template.xpReward * healthMultiplier),
  };
}
