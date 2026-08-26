import { expect, test } from '@playwright/test';

async function openDemoCampaign(page: import('@playwright/test').Page) {
  await page.goto('/auth/login');
  await page.getByPlaceholder('E-mailadres').fill('demo@atlore.app');
  await page.getByPlaceholder('Wachtwoord').fill('AtloreDemo!2026');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await page.getByText('Ember & Rust', { exact: true }).first().click();
  await expect(page.getByLabel('Interactieve kennisgraaf')).toBeVisible();
}

test('de auth-achtergrond bevat opstijgende vuurvonken', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __atloreSparks: [] as { x: number; y: number }[] });
    const prototype = CanvasRenderingContext2D.prototype;
    const originalClear = prototype.clearRect;
    const originalArc = prototype.arc;
    prototype.clearRect = function (...args) {
      if (this.canvas.getAttribute('aria-hidden') === 'true') (window as any).__atloreSparks = [];
      return originalClear.apply(this, args);
    };
    prototype.arc = function (x, y, radius, start, end, counterclockwise) {
      if (radius <= 4 && this.canvas.getAttribute('aria-hidden') === 'true') {
        ((window as any).__atloreSparks as { x: number; y: number }[]).push({ x, y });
      }
      return originalArc.call(this, x, y, radius, start, end, counterclockwise);
    };
  });
  await page.goto('/auth/login');
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas[aria-hidden="true"]');
    if (!canvas) return false;
    const expected = Math.min(26, Math.round((canvas.clientWidth * canvas.clientHeight) / 34_000));
    return (window as any).__atloreSparks?.length === expected;
  });
  const before = await page.evaluate(() => structuredClone((window as any).__atloreSparks));
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => structuredClone((window as any).__atloreSparks));

  expect(after.length).toBe(before.length);
  const rises = after.filter(
    (spark: { y: number }, index: number) => before[index] && spark.y < before[index].y - 1
  );
  expect(rises.length).toBe(after.length);
});

test('schrijf- en leesvlakken hebben een herkenbare componentstatus', async ({ page }) => {
  await openDemoCampaign(page);
  await page.getByRole('button', { name: 'Sessie', exact: true }).click();

  const writingSurfaces = page.getByLabel('Schrijfvlak');
  await expect(writingSurfaces).toHaveCount(2);
  const editor = page.getByRole('textbox', { name: 'Teksteditor' }).first();
  const restingBorder = await writingSurfaces
    .first()
    .evaluate((element) => getComputedStyle(element).borderColor);
  await editor.focus();
  await expect
    .poll(() =>
      writingSurfaces.first().evaluate((element) => getComputedStyle(element).borderColor)
    )
    .not.toBe(restingBorder);

  await page.getByRole('button', { name: 'Verhaal', exact: true }).click();
  await expect(page.getByLabel('Leesweergave').first()).toBeVisible();
});

test('tooltips en tekst-hoverinspectie volgen het prototype', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name.includes('mobile'),
    'Hoverlagen zijn alleen actief met een muis.'
  );
  await openDemoCampaign(page);

  await page.getByRole('button', { name: 'Graph', exact: true }).hover();
  const tooltip = page.locator('.atlore-tooltip');
  await expect(tooltip).toHaveText('Graph');
  expect(
    await tooltip.evaluate((element) => ({
      fontSize: getComputedStyle(element).fontSize,
      arrow: getComputedStyle(element, '::before').content
    }))
  ).toEqual({ fontSize: '12.5px', arrow: '""' });

  await page.mouse.move(700, 500);
  const nodeRow = page.locator('.group-items button').first();
  await nodeRow.hover();
  const preview = page.locator('.node-preview');
  await page.waitForTimeout(350);
  await expect(preview).toHaveCount(0);

  await page.getByRole('button', { name: 'Sessie', exact: true }).click();
  const nodeReference = page
    .getByRole('textbox', { name: 'Teksteditor' })
    .first()
    .locator('[data-ref]')
    .first();
  const nodeTitle = (await nodeReference.innerText()).trim();
  await nodeReference.hover();
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(nodeTitle);
  expect(Math.round((await preview.boundingBox())!.width)).toBe(316);

  await preview.getByRole('button', { name: 'Openen', exact: true }).hover();
  await expect(preview).toBeVisible();
  await preview.getByRole('button', { name: 'Openen', exact: true }).click();
  await expect(page.getByLabel('Nodenaam')).toHaveValue(nodeTitle);
  await expect(page.getByLabel('Schrijfvlak').first()).toBeVisible();
});

