<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  import { tooltip } from '$lib/actions/tooltip';
  import type { Campaign } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';
  let {
    campaign,
    panelOpen,
    togglePanel,
    exit
  }: {
    campaign: Campaign;
    panelOpen: boolean;
    togglePanel: () => void;
    exit: () => void;
  } = $props();
</script>

<header class="workspace-header">
  <div class="header-actions">
    <button
      class="icon-button"
      class:active={panelOpen}
      aria-label={t('workspace.togglePanel')}
      use:tooltip={t('workspace.togglePanel')}
      onclick={togglePanel}><Icon name="panel" size={17} /></button
    >
    <button
      class="icon-button back"
      aria-label={t('workspace.backToCampaigns')}
      use:tooltip={t('workspace.backToCampaigns')}
      onclick={exit}><Icon name="back" size={17} /></button
    >
  </div>
  <div class="campaign-title">
    <small>{campaign.system}</small><b class="serif-title">{campaign.title}</b>
  </div>
</header>

<style>
  .workspace-header {
    height: calc(52px + env(safe-area-inset-top));
    padding-top: env(safe-area-inset-top);
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--line);
    background: var(--canvas);
    flex: 0 0 auto;
    position: relative;
    z-index: 35;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 7px;
  }
  .header-actions .active {
    color: var(--ember);
  }
  .header-actions .back {
    color: var(--text-2);
  }
  .campaign-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100% - 250px);
    min-width: 0;
    color: var(--text);
    text-align: center;
  }
  .campaign-title small {
    display: block;
    font: 9.5px var(--font-mono);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .campaign-title b {
    display: block;
    font-size: 18px;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 400;
  }
  @media (max-width: 600px) {
    .header-actions {
      gap: 0;
      padding-inline: 4px;
    }
    .campaign-title {
      max-width: calc(100% - 150px);
    }
  }
</style>
