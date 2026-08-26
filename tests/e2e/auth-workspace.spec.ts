import { expect, test } from '@playwright/test';

test('same-origin login werkt ook via een alternatieve lokale host', async ({ request }) => {
  const alternativeOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000');
  alternativeOrigin.hostname = '127.0.0.1';
  const response = await request.post(`${alternativeOrigin.origin}/api/auth/login`, {
    headers: { origin: alternativeOrigin.origin },
    data: { email: 'demo@atlore.app', password: 'AtloreDemo!2026' }
  });

  expect(response.ok()).toBeTruthy();
});

test('cross-site login wordt geweigerd', async ({ request }) => {
  const response = await request.post('/api/auth/login', {
    headers: { origin: 'https://evil.example' },
    data: { email: 'demo@atlore.app', password: 'AtloreDemo!2026' }
  });

  expect(response.status()).toBe(403);
});

test('de workspace blijft werken zonder crypto.randomUUID', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: undefined,
      configurable: true
    });
  });
  await page.goto('/auth/login');
  await page.getByPlaceholder('E-mailadres').fill('demo@atlore.app');
  await page.getByPlaceholder('Wachtwoord').fill('AtloreDemo!2026');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
  await page.getByText('Ember & Rust', { exact: true }).first().click();
  await page.getByLabel('Bekijk de campagne als').selectOption({ label: 'Lena' });

  await expect(page.getByText(/Alleen-lezen: je bekijkt de wereld als Lena/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('inloggen en door de Atlore-workspace navigeren', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByPlaceholder('E-mailadres').fill('demo@atlore.app');
  await page.getByPlaceholder('Wachtwoord').fill('AtloreDemo!2026');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page.getByText('Welkom terug,')).toBeVisible();
  await page.getByText('Ember & Rust', { exact: true }).first().click();
  await expect(page.getByRole('navigation', { name: 'Hoofdweergaven' })).toBeVisible();
  await expect(page.getByLabel('Interactieve kennisgraaf')).toBeVisible();
  await page.getByRole('button', { name: 'Sessie', exact: true }).click();
  await expect(page.getByLabel('Sessietitel')).toHaveValue('Een lege stoel');
});
