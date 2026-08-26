import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { Pool } from 'pg';

const email = (process.env.LOAD_TEST_EMAIL || 'demo@atlore.app').trim().toLowerCase();
const baseUrl = process.env.LOAD_TEST_URL || 'http://localhost:5173';
const expectedNodes = Number.parseInt(process.env.LOAD_TEST_NODES || '10000', 10);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL ontbreekt.');

const pool = new Pool({ connectionString: databaseUrl });
const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');
let sessionId = '';
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

try {
  const result = await pool.query<{
    user_id: string;
    campaign_id: string;
    node_count: number;
    link_count: number;
  }>(
    `select u.id as user_id, c.id as campaign_id,
      (select count(*)::int from nodes n where n.campaign_id = c.id) as node_count,
      (select count(*)::int from links l where l.campaign_id = c.id) as link_count
    from users u
    join campaigns c on c.created_by = u.id
    where lower(u.email) = $1 and c.title = $2
    limit 1`,
    [email, `Loadtest · ${expectedNodes.toLocaleString('nl-NL')} nodes`]
  );
  const target = result.rows[0];
  if (!target) throw new Error('Loadtestcampagne ontbreekt; draai eerst `make seed-10k`.');
  if (target.node_count !== expectedNodes) {
    throw new Error(`Loadtest bevat ${target.node_count} nodes, verwacht ${expectedNodes}.`);
  }

  const session = await pool.query<{ id: string }>(
    `insert into auth_sessions (user_id, token_hash, user_agent, ip_address, expires_at)
     values ($1, $2, 'Atlore loadtest', '127.0.0.1', now() + interval '15 minutes')
     returning id`,
    [target.user_id, tokenHash]
  );
  sessionId = session.rows[0].id;

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    {
      name: process.env.SESSION_COOKIE_NAME || 'atlore_session',
      value: token,
      url: baseUrl,
      httpOnly: true,
      sameSite: 'Lax'
    }
  ]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (request) =>
    errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`)
  );
  await page.route('**/api/campaigns/*/nodes/*', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    } else await route.continue();
  });
  await page.addInitScript(() => {
    const graph = { nodes: [] as { x: number; y: number; screenX: number; screenY: number }[] };
    Object.assign(window, {
      __atloreLoadGraph: graph,
      __atloreCaptureGraph: true,
      __atloreLongTasks: [] as number[]
    });
    try {
      new PerformanceObserver((list) => {
        const values = (window as any).__atloreLongTasks as number[];
        for (const entry of list.getEntries()) values.push(entry.duration);
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // Long Tasks is aanvullende diagnostiek; oudere engines mogen de rest van de test uitvoeren.
    }
    const prototype = CanvasRenderingContext2D.prototype;
    const originalClear = prototype.clearRect;
    const originalArc = prototype.arc;
    let seen = new Set<string>();
    prototype.clearRect = function (...args) {
      if (
        (window as any).__atloreCaptureGraph &&
        this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf'
      ) {
        graph.nodes = [];
        seen = new Set();
      }
      return originalClear.apply(this, args);
    };
    prototype.arc = function (x, y, radius, start, end, counterclockwise) {
      if (
        (window as any).__atloreCaptureGraph &&
        radius > 5 &&
        this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf'
      ) {
        const key = `${x.toFixed(3)}:${y.toFixed(3)}`;
        if (!seen.has(key)) {
          seen.add(key);
          const matrix = this.getTransform();
          const rect = this.canvas.getBoundingClientRect();
          const ratio = this.canvas.width / Math.max(1, rect.width);
          graph.nodes.push({
            x,
            y,
            screenX: rect.left + (matrix.a * x + matrix.c * y + matrix.e) / ratio,
            screenY: rect.top + (matrix.b * x + matrix.d * y + matrix.f) / ratio
          });
        }
      }
      return originalArc.call(this, x, y, radius, start, end, counterclockwise);
    };
  });

  const started = performance.now();
  const response = await page.goto(`${baseUrl}/campaigns/${target.campaign_id}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000
  });
  if (!response?.ok()) throw new Error(`Campagne gaf HTTP ${response?.status()}.`);
  const canvas = page.getByLabel('Interactieve kennisgraaf');
  await canvas.waitFor({ state: 'visible', timeout: 120_000 });
  await page.waitForFunction(
    (count) => (window as any).__atloreLoadGraph?.nodes.length === count,
    expectedNodes,
    { timeout: 120_000 }
  );
  const readyMs = Math.round(performance.now() - started);
  // Laat de initiële worker-layout landen voordat de dragrespons wordt gemeten.
  await page.waitForTimeout(1800);
  const before = await page.evaluate(() =>
    structuredClone((window as any).__atloreLoadGraph.nodes)
  );
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Graphcanvas heeft geen afmetingen.');
  const targetNode = before.find(
    (node: { screenX: number; screenY: number }) =>
      node.screenX > bounds.x + 80 &&
      node.screenX < bounds.x + bounds.width - 240 &&
      node.screenY > bounds.y + 80 &&
      node.screenY < bounds.y + bounds.height - 150
  );
  if (!targetNode) throw new Error('Geen zichtbare node gevonden om te slepen.');

  const dragStarted = performance.now();
  await page.evaluate(`(() => {
    window.__atloreCaptureGraph = false;
    const frameTimes = [];
    let active = true;
    let previous = performance.now();
    const sample = (timestamp) => {
      if (!active) return;
      frameTimes.push(timestamp - previous);
      previous = timestamp;
      requestAnimationFrame(sample);
    };
    window.__atloreStopFrameSample = () => {
      active = false;
      return frameTimes;
    };
    requestAnimationFrame(sample);
  })()`);
  await page.mouse.move(targetNode.screenX, targetNode.screenY);
  await page.mouse.down();
  await page.mouse.move(targetNode.screenX + 90, targetNode.screenY + 45, { steps: 6 });
  await page.waitForTimeout(180);
  const dragMs = Math.round(performance.now() - dragStarted);
  const frameTimes = await page.evaluate(() => (window as any).__atloreStopFrameSample());
  await page.evaluate(() => ((window as any).__atloreCaptureGraph = true));
  await page.mouse.up();
  await page.waitForTimeout(220);
  const during = await page.evaluate(() =>
    structuredClone((window as any).__atloreLoadGraph.nodes)
  );

  const moved = during.filter(
    (node: { x: number; y: number }, index: number) =>
      before[index] && Math.hypot(node.x - before[index].x, node.y - before[index].y) > 1
  ).length;
  const longTasks = await page.evaluate(() => (window as any).__atloreLongTasks as number[]);
  const averageFrameMs =
    frameTimes.reduce((total: number, duration: number) => total + duration, 0) /
    Math.max(1, frameTimes.length);
  const slowestFrameMs = Math.max(0, ...frameTimes);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/load-10k.png', fullPage: true });

  if (before.length !== expectedNodes) throw new Error(`Canvas tekende ${before.length} nodes.`);
  if (moved < 4) throw new Error(`Slechts ${moved} nodes bewogen tijdens de drag.`);
  if (readyMs > 20_000) throw new Error(`10k-graph werd pas na ${readyMs} ms interactief.`);
  if (averageFrameMs > 24)
    throw new Error(`10k-drag haalde gemiddeld slechts ${(1000 / averageFrameMs).toFixed(0)} FPS.`);
  if (slowestFrameMs > 140)
    throw new Error(`10k-drag blokkeerde één frame ${Math.round(slowestFrameMs)} ms.`);
  if (errors.length) throw new Error(`Browserfouten:\n${errors.join('\n')}`);

  console.info(
    JSON.stringify(
      {
        campaignId: target.campaign_id,
        nodes: target.node_count,
        links: target.link_count,
        readyMs,
        dragMs,
        averageFrameMs: Math.round(averageFrameMs),
        slowestFrameMs: Math.round(slowestFrameMs),
        movedNodes: moved,
        longTasks: longTasks.length,
        longestTaskMs: Math.round(Math.max(0, ...longTasks))
      },
      null,
      2
    )
  );
} finally {
  await browser?.close();
  if (sessionId) await pool.query('delete from auth_sessions where id = $1', [sessionId]);
  await pool.end();
}
