import type { FloorDefinition } from './types';

const floors: FloorDefinition[] = [
  {
    floor: 1,
    name: 'Ashen Tunnels',
    description:
      'Collapsed mine shafts where ember-fed vermin gather in the dark.',
    encounter: {
      id: 'cinder-rat',
      name: 'Cinder Rat',
      title: 'Ember-fed vermin',
      role: 'Common',
      count: { min: 1, max: 2 },
      hp: { min: 7, max: 9 },
      damage: { min: 1, max: 3 },
      rules: ['All surviving enemies attack after your strike.'],
    },
    lootTable: [
      {
        id: 'gold',
        name: 'Gold',
        rarity: 'Common',
        dropChance: 100,
        quantity: { min: 4, max: 8 },
        knownValue: 1,
      },
      {
        id: 'frayed-wraps',
        name: 'Frayed Wraps',
        rarity: 'Common',
        dropChance: 30,
        quantity: { min: 1, max: 1 },
        knownValue: 12,
      },
    ],
    xpReward: 14,
  },
  {
    floor: 2,
    name: 'Scavenger Camp',
    description:
      'A crude barricade blocks the shaft, watched by hungry tunnel scavengers.',
    encounter: {
      id: 'ash-goblin',
      name: 'Ash Goblin',
      title: 'Tunnel scavenger',
      role: 'Common',
      count: { min: 2, max: 3 },
      hp: { min: 9, max: 12 },
      damage: { min: 2, max: 4 },
      rules: ['All surviving enemies attack after your strike.'],
    },
    lootTable: [
      {
        id: 'gold',
        name: 'Gold',
        rarity: 'Common',
        dropChance: 100,
        quantity: { min: 7, max: 13 },
        knownValue: 1,
      },
      {
        id: 'goblin-shiv',
        name: 'Goblin Shiv',
        rarity: 'Uncommon',
        dropChance: 18,
        quantity: { min: 1, max: 1 },
        knownValue: 28,
      },
    ],
    xpReward: 22,
  },
  {
    floor: 3,
    name: 'Lower Shaft',
    description:
      'The narrow mine opens around a single brute guarding abandoned equipment.',
    encounter: {
      id: 'tunnel-brute',
      name: 'Tunnel Brute',
      title: 'Warden of the lower shaft',
      role: 'Elite',
      count: { min: 1, max: 1 },
      hp: { min: 28, max: 34 },
      damage: { min: 4, max: 7 },
      rules: ['Heavy blows have a wide declared damage range.'],
    },
    lootTable: [
      {
        id: 'gold',
        name: 'Gold',
        rarity: 'Common',
        dropChance: 100,
        quantity: { min: 12, max: 20 },
        knownValue: 1,
      },
      {
        id: 'iron-ore',
        name: 'Iron Ore',
        rarity: 'Uncommon',
        dropChance: 45,
        quantity: { min: 1, max: 3 },
        knownValue: 18,
      },
      {
        id: 'rusted-war-axe',
        name: 'Rusted War Axe',
        rarity: 'Rare',
        dropChance: 10,
        quantity: { min: 1, max: 1 },
        knownValue: 120,
      },
    ],
    xpReward: 34,
  },
  {
    floor: 4,
    name: 'Ember Nest',
    description:
      'A hot chamber alive with a swarm nesting below the old furnaces.',
    encounter: {
      id: 'emberling',
      name: 'Emberling',
      title: 'Furnace-born swarm',
      role: 'Common',
      count: { min: 3, max: 5 },
      hp: { min: 8, max: 11 },
      damage: { min: 2, max: 4 },
      rules: ['Every surviving Emberling attacks each round.'],
    },
    lootTable: [
      {
        id: 'gold',
        name: 'Gold',
        rarity: 'Common',
        dropChance: 100,
        quantity: { min: 18, max: 28 },
        knownValue: 1,
      },
      {
        id: 'ember-dust',
        name: 'Ember Dust',
        rarity: 'Uncommon',
        dropChance: 55,
        quantity: { min: 2, max: 4 },
        knownValue: 22,
      },
    ],
    xpReward: 46,
  },
  {
    floor: 5,
    name: 'The Furnace Gate',
    description:
      'The first descent ends before a warden bound to a fire that never cools.',
    encounter: {
      id: 'cinder-warden',
      name: 'Cinder Warden',
      title: 'Keeper of the first threshold',
      role: 'Boss',
      count: { min: 1, max: 1 },
      hp: { min: 68, max: 76 },
      damage: { min: 7, max: 11 },
      rules: [
        'Boss encounter.',
        'Defeating the Warden marks a permanent milestone.',
      ],
    },
    lootTable: [
      {
        id: 'gold',
        name: 'Gold',
        rarity: 'Common',
        dropChance: 100,
        quantity: { min: 35, max: 50 },
        knownValue: 1,
      },
      {
        id: 'ashen-token',
        name: 'Ashen Token',
        rarity: 'Rare',
        dropChance: 100,
        quantity: { min: 1, max: 1 },
        knownValue: 180,
      },
      {
        id: 'warden-core',
        name: 'Warden Core',
        rarity: 'Epic',
        dropChance: 12,
        quantity: { min: 1, max: 1 },
        knownValue: 420,
      },
    ],
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

  const multiplier = 1 + depth * 0.72;
  return {
    ...structuredClone(template),
    floor: safeFloor,
    name: `${template.name} · Depth ${depth + 1}`,
    encounter: {
      ...structuredClone(template.encounter),
      id: `${template.encounter.id}-${depth + 1}`,
      hp: scaleRange(
        template.encounter.hp.min,
        template.encounter.hp.max,
        multiplier,
      ),
      damage: scaleRange(
        template.encounter.damage.min,
        template.encounter.damage.max,
        1 + depth * 0.48,
      ),
    },
    lootTable: template.lootTable.map((entry) => ({
      ...entry,
      id: entry.id === 'gold' ? entry.id : `${entry.id}-${depth + 1}`,
      quantity: scaleRange(
        entry.quantity.min,
        entry.quantity.max,
        1 + depth * 0.5,
      ),
    })),
    xpReward: Math.round(template.xpReward * multiplier),
  };
}
