import { expect, test, type Page } from '@playwright/test';

type TestWorkspace = { campaignId: string; sessionId: string; nodeId: string };

async function createWorkspace(page: Page): Promise<TestWorkspace> {
  await page.goto('/auth/login');
  await page.getByPlaceholder('E-mailadres').fill('demo@atlore.app');
  await page.getByPlaceholder('Wachtwoord').fill('AtloreDemo!2026');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page).toHaveURL(/\/campaigns$/);

  return page.evaluate(async () => {
    const json = async (url: string, init?: RequestInit) => {
      const response = await fetch(url, init);
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    };
    const campaign = await json('/api/campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: `Navigatietest ${Date.now()} ${Math.random()}`,
        system: 'D&D 5e',
        note: 'Tijdelijke autosave- en navigatietest'
      })
    });
    const node = await json(`/api/campaigns/${campaign.id}/nodes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Navigatieheld', type: 'character' })
    });
    const session = await json(`/api/campaigns/${campaign.id}/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Navigatiesessie', worldDate: 'Testdag' })
    });
    return { campaignId: campaign.id, sessionId: session.id, nodeId: node.id };
  });
}

async function removeWorkspace(page: Page, campaignId: string) {
  if (page.isClosed()) return;
  await page.evaluate(async (id) => {
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
  }, campaignId);
}

async function waitForWorkspace(page: Page) {
  await expect(page.getByLabel('Interactieve kennisgraaf')).toBeVisible();
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[aria-label="Interactieve kennisgraaf"]'
    );
    return Boolean(canvas && canvas.width > 300 && canvas.height > 200);
  });
}

test('sessietekst slaat ook bij direct wisselen op en blijft lokaal actueel', async ({ page }) => {
  const workspace = await createWorkspace(page);
  const story = `De groep betreedt de verzonken bibliotheek ${Date.now()}.`;

  try {
    await page.goto(`/campaigns/${workspace.campaignId}`);
    await waitForWorkspace(page);
    await page.getByRole('button', { name: 'Sessie', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Teksteditor' }).first();
    await expect(editor).toBeVisible();

    const saved = page.waitForResponse(
      (response) =>
        response.url().includes(`/sessions/${workspace.sessionId}`) &&
        response.request().method() === 'PATCH' &&
        response.ok()
    );
    await editor.fill(story);
    await expect(page.getByText('Opslaan…', { exact: true })).toHaveText('Opslaan…');
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    await saved;

    await page.getByRole('button', { name: 'Sessie', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Teksteditor' }).first()).toContainText(story);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Teksteditor' }).first()).toContainText(story);

    const storyOnLeave = `Deze alinea wordt tijdens pagehide bewaard ${Date.now()}.`;
    await page.getByRole('textbox', { name: 'Teksteditor' }).first().fill(storyOnLeave);
    await page.goto('/campaigns');
    await expect
      .poll(() =>
        page.evaluate(
          async ({ campaignId, sessionId, expected }) => {
            const response = await fetch(`/api/campaigns/${campaignId}/workspace`);
            const snapshot = await response.json();
            const session = snapshot.sessions.find((item: { id: string }) => item.id === sessionId);
            return JSON.stringify(session?.body ?? []).includes(expected);
          },
          {
            campaignId: workspace.campaignId,
            sessionId: workspace.sessionId,
            expected: storyOnLeave
          }
        )
      )
      .toBe(true);
    await page.goto(
      `/campaigns/${workspace.campaignId}?view=session&session=${workspace.sessionId}`
    );
    await expect(page.getByRole('textbox', { name: 'Teksteditor' }).first()).toContainText(
      storyOnLeave
    );
  } finally {
    await removeWorkspace(page, workspace.campaignId);
  }
});

test('werkruimte, sessie en dossier werken met browser back, forward en URL-herstel', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'De contextmenu-opening gebruikt een muis.');
  const workspace = await createWorkspace(page);

  try {
    await page.goto(`/campaigns/${workspace.campaignId}`);
    await waitForWorkspace(page);
    await page.getByRole('button', { name: 'Sessie', exact: true }).click();
    await expect(page).toHaveURL(/view=session/);
    await expect(page).toHaveURL(new RegExp(`session=${workspace.sessionId}`));

    const node = page
      .getByLabel('Explorer')
      .getByRole('button', { name: 'Navigatieheld', exact: true });
    await node.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Openen' }).click();
    await expect(page.getByLabel('Nodenaam')).toHaveValue('Navigatieheld');
    await expect(page).toHaveURL(new RegExp(`node=${workspace.nodeId}`));

    await page.goBack();
    await expect(page.getByLabel('Nodenaam')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Teksteditor' }).first()).toBeVisible();
    await expect(page).not.toHaveURL(/node=/);

    await page.goBack();
    await expect(page.getByLabel('Interactieve kennisgraaf')).toBeVisible();
    await expect(page).not.toHaveURL(/view=/);

    await page.goForward();
    await expect(page.getByRole('textbox', { name: 'Teksteditor' }).first()).toBeVisible();
    await page.goForward();
    await expect(page.getByLabel('Nodenaam')).toHaveValue('Navigatieheld');

    await page.reload();
    await expect(page.getByLabel('Nodenaam')).toHaveValue('Navigatieheld');
    await page.goto('/campaigns');
    await page.goBack();
    await expect(page.getByLabel('Nodenaam')).toHaveValue('Navigatieheld');
  } finally {
    await removeWorkspace(page, workspace.campaignId);
  }
});

test('paneel-, dossier- en campagne-instellingentabs herstellen via URL en browserhistorie', async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes('mobile'),
    'De dossieropening gebruikt een muiscontextmenu.'
  );
  const workspace = await createWorkspace(page);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.goto(`/campaigns/${workspace.campaignId}`);
    await waitForWorkspace(page);
    await page.getByRole('button', { name: 'Instellingen', exact: true }).click();
    await expect(page).toHaveURL(/panel=settings/);
    await page.getByRole('button', { name: 'Campagne-instellingen', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(/campaignSettings=general/);

    await page.getByRole('button', { name: 'Wie speelt mee', exact: true }).click();
    await expect(page).toHaveURL(/campaignSettings=members/);
    await expect(page.getByRole('button', { name: 'Wie speelt mee', exact: true })).toHaveClass(
      /active/
    );

    await page.goBack();
    await expect(page).toHaveURL(/campaignSettings=general/);
    await expect(page.getByLabel('Naam', { exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/panel=settings/);
    await page.goBack();
    await expect(page).not.toHaveURL(/panel=/);

    const node = page
      .getByLabel('Explorer')
      .getByRole('button', { name: 'Navigatieheld', exact: true });
    await node.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Openen' }).click();
    await page.getByRole('button', { name: 'Spel', exact: true }).click();
    await expect(page).toHaveURL(/nodeTab=game/);
    await expect(page.getByText('Statistieken', { exact: true })).toBeVisible();

    await page.goBack();
    await expect(page).not.toHaveURL(/nodeTab=/);
    await expect(page.getByText('Gedeelde omschrijving', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Gedeelde omschrijving', { exact: true })).toBeVisible();
    expect(pageErrors).toEqual([]);
  } finally {
    await removeWorkspace(page, workspace.campaignId);
  }
});
