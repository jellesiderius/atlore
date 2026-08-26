import { expect, request as requestFactory, test } from '@playwright/test';

test('campagne-, node-, link- en sessie-API vormen één werkende flow', async ({ request }) => {
  const login = await request.post('/api/auth/login', {
    data: { email: 'demo@atlore.app', password: 'AtloreDemo!2026' }
  });
  expect(login.ok()).toBeTruthy();

  const campaignResponse = await request.post('/api/campaigns', {
    data: { title: `E2E ${Date.now()}`, system: 'Daggerheart', note: 'Automatische test' }
  });
  expect(campaignResponse.status()).toBe(201);
  const { id: campaignId } = await campaignResponse.json();

  const first = await request.post(`/api/campaigns/${campaignId}/nodes`, {
    data: { title: 'Testheld', type: 'character', summary: 'Uit de E2E-test' }
  });
  const second = await request.post(`/api/campaigns/${campaignId}/nodes`, {
    data: { title: 'Testplaats', type: 'location', summary: 'Uit de E2E-test' }
  });
  expect(first.status()).toBe(201);
  expect(second.status()).toBe(201);
  const a = (await first.json()).id;
  const b = (await second.json()).id;

  const link = await request.post(`/api/campaigns/${campaignId}/links`, {
    data: { sourceId: a, targetId: b }
  });
  expect(link.status()).toBe(201);
  const session = await request.post(`/api/campaigns/${campaignId}/sessions`, {
    data: {
      title: 'Eerste testsessie',
      worldDate: 'Vandaag',
      body: [
        {
          segs: [
            { t: 'ref', id: a },
            { t: 'txt', v: ' reist naar ' },
            { t: 'ref', id: b }
          ]
        }
      ]
    }
  });
  expect(session.status()).toBe(201);

  const workspace = await request.get(`/api/campaigns/${campaignId}/workspace`);
  expect(workspace.ok()).toBeTruthy();
  const snapshot = await workspace.json();
  expect(snapshot.nodes).toHaveLength(2);
  expect(snapshot.links).toHaveLength(1);
  expect(snapshot.sessions).toHaveLength(1);

  const customType = await request.post(`/api/campaigns/${campaignId}/types`, {
    data: {
      key: 'ship',
      pluralName: 'Schepen',
      singularName: 'Schip',
      colorDark: '#59a8d8',
      colorLight: '#59a8d8'
    }
  });
  expect(customType.status()).toBe(201);

  const trashedSession = await request.patch(
    `/api/campaigns/${campaignId}/sessions/${(await session.json()).id}`,
    { data: { trashed: true } }
  );
  expect(trashedSession.ok()).toBeTruthy();
  expect(
    (
      await request.delete(
        `/api/campaigns/${campaignId}/sessions/${(await trashedSession.json()).id}`
      )
    ).ok()
  ).toBeTruthy();

  expect((await request.delete(`/api/campaigns/${campaignId}`)).ok()).toBeTruthy();
});

test('GM-weergave als speler filtert server-side en blijft alleen-lezen in de payload', async ({
  request
}) => {
  await request.post('/api/auth/login', {
    data: { email: 'demo@atlore.app', password: 'AtloreDemo!2026' }
  });
  const { campaigns } = await (await request.get('/api/campaigns')).json();
  const ember = campaigns.find((campaign: { title: string }) => campaign.title === 'Ember & Rust');
  const gmSnapshot = await (await request.get(`/api/campaigns/${ember.id}/workspace`)).json();
  const player = gmSnapshot.members.find((member: { role: string }) => member.role === 'player');
  const playerSnapshot = await (
    await request.get(`/api/campaigns/${ember.id}/workspace?viewAs=${player.id}`)
  ).json();

  expect(playerSnapshot.canViewAs).toBe(true);
  expect(playerSnapshot.viewAs.id).toBe(player.id);
  expect(playerSnapshot.campaign.role).toBe('player');
  expect(playerSnapshot.nodes.length).toBeLessThan(gmSnapshot.nodes.length);
});

test('een speler kan een verborgen node ook met een geraden UUID niet benaderen', async ({
  request,
  baseURL
}) => {
  await request.post('/api/auth/login', {
    data: { email: 'demo@atlore.app', password: 'AtloreDemo!2026' }
  });
  const { campaigns } = await (await request.get('/api/campaigns')).json();
  const ember = campaigns.find((campaign: { title: string }) => campaign.title === 'Ember & Rust');
  const gmSnapshot = await (await request.get(`/api/campaigns/${ember.id}/workspace`)).json();
  const secret = gmSnapshot.nodes.find((node: { revealed: boolean }) => !node.revealed);
  const gm = gmSnapshot.members.find((member: { role: string }) => member.role === 'gm');

  const playerApi = await requestFactory.newContext({
    baseURL: baseURL ?? 'http://localhost:3000'
  });
  try {
    expect(
      (
        await playerApi.post('/api/auth/login', {
          data: { email: 'lena@atlore.app', password: 'AtloreDemo!2026' }
        })
      ).ok()
    ).toBeTruthy();
    expect(
      (
        await playerApi.patch(`/api/campaigns/${ember.id}/nodes/${secret.id}`, {
          data: { summary: 'Dit mag nooit worden opgeslagen.' }
        })
      ).status()
    ).toBe(404);
    expect(
      (await playerApi.get(`/api/campaigns/${ember.id}/workspace?viewAs=${gm.id}`)).status()
    ).toBe(403);
  } finally {
    await playerApi.dispose();
  }
});
