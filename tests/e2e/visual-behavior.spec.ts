import { expect, test } from '@playwright/test';

async function openDemoCampaign(page: import('@playwright/test').Page) {
  await page.goto('/auth/login');
  await page.getByPlaceholder('E-mailadres').fill('demo@atlore.app');
  await page.getByPlaceholder('Wachtwoord').fill('AtloreDemo!2026');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await page.getByText('Ember & Rust', { exact: true }).first().click();
  await expect(page.getByLabel('Interactieve kennisgraaf')).toBeVisible();
}

async function themeValues(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const rgb = (value: string) => {
      const color = value.trim();
      const channels = color.startsWith('#')
        ? color
            .slice(1)
            .match(/.{2}/g)!
            .map((channel) => Number.parseInt(channel, 16))
        : color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number);
      return channels.map((channel) => channel / 255);
    };
    const luminance = (value: string) => {
      const [red, green, blue] = rgb(value).map((channel) =>
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      );
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const ratio = (foreground: string, background: string) => {
      const light = Math.max(luminance(foreground), luminance(background));
      const dark = Math.min(luminance(foreground), luminance(background));
      return (light + 0.05) / (dark + 0.05);
    };
    const panel = root.getPropertyValue('--bg-3');
    return {
      tokens: {
        canvas: root.getPropertyValue('--canvas').trim().toLowerCase(),
        text: root.getPropertyValue('--text').trim().toLowerCase(),
        secondary: root.getPropertyValue('--text-2').trim().toLowerCase(),
        muted: root.getPropertyValue('--text-3').trim().toLowerCase()
      },
      secondary: ratio(root.getPropertyValue('--text-2'), panel),
      muted: ratio(root.getPropertyValue('--text-3'), panel)
    };
  });
}

test('secundaire dark-mode tekst behoudt leesbaar contrast', async ({ page }) => {
  await page.goto('/auth/login');
  const contrast = await themeValues(page);

  expect(contrast.tokens).toEqual({
    canvas: '#1a1816',
    text: '#eae8e6',
    secondary: '#a19e9e',
    muted: '#a19e9e'
  });
  expect(contrast.secondary).toBeGreaterThanOrEqual(4.5);
  expect(contrast.muted).toBeGreaterThanOrEqual(4.5);
});

test('light mode gebruikt een warm en volledig leesbaar kleurenpalet', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('atlore-theme', 'light'));
  await page.goto('/auth/login');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const contrast = await themeValues(page);

  expect(contrast.tokens).toEqual({
    canvas: '#f5f3ef',
    text: '#1a1816',
    secondary: '#4f4b47',
    muted: '#69645f'
  });
  expect(contrast.secondary).toBeGreaterThanOrEqual(4.5);
  expect(contrast.muted).toBeGreaterThanOrEqual(4.5);
});

test('het graph-stippenraster blijft zichtbaar bij elk zoomniveau', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, {
      __atloreGraphDots: [] as { radius: number; alpha: number; color: string }[]
    });
    const prototype = CanvasRenderingContext2D.prototype;
    const originalClear = prototype.clearRect;
    const originalArc = prototype.arc;
    prototype.clearRect = function (...args) {
      if (this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf')
        (window as any).__atloreGraphDots = [];
      return originalClear.apply(this, args);
    };
    prototype.arc = function (x, y, radius, start, end, counterclockwise) {
      if (
        radius >= 1 &&
        radius <= 2 &&
        this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf'
      ) {
        (window as any).__atloreGraphDots.push({
          radius,
          alpha: this.globalAlpha,
          color: String(this.fillStyle)
        });
      }
      return originalArc.call(this, x, y, radius, start, end, counterclockwise);
    };
  });
  await openDemoCampaign(page);
  await page.waitForFunction(() => (window as any).__atloreGraphDots?.length > 20);
  const dots = await page.evaluate(() => structuredClone((window as any).__atloreGraphDots));

  expect(dots.every((dot: { radius: number }) => dot.radius >= 1.15)).toBe(true);
  expect(Math.max(...dots.map((dot: { alpha: number }) => dot.alpha))).toBeGreaterThan(0.08);
  expect(dots.every((dot: { color: string }) => dot.color === '#ffffff')).toBe(true);
});

