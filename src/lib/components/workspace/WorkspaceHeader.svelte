<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  import LanguageSwitcher from '$lib/components/ui/LanguageSwitcher.svelte';
  import { tooltip } from '$lib/actions/tooltip';
  import type { Campaign, CampaignMember } from '$lib/types';
  import { t } from '$lib/i18n/index.svelte';
  let {
    campaign,
    panelOpen,
    togglePanel,
    exit,
    theme,
    toggleTheme,
    members,
    viewAs,
    canViewAs,
    changeView
  }: {
    campaign: Campaign;
    panelOpen: boolean;
    togglePanel: () => void;
    exit: () => void;
    theme: 'dark' | 'light';
    toggleTheme: () => void;
    members: CampaignMember[];
    viewAs: CampaignMember | null;
    canViewAs: boolean;
    changeView: (userId: string | null) => void;
  } = $props();
</script>

<header class="workspace-header">
  <div class="panel-toggle">
    <button
      class="icon-button"
      class:active={panelOpen}
      aria-label={t('workspace.togglePanel')}
      use:tooltip={t('workspace.togglePanel')}
      onclick={togglePanel}><Icon name="panel" size={17} /></button
    >
  </div>
  <button class="campaign-title" onclick={exit} use:tooltip={t('workspace.backToCampaigns')}
    ><Icon name="back" size={14} /><span
      ><small>{campaign.system}</small><b class="serif-title">{campaign.title}</b></span
    ></button
  >
  <div class="header-actions">
    {#if canViewAs}
      <label class:viewing={viewAs} class="view-as">
        <span>{t(viewAs ? 'workspace.viewingAs' : 'workspace.view')}</span>
        <select
          aria-label={t('workspace.viewAs')}
          value={viewAs?.id ?? ''}
          onchange={(event) => changeView(event.currentTarget.value || null)}
        >
          <option value="">{t('common.gameMaster')}</option>
          {#each members.filter((member) => member.role === 'player') as member}
            <option value={member.id}>{member.name}</option>
          {/each}
        </select>
      </label>
    {/if}
    <LanguageSwitcher compact />
    <button
      class="theme"
      onclick={toggleTheme}
      aria-label={t('workspace.toggleTheme')}
      use:tooltip={t('workspace.toggleTheme')}>{theme === 'dark' ? '☾' : '☀'}</button
    ><span class="role">{t(campaign.role === 'gm' ? 'common.gameMaster' : 'common.player')}</span>
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
  .panel-toggle {
    width: 52px;
    display: grid;
    place-items: center;
  }
  .panel-toggle .active {
    color: var(--ember);
  }
  .campaign-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100% - 250px);
    display: flex;
    align-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: center;
  }
  .campaign-title > :global(svg) {
    color: var(--text-3);
    flex: 0 0 auto;
  }
  .campaign-title span {
    min-width: 0;
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
  .header-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 12px;
  }
  .view-as {
    height: 34px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 4px 0 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    color: var(--text-3);
    background: var(--bg-2);
  }
  .view-as.viewing {
    border-color: color-mix(in srgb, var(--ember) 55%, var(--line));
    background: var(--ember-soft);
  }
  .view-as span {
    font: 8px var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .view-as select {
    max-width: 110px;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text-2);
    font-size: 11px;
  }
  .theme {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text-3);
  }
  .theme:hover {
    background: var(--bg-3);
    color: var(--text);
  }
  .role {
    padding: 5px 8px;
    border: 1px solid var(--line);
    border-radius: 7px;
    color: var(--text-3);
    font: 9px var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  @media (max-width: 600px) {
    .campaign-title {
      max-width: calc(100% - 130px);
    }
    .header-actions .role {
      display: none;
    }
    .header-actions :global(label.compact) {
      display: none;
    }
    .view-as span {
      display: none;
    }
    .view-as select {
      max-width: 82px;
    }
  }
</style>
