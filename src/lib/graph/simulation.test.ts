import { describe, expect, it } from 'vitest';
import {
  connectedDepths,
  propagateDragDelta,
  stepForceSimulation,
  type SimulationNode
} from './simulation';

const settings = { repel: 700, distance: 70, grouping: 0.65, gravity: 0.3 };
const nodes: SimulationNode[] = [
  {
    id: 'a',
    radius: 12,
    halfWidth: 30,
    halfHeight: 34,
    degree: 1,
    community: 0,
    pinned: false
  },
  {
    id: 'b',
    radius: 12,
    halfWidth: 30,
    halfHeight: 34,
    degree: 2,
    community: 0,
    pinned: false
  },
  {
    id: 'c',
    radius: 12,
    halfWidth: 30,
    halfHeight: 34,
    degree: 1,
    community: 0,
    pinned: false
  },
  {
    id: 'd',
    radius: 12,
    halfWidth: 30,
    halfHeight: 34,
    degree: 2,
    community: 0,
    pinned: false
  },
  {
    id: 'e',
    radius: 12,
    halfWidth: 30,
    halfHeight: 34,
    degree: 1,
    community: 0,
    pinned: false
  }
];
const links = [
  { sourceId: 'a', targetId: 'b' },
  { sourceId: 'b', targetId: 'c' },
  { sourceId: 'c', targetId: 'd' },
  { sourceId: 'd', targetId: 'e' }
];

describe('live graph simulation', () => {
  it('geeft een drag direct door aan iedere volgende verbindingsring', () => {
    const positions = new Map(nodes.map((node, index) => [node.id, { x: index * 110, y: 0 }]));
    const velocities = new Map<string, { x: number; y: number }>();
    const depths = connectedDepths('a', links);

    propagateDragDelta(nodes, depths, positions, velocities, 100, 20);

    expect(depths.get('e')).toBe(4);
    expect(positions.get('b')!.x).toBeGreaterThan(110);
    expect(positions.get('c')!.x).toBeGreaterThan(220);
    expect(positions.get('d')!.x).toBeGreaterThan(330);
    expect(positions.get('e')!.x).toBeGreaterThan(440);
    expect(positions.get('b')!.x - 110).toBeGreaterThan(positions.get('e')!.x - 440);
  });

  it('laat verbonden nodes reageren terwijl de gesleepte node gefixeerd blijft', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 110, y: 0 }],
      ['c', { x: 220, y: 0 }],
      ['d', { x: 330, y: 0 }],
      ['e', { x: 440, y: 0 }]
    ]);
    const velocities = new Map<string, { x: number; y: number }>();
    positions.get('a')!.x = -180;

    for (let index = 0; index < 45; index++)
      stepForceSimulation({
        nodes,
        links,
        positions,
        velocities,
        settings,
        alpha: 0.34,
        draggedId: 'a'
      });

    expect(positions.get('a')!.x).toBe(-180);
    expect(positions.get('b')!.x).toBeLessThan(110);
    expect(positions.get('c')!.x).toBeLessThan(220);
    expect(positions.get('d')!.x).toBeLessThan(330);
    expect(positions.get('e')!.x).toBeLessThan(440);
  });

  it('verplaatst een expliciet vastgezette node niet', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 300, y: 0 }],
      ['c', { x: 600, y: 0 }]
    ]);
    const velocities = new Map<string, { x: number; y: number }>();

    stepForceSimulation({
      nodes: nodes.map((node) => (node.id === 'b' ? { ...node, pinned: true } : node)),
      links,
      positions,
      velocities,
      settings,
      alpha: 0.5
    });

    expect(positions.get('b')).toEqual({ x: 300, y: 0 });
  });
});
