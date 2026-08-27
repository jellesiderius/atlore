import { expect, test } from '@playwright/test';

test('twee gebruikers zien sessietekst direct via de realtime socket', async ({
  browser,
  request
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes('mobile'),
    'Dezelfde socketflow wordt op desktop getest.'
  );

  await request.post('/api/auth/login', {
    data: { email: 'demo@atlore.app', password: 'AtloreDemo!2026' }
  });
  const { campaigns } = await (await request.get('/api/campaigns')).json();
  const campaign = campaigns.find((item: { title: string }) => item.title === 'Ember & Rust');
  const created = await request.post(`/api/campaigns/${campaign.id}/sessions`, {
    data: { title: `Realtime E2E ${Date.now()}`, worldDate: 'Nu' }
  });
  expect(created.ok()).toBeTruthy();
  const session = await created.json();
  const createdNode = await request.post(`/api/campaigns/${campaign.id}/nodes`, {
    data: { title: `Realtime node ${Date.now()}`, type: 'location', x: 0, y: 0 }
  });
  expect(createdNode.ok()).toBeTruthy();
  const node = await createdNode.json();

  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();
  const pageErrors: string[] = [];
  for (const page of [gm, player]) {
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(message.text());
    });
  }
  const gmSent: string[] = [];
  const playerReceived: string[] = [];
  gm.on('websocket', (socket) =>
    socket.on('framesent', (frame) => gmSent.push(String(frame.payload)))
  );
  player.on('websocket', (socket) =>
    socket.on('framereceived', (frame) => playerReceived.push(String(frame.payload)))
  );

  const login = async (page: typeof gm, email: string) => {
    await page.goto('/auth/login');
    await page.getByPlaceholder('E-mailadres').fill(email);
    await page.getByPlaceholder('Wachtwoord').fill('AtloreDemo!2026');
    await page.getByRole('button', { name: 'Inloggen' }).click();
    await expect(page).toHaveURL(/\/campaigns(?:\?|$)/);
    await page.goto(`/campaigns/${campaign.id}?view=session&session=${session.id}`);
    await expect(page.locator('main.workspace')).toHaveAttribute('data-realtime', 'connected');
  };

  try {
    await Promise.all([login(gm, 'demo@atlore.app'), login(player, 'lena@atlore.app')]);
    const gmEditor = gm.getByRole('textbox', { name: 'Teksteditor' }).first();
    const playerEditor = player.getByRole('textbox', { name: 'Teksteditor' }).first();
    await expect(gmEditor).toBeEditable();
    await expect(playerEditor).toBeEditable();

    const first = `Live vanaf de spelleider ${Date.now()}`;
    await gm.route(`**/sessions/${session.id}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await new Promise((resolve) => setTimeout(resolve, 1_200));
      }
      await route.continue();
    });
    await gmEditor.fill(first);
    await expect.poll(() => gmSent.some((frame) => frame.includes(first))).toBe(true);
    await expect.poll(() => playerReceived.some((frame) => frame.includes(first))).toBe(true);
    await expect(playerEditor).toContainText(first, { timeout: 1_000 });
    await expect(player.locator('.remote-cursor').filter({ hasText: 'Jelle' })).toBeVisible({
      timeout: 1_000
    });
    await expect(player.getByText('Live bijgewerkt door Jelle')).toBeVisible();
    await expect(gm.getByText('Opgeslagen', { exact: true })).toBeVisible({ timeout: 3_000 });

    const firstParagraph = `Johan en Karel ${Date.now()}`;
    await playerEditor.fill(firstParagraph);
    await player.keyboard.press('Enter');
    await player.keyboard.press('Enter');
    await player.keyboard.type('kees');
    await expect(gmEditor.locator(':scope > div')).toHaveCount(3, { timeout: 1_000 });
    await expect(gmEditor.locator(':scope > div').nth(0)).toContainText('Johan en Karel');
    await expect(gmEditor.locator(':scope > div').nth(1)).toHaveText('');
    await expect(gmEditor.locator(':scope > div').nth(2)).toHaveText('kees');
    await expect(gm.locator('.remote-cursor').filter({ hasText: 'Lena' })).toBeVisible({
      timeout: 1_000
    });

    await expect
      .poll(async () => {
        const workspace = await (
          await request.get(`/api/campaigns/${campaign.id}/workspace`)
        ).json();
        return workspace.sessions
          .find((item: { id: string }) => item.id === session.id)
          ?.body.map((paragraph: { segs: { v?: string }[] }) =>
            paragraph.segs.map((segment) => segment.v ?? '').join('')
          );
      })
      .toEqual([firstParagraph, '', 'kees']);

    await player.getByRole('button', { name: 'Lezen', exact: true }).click();
    await expect(player).toHaveURL(/mode=read/);
    const storySession = player.locator('.story article').filter({ hasText: session.title });
    const reader = storySession.locator('.rich-view').first();
    await expect(reader.locator('p')).toHaveCount(3);
    await expect(reader.locator('p').nth(0)).toContainText('Johan en Karel');
    await expect(reader.locator('p').nth(1)).toHaveText('');
    await expect(reader.locator('p').nth(2)).toHaveText('kees');

    const third = `Live in de sessielezer ${Date.now()}`;
    await gmEditor.fill(third);
    await expect(reader).toContainText(third, { timeout: 1_000 });
    await expect(storySession.locator('.remote-cursor').filter({ hasText: 'Jelle' })).toBeVisible({
      timeout: 1_000
    });
    await storySession.getByRole('button', { name: 'Bewerken', exact: true }).click();
    await expect(player).toHaveURL(/mode=write/);
    await expect(player.getByRole('textbox', { name: 'Teksteditor' }).first()).toBeEditable();
    await expect
      .poll(async () => {
        const workspace = await (
          await request.get(`/api/campaigns/${campaign.id}/workspace`)
        ).json();
        return workspace.sessions
          .find((item: { id: string }) => item.id === session.id)
          ?.body.flatMap((paragraph: { segs: { v?: string }[] }) => paragraph.segs)
          .map((segment: { v?: string }) => segment.v ?? '')
          .join('');
      })
      .toBe(third);

    await Promise.all([
      gm.goto(`/campaigns/${campaign.id}?node=${node.id}`),
      player.goto(`/campaigns/${campaign.id}?node=${node.id}`)
    ]);
    await expect(gm.locator('main.workspace')).toHaveAttribute('data-realtime', 'connected');
    await expect(player.locator('main.workspace')).toHaveAttribute('data-realtime', 'connected');
    const gmNodeEditors = gm.locator('.dossier').getByRole('textbox', { name: 'Teksteditor' });
    const playerNodeEditors = player.locator('.dossier').getByRole('textbox', {
      name: 'Teksteditor'
    });
    await expect(gm.getByText('Gedeelde omschrijving', { exact: true })).toBeVisible();
    await expect(gmNodeEditors).toHaveCount(2);
    await expect(playerNodeEditors).toHaveCount(2);

    await gm.route(`**/nodes/${node.id}/description`, async (route) => {
      if (route.request().method() === 'PUT') {
        await new Promise((resolve) => setTimeout(resolve, 1_200));
      }
      await route.continue();
    });
    const sharedDescription = `Globale node-omschrijving ${Date.now()}`;
    await gmNodeEditors.first().fill(sharedDescription);
    await expect(playerNodeEditors.first()).toContainText(sharedDescription, { timeout: 1_000 });
    await expect(player.locator('.remote-cursor').filter({ hasText: 'Jelle' })).toBeVisible({
      timeout: 1_000
    });

    const privateNote = `Alleen Lena ziet dit ${Date.now()}`;
    await playerNodeEditors.nth(1).fill(privateNote);
    await expect
      .poll(() =>
        player.evaluate(
          async ({ campaignId, nodeId }) => {
            const workspace = await (await fetch(`/api/campaigns/${campaignId}/workspace`)).json();
            const current = workspace.nodes.find((item: { id: string }) => item.id === nodeId);
            return current.note
              .flatMap((paragraph: { segs: { v?: string }[] }) => paragraph.segs)
              .map((segment: { v?: string }) => segment.v ?? '')
              .join('');
          },
          { campaignId: campaign.id, nodeId: node.id }
        )
      )
      .toContain(privateNote);
    await expect
      .poll(() =>
        gm.evaluate(
          async ({ campaignId, nodeId }) => {
            const workspace = await (await fetch(`/api/campaigns/${campaignId}/workspace`)).json();
            const current = workspace.nodes.find((item: { id: string }) => item.id === nodeId);
            return current.description
              .flatMap((paragraph: { segs: { v?: string }[] }) => paragraph.segs)
              .map((segment: { v?: string }) => segment.v ?? '')
              .join('');
          },
          { campaignId: campaign.id, nodeId: node.id }
        )
      )
      .toContain(sharedDescription);
    await expect(gmNodeEditors.nth(1)).not.toContainText(privateNote);
    const [gmNode, playerNode] = await Promise.all(
      [gm, player].map((page) =>
        page.evaluate(
          async ({ campaignId, nodeId }) => {
            const workspace = await (await fetch(`/api/campaigns/${campaignId}/workspace`)).json();
            return workspace.nodes.find((item: { id: string }) => item.id === nodeId);
          },
          { campaignId: campaign.id, nodeId: node.id }
        )
      )
    );
    expect(gmNode.description[0].segs[0].v).toContain(sharedDescription);
    expect(
      gmNode.note
        .flatMap((paragraph: { segs: { v?: string }[] }) => paragraph.segs)
        .map((segment: { v?: string }) => segment.v ?? '')
        .join('')
    ).not.toContain(privateNote);
    expect(
      playerNode.note
        .flatMap((paragraph: { segs: { v?: string }[] }) => paragraph.segs)
        .map((segment: { v?: string }) => segment.v ?? '')
        .join('')
    ).toContain(privateNote);
    expect(pageErrors).toEqual([]);
  } finally {
    await Promise.all([gmContext.close(), playerContext.close()]);
    await request.patch(`/api/campaigns/${campaign.id}/sessions/${session.id}`, {
      data: { trashed: true }
    });
    await request.delete(`/api/campaigns/${campaign.id}/sessions/${session.id}`);
    await request.patch(`/api/campaigns/${campaign.id}/nodes/${node.id}`, {
      data: { trashed: true }
    });
    await request.delete(`/api/campaigns/${campaign.id}/nodes/${node.id}`);
  }
});
