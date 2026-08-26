import type { NodeType, Rights } from '$lib/types';

export const DEFAULT_RIGHTS: Rights = {
  create: true,
  edit: true,
  link: true,
  delete: false,
  image: true,
  write: true,
  session: false,
  history: false,
  mapUpload: false,
  pin: false,
  reveal: false,
  seeSecret: false,
  dmNotes: false,
  invite: false,
  settings: false
};

export const STRICT_RIGHTS: Rights = {
  ...Object.fromEntries(Object.keys(DEFAULT_RIGHTS).map((key) => [key, false])),
  write: true
} as Rights;

export const OPEN_RIGHTS: Rights = Object.fromEntries(
  Object.keys(DEFAULT_RIGHTS).map((key) => [key, true])
) as unknown as Rights;

export const BUILTIN_NODE_TYPES: NodeType[] = [
  ['character', 'Personages', 'Personage', '#e7bd58', '#9b6500'],
  ['npc', "NPC's", 'NPC', '#d88b63', '#a64a24'],
  ['location', 'Locaties', 'Locatie', '#63c4a8', '#18765f'],
  ['building', 'Gebouwen', 'Gebouw', '#79b5cf', '#266a8c'],
  ['region', "Regio's", 'Regio', '#4ca696', '#12685a'],
  ['faction', 'Facties', 'Factie', '#b47bd7', '#704398'],
  ['quest', 'Quests', 'Quest', '#ef8e3f', '#a74b09'],
  ['item', 'Voorwerpen', 'Voorwerp', '#7f8ee8', '#4554a8'],
  ['monster', 'Monsters', 'Monster', '#db6868', '#a32f35'],
  ['session', 'Sessies', 'Sessie', '#aab3c2', '#526071'],
  ['lore', 'Lore', 'Lore', '#9c89c8', '#625093'],
  ['deity', 'Goden', 'Godheid', '#d5a361', '#8e5c20']
].map(([key, nl, one, colorDark, colorLight]) => ({
  key,
  nl,
  one,
  colorDark,
  colorLight,
  custom: false
}));

export const NODE_COLOR_SWATCHES = [
  '#e7bd58',
  '#d88b63',
  '#63c4a8',
  '#79b5cf',
  '#b47bd7',
  '#ef8e3f',
  '#7f8ee8',
  '#db6868',
  '#9c89c8',
  '#d5a361',
  '#72b2ff',
  '#d978a8'
];

export const PLACE_TYPES = new Set(['location', 'building', 'region']);
