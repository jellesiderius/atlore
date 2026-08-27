import { expect, test, type Locator, type Page } from '@playwright/test';

type TestWorld = { campaignId: string; heroId: string; placeId: string };

async function waitForWorkspace(page: Page) {
  const canvas = page.getByLabel('Interactieve kennisgraaf');
  await expect(canvas).toBeVisible();
  await expect
    .poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.width > 300))
    .toBe(true);
}

async function createWorld(page: Page, withMap = false): Promise<TestWorld> {
  await page.goto('/auth/login');
  await page.getByPlaceholder('E-mailadres').fill('demo@atlore.app');
  await page.getByPlaceholder('Wachtwoord').fill('AtloreDemo!2026');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page).toHaveURL(/\/campaigns$/);

  return page.evaluate(async (map) => {
    const json = async (url: string, init?: RequestInit) => {
      const response = await fetch(url, init);
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    };
    const campaign = await json('/api/campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: `Contextmenu ${Date.now()} ${Math.random()}`,
        system: 'D&D 5e',
        note: 'Tijdelijke contextmenutest'
      })
    });
    const createNode = (title: string, type: string) =>
      json(`/api/campaigns/${campaign.id}/nodes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, type, summary: 'Contextmenutest' })
      });
    const hero = await createNode('Contextheld', 'character');
    const place = await createNode('Contextplaats', 'location');
    await json(`/api/campaigns/${campaign.id}/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Contextsessie',
        worldDate: 'Testdag',
        body: [
          {
            segs: [
              { t: 'ref', id: hero.id },
              { t: 'txt', v: ' bezoekt de markt.' }
            ]
          }
        ]
      })
    });

    if (map) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 400;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#17212b';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#d8b06a';
      context.fillRect(80, 70, 480, 260);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error('PNG mislukt'))),
          'image/png'
        )
      );
      const form = new FormData();
      form.set('campaignId', campaign.id);
      form.set('purpose', 'map');
      form.set('file', new File([blob], 'contextkaart.png', { type: 'image/png' }));
      const asset = await json('/api/media', { method: 'POST', body: form });
      await json(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mapMediaId: asset.id })
      });
      await json(`/api/campaigns/${campaign.id}/nodes/${hero.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pinX: 0.5, pinY: 0.5, pinMapId: null })
      });
    }

    return { campaignId: campaign.id, heroId: hero.id, placeId: place.id };
  }, withMap);
}

async function workspaceNode(page: Page, campaignId: string, nodeId: string) {
  return page.evaluate(
    async ({ campaignId, nodeId }) => {
      const response = await fetch(`/api/campaigns/${campaignId}/workspace`);
      const snapshot = await response.json();
      return snapshot.nodes.find((node: { id: string }) => node.id === nodeId);
    },
    { campaignId, nodeId }
  );
}

async function selectTextAndOpenContext(editor: Locator, text: string) {
  await editor.evaluate((element, value) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Text | null = null;
    let start = -1;
    while (walker.nextNode()) {
      const candidate = walker.currentNode as Text;
      const index = candidate.data.indexOf(value);
      if (index >= 0) {
        node = candidate;
        start = index;
        break;
      }
    }
    if (!node) throw new Error(`Tekst niet gevonden: ${value}`);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + value.length);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const bounds = range.getBoundingClientRect();
    (node.parentElement ?? element).dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + Math.max(2, bounds.width / 2),
        clientY: bounds.top + Math.max(2, bounds.height / 2),
        button: 2
      })
    );
  }, text);
}

async function removeWorld(page: Page, campaignId: string) {
  await page.evaluate(async (id) => {
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
  }, campaignId);
}

test('alle graph-, explorer- en tekstacties uit het contextmenu werken', async ({
  page
}, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name.includes('mobile'), 'Rechtermuisknop is een desktopinteractie.');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const world = await createWorld(page);

  try {
    await page.goto(`/campaigns/${world.campaignId}`);
    await waitForWorkspace(page);
    const explorer = page.getByLabel('Explorer');
    const hero = explorer.getByRole('button', { name: 'Contextheld', exact: true });
    await expect(hero).toBeVisible();

    await hero.click({ button: 'right' });
    let menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Openen' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Verbinden met…' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Verbinden met…' }).click();
    await expect(page.getByRole('dialog', { name: 'Verbinden met Contextheld' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Sluiten' }).click();

    await hero.click({ button: 'right' });
    await page.getByRole('menu').getByRole('menuitem', { name: 'Openen' }).click();
    await expect(page.getByLabel('Nodenaam')).toHaveValue('Contextheld');
    await page.getByRole('button', { name: 'Dossier sluiten' }).click();

    await explorer.getByRole('button', { name: 'Recent', exact: true }).click();
    const recentHero = explorer.getByRole('button', { name: /Contextheld/ });
    await recentHero.click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');

    await explorer.getByRole('button', { name: 'Zoeken', exact: true }).click();
    await explorer.getByPlaceholder('Zoek nodes…').fill('Contextheld');
    const searchHero = explorer.getByRole('button', { name: /Contextheld/ });
    await searchHero.click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Sessies', exact: true }).click();
    await searchHero.click({ button: 'right' });
    await page.getByRole('menu').getByRole('menuitem', { name: 'Toon in de graph' }).click();
    await expect(page.getByLabel('Interactieve kennisgraaf')).toBeVisible();

    await searchHero.click({ button: 'right' });
    await page.getByRole('menu').getByRole('menuitem', { name: 'Verbergen' }).click();
    await expect
      .poll(async () => (await workspaceNode(page, world.campaignId, world.heroId)).revealed)
      .toBe(false);
    await searchHero.click({ button: 'right' });
    await page.getByRole('menu').getByRole('menuitem', { name: 'Onthullen' }).click();
    await expect
      .poll(async () => (await workspaceNode(page, world.campaignId, world.heroId)).revealed)
      .toBe(true);

    const canvas = page.getByLabel('Interactieve kennisgraaf');
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) return;
    let graphNodeMenuFound = false;
    for (const [dx, dy] of [
      [0, 0],
      [-12, 0],
      [12, 0],
      [0, -12],
      [0, 12],
      [-24, 0],
      [24, 0],
      [0, -24],
      [0, 24]
    ]) {
      await page.mouse.click(bounds.x + bounds.width / 2 + dx, bounds.y + bounds.height / 2 + dy, {
        button: 'right'
      });
      menu = page.getByRole('menu');
      if ((await menu.getByRole('menuitem', { name: 'Openen' }).count()) > 0) {
        graphNodeMenuFound = true;
        await expect(menu.getByRole('menuitem', { name: 'Verbinden met…' })).toBeVisible();
        break;
      }
      await page.keyboard.press('Escape');
    }
    expect(graphNodeMenuFound).toBe(true);
    await page.keyboard.press('Escape');

    const contextX = bounds.x + bounds.width - 55;
    const contextY = bounds.y + bounds.height - 70;
    await page.mouse.click(contextX, contextY, { button: 'right' });
    menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Nieuwe node hier' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Alles passend' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Kaart opnieuw ordenen' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Nieuwe node hier' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Nieuwe node' });
    await createDialog.getByPlaceholder('Naam').fill('Via contextmenu');
    const createdResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/campaigns/${world.campaignId}/nodes`) &&
        response.request().method() === 'POST'
    );
    await createDialog.getByRole('button', { name: 'Toevoegen', exact: true }).click();
    const createdId = (await (await createdResponse).json()).id as string;
    const created = await workspaceNode(page, world.campaignId, createdId);
    expect(Math.abs(created.x) + Math.abs(created.y)).toBeGreaterThan(10);

    await page.getByRole('button', { name: 'Sessies', exact: true }).click();
    await page.getByRole('button', { name: 'Bewerken', exact: true }).first().click();
    const editor = page.getByRole('textbox', { name: 'Teksteditor' }).first();
    const chip = editor.locator('[data-ref]').first();
    await expect(chip).toHaveText('Contextheld');
    await chip.click({ button: 'right' });
    menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Losmaken uit tekst' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Losmaken uit tekst' }).click();
    await expect(editor.locator('[data-ref]')).toHaveCount(0);
    await expect(editor).toContainText('Contextheld');

    await selectTextAndOpenContext(editor, 'Contextheld');
    await page.getByRole('menu').getByRole('menuitem', { name: 'Koppel aan Contextheld' }).click();
    await expect(editor.locator('[data-ref]')).toHaveCount(1);

    const scratch = page.getByRole('textbox', { name: 'Teksteditor' }).nth(1);
    await scratch.click();
    await scratch.pressSequentially('Nieuwe contextnode');
    await selectTextAndOpenContext(scratch, 'Nieuwe contextnode');
    await page
      .getByRole('menu')
      .getByRole('menuitem', { name: 'Maak node van “Nieuwe contextnode”' })
      .click();
    const selectionDialog = page.getByRole('dialog', { name: 'Nieuwe node' });
    await expect(selectionDialog.getByPlaceholder('Naam')).toHaveValue('Nieuwe contextnode');
    await selectionDialog.getByRole('button', { name: 'Toevoegen', exact: true }).click();
    await expect(scratch.locator('[data-ref]')).toHaveCount(1);

    await explorer.getByPlaceholder('Zoek nodes…').fill('Via contextmenu');
    const createdRow = explorer.getByRole('button', { name: /Via contextmenu/ });
    await createdRow.click({ button: 'right' });
    await page.getByRole('menu').getByRole('menuitem', { name: 'Naar prullenbak' }).click();
    await expect
      .poll(async () => Boolean((await workspaceNode(page, world.campaignId, createdId)).trashedAt))
      .toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await removeWorld(page, world.campaignId);
  }
});

