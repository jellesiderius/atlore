<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import CampaignCard from '$lib/components/campaign/CampaignCard.svelte';
  import CampaignSettingsModal from '$lib/components/campaign/CampaignSettingsModal.svelte';
  import NewCampaignModal from '$lib/components/campaign/NewCampaignModal.svelte';
  import Starfield from '$lib/components/visual/Starfield.svelte';
  import { api } from '$lib/client/api';
  import type { CampaignSummary, WorkspaceSnapshot } from '$lib/types';
  let {
    data
  }: { data: { user: { id: string; name: string; color: string }; campaigns: CampaignSummary[] } } =
    $props();
  // svelte-ignore state_referenced_locally -- page data seeds client-managed campaign state
  let campaigns = $state([...data.campaigns]);
  let showNew = $state(false);
  let settings = $state<WorkspaceSnapshot | null>(null);
  let loadingSettings = $state(false);
  let gmCount = $derived(campaigns.filter((campaign) => campaign.role === 'gm').length);
  async function createCampaign(value: { title: string; system: string; note: string }) {
    const result = await api<{ id: string }>('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(value)
    });
    await goto(`/campaigns/${result.id}`);
  }
  async function openSettings(campaignId: string) {
    loadingSettings = true;
    try {
      settings = await api(`/api/campaigns/${campaignId}/workspace`);
    } finally {
      loadingSettings = false;
    }
  }
  async function refreshSettings() {
    if (!settings) return;
    const id = settings.campaign.id;
    await invalidateAll();
    campaigns = (await api<{ campaigns: CampaignSummary[] }>('/api/campaigns')).campaigns;
    settings = await api(`/api/campaigns/${id}/workspace`);
  }
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    await goto('/auth/login', { invalidateAll: true });
  }
</script>

<svelte:head><title>Campagnes · Atlore</title></svelte:head>
<main class="gate">
  <Starfield />
  <div class="vignette"></div>
  <div class="account">
    <span style:border-color={data.user.color} style:color={data.user.color}
      >{data.user.name.slice(0, 1).toUpperCase()}</span
    ><button class="ghost-button" onclick={logout}>Uitloggen</button>
  </div>
  <section class="welcome">
    <div class="eyebrow">Atlore</div>
    <h1 class="serif-title">Welkom terug,<br /><em>{data.user.name}</em></h1>
    <div class="divider-mark"><span></span></div>
    <p>
      De ovens zijn koud. Je leidt {gmCount}
      {gmCount === 1 ? 'campagne' : 'campagnes'} en speelt mee in {campaigns.length - gmCount}.
    </p>
  </section>
  <section class="cards">
    {#each campaigns as campaign, index (campaign.id)}<CampaignCard
        {campaign}
        {index}
        open={() => goto(`/campaigns/${campaign.id}`)}
        settings={() => openSettings(campaign.id)}
      />{/each}<button class="new-card" onclick={() => (showNew = true)}
      ><span><b>+</b></span><strong>Nieuwe campagne</strong><small
        >Een lege wereld, klaar voor<br />de eerste sessie</small
      ></button
    >
  </section>
</main>
{#if showNew}<NewCampaignModal close={() => (showNew = false)} create={createCampaign} />{/if}
{#if loadingSettings}<div class="loading" role="status">Instellingen laden…</div>{/if}
{#if settings}<CampaignSettingsModal
    snapshot={settings}
    close={() => (settings = null)}
    save={async (value) => {
      await api(`/api/campaigns/${settings!.campaign.id}`, {
        method: 'PATCH',
        body: JSON.stringify(value)
      });
      await refreshSettings();
    }}
    invite={async (value) => {
      await api(`/api/campaigns/${settings!.campaign.id}/invite`, {
        method: 'POST',
        body: JSON.stringify(value)
      });
      await refreshSettings();
    }}
    roleChange={async (id, role) => {
      await api(`/api/campaigns/${settings!.campaign.id}/members/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
      });
      await refreshSettings();
    }}
    remove={async (id) => {
      await api(`/api/campaigns/${settings!.campaign.id}/members/${id}`, { method: 'DELETE' });
      await refreshSettings();
    }}
    destroy={async () => {
      await api(`/api/campaigns/${settings!.campaign.id}`, { method: 'DELETE' });
      settings = null;
      campaigns = (await api<{ campaigns: CampaignSummary[] }>('/api/campaigns')).campaigns;
    }}
  />{/if}

<style>
  .gate {
    position: relative;
    isolation: isolate;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 32px;
    padding: max(54px, env(safe-area-inset-top)) 18px max(34px, env(safe-area-inset-bottom));
    overflow-x: hidden;
    background:
      radial-gradient(
        120% 78% at 50% 118%,
        rgba(240, 145, 63, 0.16),
        rgba(240, 145, 63, 0.04) 38%,
        transparent 68%
      ),
      radial-gradient(90% 60% at 50% -20%, rgba(127, 179, 255, 0.07), transparent 60%),
      var(--canvas);
  }
  .vignette {
    position: absolute;
    inset: 0;
    z-index: -1;
    background: radial-gradient(140% 100% at 50% 50%, transparent 45%, rgba(0, 0, 0, 0.5));
  }
  .account {
    position: absolute;
    right: 12px;
    top: calc(12px + env(safe-area-inset-top));
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .account > span {
    width: 30px;
    height: 30px;
    border: 1.5px solid;
    border-radius: 50%;
    display: grid;
    place-items: center;
  }
  .account .ghost-button {
    min-height: 32px;
    font-size: 12px;
  }
  .welcome {
    position: relative;
    z-index: 1;
    max-width: 540px;
    text-align: center;
  }
  .welcome > .eyebrow {
    letter-spacing: 0.24em;
    margin-bottom: 14px;
  }
  .welcome h1 {
    margin: 0;
    font-size: 48px;
    line-height: 1.02;
  }
  .welcome h1 em {
    color: var(--ember);
    font-style: normal;
  }
  .welcome .divider-mark {
    margin: 19px 0;
  }
  .welcome p {
    margin: 0;
    color: var(--text-3);
    font-size: 13.5px;
    line-height: 1.6;
  }
  .cards {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px;
    width: 100%;
    max-width: 940px;
  }
  .new-card {
    width: 220px;
    height: 270px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 13px;
    border: 1px dashed var(--line-2);
    border-radius: 15px;
    background: transparent;
    color: var(--text-3);
    animation: lift-in 0.42s var(--ease-atlore) 0.28s both;
    transition:
      transform 0.3s,
      border-color 0.3s;
  }
  .new-card:hover {
    transform: translateY(-4px);
    border-color: var(--ember);
  }
  .new-card span {
    width: 44px;
    height: 44px;
    border: 1px solid var(--line-2);
    border-radius: 50%;
    display: grid;
    place-items: center;
  }
  .new-card b {
    font-size: 23px;
    font-weight: 400;
    color: var(--ember);
  }
  .new-card strong {
    font-size: 13px;
    font-weight: 400;
  }
  .new-card small {
    font-size: 11.5px;
    line-height: 1.5;
  }
  .loading {
    position: fixed;
    left: 50%;
    bottom: 25px;
    z-index: 100;
    transform: translateX(-50%);
    padding: 10px 14px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--bg-2);
    font-size: 12px;
  }
  @media (max-width: 600px) {
    .gate {
      justify-content: flex-start;
      padding-top: 90px;
      gap: 25px;
    }
    .welcome h1 {
      font-size: 40px;
    }
    .cards {
      flex-direction: column;
    }
    .new-card {
      width: 100%;
      height: 190px;
    }
  }
</style>
