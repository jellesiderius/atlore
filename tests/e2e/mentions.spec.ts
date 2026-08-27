import { expect, test } from '@playwright/test';

test('een @ toont nodes en biedt daaronder een nieuwe node aan', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByPlaceholder('E-mailadres').fill('demo@atlore.app');
  await page.getByPlaceholder('Wachtwoord').fill('AtloreDemo!2026');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page).toHaveURL(/\/campaigns$/);

  const campaignId = await page.evaluate(async () => {
    const response = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: `Mentiontest ${Date.now()}`,
        system: 'D&D 5e',
        note: 'Tijdelijke Playwright-campagne'
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const campaign = await response.json();
    for (const title of [
      'Bestaande testnode',
      'Jan',
      'Kees',
      'Kare',
      'Bertje',
      'Klaas',
      'Extra testnode één',
      'Extra testnode twee'
    ]) {
      const nodeResponse = await fetch(`/api/campaigns/${campaign.id}/nodes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          type: 'npc',
          size: 'm',
          summary: '',
          revealed: true,
          visibility: 'all',
          visibleWith: [],
          x: 0,
          y: 0,
          connectTo: []
        })
      });
      if (!nodeResponse.ok) throw new Error(await nodeResponse.text());
    }
    const sessionResponse = await fetch(`/api/campaigns/${campaign.id}/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Mentiontest', worldDate: '' })
    });
    if (!sessionResponse.ok) throw new Error(await sessionResponse.text());
    return campaign.id as string;
  });

  try {
    await page.goto(`/campaigns/${campaignId}`);
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    await page.getByRole('button', { name: 'Sessies', exact: true }).click();
    await page.getByRole('button', { name: 'Bewerken', exact: true }).first().click();
    const editor = page.getByRole('textbox', { name: 'Teksteditor' }).first();
    await editor.click();

    await editor.pressSequentially(
      'jan en kees en kare en bertje Toen jan2 jan2 en jan janjan jan klaas kees'
    );
    await page.locator('input.title').click();
    const suggestions = editor.locator('[data-maybe]');
    await expect(suggestions).toHaveCount(8);
    await expect(suggestions).toHaveText([
      'jan',
      'kees',
      'kare',
      'bertje',
      'jan',
      'jan',
      'klaas',
      'kees'
    ]);

    await editor.click();
    await editor.press('ControlOrMeta+A');
    await editor.press('Backspace');
    await editor.pressSequentially('@');

    const menu = page.getByRole('listbox');
    await expect(menu).toBeVisible();
    await expect(menu.getByText('Bestaande testnode', { exact: true })).toBeVisible();
    await expect(menu.getByText('Nieuwe node maken', { exact: true })).toBeVisible();
    const menuLayout = await menu.evaluate((element) => {
      const results = element.querySelector<HTMLElement>('.mention-results')!;
      const create = element.querySelector<HTMLElement>('button.new')!;
      const plus = create.querySelector<HTMLElement>('span')!;
      const icon = plus.querySelector<SVGElement>('svg')!;
      const menuBox = element.getBoundingClientRect();
      const createBox = create.getBoundingClientRect();
      const plusBox = plus.getBoundingClientRect();
      const iconBox = icon.getBoundingClientRect();
      results.scrollTop = results.scrollHeight;
      return {
        resultsScrollable: results.scrollHeight > results.clientHeight,
        footerInsideMenu: createBox.bottom <= menuBox.bottom,
        footerSeparated: getComputedStyle(create).borderTopStyle !== 'none',
        plusCenterDelta: Math.max(
          Math.abs(plusBox.left + plusBox.width / 2 - (iconBox.left + iconBox.width / 2)),
          Math.abs(plusBox.top + plusBox.height / 2 - (iconBox.top + iconBox.height / 2))
        )
      };
    });
    expect(menuLayout).toEqual({
      resultsScrollable: true,
      footerInsideMenu: true,
      footerSeparated: true,
      plusCenterDelta: 0
    });
    await expect(menu.getByText('Nieuwe node maken', { exact: true })).toBeVisible();

    await editor.pressSequentially('Bestaande testnode');
    await expect(menu.getByText('Bestaande testnode', { exact: true })).toBeVisible();
    await expect(menu.locator('button.new')).toHaveCount(0);

    await editor.fill('@Volledig nieuwe node');
    await expect(menu.getByText('Nieuw: “Volledig nieuwe node”', { exact: true })).toBeVisible();
    await menu.getByText('Nieuw: “Volledig nieuwe node”', { exact: true }).click();
    await expect(page.getByPlaceholder('Naam')).toHaveValue('Volledig nieuwe node');
  } finally {
    await page.evaluate(async (id) => {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
    }, campaignId);
  }
});
