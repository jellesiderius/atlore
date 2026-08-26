<script lang="ts">
  import type { NodeType, SessionEntry, WorldNode } from '$lib/types';
  import { nodeTypeLabel, t } from '$lib/i18n/index.svelte';

  let {
    nodes,
    sessions,
    types,
    canPurge,
    restoreNode,
    purgeNode,
    restoreSession,
    purgeSession
  }: {
    nodes: WorldNode[];
    sessions: SessionEntry[];
    types: NodeType[];
    canPurge: boolean;
    restoreNode: (id: string) => void;
    purgeNode: (id: string) => void;
    restoreSession: (id: string) => void;
    purgeSession: (id: string) => void;
  } = $props();

  let trashedNodes = $derived(nodes.filter((node) => node.trashedAt));
  let trashedSessions = $derived(sessions.filter((session) => session.trashedAt));
  let total = $derived(trashedNodes.length + trashedSessions.length);
  let typeMap = $derived(new Map(types.map((type) => [type.key, type])));
</script>

<div class="eyebrow section-label">{t('trash.title')} · {total}</div>
{#if !total}
  <div class="empty">{t('trash.emptyLong')}</div>
{:else}
  <div class="trash-list">
    {#each trashedNodes as node}
      <div class="trash-row">
        <span class="dot" style:background={typeMap.get(node.type)?.colorDark}></span>
        <span class="title"
          ><b>{node.title}</b><small
            >{typeMap.get(node.type)
              ? nodeTypeLabel(typeMap.get(node.type)!, 'singular')
              : ''}</small
          ></span
        >
        <button onclick={() => restoreNode(node.id)}>{t('common.restore')}</button>
        {#if canPurge}
          <button
            class="purge"
            aria-label={t('trash.permanentlyDelete')}
            onclick={() =>
              confirm(t('trash.confirmNode', { title: node.title })) && purgeNode(node.id)}
            >×</button
          >
        {/if}
      </div>
    {/each}
    {#each trashedSessions as session}
      <div class="trash-row">
        <span class="dot session"></span>
        <span class="title"
          ><b>{session.title}</b><small>{t('session.sequence', { number: session.sequence })}</small
          ></span
        >
        <button onclick={() => restoreSession(session.id)}>{t('common.restore')}</button>
        {#if canPurge}
          <button
            class="purge"
            aria-label={t('trash.permanentlyDelete')}
            onclick={() =>
              confirm(t('trash.confirmSession', { title: session.title })) &&
              purgeSession(session.id)}>×</button
          >
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .section-label {
    margin: 3px 4px 9px;
  }
  .empty {
    padding: 10px;
    margin-bottom: 16px;
    border: 1px dashed var(--line);
    border-radius: 9px;
    color: var(--text-3);
    font-size: 12px;
  }
  .trash-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 18px;
  }
  .trash-row {
    min-height: 42px;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 7px;
    border-radius: 8px;
    background: var(--bg-3);
  }
  .dot {
    width: 6px;
    height: 6px;
    flex: 0 0 auto;
    border-radius: 50%;
  }
  .dot.session {
    background: var(--ember);
  }
  .title {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .title b {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 400;
  }
  .title small {
    color: var(--text-3);
    font: 8.5px var(--font-mono);
    text-transform: uppercase;
  }
  button {
    border: 0;
    background: transparent;
    color: var(--ember);
    font-size: 11px;
  }
  button.purge {
    color: var(--text-3);
    font-size: 17px;
  }
</style>