test('graphlijnen zijn gebogen en Explorer-klikken volgen het prototype', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'De Explorer sluit na een mobiele selectie.');
  await page.addInitScript(() => {
    Object.assign(window, { __atloreCurves: 0, __atloreCameraFrames: [] });
    const prototype = CanvasRenderingContext2D.prototype;
    const original = prototype.quadraticCurveTo;
    const originalTranslate = prototype.translate;
    prototype.quadraticCurveTo = function (...args) {
      if (this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf')
        (window as any).__atloreCurves += 1;
      return original.apply(this, args);
    };
    prototype.translate = function (x, y) {
      if (this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf')
        (window as any).__atloreCameraFrames.push({ x, y });
      return originalTranslate.call(this, x, y);
    };
  });
  await openDemoCampaign(page);
  await page.waitForFunction(() => (window as any).__atloreCurves > 10);

  const row = page.locator('.group-items button').filter({ hasText: 'Oakvale' });
  await page.evaluate(() => ((window as any).__atloreCameraFrames = []));
  await row.click();
  await expect(row).toHaveClass(/active/);
  await expect(page.getByRole('dialog', { name: 'Details van Oakvale' })).toHaveCount(0);
  await expect(page.locator('.node-preview')).toHaveCount(0);
  await page.waitForTimeout(450);
  const cameraPositions = await page.evaluate(() =>
    (window as any).__atloreCameraFrames.map(({ x, y }: { x: number; y: number }) =>
      `${x.toFixed(1)}:${y.toFixed(1)}`
    )
  );
  expect(new Set(cameraPositions).size).toBeGreaterThan(4);

  await row.click();
  await expect(page.getByLabel('Nodenaam')).toHaveValue('Oakvale');
  const tabAlignment = await page.locator('.dossier > nav').evaluate((nav) => {
    const tabs = [...nav.querySelectorAll('button')];
    const first = tabs[0].getBoundingClientRect();
    const last = tabs.at(-1)!.getBoundingClientRect();
    const bounds = nav.getBoundingClientRect();
    return Math.abs((first.left + last.right) / 2 - (bounds.left + bounds.right) / 2);
  });
  expect(tabAlignment).toBeLessThan(2);
});

test('de graph-intro ontvouwt vanuit het centrum en implodeert niet', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __atloreIntroNodes: [] as { x: number; y: number }[] });
    const prototype = CanvasRenderingContext2D.prototype;
    const originalClear = prototype.clearRect;
    const originalArc = prototype.arc;
    let seen = new Set<string>();
    prototype.clearRect = function (...args) {
      if (this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf') {
        (window as any).__atloreIntroNodes = [];
        seen = new Set();
      }
      return originalClear.apply(this, args);
    };
    prototype.arc = function (x, y, radius, start, end, counterclockwise) {
      if (radius > 5 && this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf') {
        const key = `${x.toFixed(3)}:${y.toFixed(3)}`;
        if (!seen.has(key)) {
          seen.add(key);
          ((window as any).__atloreIntroNodes as { x: number; y: number }[]).push({ x, y });
        }
      }
      return originalArc.call(this, x, y, radius, start, end, counterclockwise);
    };
  });
  await openDemoCampaign(page);
  await page.waitForFunction(() => (window as any).__atloreIntroNodes?.length > 20);
  const initial = await page.evaluate(() => structuredClone((window as any).__atloreIntroNodes));
  await page.waitForTimeout(1600);
  const settled = await page.evaluate(() => structuredClone((window as any).__atloreIntroNodes));
  const area = (points: { x: number; y: number }[]) =>
    (Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))) *
    (Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y)));

  expect(settled.length).toBe(initial.length);
  expect(area(settled)).toBeGreaterThan(area(initial) * 1.25);
});

test('icon controls tonen de gedeelde Atlore-tooltip', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'Mobiel gebruikt zichtbare navigatielabels.');
  await openDemoCampaign(page);

  await page.getByRole('button', { name: 'Graph', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('Graph');
});

test('node-popover staat bij de selectie en opent het juiste dossier', async ({
  page
}) => {
  await page.addInitScript(() => {
    Object.assign(window, {
      __atloreGraphNodes: [] as { x: number; y: number; alpha: number }[]
    });
    const prototype = CanvasRenderingContext2D.prototype;
    const originalClear = prototype.clearRect;
    const originalArc = prototype.arc;
    let seen = new Set<string>();
    prototype.clearRect = function (...args) {
      if (this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf') {
        (window as any).__atloreGraphNodes = [];
        seen = new Set();
      }
      return originalClear.apply(this, args);
    };
    prototype.arc = function (x, y, radius, start, end, counterclockwise) {
      if (radius > 5 && this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf') {
        const key = `${x.toFixed(3)}:${y.toFixed(3)}`;
        if (!seen.has(key)) {
          seen.add(key);
          const matrix = this.getTransform();
          const rect = this.canvas.getBoundingClientRect();
          const pixelRatio = this.canvas.width / Math.max(1, rect.width);
          (window as any).__atloreGraphNodes.push({
            x: rect.left + (matrix.a * x + matrix.c * y + matrix.e) / pixelRatio,
            y: rect.top + (matrix.b * x + matrix.d * y + matrix.f) / pixelRatio,
            alpha: this.globalAlpha
          });
        }
      }
      return originalArc.call(this, x, y, radius, start, end, counterclockwise);
    };
  });
  await openDemoCampaign(page);
  await page.waitForFunction(() => (window as any).__atloreGraphNodes?.length > 10);
  await page.waitForTimeout(1600);
  const target = await page.evaluate(() => (window as any).__atloreGraphNodes[0]);
  await page.mouse.move(target.x, target.y);
  await page.waitForTimeout(400);
  await expect(page.locator('.node-preview')).toHaveCount(0);
  const hoverAlphas = await page.evaluate(() =>
    (window as any).__atloreGraphNodes.map((node: { alpha: number }) => node.alpha)
  );
  expect(hoverAlphas.some((alpha: number) => alpha < 0.2)).toBe(true);
  expect(hoverAlphas.some((alpha: number) => alpha > 0.8)).toBe(true);
  await page.mouse.click(target.x, target.y);
  const popover = page.getByRole('dialog', { name: /Details van/ });
  await expect(popover).toBeVisible();
  await popover.getByRole('button', { name: 'Openen' }).click();

  await expect(page.getByLabel('Nodenaam')).not.toHaveValue('');
  await expect(page.getByRole('button', { name: 'Dossier sluiten' })).toBeVisible();
});
