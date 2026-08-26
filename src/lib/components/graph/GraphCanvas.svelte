<script lang="ts">
  import { onMount } from 'svelte';
  import type { NodeType, WorldLink, WorldNode } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';
  import {
    connectedDepths,
    measureLinkScale,
    propagateDragDelta,
    stepForceSimulation,
    stepSpringSimulation,
    type SimulationNode,
    type SimulationSettings
  } from '$lib/graph/simulation';
  export type ForceSettings = SimulationSettings;
  let {
    nodes,
    links,
    types,
    selected = null,
    settings,
    onSelect,
    onOpen,
    onCreate,
    onContext,
    onMove
  }: {
    nodes: WorldNode[];
    links: WorldLink[];
    types: NodeType[];
    selected?: string | null;
    settings: ForceSettings;
    onSelect: (id: string | null, clientX?: number, clientY?: number) => void;
    onOpen: (id: string) => void;
    onCreate: (x: number, y: number) => void;
    onContext?: (
      id: string | null,
      clientX: number,
      clientY: number,
      worldX: number,
      worldY: number
    ) => void;
    onMove?: (id: string, x: number, y: number) => void;
  } = $props();
  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let width = 0,
    height = 0,
    dpr = 1,
    frame = 0;
  let worker: Worker | null = null;
  let positions = new Map<string, { x: number; y: number }>();
  let velocities = new Map<string, { x: number; y: number }>();
  let simulationAlpha = 0;
  let simulationMode: 'live' | 'layout' = 'live';
  let currentLinkScale = 1;
  let previousFrame = 0;
  let drawRequested = false;
  let mounted = false;
  let structureKey = '';
  let settingsKey = '';
  let settingsTimer: ReturnType<typeof setTimeout>;
  let fitWhenSettled = false;
  let introTargets: Map<string, { x: number; y: number }> | null = null;
  let introOrigins = new Map<string, { x: number; y: number }>();
  let introDelays = new Map<string, number>();
  let introStarted = 0;
  let camera = { x: 0, y: 0, z: 1 };
  let cameraTarget: { x: number; y: number; z: number } | null = null;
  let reducedMotion = false;
  let userMoved = false;
  let pointer: {
    id: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    nodeId: string | null;
    offsetX: number;
    offsetY: number;
    connectedDepths: Map<string, number>;
    moved: boolean;
  } | null = null;
  let hover: string | null = null;
  let activeNodes = $derived(nodes.filter((node) => !node.trashedAt));
  let activeNodeIds = $derived(new Set(activeNodes.map((node) => node.id)));
  let activeLinks = $derived(
    links.filter((link) => activeNodeIds.has(link.sourceId) && activeNodeIds.has(link.targetId))
  );
  let typeMap = $derived(new Map(types.map((type) => [type.key, type])));
  let adjacency = $derived(buildAdjacency(activeLinks));
  let communities = $derived(buildCommunities(activeNodes, activeLinks));
  let simulationNodes = $derived<SimulationNode[]>(
    activeNodes.map((node) => {
      const degree = adjacency.get(node.id)?.length ?? 0;
      const radius = radiusFor(node, degree);
      const labelWidth = Math.min(132, shorten(node.title, 24).length * 6.6);
      return {
        id: node.id,
        radius,
        halfWidth: Math.max(radius + 12, labelWidth / 2 + 11),
        halfHeight: radius + 22,
        degree,
        community: communities.get(node.id) ?? 0,
        pinned: node.pinned
      };
    })
  );
  onMount(() => {
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    context = canvas.getContext('2d')!;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!userMoved && !introTargets) fitView();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    syncPositions(activeNodes);
    currentLinkScale = measureCurrentScale();
    simulationAlpha = 0;
    simulationMode = 'live';
    if (activeNodes.length <= 900) {
      prelayoutInitial();
      fitView();
      startIntro();
    }
    mounted = true;
    worker = new Worker(new URL('../../workers/graph.worker.ts', import.meta.url), {
      type: 'module'
    });
    worker.onmessage = (event) => {
      for (const item of event.data.positions) {
        positions.set(item.id, { x: item.x, y: item.y });
        velocities.set(item.id, { x: 0, y: 0 });
      }
      currentLinkScale = measureCurrentScale();
      simulationMode = 'live';
      simulationAlpha = activeNodes.length <= 900 ? Math.max(simulationAlpha, 0.08) : 0;
      fitView();
    };
    if (activeNodes.length > 900) reflow();
    frame = requestAnimationFrame(loop);
    return () => {
      observer.disconnect();
      clearTimeout(settingsTimer);
      worker?.terminate();
      cancelAnimationFrame(frame);
    };
  });
  $effect(() => {
    syncPositions(activeNodes);
    const nextKey = `${activeNodes.map((node) => node.id).join(',')}|${activeLinks.map((link) => link.id).join(',')}`;
    if (mounted && structureKey && structureKey !== nextKey) {
      if (activeNodes.length <= 900) startLayout(0.42, true);
      else reflow();
    }
    structureKey = nextKey;
    queueMicrotask(requestDraw);
  });
  $effect(() => {
    const nextKey = `${settings.repel}:${settings.distance}:${settings.grouping}:${settings.gravity}`;
    if (mounted && settingsKey && settingsKey !== nextKey) {
      clearTimeout(settingsTimer);
      settingsTimer = setTimeout(() => {
        if (activeNodes.length <= 900) startLayout(0.72, true);
        else reflow();
      }, 130);
    }
    settingsKey = nextKey;
  });
  $effect(() => {
    drawAfterSelection(selected);
  });
  function syncPositions(nodesToSync: WorldNode[]) {
    const ids = new Set(nodesToSync.map((node) => node.id));
    for (const id of positions.keys())
      if (!ids.has(id)) {
        positions.delete(id);
        velocities.delete(id);
      }
    for (const node of nodesToSync) {
      if (!positions.has(node.id) || node.pinned) positions.set(node.id, { x: node.x, y: node.y });
      if (!velocities.has(node.id)) velocities.set(node.id, { x: 0, y: 0 });
    }
  }
  function drawAfterSelection(_selectedId: string | null) {
    queueMicrotask(requestDraw);
  }
  function loop(timestamp: number) {
    let needsDraw = tickIntro(timestamp);
    if (cameraTarget) {
      const factor = reducedMotion ? 1 : 0.11;
      camera.x += (cameraTarget.x - camera.x) * factor;
      camera.y += (cameraTarget.y - camera.y) * factor;
      camera.z += (cameraTarget.z - camera.z) * factor;
      if (
        Math.abs(cameraTarget.x - camera.x) < 0.4 &&
        Math.abs(cameraTarget.y - camera.y) < 0.4 &&
        Math.abs(cameraTarget.z - camera.z) < 0.0005
      ) {
        camera = { ...cameraTarget };
        cameraTarget = null;
      }
      needsDraw = true;
    }
    const draggedId = pointer?.nodeId && pointer.moved ? pointer.nodeId : null;
    const largeWorld = simulationNodes.length > 900;
    if (draggedId && !largeWorld) simulationAlpha = Math.max(simulationAlpha, 0.34);
    if ((!largeWorld && draggedId) || (!draggedId && simulationAlpha > 0.002)) {
      const elapsed = previousFrame ? timestamp - previousFrame : 16.7;
      const steps = largeWorld ? 1 : Math.max(1, Math.min(2, Math.round(elapsed / 16.7)));
      for (let index = 0; index < steps; index++) {
        const step =
          largeWorld && simulationMode === 'live' ? stepSpringSimulation : stepForceSimulation;
        step({
          nodes: simulationNodes,
          links: activeLinks,
          positions,
          velocities,
          settings,
          alpha: simulationAlpha,
          live: simulationMode === 'live',
          linkScale: simulationMode === 'live' ? currentLinkScale : 1,
          aspectRatio: width / Math.max(1, height),
          draggedId
        });
      }
      if (!draggedId) {
        simulationAlpha = largeWorld
          ? Math.max(0, simulationAlpha * 0.86 - 0.006)
          : Math.max(0, simulationAlpha * 0.988 - 0.0006);
        if (simulationAlpha <= 0.002 && simulationMode === 'layout') {
          simulationAlpha = 0;
          currentLinkScale = measureCurrentScale();
          simulationMode = 'live';
          if (fitWhenSettled) fitView();
          fitWhenSettled = false;
        }
      }
      needsDraw = true;
    }
    if (needsDraw || drawRequested) draw();
    previousFrame = timestamp;
    frame = requestAnimationFrame(loop);
  }
  function draw() {
    if (!context) return;
    drawRequested = false;
    context.clearRect(0, 0, width, height);
    const focusId = pointer?.nodeId ?? hover ?? selected;
    const highlighted = focusId ? new Set([focusId, ...(adjacency.get(focusId) ?? [])]) : null;
    const draggingFocus = Boolean(pointer?.nodeId);
    drawGrid(Boolean(focusId));
    context.save();
    context.translate(camera.x, camera.y);
    context.scale(camera.z, camera.z);
    drawLinks(highlighted, focusId, draggingFocus);
    const visible =
      activeNodes.length > 900
        ? activeNodes.filter(inViewport).slice(0, activeNodes.length > 20000 ? 4000 : 12000)
        : activeNodes;
    if (activeNodes.length > 900) drawLargeNodes(visible, highlighted, focusId, draggingFocus);
    else for (const node of visible) drawNode(node, highlighted, focusId, draggingFocus);
    context.restore();
  }
  function requestDraw() {
    drawRequested = true;
  }
  function appendLinkPath(predicate?: (link: WorldLink) => boolean) {
    context.beginPath();
    for (const link of activeLinks) {
      if (predicate && !predicate(link)) continue;
      const a = positions.get(link.sourceId),
        b = positions.get(link.targetId);
      if (!a || !b) continue;
      context.moveTo(a.x, a.y);
      curveTo(a, b);
    }
  }
  function curveTo(a: { x: number; y: number }, b: { x: number; y: number }) {
    const midpointX = (a.x + b.x) / 2;
    const midpointY = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    context.quadraticCurveTo(midpointX - dy * 0.07, midpointY + dx * 0.07, b.x, b.y);
  }
  function drawLinks(
    highlighted: Set<string> | null,
    focusId: string | null,
    draggingFocus: boolean
  ) {
    if (activeNodes.length > 20000 || !activeLinks.length) return;
    if (activeNodes.length <= 900) {
      for (const link of activeLinks) {
        const a = positions.get(link.sourceId),
          b = positions.get(link.targetId);
        if (!a || !b) continue;
        const lit =
          !highlighted || (highlighted.has(link.sourceId) && highlighted.has(link.targetId));
        const strong = focusId && (link.sourceId === focusId || link.targetId === focusId);
        context.beginPath();
        context.moveTo(a.x, a.y);
        curveTo(a, b);
        context.strokeStyle = strong
          ? 'rgba(240,145,63,.88)'
          : lit
            ? 'rgba(114,126,147,.42)'
            : draggingFocus
              ? 'rgba(68,76,91,.025)'
              : 'rgba(68,76,91,.07)';
        context.lineWidth = (strong ? 1.7 : lit ? 1 : 0.6) / camera.z;
        context.stroke();
      }
      return;
    }

    appendLinkPath();
    context.strokeStyle = highlighted
      ? draggingFocus
        ? 'rgba(68,76,91,.025)'
        : 'rgba(68,76,91,.07)'
      : 'rgba(114,126,147,.36)';
    context.lineWidth = (highlighted ? 0.6 : 0.9) / camera.z;
    context.stroke();
    if (!focusId) return;
    appendLinkPath((link) => link.sourceId === focusId || link.targetId === focusId);
    context.strokeStyle = 'rgba(240,145,63,.88)';
    context.lineWidth = 1.7 / camera.z;
    context.stroke();
  }
  function drawLargeNodes(
    visible: WorldNode[],
    highlighted: Set<string> | null,
    focusId: string | null,
    draggingFocus: boolean
  ) {
    const groups = new Map<string, { color: string; alpha: number; nodes: WorldNode[] }>();
    const emphasized: WorldNode[] = [];
    for (const node of visible) {
      if (highlighted?.has(node.id)) {
        emphasized.push(node);
        continue;
      }
      const color = typeMap.get(node.type)?.colorDark ?? '#9aa1af';
      const alpha = highlighted ? (draggingFocus ? 0.07 : 0.14) : 0.88;
      const key = `${color}:${alpha}`;
      const group = groups.get(key) ?? { color, alpha, nodes: [] };
      group.nodes.push(node);
      groups.set(key, group);
    }
    context.shadowBlur = 0;
    for (const group of groups.values()) {
      context.beginPath();
      for (const node of group.nodes) {
        const position = positions.get(node.id);
        if (!position) continue;
        const radius = radiusFor(node, adjacency.get(node.id)?.length ?? 0);
        context.moveTo(position.x + radius, position.y);
        context.arc(position.x, position.y, radius, 0, Math.PI * 2);
      }
      context.globalAlpha = group.alpha;
      context.fillStyle = group.color;
      context.fill();
    }
    context.globalAlpha = 1;
    for (const node of emphasized) drawNode(node, highlighted, focusId, draggingFocus);
    if (!highlighted && camera.z > 0.34)
      for (const node of visible) {
        const degree = adjacency.get(node.id)?.length ?? 0;
        const importance =
          (node.size === 'l' ? 3 : node.size === 'm' ? 2 : 1) + Math.min(3, Math.sqrt(degree));
        if (importance >= (camera.z > 0.72 ? 3 : 4.5)) drawNodeLabel(node, false);
      }
  }
  function drawGrid(focused: boolean) {
    const spacing = 34 * camera.z;
    const ox = ((camera.x % spacing) + spacing) % spacing,
      oy = ((camera.y % spacing) + spacing) % spacing;
    context.fillStyle =
      getComputedStyle(document.documentElement).getPropertyValue('--line').trim() || '#262b35';
    context.globalAlpha = focused ? 0.1 : 0.36;
    for (let x = ox; x < width; x += spacing)
      for (let y = oy; y < height; y += spacing) {
        context.beginPath();
        context.arc(x, y, 0.7, 0, Math.PI * 2);
        context.fill();
      }
    context.globalAlpha = 1;
  }
  function drawNode(
    node: WorldNode,
    highlighted: Set<string> | null,
    focusId: string | null,
    draggingFocus: boolean
  ) {
    const position = positions.get(node.id);
    if (!position) return;
    const degree = adjacency.get(node.id)?.length ?? 0;
    const radius = radiusFor(node, degree);
    const dim = highlighted && !highlighted.has(node.id);
    const type = typeMap.get(node.type);
    const color = type?.colorDark ?? '#9aa1af';
    context.globalAlpha = dim ? (draggingFocus ? 0.07 : 0.14) : node.id === focusId ? 1 : 0.88;
    context.shadowBlur = node.id === focusId ? 20 : highlighted?.has(node.id) ? 7 : 0;
    context.shadowColor = color;
    context.beginPath();
    context.arc(position.x, position.y, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.shadowBlur = 0;
    if (node.id === focusId) {
      context.beginPath();
      context.arc(position.x, position.y, radius + 6 / camera.z, 0, Math.PI * 2);
      context.strokeStyle = color;
      context.lineWidth = 1.5 / camera.z;
      context.stroke();
    }
    const importance =
      (node.size === 'l' ? 3 : node.size === 'm' ? 2 : 1) + Math.min(3, Math.sqrt(degree));
    const show =
      camera.z > 0.72 ||
      importance >= 3.5 ||
      (camera.z > 0.42 && importance >= 2.5) ||
      node.id === focusId ||
      highlighted?.has(node.id);
    if (show) drawNodeLabel(node, Boolean(dim));
    context.globalAlpha = 1;
  }
  function drawNodeLabel(node: WorldNode, dim: boolean) {
    const position = positions.get(node.id);
    if (!position) return;
    const radius = radiusFor(node, adjacency.get(node.id)?.length ?? 0);
    const fontSize = Math.max(11.5 / camera.z, 13);
    context.font = `500 ${fontSize}px "IBM Plex Sans",system-ui`;
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = dim ? 'rgba(154,161,175,.2)' : '#b8bfca';
    context.fillText(shorten(node.title, 24), position.x, position.y + radius + 7 / camera.z);
  }
  function screenToWorld(x: number, y: number) {
    return { x: (x - camera.x) / camera.z, y: (y - camera.y) / camera.z };
  }
  function nodeAt(x: number, y: number) {
    const p = screenToWorld(x, y);
    let found: WorldNode | null = null,
      best = Infinity;
    for (const node of activeNodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;
      const d = Math.hypot(pos.x - p.x, pos.y - p.y),
        r = radiusFor(node, adjacency.get(node.id)?.length ?? 0) + 12 / camera.z;
      if (d < r && d < best) {
        found = node;
        best = d;
      }
    }
    return found;
  }
  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    cameraTarget = null;
    finishIntro();
    canvas.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect(),
      x = event.clientX - rect.left,
      y = event.clientY - rect.top,
      n = nodeAt(x, y);
    const world = screenToWorld(x, y);
    const nodePosition = n ? positions.get(n.id) : null;
    if (n) {
      currentLinkScale = measureCurrentScale();
      simulationMode = 'live';
      fitWhenSettled = false;
    }
    pointer = {
      id: event.pointerId,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      nodeId: n?.id ?? null,
      offsetX: nodePosition ? nodePosition.x - world.x : 0,
      offsetY: nodePosition ? nodePosition.y - world.y : 0,
      connectedDepths: n ? connectedDepths(n.id, activeLinks) : new Map(),
      moved: false
    };
    requestDraw();
  }
  function move(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect(),
      x = event.clientX - rect.left,
      y = event.clientY - rect.top;
    if (pointer?.id === event.pointerId) {
      const dx = x - pointer.lastX,
        dy = y - pointer.lastY;
      if (Math.hypot(x - pointer.startX, y - pointer.startY) > 4) pointer.moved = true;
      if (pointer.nodeId) {
        if (pointer.moved) {
          const pos = positions.get(pointer.nodeId)!;
          const world = screenToWorld(x, y);
          pos.x = world.x + pointer.offsetX;
          pos.y = world.y + pointer.offsetY;
          velocities.set(pointer.nodeId, { x: 0, y: 0 });
          propagateDragDelta(
            simulationNodes,
            pointer.connectedDepths,
            positions,
            velocities,
            dx / camera.z,
            dy / camera.z
          );
          simulationMode = 'live';
          simulationAlpha = Math.max(simulationAlpha, activeNodes.length > 900 ? 0.18 : 0.34);
        }
      } else {
        camera.x += dx;
        camera.y += dy;
        userMoved = true;
      }
      pointer.lastX = x;
      pointer.lastY = y;
    } else {
      hover = nodeAt(x, y)?.id ?? null;
    }
    requestDraw();
  }
  function up(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const id = pointer.nodeId;
    if (!pointer.moved) onSelect(id, event.clientX, event.clientY);
    else if (id) {
      const pos = positions.get(id)!;
      simulationMode = 'live';
      simulationAlpha = Math.max(simulationAlpha, activeNodes.length > 900 ? 0.14 : 0.3);
      onMove?.(id, pos.x, pos.y);
    }
    pointer = null;
    requestDraw();
  }
  function leave() {
    if (pointer) return;
    hover = null;
    requestDraw();
  }
  function wheel(event: WheelEvent) {
    event.preventDefault();
    cameraTarget = null;
    const rect = canvas.getBoundingClientRect(),
      mx = event.clientX - rect.left,
      my = event.clientY - rect.top,
      world = screenToWorld(mx, my),
      factor = Math.exp(-event.deltaY * 0.0012),
      next = Math.max(0.12, Math.min(4, camera.z * factor));
    camera.z = next;
    camera.x = mx - world.x * next;
    camera.y = my - world.y * next;
    userMoved = true;
    requestDraw();
  }
  function doubleClick(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect(),
      x = event.clientX - rect.left,
      y = event.clientY - rect.top,
      n = nodeAt(x, y);
    if (n) onOpen(n.id);
    else {
      const p = screenToWorld(x, y);
      onCreate(p.x, p.y);
    }
  }
  function contextmenu(event: MouseEvent) {
    event.preventDefault();
    pointer = null;
    const rect = canvas.getBoundingClientRect(),
      x = event.clientX - rect.left,
      y = event.clientY - rect.top;
    const world = screenToWorld(x, y);
    onContext?.(nodeAt(x, y)?.id ?? null, event.clientX, event.clientY, world.x, world.y);
  }
  export function fitView() {
    if (!activeNodes.length || !width || !height) return;
    cameraTarget = null;
    const values = activeNodes.map((node) => positions.get(node.id)).filter(Boolean) as {
      x: number;
      y: number;
    }[];
    if (!values.length) return;
    const minX = Math.min(...values.map((p) => p.x)),
      maxX = Math.max(...values.map((p) => p.x)),
      minY = Math.min(...values.map((p) => p.y)),
      maxY = Math.max(...values.map((p) => p.y));
    const scale = Math.min(
      (width - 100) / Math.max(200, maxX - minX),
      (height - 100) / Math.max(160, maxY - minY),
      1.35
    );
    camera.z = Math.max(0.12, scale);
    camera.x = width / 2 - ((minX + maxX) / 2) * camera.z;
    camera.y = height / 2 - ((minY + maxY) / 2) * camera.z;
    userMoved = false;
    draw();
  }
  export function reflow() {
    if (activeNodes.length <= 900) {
      startLayout(1, true);
      return;
    }
    worker?.postMessage({
      nodes: activeNodes.map((node) => ({
        id: node.id,
        type: node.type,
        x: positions.get(node.id)?.x ?? node.x,
        y: positions.get(node.id)?.y ?? node.y,
        radius: radiusFor(node, adjacency.get(node.id)?.length ?? 0),
        pinned: node.pinned
      })),
      links: activeLinks.map((link) => ({
        sourceId: link.sourceId,
        targetId: link.targetId
      })),
      settings: { ...settings, iterations: activeNodes.length < 900 ? 700 : 160 }
    });
  }

  export function centerOn(id: string, minimumZoom = 1) {
    const position = positions.get(id);
    if (!position || !width || !height) return;
    const z = Math.max(camera.z, minimumZoom);
    cameraTarget = {
      z,
      x: width / 2 - position.x * z,
      y: height / 2 - position.y * z
    };
    userMoved = true;
    requestDraw();
  }
  function startLayout(alpha: number, fit = false) {
    simulationMode = 'layout';
    currentLinkScale = 1;
    fitWhenSettled ||= fit;
    simulationAlpha = Math.max(simulationAlpha, alpha);
    for (const velocity of velocities.values()) {
      velocity.x = 0;
      velocity.y = 0;
    }
  }
  function measureCurrentScale() {
    return measureLinkScale(simulationNodes, activeLinks, positions, settings.distance);
  }
  function prelayoutInitial() {
    simulationMode = 'layout';
    currentLinkScale = 1;
    let alpha = 1;
    const steps = Math.round(Math.max(150, Math.min(700, 70_000 / activeNodes.length)));
    for (let index = 0; index < steps && alpha > 0.002; index++) {
      stepForceSimulation({
        nodes: simulationNodes,
        links: activeLinks,
        positions,
        velocities,
        settings,
        alpha,
        live: false,
        linkScale: 1,
        aspectRatio: width / Math.max(1, height)
      });
      alpha = Math.max(0, alpha * 0.988 - 0.0006);
    }
    for (const velocity of velocities.values()) {
      velocity.x = 0;
      velocity.y = 0;
    }
    currentLinkScale = measureCurrentScale();
    simulationMode = 'live';
    simulationAlpha = 0;
  }
  function startIntro() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !activeNodes.length) return;
    introTargets = new Map(
      activeNodes.map((node) => [
        node.id,
        { ...(positions.get(node.id) ?? { x: node.x, y: node.y }) }
      ])
    );
    const values = [...introTargets.values()];
    const center = {
      x:
        (Math.min(...values.map((point) => point.x)) +
          Math.max(...values.map((point) => point.x))) /
        2,
      y:
        (Math.min(...values.map((point) => point.y)) +
          Math.max(...values.map((point) => point.y))) /
        2
    };
    const hub = [...simulationNodes].sort((a, b) => b.degree - a.degree)[0];
    const depths = hub ? connectedDepths(hub.id, activeLinks) : new Map<string, number>();
    const maxDepth = Math.max(0, ...depths.values());
    const cosine = Math.cos(0.26);
    const sine = Math.sin(0.26);
    introOrigins = new Map();
    introDelays = new Map();
    for (const node of activeNodes) {
      const target = introTargets.get(node.id)!;
      const dx = target.x - center.x;
      const dy = target.y - center.y;
      introOrigins.set(node.id, {
        x: center.x + (dx * cosine - dy * sine) * 0.62,
        y: center.y + (dx * sine + dy * cosine) * 0.62
      });
      introDelays.set(node.id, (depths.get(node.id) ?? maxDepth + 1) * 58);
      positions.set(node.id, { ...introOrigins.get(node.id)! });
    }
    introStarted = performance.now();
  }
  function tickIntro(timestamp: number) {
    if (!introTargets) return false;
    let complete = true;
    for (const node of activeNodes) {
      const target = introTargets.get(node.id);
      const origin = introOrigins.get(node.id);
      if (!target || !origin) continue;
      const progress = Math.max(
        0,
        Math.min(1, (timestamp - introStarted - (introDelays.get(node.id) ?? 0)) / 620)
      );
      if (progress < 1) complete = false;
      const eased = 1 - Math.pow(1 - progress, 3);
      positions.set(node.id, {
        x: origin.x + (target.x - origin.x) * eased,
        y: origin.y + (target.y - origin.y) * eased
      });
    }
    if (complete) finishIntro();
    return true;
  }
  function finishIntro() {
    if (!introTargets) return;
    for (const [id, target] of introTargets) positions.set(id, { ...target });
    introTargets = null;
    introOrigins.clear();
    introDelays.clear();
  }
  function inViewport(node: WorldNode) {
    const p = positions.get(node.id);
    if (!p) return false;
    const x = p.x * camera.z + camera.x,
      y = p.y * camera.z + camera.y;
    return x > -80 && x < width + 80 && y > -80 && y < height + 80;
  }
  function radiusFor(node: WorldNode, degree: number) {
    return (
      (node.size === 'l' ? 17 : node.size === 'm' ? 13 : 9) + Math.min(10, Math.sqrt(degree) * 2.2)
    );
  }
  function shorten(value: string, max: number) {
    return value.length > max ? value.slice(0, max - 1).replace(/\s+$/, '') + '…' : value;
  }
  function buildAdjacency(values: WorldLink[]) {
    const map = new Map<string, string[]>();
    for (const link of values) {
      let source = map.get(link.sourceId);
      if (!source) map.set(link.sourceId, (source = []));
      source.push(link.targetId);
      let target = map.get(link.targetId);
      if (!target) map.set(link.targetId, (target = []));
      target.push(link.sourceId);
    }
    return map;
  }
  function buildCommunities(nodeValues: WorldNode[], linkValues: WorldLink[]) {
    const neighbours = buildAdjacency(linkValues);
    const labels = new Map(nodeValues.map((node, index) => [node.id, index]));
    for (let pass = 0; pass < 12; pass++) {
      let changed = false;
      for (const node of nodeValues) {
        const counts = new Map<number, number>();
        for (const neighbour of neighbours.get(node.id) ?? []) {
          const label = labels.get(neighbour);
          if (label === undefined) continue;
          const weight = 1 / (1 + Math.sqrt(neighbours.get(neighbour)?.length ?? 0));
          counts.set(label, (counts.get(label) ?? 0) + weight);
        }
        let best = labels.get(node.id) ?? 0;
        let bestWeight = -1;
        for (const [label, weight] of counts)
          if (weight > bestWeight) {
            best = label;
            bestWeight = weight;
          }
        if (best !== labels.get(node.id)) {
          labels.set(node.id, best);
          changed = true;
        }
      }
      if (!changed) break;
    }
    return labels;
  }
</script>

<canvas
  bind:this={canvas}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onpointerleave={leave}
  onwheel={wheel}
  ondblclick={doubleClick}
  oncontextmenu={contextmenu}
  aria-label={t('graph.ariaLabel')}
></canvas>

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    cursor: grab;
  }
  canvas:active {
    cursor: grabbing;
  }
</style>
