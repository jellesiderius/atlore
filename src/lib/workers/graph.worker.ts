/// <reference lib="webworker" />

type SimNode = {
  id: string;
  type: string;
  x: number;
  y: number;
  radius: number;
  pinned: boolean;
  vx: number;
  vy: number;
  community: number;
};
type SimLink = { sourceId: string; targetId: string };
type Settings = {
  repel: number;
  distance: number;
  grouping: number;
  gravity: number;
  iterations: number;
};

self.onmessage = (
  event: MessageEvent<{
    nodes: Omit<SimNode, 'vx' | 'vy' | 'community'>[];
    links: SimLink[];
    settings: Settings;
  }>
) => {
  const nodes: SimNode[] = event.data.nodes.map((node, index) => ({
    ...node,
    x: Number.isFinite(node.x) ? node.x : Math.cos(index * 2.399) * Math.sqrt(index) * 40,
    y: Number.isFinite(node.y) ? node.y : Math.sin(index * 2.399) * Math.sqrt(index) * 40,
    vx: 0,
    vy: 0,
    community: index
  }));
  const links = event.data.links;
  const settings = event.data.settings;
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  propagateCommunities(nodes, links, index);
  const iterations = Math.min(
    settings.iterations,
    nodes.length > 3000 ? 70 : nodes.length > 900 ? 140 : 700
  );
  for (let pass = 0; pass < iterations; pass++) {
    const alpha = Math.max(0.025, 1 - pass / iterations);
    const cellSize = Math.max(90, settings.distance);
    const grid = new Map<string, number[]>();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const key = `${Math.floor(node.x / cellSize)},${Math.floor(node.y / cellSize)}`;
      const cell = grid.get(key) ?? [];
      cell.push(i);
      grid.set(key, cell);
    }
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const gx = Math.floor(node.x / cellSize),
        gy = Math.floor(node.y / cellSize);
      let checked = 0;
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const j of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
            if (j <= i) continue;
            if (nodes.length > 3000 && checked++ > 20) break;
            const other = nodes[j];
            let x = other.x - node.x,
              y = other.y - node.y;
            let d2 = x * x + y * y;
            if (d2 < 0.1) {
              x = 0.1;
              y = 0.1;
              d2 = 0.02;
            }
            const force = ((settings.repel + node.radius * 60) * alpha * 0.02) / d2;
            const fx = x * force,
              fy = y * force;
            if (!node.pinned) {
              node.vx -= fx;
              node.vy -= fy;
            }
            if (!other.pinned) {
              other.vx += fx;
              other.vy += fy;
            }
          }
    }
    for (const link of links) {
      const ai = index.get(link.sourceId),
        bi = index.get(link.targetId);
      if (ai === undefined || bi === undefined) continue;
      const a = nodes[ai],
        b = nodes[bi];
      const dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.max(1, Math.hypot(dx, dy));
      const target = settings.distance + a.radius + b.radius;
      const force = ((d - target) / d) * 0.4 * alpha;
      const fx = dx * force,
        fy = dy * force;
      if (!a.pinned) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.pinned) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    const centers = new Map<number, { x: number; y: number; n: number }>();
    for (const node of nodes) {
      const center = centers.get(node.community) ?? { x: 0, y: 0, n: 0 };
      center.x += node.x;
      center.y += node.y;
      center.n++;
      centers.set(node.community, center);
    }
    for (const node of nodes) {
      if (node.pinned) continue;
      const center = centers.get(node.community)!;
      node.vx += (center.x / center.n - node.x) * settings.grouping * 0.05 * alpha;
      node.vy += (center.y / center.n - node.y) * settings.grouping * 0.05 * alpha;
      node.vx += -node.x * settings.gravity * 0.008 * alpha;
      node.vy += -node.y * settings.gravity * 0.008 * alpha;
      node.vx *= 0.62;
      node.vy *= 0.62;
      node.x += Math.max(-45, Math.min(45, node.vx));
      node.y += Math.max(-45, Math.min(45, node.vy));
    }
    if (nodes.length < 3000 && pass % 4 === 0) separate(nodes);
  }
  postMessage({ positions: nodes.map(({ id, x, y }) => ({ id, x, y })) });
};

function propagateCommunities(nodes: SimNode[], links: SimLink[], index: Map<string, number>) {
  const neighbours = new Map<number, number[]>();
  for (const link of links) {
    const a = index.get(link.sourceId),
      b = index.get(link.targetId);
    if (a === undefined || b === undefined) continue;
    (neighbours.get(a) ?? neighbours.set(a, []).get(a)!).push(b);
    (neighbours.get(b) ?? neighbours.set(b, []).get(b)!).push(a);
  }
  for (let pass = 0; pass < 12; pass++)
    for (let i = 0; i < nodes.length; i++) {
      const counts = new Map<number, number>();
      for (const j of neighbours.get(i) ?? [])
        counts.set(nodes[j].community, (counts.get(nodes[j].community) ?? 0) + 1);
      let best = nodes[i].community,
        total = 0;
      for (const [community, value] of counts)
        if (value > total) {
          best = community;
          total = value;
        }
      nodes[i].community = best;
    }
}
function separate(nodes: SimNode[]) {
  const size = 110,
    grid = new Map<string, number[]>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i],
      key = `${Math.floor(n.x / size)},${Math.floor(n.y / size)}`;
    const cell = grid.get(key) ?? [];
    cell.push(i);
    grid.set(key, cell);
  }
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i],
      gx = Math.floor(a.x / size),
      gy = Math.floor(a.y / size);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const j of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
          if (j <= i) continue;
          const b = nodes[j],
            min = a.radius + b.radius + 28,
            x = b.x - a.x,
            y = b.y - a.y,
            d = Math.max(0.1, Math.hypot(x, y));
          if (d >= min) continue;
          const push = ((min - d) / d) * 0.5;
          if (!a.pinned) {
            a.x -= x * push;
            a.y -= y * push;
          }
          if (!b.pinned) {
            b.x += x * push;
            b.y += y * push;
          }
        }
  }
}
