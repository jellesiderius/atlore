import { expect, test } from '@playwright/test';

type DebugNode = { x: number; y: number; r: number; screenX: number; screenY: number };
type DebugLink = { x1: number; y1: number; x2: number; y2: number };
type DebugFrame = { nodes: DebugNode[]; links: DebugLink[] };

declare global {
  interface Window {
    __atloreGraphFrame?: DebugFrame;
  }
}

test('een drag beweegt de volledige verbonden node-swarm', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.addInitScript(() => {
    const prototype = CanvasRenderingContext2D.prototype;
    const originalClearRect = prototype.clearRect;
    const originalMoveTo = prototype.moveTo;
    const originalQuadraticCurveTo = prototype.quadraticCurveTo;
    const originalArc = prototype.arc;
    let lineStart: { x: number; y: number } | null = null;
    let seenNodes = new Set<string>();

    prototype.clearRect = function (...args) {
      if (this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf') {
        window.__atloreGraphFrame = { nodes: [], links: [] };
        lineStart = null;
        seenNodes = new Set();
      }
      return originalClearRect.apply(this, args);
    };
    prototype.moveTo = function (x, y) {
      if (this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf')
        lineStart = { x, y };
      return originalMoveTo.call(this, x, y);
    };
    prototype.quadraticCurveTo = function (controlX, controlY, x, y) {
      if (
        this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf' &&
        lineStart &&
        window.__atloreGraphFrame
      ) {
        window.__atloreGraphFrame.links.push({ x1: lineStart.x, y1: lineStart.y, x2: x, y2: y });
      }
      return originalQuadraticCurveTo.call(this, controlX, controlY, x, y);
    };
    prototype.arc = function (x, y, radius, startAngle, endAngle, counterclockwise) {
      if (
        radius > 5 &&
        this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf' &&
        window.__atloreGraphFrame
      ) {
        const key = `${x.toFixed(3)}:${y.toFixed(3)}`;
        if (!seenNodes.has(key)) {
          seenNodes.add(key);
          const matrix = this.getTransform();
          const rect = this.canvas.getBoundingClientRect();
          const pixelRatio = this.canvas.width / Math.max(1, rect.width);
          window.__atloreGraphFrame.nodes.push({
            x,
            y,
            r: radius,
            screenX: rect.left + (matrix.a * x + matrix.c * y + matrix.e) / pixelRatio,
            screenY: rect.top + (matrix.b * x + matrix.d * y + matrix.f) / pixelRatio
          });
        }
      }
      return originalArc.call(this, x, y, radius, startAngle, endAngle, counterclockwise);
    };
  });

  await page.goto('/auth/login');
  await page.getByPlaceholder('E-mailadres').fill('demo@atlore.app');
  await page.getByPlaceholder('Wachtwoord').fill('AtloreDemo!2026');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  if (process.env.PLAYWRIGHT_GRAPH_URL) {
    await expect(page).toHaveURL(/\/campaigns$/);
    await page.goto(process.env.PLAYWRIGHT_GRAPH_URL);
  } else await page.getByText('Ember & Rust', { exact: true }).first().click();

  const canvas = page.getByLabel('Interactieve kennisgraaf');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(2200);

  const before = await page.evaluate(() => structuredClone(window.__atloreGraphFrame));
  const bounds = await canvas.boundingBox();
  expect(before?.nodes.length).toBeGreaterThan(5);
  expect(before?.links.length).toBeGreaterThan(3);
  expect(bounds).not.toBeNull();
  if (!before || !bounds) return;

  const degrees = before.nodes.map(
    (node) =>
      before.links.filter(
        (link) =>
          Math.hypot(link.x1 - node.x, link.y1 - node.y) < 0.5 ||
          Math.hypot(link.x2 - node.x, link.y2 - node.y) < 0.5
      ).length
  );
  const candidates = before.nodes
    .map((node, index) => ({ node, index, degree: degrees[index] }))
    .filter(
      ({ node, degree }) =>
        degree > 0 &&
        node.screenX > bounds.x + 45 &&
        node.screenX < bounds.x + bounds.width - 220 &&
        node.screenY > bounds.y + 45 &&
        node.screenY < bounds.y + bounds.height - 140
    )
    .sort((a, b) => b.degree - a.degree);
  expect(candidates.length).toBeGreaterThan(0);
  const target = candidates[0];

  await page.screenshot({ path: testInfo.outputPath('swarm-before.png') });
  await page.mouse.move(target.node.screenX, target.node.screenY);
  await page.mouse.down();
  await page.mouse.move(target.node.screenX + 180, target.node.screenY + 85, { steps: 12 });
  await page.waitForTimeout(160);

  const during = await page.evaluate(() => structuredClone(window.__atloreGraphFrame));
  await page.screenshot({ path: testInfo.outputPath('swarm-during.png') });
  expect(during?.nodes.length).toBe(before.nodes.length);
  if (!during) return;

  const movement = during.nodes.map((node, index) =>
    Math.hypot(node.x - before.nodes[index].x, node.y - before.nodes[index].y)
  );
  const movedNeighbours = movement.filter(
    (distance, index) => index !== target.index && distance > 2
  );
  expect(movement[target.index]).toBeGreaterThan(100);
  expect(movedNeighbours.length).toBeGreaterThanOrEqual(Math.min(4, before.nodes.length - 1));
  expect(Math.max(...movedNeighbours)).toBeGreaterThan(8);

  await page.mouse.up();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
