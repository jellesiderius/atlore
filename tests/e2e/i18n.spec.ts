import { expect, test } from '@playwright/test';

test('taalkeuze vertaalt snippets, blijft bewaard en geldt voor serverfouten', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');

  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.getByRole('heading', { name: 'Welkom terug' })).toBeVisible();

  await page.getByLabel('Taal').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByPlaceholder('Email address')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Language')).toHaveValue('en');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

  await page.getByPlaceholder('Email address').fill('unknown@example.com');
  await page.getByPlaceholder('Password').fill('incorrect-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('The email address or password is incorrect.')).toBeVisible();
});
