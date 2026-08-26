<script lang="ts">
  import { onMount } from 'svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { searchNodes } from '$lib/domain/search';
  import type { CampaignMember, NodeType, Visibility, WorldNode } from '$lib/types';
  import { nodeTypeLabel, t } from '$lib/i18n/index.svelte';
  let {
    initialTitle = '',
    initialX = 0,
    initialY = 0,
    nodes,
    types,
    members,
    close,
    create
  }: {
    initialTitle?: string;
    initialX?: number;
    initialY?: number;
    nodes: WorldNode[];
    types: NodeType[];
    members: CampaignMember[];
    close: () => void;
    create: (value: {
      title: string;
      type: string;
      size: 's' | 'm' | 'l';
      summary: string;
      revealed: boolean;
      visibility: Visibility;
      visibleWith: string[];
      x: number;
      y: number;
      connectTo: string[];
    }) => Promise<string>;
  } = $props();
  // svelte-ignore state_referenced_locally -- modal form state is intentionally initialized once
  let title = $state(initialTitle);
  let titleInput = $state<HTMLInputElement>();
  // svelte-ignore state_referenced_locally -- available types are stable for this modal instance
  let type = $state(types.find((item) => item.key !== 'session')?.key ?? 'lore');
  let summary = $state('');
  let visibility = $state<Visibility>('all');
  let revealed = $state(true);
  let visibleWith = $state<string[]>([]);
  let query = $state('');
  let connectTo = $state<string[]>([]);
  let busy = $state(false);
  let message = $state('');
  let results = $derived(searchNodes(nodes, query, { limit: 6, exclude: new Set(connectTo) }));
  let selectedNodes = $derived(
    connectTo.map((id) => nodes.find((node) => node.id === id)).filter(Boolean)
  );
  onMount(() => titleInput?.focus());
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    message = '';
    try {
      await create({
        title,
        type,
        size: ['item', 'lore', 'deity'].includes(type)
          ? 's'
          : ['region', 'faction'].includes(type)
            ? 'l'
            : 'm',
        summary,
        revealed,
        visibility,
        visibleWith,
        x: initialX,
        y: initialY,
        connectTo
      });
      close();
    } catch (cause) {
      message = cause instanceof Error ? cause.message : t('errors.createFailed');
    } finally {
      busy = false;
    }
  }
</script>

<Modal title={t('createNode.title')} eyebrow={t('createNode.eyebrow')} {close}>
  <form onsubmit={submit}>
    <input
      bind:this={titleInput}
      class="field title"
      bind:value={title}
      placeholder={t('createNode.name')}
      required
      maxlength="160"
    />
    <div class="types">
      {#each types.filter((item) => item.key !== 'session') as item}<button
          type="button"
          class:active={type === item.key}
          style:--type-color={item.colorDark}
          onclick={() => (type = item.key)}><span></span>{nodeTypeLabel(item, 'singular')}</button
        >{/each}
    </div>
    <input
      class="field"
      bind:value={summary}
      placeholder={t('node.summaryPlaceholder')}
      maxlength="500"
    />
    <div class="connect">
      <div class="eyebrow">{t('createNode.connect')}</div>
      {#if selectedNodes.length}<div class="chips">
          {#each selectedNodes as node}<button
              type="button"
              onclick={() => (connectTo = connectTo.filter((id) => id !== node!.id))}
              >{node!.title} ×</button
            >{/each}
        </div>{/if}<input
        class="field"
        bind:value={query}
        placeholder={t('createNode.searchMultiple')}
      />{#if query}<div class="results">
          {#each results as node}<button
              type="button"
              onclick={() => {
                connectTo = [...connectTo, node.id];
                query = '';
              }}
              ><span style:background={types.find((item) => item.key === node.type)?.colorDark}
              ></span>{node.title}</button
            >{/each}
        </div>{/if}
    </div>
    <div class="visibility">
      <div class="eyebrow">{t('createNode.visible')}</div>
      <div class="options">
        <button
          type="button"
          class:active={revealed && visibility === 'all'}
          onclick={() => {
            revealed = true;
            visibility = 'all';
          }}>{t('createNode.everyone')}</button
        ><button
          type="button"
          class:active={revealed && visibility === 'sel'}
          onclick={() => {
            revealed = true;
            visibility = 'sel';
          }}>{t('createNode.selected')}</button
        ><button
          type="button"
          class:active={!revealed || visibility === 'me'}
          onclick={() => {
            revealed = false;
            visibility = 'me';
          }}>{t('createNode.onlyMe')}</button
        >
      </div>
      {#if visibility === 'sel'}<div class="players">
          {#each members.filter((member) => member.role === 'player') as member}<button
              type="button"
              class:active={visibleWith.includes(member.id)}
              onclick={() =>
                (visibleWith = visibleWith.includes(member.id)
                  ? visibleWith.filter((id) => id !== member.id)
                  : [...visibleWith, member.id])}
              ><span style:background={member.color}></span>{member.name}</button
            >{/each}
        </div>{/if}
    </div>
    {#if message}<div class="error">{message}</div>{/if}
    <div class="actions">
      <button type="button" class="ghost-button" onclick={close}>{t('common.cancel')}</button
      ><button class="primary-button" disabled={busy}
        >{busy ? t('createNode.adding') : t('createNode.add')}</button
      >
    </div>
  </form>
</Modal>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 11px;
  }
  .title {
    font: 19px var(--font-serif);
  }
  .types {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-height: 114px;
    overflow-y: auto;
  }
  .types button,
  .options button,
  .players button {
    min-height: 30px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: transparent;
    color: var(--text-3);
    font-size: 11.5px;
  }
  .types button span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--type-color);
  }
  .types button.active {
    border-color: var(--type-color);
    color: var(--text);
  }
  .connect,
  .visibility {
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  .connect .eyebrow,
  .visibility .eyebrow {
    margin-bottom: 7px;
  }
  .connect .field {
    min-height: 34px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 6px;
  }
  .chips button {
    min-height: 26px;
    border: 0;
    border-radius: 6px;
    background: var(--bg-3);
    color: var(--text-2);
    font-size: 11px;
  }
  .results {
    display: flex;
    flex-direction: column;
    margin-top: 4px;
  }
  .results button {
    min-height: 30px;
    display: flex;
    align-items: center;
    gap: 7px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text-2);
    text-align: left;
  }
  .results button:hover {
    background: var(--bg-3);
  }
  .results span,
  .players span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }
  .options button {
    justify-content: center;
  }
  .options button.active {
    border-color: var(--ember);
    background: var(--ember-soft);
    color: var(--ember);
  }
  .players {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 7px;
  }
  .players button.active {
    border-color: var(--ember);
    color: var(--text);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
  .error {
    font-size: 12px;
    color: var(--danger);
  }
</style>
