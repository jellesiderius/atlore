import { describe, expect, it } from 'vitest';
import { fold, searchNodes } from './search';
import type { WorldNode } from '$lib/types';

const node = (id: string, title: string): WorldNode => ({
  id,
  title,
  type: 'npc',
  size: 'm',
  summary: '',
  revealed: true,
  visibility: 'all',
  visibleWith: [],
  x: 0,
  y: 0,
  pinned: false,
  pinX: null,
  pinY: null,
  pinMapId: null,
  markerLocked: false,
  imageMediaId: null,
  mapMediaId: null,
  tags: [],
  stats: {},
  gear: [],
  descriptions: [],
  trashedAt: null,
  createdAt: '',
  updatedAt: ''
});

describe('searchNodes', () => {
  const nodes = [node('1', 'Captain Rowan'), node('2', 'De kapitein'), node('3', 'Rówan de Oude')];

  it('zoekt accentongevoelig en over meerdere woorden', () => {
    expect(fold('Rówan')).toBe('rowan');
    expect(searchNodes(nodes, 'cap row')[0]?.id).toBe('1');
  });

  it('geeft contextbonussen zonder niet-matchende nodes toe te voegen', () => {
    const result = searchNodes(nodes, 'rowan', {
      recentIds: ['3'],
      sessionNodeIds: new Set(['3'])
    });
    expect(result[0]?.id).toBe('3');
    expect(result).toHaveLength(2);
  });
});
