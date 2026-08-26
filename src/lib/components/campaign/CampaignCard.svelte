<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  import { tooltip } from '$lib/actions/tooltip';
  import type { CampaignSummary } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';
  let {
    campaign,
    index = 0,
    open,
    settings
  }: {
    campaign: CampaignSummary;
    index?: number;
    open: () => void;
    settings: () => void;
  } = $props();
  const glyphs = ['✦', '◈', '⌁', '◇'];
  let accent = $derived(campaign.role === 'gm' ? 'var(--ember)' : '#63c4a8');
</script>

<div class="card-wrap" style:--delay={`${index * 80 + 100}ms`}>
  <button class="campaign-card" onclick={open} style:--accent={accent}>
    <span class="glow"></span><span class="glyph">{glyphs[index % glyphs.length]}</span><span
      class="shade"
    ></span>
    <span class="system">{campaign.system}</span><span class="title serif-title"
      >{campaign.title}</span
    ><span class="note">{campaign.note || t('campaigns.defaultNote')}</span>
    <span class="stats"
      ><span><b>{campaign.sessionCount}</b><small>{t('campaigns.sessions')}</small></span><span
        ><b>{campaign.nodeCount}</b><small>{t('campaigns.nodes')}</small></span
      ><span><b>{campaign.memberCount}</b><small>{t('campaigns.players')}</small></span></span
    >
    <span class="footer"
      ><span class="people"
        >{#each campaign.members.slice(0, 4) as person}<span
            style:border-color={person.color}
            style:color={person.color}>{person.name.slice(0, 1).toUpperCase()}</span
          >{/each}</span
      ><em>{t(campaign.role === 'gm' ? 'campaigns.youAreGm' : 'campaigns.youPlay')}</em></span
    >
  </button>
  <button
    class="settings icon-button"
    aria-label={t('campaigns.settingsFor', { title: campaign.title })}
    use:tooltip={t('campaigns.settingsFor', { title: campaign.title })}
    onclick={(event) => {
      event.stopPropagation();
      settings();
    }}><Icon name="settings" size={15} /></button
  >
</div>

<style>
  .card-wrap {
    position: relative;
    width: 220px;
    animation: lift-in 0.42s var(--ease-atlore) var(--delay) both;
  }
  .campaign-card {
    position: relative;
    width: 100%;
    height: 270px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 5px;
    padding: 18px 16px 16px;
    border-radius: 15px;
    border: 1px solid var(--line-2);
    background: linear-gradient(168deg, var(--bg-2), var(--canvas));
    color: var(--text);
    text-align: left;
    overflow: hidden;
    transition:
      transform 0.3s var(--ease-atlore),
      border-color 0.3s,
      box-shadow 0.3s;
  }
  .campaign-card:hover {
    transform: translateY(-4px);
    border-color: var(--accent);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.42);
  }
  .glow {
    position: absolute;
    left: -30%;
    top: -40%;
    width: 160%;
    height: 110%;
    background: radial-gradient(
      50% 50% at 50% 50%,
      color-mix(in srgb, var(--accent) 18%, transparent),
      transparent 70%
    );
    animation: soft-glow 7s ease-in-out infinite;
  }
  .glyph {
    position: absolute;
    right: 14px;
    top: 8px;
    font-family: var(--font-serif);
    font-size: 118px;
    line-height: 0.82;
    color: var(--accent);
    opacity: 0.11;
  }
  .shade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 58%;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.42));
  }
  .system,
  .title,
  .note,
  .stats,
  .footer {
    position: relative;
  }
  .system {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .title {
    font-size: 25px;
    line-height: 1.12;
    text-wrap: pretty;
  }
  .note {
    min-height: 35px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--text-3);
  }
  .stats {
    display: flex;
    gap: 14px;
    margin-top: 9px;
  }
  .stats span {
    display: flex;
    flex-direction: column;
  }
  .stats b {
    font-family: var(--font-mono);
    font-size: 15px;
    line-height: 1.1;
    font-weight: 400;
  }
  .stats small {
    font: 8.5px var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .footer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding-top: 11px;
    border-top: 1px solid var(--line);
  }
  .people {
    display: flex;
    flex: 1;
  }
  .people span {
    width: 21px;
    height: 21px;
    margin-right: -6px;
    border: 1.5px solid;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--bg-3);
    font-size: 10px;
  }
  .footer em {
    font: 8.5px var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    font-style: normal;
  }
  .settings {
    position: absolute;
    right: 10px;
    top: 10px;
    background: rgba(13, 15, 20, 0.72);
    backdrop-filter: blur(6px);
    border-color: var(--line);
    z-index: 2;
    width: 32px;
    height: 32px;
  }
  @media (max-width: 600px) {
    .card-wrap {
      width: 100%;
    }
    .campaign-card {
      height: 230px;
    }
  }
</style>
