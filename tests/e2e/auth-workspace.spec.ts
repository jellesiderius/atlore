import { expect, test } from '@playwright/test';

test('productieshell levert manifest zonder router- of socketwaarschuwingen', async ({
  page,
  request
}) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBeTruthy();
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  await expect(manifestResponse.json()).resolves.toMatchObject({
    name: 'Atlore',
    start_url: '/',
    scope: '/'
  });

  const messages: string[] = [];
  page.on('pageerror', (error) => messages.push(error.message));
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) messages.push(message.text());
  });
  await page.goto('/auth/login');
  await page.getByPlaceholder('E-mailadres').fill('demo@atlore.app');
  await page.getByPlaceholder('Wachtwoord').fill('AtloreDemo!2026');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await page.getByText('Ember & Rust', { exact: true }).first().click();
  await expect(page.locator('main.workspace')).toHaveAttribute('data-realtime', 'connected');

  expect(messages).toEqual([]);
});

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

test('accountbol opent profiel-, taal-, thema- en uitloginstellingen', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByPlaceholder('E-mailadres').fill('demo@atlore.app');
  await page.getByPlaceholder('Wachtwoord').fill('AtloreDemo!2026');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page).toHaveURL(/\/campaigns$/, { timeout: 10_000 });

  await expect(page.getByRole('button', { name: 'Uitloggen' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Accountinstellingen openen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Accountinstellingen' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Naam')).not.toHaveValue('');
  await expect(dialog.getByLabel('E-mailadres')).toHaveValue('demo@atlore.app');
  await expect(dialog.getByLabel('Huidig wachtwoord')).toBeVisible();
  await expect(dialog.getByLabel('Nieuw wachtwoord', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Herhaal nieuw wachtwoord')).toBeVisible();
  await expect(dialog.getByLabel('Taal')).toHaveValue('nl');
  await expect(dialog.getByRole('button', { name: 'Uitloggen' })).toBeVisible();

  await dialog.getByRole('button', { name: '☀ Licht' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('atlore-theme'))).toBe('light');
  await dialog.getByRole('button', { name: '☾ Donker' }).click();

  await dialog.getByLabel('Huidig wachtwoord').fill('niet-opslaan');
  await dialog.getByLabel('Nieuw wachtwoord', { exact: true }).fill('EenNieuwWachtwoord1!');
  await dialog.getByLabel('Herhaal nieuw wachtwoord').fill('EenAnderWachtwoord2!');
  await dialog.getByRole('button', { name: 'Wachtwoord opslaan' }).click();
  await expect(dialog.getByText('De nieuwe wachtwoorden zijn niet gelijk.')).toBeVisible();

  await dialog.getByLabel('Huidig wachtwoord').fill('onjuist-huidig-wachtwoord');
  await dialog.getByLabel('Herhaal nieuw wachtwoord').fill('EenNieuwWachtwoord1!');
  const rejectedPassword = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/account/password') && [401, 429].includes(response.status())
  );
  await dialog.getByRole('button', { name: 'Wachtwoord opslaan' }).click();
  const rejected = await rejectedPassword;
  if (rejected.status() === 401)
    await expect(dialog.getByText('Het huidige wachtwoord klopt niet.')).toBeVisible();
  else await expect(dialog.getByText('Te veel pogingen. Probeer het later opnieuw.')).toBeVisible();

  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/account') && response.ok()
  );
  await dialog.getByRole('button', { name: 'Account opslaan' }).click();
  await saved;
  await expect(dialog.getByText('Account opgeslagen.')).toBeVisible();

  await dialog.getByRole('button', { name: 'Uitloggen' }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
});

test('de workspace blijft werken zonder crypto.randomUUID', async ({ page, isMobile }) => {
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
  if (isMobile) await page.getByRole('button', { name: 'Paneel tonen of verbergen' }).click();
  await page.getByRole('button', { name: 'Instellingen', exact: true }).click();
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
