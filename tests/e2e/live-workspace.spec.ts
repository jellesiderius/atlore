import { expect, test, type Locator, type Page } from '@playwright/test';

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function dropPng(page: Page, target: Locator, name: string) {
  const transfer = await page.evaluateHandle(
    (value) => {
      const bytes = Uint8Array.from(atob(value.png), (character) => character.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], value.name, { type: 'image/png' }));
      return transfer;
    },
    { png: PNG, name }
  );
  expect(
    await page.evaluate(
      (value) => ({ types: Array.from(value.types), count: value.files.length }),
      transfer
    )
  ).toEqual({ types: ['Files'], count: 1 });
  await target.dispatchEvent('dragenter', { dataTransfer: transfer });
  await expect(target).toHaveAttribute('data-image-dragging', 'true');
  await target.dispatchEvent('dragover', { dataTransfer: transfer });
  await target.dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
}

test('node-mentions verversen de graph direct en de kaartknop uploadt echt', async ({
  page
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(
    testInfo.project.name.includes('mobile'),
    'De canvasverversing wordt op desktop getest.'
  );

  await page.addInitScript(() => {
    Object.assign(window, { __atloreLiveCurves: 0 });
    const prototype = CanvasRenderingContext2D.prototype;
    const original = prototype.quadraticCurveTo;
    prototype.quadraticCurveTo = function (controlX, controlY, x, y) {
      if (this.canvas.getAttribute('aria-label') === 'Interactieve kennisgraaf') {
        (window as any).__atloreLiveCurves += 1;
      }
      return original.call(this, controlX, controlY, x, y);
    };
  });

  await page.goto('/auth/login');
  await page.getByPlaceholder('E-mailadres').fill('demo@atlore.app');
  await page.getByPlaceholder('Wachtwoord').fill('AtloreDemo!2026');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page).toHaveURL(/\/campaigns$/);

  const world = await page.evaluate(async () => {
    const json = async (url: string, init?: RequestInit) => {
      const response = await fetch(url, init);
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    };
    const title = `Live werkruimte ${Date.now()}`;
    const campaign = await json('/api/campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, system: 'D&D 5e', note: 'Tijdelijke E2E-campagne' })
    });
    const createNode = (nodeTitle: string) =>
      json(`/api/campaigns/${campaign.id}/nodes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: nodeTitle, type: 'location', x: 0, y: 0 })
      });
    const source = await createNode('Bronburcht');
    const target = await createNode('Doelwoud');
    return { campaignId: campaign.id, title, sourceId: source.id, targetId: target.id };
  });

  try {
    await page.goto(`/campaigns/${world.campaignId}?node=${world.sourceId}`);
    const dossier = page.locator('.dossier');
    await dropPng(page, dossier.locator('.hero'), 'bronburcht.png');
    await expect(dossier.getByRole('img', { name: 'Bronburcht' })).toBeVisible({ timeout: 5_000 });

    await page.goto(`/campaigns/${world.campaignId}?node=${world.sourceId}&nodeTab=map`);
    await dropPng(page, dossier.locator('.map-upload'), 'bronburcht-kaart.png');
    await expect(dossier.getByRole('img', { name: 'Kaart van Bronburcht' })).toBeVisible({
      timeout: 5_000
    });
    await page.goto(`/campaigns/${world.campaignId}?node=${world.sourceId}`);

    const editor = page.locator('.dossier').getByRole('textbox', { name: 'Teksteditor' }).first();
    await editor.fill('@Doelwoud');
    await page.getByRole('listbox').getByText('Doelwoud', { exact: true }).click();
    await expect(page.getByText('Opgeslagen', { exact: true })).toBeVisible({ timeout: 4_000 });
    await page.getByRole('button', { name: 'Dossier sluiten' }).click();
    await page.waitForFunction(() => (window as any).__atloreLiveCurves > 0);

    const currentLinks = await page.evaluate(async (campaignId) => {
      const snapshot = await (await fetch(`/api/campaigns/${campaignId}/workspace`)).json();
      return snapshot.links;
    }, world.campaignId);
    expect(
      currentLinks.some(
        (link: { sourceId: string; targetId: string }) =>
          [link.sourceId, link.targetId].includes(world.sourceId) &&
          [link.sourceId, link.targetId].includes(world.targetId)
      )
    ).toBe(true);

    await page.goto(`/campaigns/${world.campaignId}?view=atlas`);
    const uploadInput = page.getByRole('button', { name: 'Kaart uploaden', exact: true });
    await expect(uploadInput).toBeEnabled();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), uploadInput.click()]);
    await chooser.setFiles([]);

    await dropPng(
      page,
      page.getByRole('application', { name: 'Interactieve campagnekaart' }),
      'atlore-testkaart.png'
    );
    await expect(page.getByRole('img', { name: `Kaart van ${world.title}` })).toBeVisible({
      timeout: 5_000
    });
    await expect(page.locator('.header-upload')).toBeVisible();
  } finally {
    await page.evaluate(async (campaignId) => {
      await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
    }, world.campaignId);
  }
});
