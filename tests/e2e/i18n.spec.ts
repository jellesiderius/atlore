import { expect, test } from '@playwright/test';

test('Engels is standaard en een taalkeuze blijft bewaard voor client en server', async ({
  page,
  context
}) => {
  await context.clearCookies({ name: 'atlore_locale' });
  await page.goto('/auth/login');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByPlaceholder('Email address')).toBeVisible();

  await page.getByLabel('Language').selectOption('nl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.getByRole('heading', { name: 'Welkom terug' })).toBeVisible();
  await expect(page.getByPlaceholder('E-mailadres')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Taal')).toHaveValue('nl');
  await expect(page.getByRole('button', { name: 'Inloggen' })).toBeVisible();

  await page.getByPlaceholder('E-mailadres').fill('unknown@example.com');
  await page.getByPlaceholder('Wachtwoord').fill('incorrect-password');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page.getByText('E-mailadres of wachtwoord klopt niet.')).toBeVisible();
});