test('atlasmarker gebruikt het volledige nodemenu en de kaartacties werken', async ({
  page
}, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name.includes('mobile'), 'Rechtermuisknop is een desktopinteractie.');
  const world = await createWorld(page, true);

  try {
    await page.goto(`/campaigns/${world.campaignId}`);
    await waitForWorkspace(page);
    await page.getByRole('button', { name: 'Kaart', exact: true }).click();
    const marker = page.locator('.marker[aria-label="Contextheld"]');
    await expect(marker).toBeVisible();

    await marker.hover();
    await expect(page.getByRole('dialog', { name: 'Details van Contextheld' })).toBeVisible();
    const markerBounds = await marker.boundingBox();
    expect(markerBounds).not.toBeNull();
    if (!markerBounds) return;
    const beforeDrag = await workspaceNode(page, world.campaignId, world.heroId);
    await page.mouse.move(
      markerBounds.x + markerBounds.width / 2,
      markerBounds.y + markerBounds.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      markerBounds.x + markerBounds.width / 2 + 45,
      markerBounds.y + markerBounds.height / 2 + 25,
      { steps: 5 }
    );
    await expect(page.getByRole('dialog', { name: 'Details van Contextheld' })).toHaveCount(0);
    await page.mouse.up();
    await expect(page.getByRole('dialog', { name: 'Details van Contextheld' })).toHaveCount(0);
    await expect(page.getByLabel('Nodenaam')).toHaveCount(0);
    await expect
      .poll(async () => {
        const moved = await workspaceNode(page, world.campaignId, world.heroId);
        return Math.hypot(moved.pinX - beforeDrag.pinX, moved.pinY - beforeDrag.pinY);
      })
      .toBeGreaterThan(0.01);

    await marker.click({ button: 'right' });
    let menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Openen' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Verbinden met…' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Toon in de graph' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Tonen op de kaart' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Marker vastzetten' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Van de kaart halen' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Marker vastzetten' }).click();
    await expect
      .poll(async () => (await workspaceNode(page, world.campaignId, world.heroId)).markerLocked)
      .toBe(true);

    await marker.click({ button: 'right' });
    menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Marker losmaken' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Toon in de graph' }).click();
    await expect(page.getByLabel('Interactieve kennisgraaf')).toBeVisible();

    await page.getByRole('button', { name: 'Kaart', exact: true }).click();
    await marker.click({ button: 'right' });
    await page.getByRole('menu').getByRole('menuitem', { name: 'Van de kaart halen' }).click();
    await expect
      .poll(async () => (await workspaceNode(page, world.campaignId, world.heroId)).pinX)
      .toBeNull();
    await expect(marker).toHaveCount(0);
  } finally {
    await removeWorld(page, world.campaignId);
  }
});
