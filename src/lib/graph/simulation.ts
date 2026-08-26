export type SimulationSettings = {
  repel: number;
  distance: number;
  grouping: number;
  gravity: number;
};

export type SimulationPoint = { x: number; y: number };
export type SimulationVelocity = { x: number; y: number };
export type SimulationNode = {
  id: string;
  radius: number;
  halfWidth: number;
  halfHeight: number;
  degree: number;
  community: number;
  pinned: boolean;
};
export type SimulationLink = { sourceId: string; targetId: string };

type SimulationStep = {
  nodes: SimulationNode[];
  links: SimulationLink[];
  positions: Map<string, SimulationPoint>;
  velocities: Map<string, SimulationVelocity>;
  settings: SimulationSettings;
  alpha: number;
  draggedId?: string | null;
  live?: boolean;
  linkScale?: number;
  aspectRatio?: number;
};

/**
 * One frame of the force engine used by the graph. The coefficients mirror the
 * prototype: charge, link springs, label-aware collision, community attraction,
 * centering gravity and velocity damping all operate on the same particles.
 */
export function stepForceSimulation({
  nodes,
  links,
  positions,
  velocities,
  settings,
  alpha,
  draggedId = null,
  live = true,
  linkScale = 1,
  aspectRatio = 1
}: SimulationStep): void {
  if (!nodes.length || alpha <= 0) return;

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const fixed = (node: SimulationNode) => node.id === draggedId || node.pinned;
  const cellSize = Math.max(160, settings.distance * 2.4);
  const grid = buildGrid(nodes, positions, cellSize);
  const cap = nodes.length > 3000 ? 20 : nodes.length > 120 ? 64 : Number.POSITIVE_INFINITY;

  for (const node of nodes) {
    const point = positions.get(node.id);
    if (!point || fixed(node)) continue;
    const velocity = getVelocity(velocities, node.id);
    const gx = Math.floor(point.x / cellSize);
    const gy = Math.floor(point.y / cellSize);
    let seen = 0;
    for (let ox = -1; ox <= 1 && seen < cap; ox++) {
      for (let oy = -1; oy <= 1 && seen < cap; oy++) {
        for (const other of grid.get(`${gx + ox},${gy + oy}`) ?? []) {
          if (other.id === node.id || ++seen > cap) continue;
          const otherPoint = positions.get(other.id);
          if (!otherPoint) continue;
          let dx = point.x - otherPoint.x;
          let dy = point.y - otherPoint.y;
          let distanceSquared = dx * dx + dy * dy;
          if (distanceSquared < 4) {
            const angle = hashAngle(node.id, other.id);
            dx = Math.cos(angle) * 2;
            dy = Math.sin(angle) * 2;
            distanceSquared = 4;
          }
          if (distanceSquared > cellSize * cellSize) continue;
          const strength =
            (((settings.repel + node.radius * 60) * linkScale * linkScale * alpha) /
              distanceSquared) *
            0.02;
          velocity.x += dx * strength;
          velocity.y += dy * strength;
        }
      }
    }
  }

  for (const link of links) {
    const source = nodeById.get(link.sourceId);
    const target = nodeById.get(link.targetId);
    const a = source && positions.get(source.id);
    const b = target && positions.get(target.id);
    if (!source || !target || !a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const desired =
      (settings.distance +
        source.radius +
        target.radius +
        Math.max(source.halfWidth, target.halfWidth) * 0.5) *
      linkScale;
    const spring = ((distance - desired) / distance) * alpha * 0.4;
    const sourceBias = 1 / (1 + source.degree * 0.14);
    const targetBias = 1 / (1 + target.degree * 0.14);
    const sourceVelocity = getVelocity(velocities, source.id);
    const targetVelocity = getVelocity(velocities, target.id);
    if (!fixed(source)) {
      sourceVelocity.x += dx * spring * targetBias;
      sourceVelocity.y += dy * spring * targetBias;
    }
    if (!fixed(target)) {
      targetVelocity.x -= dx * spring * sourceBias;
      targetVelocity.y -= dy * spring * sourceBias;
    }
  }

  if (!live) {
    const centers = new Map<number, { x: number; y: number; count: number }>();
    for (const node of nodes) {
      const point = positions.get(node.id);
      if (!point) continue;
      const center = centers.get(node.community) ?? { x: 0, y: 0, count: 0 };
      center.x += point.x;
      center.y += point.y;
      center.count++;
      centers.set(node.community, center);
    }
    const ratio = Math.max(0.6, Math.min(2.6, aspectRatio));
    const gravity = settings.gravity * 0.008 * alpha;
    const grouping = settings.grouping * 0.05 * alpha;
    for (const node of nodes) {
      if (fixed(node)) continue;
      const point = positions.get(node.id);
      const center = centers.get(node.community);
      if (!point || !center) continue;
      const velocity = getVelocity(velocities, node.id);
      if (center.count > 1) {
        velocity.x += (center.x / center.count - point.x) * grouping;
        velocity.y += (center.y / center.count - point.y) * grouping;
      }
      velocity.x -= (point.x * gravity) / ratio;
      velocity.y -= point.y * gravity * ratio;
    }
  }

  for (const node of nodes) {
    const point = positions.get(node.id);
    const velocity = getVelocity(velocities, node.id);
    if (!point) continue;
    if (fixed(node)) {
      velocity.x = 0;
      velocity.y = 0;
      continue;
    }
    velocity.x *= 0.62;
    velocity.y *= 0.62;
    point.x += clamp(velocity.x, -45, 45);
    point.y += clamp(velocity.y, -45, 45);
  }

  if (nodes.length <= 3000) separateLabels(nodes, positions, fixed, grid, cellSize);
}

/**
 * Lightweight interactive pass for large worlds. Expensive global repulsion and
 * collision stay in the worker; this keeps connected springs and inertial sway
 * responsive while the user is dragging thousands of visible particles.
 */
export function stepSpringSimulation({
  nodes,
  links,
  positions,
  velocities,
  settings,
  alpha,
  draggedId = null,
  linkScale = 1
}: SimulationStep): void {
  if (!nodes.length || alpha <= 0) return;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const fixed = (node: SimulationNode) => node.id === draggedId || node.pinned;

  for (const link of links) {
    const source = nodeById.get(link.sourceId);
    const target = nodeById.get(link.targetId);
    const a = source && positions.get(source.id);
    const b = target && positions.get(target.id);
    if (!source || !target || !a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const desired =
      (settings.distance +
        source.radius +
        target.radius +
        Math.max(source.halfWidth, target.halfWidth) * 0.5) *
      linkScale;
    const spring = ((distance - desired) / distance) * alpha * 0.18;
    if (!fixed(source)) {
      const velocity = getVelocity(velocities, source.id);
      velocity.x += dx * spring * 0.5;
      velocity.y += dy * spring * 0.5;
    }
    if (!fixed(target)) {
      const velocity = getVelocity(velocities, target.id);
      velocity.x -= dx * spring * 0.5;
      velocity.y -= dy * spring * 0.5;
    }
  }

  for (const node of nodes) {
    const point = positions.get(node.id);
    const velocity = getVelocity(velocities, node.id);
    if (!point) continue;
    if (fixed(node)) {
      velocity.x = 0;
      velocity.y = 0;
      continue;
    }
    velocity.x *= 0.76;
    velocity.y *= 0.76;
    point.x += clamp(velocity.x, -24, 24);
    point.y += clamp(velocity.y, -24, 24);
  }
}

export function measureLinkScale(
  nodes: SimulationNode[],
  links: SimulationLink[],
  positions: Map<string, SimulationPoint>,
  distance: number
): number {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const ratios: number[] = [];
  for (const link of links) {
    const source = nodeById.get(link.sourceId);
    const target = nodeById.get(link.targetId);
    const a = source && positions.get(source.id);
    const b = target && positions.get(target.id);
    if (!source || !target || !a || !b) continue;
    const desired =
      distance + source.radius + target.radius + Math.max(source.halfWidth, target.halfWidth) * 0.5;
    if (desired > 0) ratios.push(Math.hypot(b.x - a.x, b.y - a.y) / desired);
  }
  if (!ratios.length) return 1;
  ratios.sort((a, b) => a - b);
  return clamp(ratios[ratios.length >> 1], 0.65, 3.5);
}

export function connectedDepths(startId: string, links: SimulationLink[]): Map<string, number> {
  const neighbours = new Map<string, string[]>();
  for (const link of links) {
    let source = neighbours.get(link.sourceId);
    if (!source) neighbours.set(link.sourceId, (source = []));
    source.push(link.targetId);
    let target = neighbours.get(link.targetId);
    if (!target) neighbours.set(link.targetId, (target = []));
    target.push(link.sourceId);
  }
  const depths = new Map<string, number>([[startId, 0]]);
  const queue = [startId];
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    const depth = depths.get(id)!;
    for (const neighbour of neighbours.get(id) ?? []) {
      if (depths.has(neighbour)) continue;
      depths.set(neighbour, depth + 1);
      queue.push(neighbour);
    }
  }
  return depths;
}

/**
 * Carries a pointer delta through every ring in the connected component. Springs
 * then turn this immediate elastic response into the normal force-driven swarm.
 */
export function propagateDragDelta(
  nodes: SimulationNode[],
  depths: ReadonlyMap<string, number>,
  positions: Map<string, SimulationPoint>,
  velocities: Map<string, SimulationVelocity>,
  deltaX: number,
  deltaY: number
): void {
  for (const node of nodes) {
    const depth = depths.get(node.id);
    if (!depth || node.pinned) continue;
    const point = positions.get(node.id);
    if (!point) continue;
    const influence = Math.max(nodes.length > 900 ? 0.035 : 0, 0.34 * Math.pow(0.68, depth - 1));
    const moveX = deltaX * influence;
    const moveY = deltaY * influence;
    point.x += moveX;
    point.y += moveY;
    const velocity = getVelocity(velocities, node.id);
    velocity.x += moveX * 0.24;
    velocity.y += moveY * 0.24;
  }
}

function buildGrid(
  nodes: SimulationNode[],
  positions: Map<string, SimulationPoint>,
  cellSize: number
) {
  const grid = new Map<string, SimulationNode[]>();
  for (const node of nodes) {
    const point = positions.get(node.id);
    if (!point) continue;
    const key = `${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`;
    const cell = grid.get(key) ?? [];
    cell.push(node);
    grid.set(key, cell);
  }
  return grid;
}

function separateLabels(
  nodes: SimulationNode[],
  positions: Map<string, SimulationPoint>,
  fixed: (node: SimulationNode) => boolean,
  grid: Map<string, SimulationNode[]>,
  cellSize: number
) {
  const passes = nodes.length > 250 ? 1 : 3;
  const cap = nodes.length > 120 ? 64 : Number.POSITIVE_INFINITY;
  for (let pass = 0; pass < passes; pass++) {
    for (const node of nodes) {
      const point = positions.get(node.id);
      if (!point) continue;
      const gx = Math.floor(point.x / cellSize);
      const gy = Math.floor(point.y / cellSize);
      let seen = 0;
      for (let ox = -1; ox <= 1 && seen < cap; ox++) {
        for (let oy = -1; oy <= 1 && seen < cap; oy++) {
          for (const other of grid.get(`${gx + ox},${gy + oy}`) ?? []) {
            if (other.id <= node.id || ++seen > cap) continue;
            const otherPoint = positions.get(other.id);
            if (!otherPoint) continue;
            const dx = point.x - otherPoint.x;
            const dy = point.y - otherPoint.y;
            const overlapX = node.halfWidth + other.halfWidth + 8 - Math.abs(dx);
            const overlapY = node.halfHeight + other.halfHeight + 4 - Math.abs(dy);
            if (overlapX <= 0 || overlapY <= 0) continue;
            const nodeFixed = fixed(node);
            const otherFixed = fixed(other);
            if (nodeFixed && otherFixed) continue;
            const share = nodeFixed || otherFixed ? 1 : 0.5;
            if (overlapX < overlapY) {
              const push = (dx >= 0 ? overlapX : -overlapX) * 0.5 * share;
              if (!nodeFixed) point.x += push;
              if (!otherFixed) otherPoint.x -= push;
            } else {
              const push = (dy >= 0 ? overlapY : -overlapY) * 0.5 * share;
              if (!nodeFixed) point.y += push;
              if (!otherFixed) otherPoint.y -= push;
            }
          }
        }
      }
    }
  }
}

function getVelocity(velocities: Map<string, SimulationVelocity>, id: string) {
  let velocity = velocities.get(id);
  if (!velocity) {
    velocity = { x: 0, y: 0 };
    velocities.set(id, velocity);
  }
  return velocity;
}

function hashAngle(a: string, b: string) {
  let hash = 0;
  const value = `${a}:${b}`;
  for (let index = 0; index < value.length; index++)
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return ((hash >>> 0) / 4_294_967_295) * Math.PI * 2;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
