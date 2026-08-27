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
    await page.getByRole('button', { name: 'Sessies', exact: true }).click();
    await page.getByRole('button', { name: 'Bewerken', exact: true }).first().click();
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

    await page.getByRole('button', { name: 'Sessies', exact: true }).click();
    await page.getByRole('button', { name: 'Bewerken', exact: true }).first().click();
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

test('de cursor blijft na een @-link en een inkomende save op zijn positie', async ({ page }) => {
  const workspace = await createWorkspace(page);

  try {
    await page.goto(
      `/campaigns/${workspace.campaignId}?view=session&session=${workspace.sessionId}`
    );
    const editor = page.getByRole('textbox', { name: 'Teksteditor' }).first();
    await expect(editor).toBeEditable();
    const writingSurface = editor.locator(
      'xpath=ancestor::section[contains(@class, "text-surface")]'
    );

    await editor.fill('Voor ');
    await editor.pressSequentially('@Navigatieheld');
    await page.getByRole('listbox').getByText('Navigatieheld', { exact: true }).click();
    await editor.pressSequentially(' loopt verder');

    await expect(editor.locator('[data-ref]')).toHaveText('Navigatieheld');
    await expect(writingSurface.getByRole('status')).toHaveText('Opslaan…');
    await expect(writingSurface.getByRole('status')).toHaveText('Opgeslagen', {
      timeout: 4_000
    });

    await editor.press('End');
    const refreshed = page.waitForResponse(
      (response) =>
        response.url().includes(`/campaigns/${workspace.campaignId}/workspace`) &&
        response.request().method() === 'GET' &&
        response.ok()
    );
    await page.evaluate(async ({ campaignId, sessionId, nodeId }) => {
      const body = [
        {
          segs: [
            { t: 'txt', v: 'Vo' },
            { t: 'txt', v: 'or ' },
            { t: 'ref', id: nodeId },
            { t: 'txt', v: '\u00a0 loopt verder' }
          ]
        }
      ];
      const response = await fetch(`/api/campaigns/${campaignId}/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body })
      });
      if (!response.ok) throw new Error(await response.text());
    }, workspace);
    await refreshed;
    await page.waitForTimeout(100);
    await page.keyboard.type(' EIND');

    await expect(editor).toContainText('Voor Navigatieheld loopt verder EIND');
    await expect(editor).not.toHaveText(/^EIND/);
  } finally {
    await removeWorkspace(page, workspace.campaignId);
  }
});

test('de sessielezer groepeert tekst en privénotities in één nette kaart', async ({ page }) => {
  const workspace = await createWorkspace(page);
  const sharedText = `Leesbare sessietekst ${Date.now()}`;
  const privateText = `Persoonlijke readernotitie ${Date.now()}`;

  try {
    await page.evaluate(
      async ({ campaignId, sessionId, sharedText, privateText }) => {
        const headers = { 'content-type': 'application/json' };
        const sessionResponse = await fetch(`/api/campaigns/${campaignId}/sessions/${sessionId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ body: [{ segs: [{ t: 'txt', v: sharedText }] }] })
        });
        if (!sessionResponse.ok) throw new Error(await sessionResponse.text());
        const noteResponse = await fetch(
          `/api/campaigns/${campaignId}/sessions/${sessionId}/scratch`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({ body: [{ segs: [{ t: 'txt', v: privateText }] }] })
          }
        );
        if (!noteResponse.ok) throw new Error(await noteResponse.text());
      },
      { ...workspace, sharedText, privateText }
    );
    await page.goto(`/campaigns/${workspace.campaignId}?view=story`);

    await expect(page.getByRole('button', { name: 'Sessies', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verhaal', exact: true })).toHaveCount(0);
    await expect(page.getByText('Doorlopend verhaal', { exact: true })).toHaveCount(0);

    const article = page.locator('.story article').filter({ hasText: 'Navigatiesessie' });
    await expect(article).toBeVisible();
    await expect(article.locator('.session-reader .rich-view')).toContainText(sharedText);
    await expect(article.locator('.session-icon')).toBeVisible();
    await expect(article.getByRole('button', { name: 'Bewerken', exact: true })).toBeVisible();
    await expect(article.locator(':scope > .text-surface')).toHaveCount(0);

    const notes = article.locator('details.session-notes');
    await notes.locator('summary').click();
    await expect(notes).toHaveAttribute('open', '');
    await expect(notes.locator('.notes-content .rich-view')).toContainText(privateText);
    await expect(notes.locator('.text-surface')).toHaveCount(0);

    const layout = await article.evaluate((element) => {
      const card = element.getBoundingClientRect();
      const heading = element
        .querySelector<HTMLElement>('.session-heading')!
        .getBoundingClientRect();
      const icon = element.querySelector<HTMLElement>('.session-icon')!.getBoundingClientRect();
      const summary = element.querySelector<HTMLElement>('summary')!.getBoundingClientRect();
      const notesContent = element
        .querySelector<HTMLElement>('.notes-content')!
        .getBoundingClientRect();
      return {
        iconInsideCard:
          icon.left >= card.left &&
          icon.right <= card.right &&
          icon.top >= heading.top &&
          icon.bottom <= heading.bottom,
        notesBelowHeader: notesContent.top >= summary.bottom
      };
    });
    expect(layout).toEqual({ iconInsideCard: true, notesBelowHeader: true });

    await article.getByRole('button', { name: 'Bewerken', exact: true }).click();
    await expect(page).toHaveURL(/mode=write/);
    const editorCard = page
      .locator('article.editing')
      .filter({ has: page.getByLabel('Sessietitel') });
    const editors = editorCard.getByRole('textbox', { name: 'Teksteditor' });
    await expect(editors).toHaveCount(2);
    await expect(editors.nth(0)).toContainText(sharedText);
    await expect(editors.nth(1)).toContainText(privateText);

    await editorCard.getByRole('button', { name: 'Lezen', exact: true }).click();
    await expect(page).toHaveURL(/mode=read/);
    await expect(page.locator('.session-reader').filter({ hasText: sharedText })).toBeVisible();
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
    await page.getByRole('button', { name: 'Sessies', exact: true }).click();
    await expect(page).toHaveURL(/view=session/);
    await expect(page).toHaveURL(new RegExp(`session=${workspace.sessionId}`));
    await expect(page).toHaveURL(/mode=read/);
    await page.getByRole('button', { name: 'Bewerken', exact: true }).first().click();
    await expect(page).toHaveURL(/mode=write/);

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
    await expect(page.getByRole('textbox', { name: 'Teksteditor' })).toHaveCount(0);
    await expect(page.locator('.session-reader').first()).toBeVisible();
    await expect(page).toHaveURL(/mode=read/);

    await page.goBack();
    await expect(page.getByLabel('Interactieve kennisgraaf')).toBeVisible();
    await expect(page).not.toHaveURL(/view=/);

    await page.goForward();
    await expect(page.locator('.session-reader').first()).toBeVisible();
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
    const repel = page.getByRole('slider', { name: 'Afstoting' });
    await expect(repel).toHaveValue('700');
    const savedSettings = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/campaigns/${workspace.campaignId}`) &&
        response.request().method() === 'PATCH' &&
        response.ok()
    );
    await repel.evaluate((element) => {
      (element as HTMLInputElement).value = '1250';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await savedSettings;
    await expect(page.getByRole('status')).toHaveText('Opgeslagen');
    await page.reload();
    await expect(page.getByRole('slider', { name: 'Afstoting' })).toHaveValue('1250');
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
    await expect(page.getByRole('button', { name: 'Spel', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Relaties', exact: true }).click();
    await expect(page).toHaveURL(/nodeTab=relations/);
    await expect(page.getByText(/Gekoppeld/)).toBeVisible();

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
