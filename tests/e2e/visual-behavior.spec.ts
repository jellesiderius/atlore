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
}, testInfo) => {
  await openDemoCampaign(page);
  if (testInfo.project.name.includes('mobile'))
    await page.getByRole('button', { name: 'Paneel tonen of verbergen' }).click();

  await page.getByRole('button', { name: 'Oakvale', exact: true }).click();
  const popover = page.getByRole('dialog', { name: 'Details van Oakvale' });
  await expect(popover).toBeVisible();
  await expect(popover.getByText('Locatie', { exact: true })).toBeVisible();
  await popover.getByRole('button', { name: 'Openen' }).click();

  await expect(page.getByLabel('Nodenaam')).toHaveValue('Oakvale');
  await expect(page.getByRole('button', { name: 'Dossier sluiten' })).toBeVisible();
});
