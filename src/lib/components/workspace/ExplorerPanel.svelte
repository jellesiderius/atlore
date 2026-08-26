<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  import { tooltip } from '$lib/actions/tooltip';
  import NodeTypeManager from '$lib/components/workspace/NodeTypeManager.svelte';
  import TrashManager from '$lib/components/workspace/TrashManager.svelte';
  import { searchNodes } from '$lib/domain/search';
  import type { ForceSettings } from '$lib/components/graph/GraphCanvas.svelte';
  import type { CampaignMember, NodeType, PanelName, SessionEntry, WorldNode } from '$lib/types';
  import { nodeTypeLabel, t } from '$lib/i18n/index.svelte';
  let {
    open,
    panel,
    nodes,
    sessions,
    types,
    recent,
    selected,
    settings,
    theme,
    members,
    viewAs,
    canViewAs,
    canCreate,
    canManage,
    canPurge,
    onPanel,
    onNode,
    onContext,
    onNew,
    onRestore,
    onPurge,
    onRestoreSession,
    onPurgeSession,
    onAddType,
    onRemoveType,
    onForceSettings,
    onCampaignSettings,
    onReflow,
    onTheme,
    onViewAs,
    onClose
  }: {
    open: boolean;
    panel: PanelName;
    nodes: WorldNode[];
    sessions: SessionEntry[];
    types: NodeType[];
    recent: string[];
    selected: string | null;
    settings: ForceSettings;
    theme: 'dark' | 'light';
    members: CampaignMember[];
    viewAs: CampaignMember | null;
    canViewAs: boolean;
    canCreate: boolean;
    canManage: boolean;
    canPurge: boolean;
    onPanel: (panel: PanelName) => void;
    onNode: (id: string) => void;
    onContext: (id: string, x: number, y: number) => void;
    onNew: () => void;
    onRestore: (id: string) => void;
    onPurge: (id: string) => void;
    onRestoreSession: (id: string) => void;
    onPurgeSession: (id: string) => void;
    onAddType: (value: {
      key: string;
      pluralName: string;
      singularName: string;
      colorDark: string;
      colorLight: string;
    }) => Promise<void>;
    onRemoveType: (key: string) => Promise<void>;
    onForceSettings: (settings: ForceSettings) => void;
    onCampaignSettings: () => void;
    onReflow: () => void;
    onTheme: () => void;
    onViewAs: (userId: string | null) => void;
    onClose: () => void;
  } = $props();
  let query = $state('');
  let searchInput = $state<HTMLInputElement>();
  let expanded = $state(new Set<string>(['character', 'npc', 'location', 'quest']));
  let searchResults = $derived(query ? searchNodes(nodes, query, { limit: 100 }) : []);
  let activeNodes = $derived(nodes.filter((node) => !node.trashedAt));
  let typeMap = $derived(new Map(types.map((type) => [type.key, type])));
  $effect(() => {
    if (panel === 'search') setTimeout(() => searchInput?.focus());
  });
  const tabs: [PanelName, string, string][] = [
    ['explorer', 'explorer.explorer', 'session'],
    ['recent', 'explorer.recent', 'clock'],
    ['search', 'explorer.search', 'search'],
    ['settings', 'explorer.settings', 'settings']
  ];
  const forceControls: {
    key: keyof ForceSettings;
    label: string;
    min: number;
    max: number;
    step: number;
    digits: number;
  }[] = [
    { key: 'repel', label: 'explorer.repel', min: 400, max: 4200, step: 50, digits: 0 },
    { key: 'distance', label: 'explorer.linkLength', min: 40, max: 240, step: 2, digits: 0 },
    { key: 'grouping', label: 'explorer.grouping', min: 0, max: 1.4, step: 0.02, digits: 2 },
    { key: 'gravity', label: 'explorer.center', min: 0, max: 1, step: 0.01, digits: 2 }
  ];
  function toggle(key: string) {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expanded = next;
  }
  function drag(event: DragEvent, id: string) {
    event.dataTransfer?.setData('application/x-atlore-node', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copyMove';
  }
  function typeColor(type?: NodeType) {
    return (theme === 'light' ? type?.colorLight : type?.colorDark) ?? 'var(--text-3)';
  }
</script>

<aside class:open aria-label={t('explorer.label')}>
  <div class="panel-tabs">
    {#each tabs as [key, label, icon]}<button
        class="icon-button"
        class:active={panel === key}
        aria-label={t(label)}
        use:tooltip={t(label)}
        onclick={() => onPanel(key)}><Icon name={icon} size={17} /></button
      >{/each}<span></span>{#if canCreate}<button
        class="icon-button add"
        aria-label={t('explorer.newNode')}
        use:tooltip={t('explorer.newNode')}
        onclick={onNew}><Icon name="plus" size={17} /></button
      >{/if}<button
      class="icon-button close"
      aria-label={t('explorer.closePanel')}
      use:tooltip={t('explorer.closePanel')}
      onclick={onClose}><Icon name="close" size={15} /></button
    >
  </div>
  <div class="panel-body">
    {#if panel === 'explorer'}
      {#each types.filter((type) => type.key !== 'session') as type}{@const items = activeNodes
          .filter((node) => node.type === type.key)
          .sort((a, b) => a.title.localeCompare(b.title, 'nl'))}{#if items.length}<section
            class="group"
          >
            <button class="group-head" onclick={() => toggle(type.key)}
              ><i class:open={expanded.has(type.key)}>▶</i><span style:background={typeColor(type)}
              ></span><b>{nodeTypeLabel(type)}</b><small>{items.length}</small></button
            >{#if expanded.has(type.key)}<div class="group-items">
                {#each items.slice(0, items.length > 150 ? 40 : items.length) as node}<button
                    class:active={selected === node.id}
                    class:hidden={!node.revealed}
                    draggable="true"
                    ondragstart={(event) => drag(event, node.id)}
                    onclick={() => onNode(node.id)}
                    oncontextmenu={(event) => {
                      event.preventDefault();
                      onContext(node.id, event.clientX, event.clientY);
                    }}
                    ><span style:background={typeColor(type)}></span><b>{node.title}</b
                    >{#if !node.revealed}<em>◌</em>{/if}</button
                  >{/each}{#if items.length > 150}<div class="more">
                    {t('explorer.more', { count: items.length - 40 })}
                  </div>{/if}
              </div>{/if}
          </section>{/if}{/each}
    {:else if panel === 'recent'}
      <div class="rows">
        {#each recent
          .map((id) => activeNodes.find((node) => node.id === id))
          .filter(Boolean) as node}<button
            onclick={() => onNode(node!.id)}
            oncontextmenu={(event) => {
              event.preventDefault();
              onContext(node!.id, event.clientX, event.clientY);
            }}
            ><span style:background={typeColor(typeMap.get(node!.type))}></span><b>{node!.title}</b
            ><small
              >{typeMap.get(node!.type)
                ? nodeTypeLabel(typeMap.get(node!.type)!, 'singular')
                : ''}</small
            ></button
          >{/each}{#if !recent.length}<div class="empty">{t('explorer.nothingOpened')}</div>{/if}
      </div>
    {:else if panel === 'search'}
      <input
        bind:this={searchInput}
        class="field search"
        bind:value={query}
        placeholder={t('explorer.searchPlaceholder')}
      />
      <div class="rows">
        {#each searchResults as node}<button
            onclick={() => onNode(node.id)}
            oncontextmenu={(event) => {
              event.preventDefault();
              onContext(node.id, event.clientX, event.clientY);
            }}
            ><span style:background={typeColor(typeMap.get(node.type))}></span><b>{node.title}</b
            ><small
              >{typeMap.get(node.type)
                ? nodeTypeLabel(typeMap.get(node.type)!, 'singular')
                : ''}</small
            ></button
          >{/each}{#if query && !searchResults.length}<div class="empty">
            {t('explorer.nothingFound')}
          </div>{/if}
      </div>
    {:else}
      <TrashManager
        {nodes}
        {sessions}
        {types}
        {canPurge}
        restoreNode={onRestore}
        purgeNode={onPurge}
        restoreSession={onRestoreSession}
        purgeSession={onPurgeSession}
      />
      <div class="eyebrow section-label">{t('explorer.forces')}</div>
      {#each forceControls as item}<label class="slider"
          ><span>{t(item.label)}<b>{settings[item.key].toFixed(item.digits)}</b></span><input
            type="range"
            min={item.min}
            max={item.max}
            step={item.step}
            value={settings[item.key]}
            oninput={(event) =>
              onForceSettings({ ...settings, [item.key]: Number(event.currentTarget.value) })}
          /></label
        >{/each}<button class="ghost-button reflow" onclick={onReflow}
        >{t('explorer.reflow')}</button
      >
      <div class="eyebrow section-label">{t('explorer.display')}</div>
      {#if canViewAs}<label class:viewing={viewAs} class="view-as"
          ><span>{t(viewAs ? 'workspace.viewingAs' : 'workspace.view')}</span><select
            aria-label={t('workspace.viewAs')}
            value={viewAs?.id ?? ''}
            onchange={(event) => onViewAs(event.currentTarget.value || null)}
            ><option value="">{t('common.gameMaster')}</option
            >{#each members.filter((member) => member.role === 'player') as member}<option
                value={member.id}>{member.name}</option
              >{/each}</select
          ></label
        >{/if}
      <button class="setting-row" onclick={onTheme}
        ><span>{t('explorer.lightTheme')}</span><span class:on={theme === 'light'} class="switch"
          ><i></i></span
        ></button
      >{#if canManage}<button class="setting-row" onclick={onCampaignSettings}
          ><span>{t('explorer.campaignSettings')}</span><Icon name="settings" size={15} /></button
        >{/if}
      <NodeTypeManager {types} {canManage} add={onAddType} remove={onRemoveType} />
    {/if}
  </div>
</aside>

<style>
  aside {
    width: var(--panel-width);
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid var(--line);
    background: var(--canvas);
    transition:
      width 0.2s var(--ease-atlore),
      transform 0.2s var(--ease-atlore);
    overflow: hidden;
    z-index: 29;
  }
  aside:not(.open) {
    width: 0;
    border-right: 0;
  }
  .panel-tabs {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 8px;
    border-bottom: 1px solid var(--line);
    width: var(--panel-width);
  }
  .panel-tabs .active {
    background: var(--bg-3);
    color: var(--text);
  }
  .panel-tabs > span {
    flex: 1;
  }
  .panel-tabs .add {
    border-color: var(--line);
    color: var(--ember);
    width: 34px;
    height: 34px;
  }
  .panel-tabs .close {
    display: none;
  }
  .panel-body {
    width: var(--panel-width);
    flex: 1;
    overflow-y: auto;
    padding: 8px 8px 80px;
  }
  .group {
    margin-bottom: 3px;
  }
  .group-head {
    width: 100%;
    min-height: 32px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 6px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text);
    text-align: left;
  }
  .group-head i {
    width: 9px;
    font-size: 8px;
    color: var(--text-3);
    font-style: normal;
    transition: transform 0.14s;
  }
  .group-head i.open {
    transform: rotate(90deg);
  }
  .group-head > span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .group-head b {
    flex: 1;
    font-size: 12.5px;
    font-weight: 500;
  }
  .group-head small {
    min-width: 20px;
    padding: 1px 5px;
    border-radius: 5px;
    background: var(--bg-3);
    font: 10px var(--font-mono);
    color: var(--text-3);
    text-align: center;
  }
  .group-items {
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .group-items > button,
  .rows > button {
    width: 100%;
    min-height: 30px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text-2);
    text-align: left;
  }
  .group-items > button:hover,
  .group-items > button.active,
  .rows > button:hover {
    background: var(--bg-3);
    color: var(--text);
  }
  .group-items > button.hidden:not(.active):not(:hover) {
    color: var(--text-3);
  }
  .group-items > button.hidden > span {
    opacity: 0.4;
    outline: 1px dashed currentColor;
    outline-offset: 2px;
  }
  .group-items button > span,
  .rows button > span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex: 0 0 auto;
  }
  .group-items button > b,
  .rows button > b {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 400;
  }
  .group-items button > em {
    font-size: 9px;
    color: var(--ember);
    font-style: normal;
  }
  .more {
    padding: 6px 8px;
    font: 10px var(--font-mono);
    color: var(--text-3);
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .rows button {
    min-height: 32px;
  }
  .rows small {
    font: 9.5px var(--font-mono);
    color: var(--text-3);
  }
  .search {
    min-height: 36px;
    margin-bottom: 8px;
    font-size: 13px;
  }
  .empty {
    padding: 12px 8px;
    font-size: 12.5px;
    color: var(--text-3);
  }
  .section-label {
    margin: 3px 4px 9px;
  }
  .slider {
    display: block;
    margin: 0 4px 9px;
  }
  .slider > span {
    display: flex;
    justify-content: space-between;
    color: var(--text-2);
    font-size: 12px;
  }
  .slider b {
    font: 11px var(--font-mono);
    color: var(--text-3);
  }
  .slider input {
    width: 100%;
    accent-color: var(--ember);
  }
  .reflow {
    width: 100%;
    min-height: 36px;
    margin: 4px 0 16px;
    font-size: 12px;
  }
  .setting-row {
    width: 100%;
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 9px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: transparent;
    color: var(--text-2);
    font-size: 12px;
    margin-bottom: 4px;
  }
  .view-as {
    min-height: 42px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 5px;
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    color: var(--text-2);
    font-size: 11.5px;
  }
  .view-as.viewing {
    border-color: color-mix(in srgb, var(--ember) 55%, var(--line));
    background: var(--ember-soft);
  }
  .view-as select {
    max-width: 125px;
    min-height: 30px;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text-2);
    font-size: 11px;
  }
  .switch {
    position: relative;
    width: 28px;
    height: 16px;
    border-radius: 9px;
    background: var(--line-2);
  }
  .switch i {
    position: absolute;
    left: 2px;
    top: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--text-3);
    transition: left 0.16s;
  }
  .switch.on {
    background: var(--ember);
  }
  .switch.on i {
    left: 14px;
    background: #1a1206;
  }
  @media (max-width: 859px) {
    aside {
      position: fixed;
      left: 0;
      top: calc(52px + env(safe-area-inset-top));
      bottom: calc(58px + env(safe-area-inset-bottom));
      width: var(--panel-width) !important;
      box-shadow: 18px 0 50px rgba(0, 0, 0, 0.45);
      transform: translateX(-105%);
      z-index: 50;
    }
    aside.open {
      transform: none;
    }
    .panel-tabs .close {
      display: inline-flex;
    }
  }
</style>