test('de graph-toolbar is alleen op mobiel zichtbaar', async ({ page }, testInfo) => {
  await openDemoCampaign(page);
  const toolbar = page.locator('section.stage > .toolbar');

  if (testInfo.project.name.includes('mobile')) await expect(toolbar).toBeVisible();
  else await expect(toolbar).toBeHidden();
});

test('de mobiele hoofdnavigatie benut de breedte compact en gelijkmatig', async ({
  page
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Dit gedrag geldt alleen voor mobiel.');
  await openDemoCampaign(page);
  const navigation = page.getByRole('navigation', { name: 'Hoofdweergaven' });
  const buttons = navigation.getByRole('button');
  await expect(buttons).toHaveCount(4);

  const layout = await navigation.evaluate((element) => {
    const style = getComputedStyle(element);
    const items = [...element.querySelectorAll<HTMLElement>('button')];
    const boxes = items.map((item) => item.getBoundingClientRect());
    return {
      display: style.display,
      columns: style.gridTemplateColumns.split(' ').length,
      height: element.getBoundingClientRect().height,
      buttonHeights: boxes.map((box) => box.height),
      widthDifference:
        Math.max(...boxes.map((box) => box.width)) - Math.min(...boxes.map((box) => box.width)),
      gaps: boxes.slice(1).map((box, index) => box.left - boxes[index].right),
      directions: items.map((item) => getComputedStyle(item).flexDirection)
    };
  });

  expect(layout.display).toBe('grid');
  expect(layout.columns).toBe(4);
  expect(layout.height).toBeLessThanOrEqual(60);
  expect(layout.buttonHeights.every((height) => height >= 44)).toBe(true);
  expect(layout.widthDifference).toBeLessThan(1);
  expect(layout.gaps.every((gap) => gap <= 4.1)).toBe(true);
  expect(layout.directions).toEqual(['row', 'row', 'row', 'row']);
  await expect(buttons.first()).toHaveAttribute('aria-current', 'page');
});

test('verborgen nodes hebben de ghoststijl uit het prototype', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'De Explorer is op mobiel ingeklapt.');
  await page.addInitScript(() => {
    Object.assign(window, { __atloreHiddenRings: [] as { alpha: number; dash: number[] }[] });
    const prototype = CanvasRenderingContext2D.prototype;
    const originalStroke = prototype.stroke;
    prototype.stroke = function (path?: Path2D) {
      const dash = this.getLineDash();
      if (dash.length && this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf') {
        (window as any).__atloreHiddenRings.push({ alpha: this.globalAlpha, dash });
      }
      return Reflect.apply(originalStroke, this, path === undefined ? [] : [path]);
    };
  });
  await openDemoCampaign(page);
  await page.waitForFunction(() => (window as any).__atloreHiddenRings.length > 0);

  const rings = await page.evaluate(() => structuredClone((window as any).__atloreHiddenRings));
  expect(rings.some((ring: { alpha: number }) => ring.alpha > 0.5 && ring.alpha < 0.8)).toBe(true);
  const hiddenRow = page.locator('.group-items button.hidden').first();
  await expect(hiddenRow).toBeVisible();
  await expect(hiddenRow.locator('em')).toHaveText('◌');
  expect(await hiddenRow.evaluate((element) => getComputedStyle(element).color)).toBe(
    'rgb(161, 158, 158)'
  );
});

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
  await expect
    .poll(() => editor.evaluate((element) => getComputedStyle(element).color))
    .toBe('rgb(234, 232, 230)');
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
  const readingSurface = page.getByLabel('Leesweergave').first();
  await expect(readingSurface).toBeVisible();
  await expect
    .poll(() =>
      readingSurface.locator('.rich-view').evaluate((element) => getComputedStyle(element).color)
    )
    .toBe('rgb(234, 232, 230)');
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

  await nodeReference.click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(preview).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.mouse.move(700, 500);
  await nodeReference.hover();
  await expect(preview).toBeVisible();

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
    (window as any).__atloreCameraFrames.map(
      ({ x, y }: { x: number; y: number }) => `${x.toFixed(1)}:${y.toFixed(1)}`
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

test('node-popover staat bij de selectie en opent het juiste dossier', async ({ page }) => {
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
