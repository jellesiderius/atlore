<script lang="ts">
  import { onMount } from 'svelte';
  import { searchNodes } from '$lib/domain/search';
  import type { NodeType, WorldNode } from '$lib/types';
  import { nodeTypeLabel, t } from '$lib/i18n/index.svelte';
  let {
    nodes,
    types,
    close,
    open
  }: { nodes: WorldNode[]; types: NodeType[]; close: () => void; open: (id: string) => void } =
    $props();
  let query = $state('');
  let index = $state(0);
  let input: HTMLInputElement;
  let results = $derived(searchNodes(nodes, query, { limit: 10 }));
  onMount(() => input.focus());
  function key(event: KeyboardEvent) {
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      index = (index + 1) % Math.max(1, results.length);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      index = (index + results.length - 1) % Math.max(1, results.length);
    }
    if (event.key === 'Enter' && results[index]) open(results[index].id);
  }
</script>

<div
  class="backdrop"
  role="presentation"
  onclick={(event) => event.currentTarget === event.target && close()}
  onkeydown={(event) => event.key === 'Escape' && close()}
>
  <section>
    <div class="search">
      <span>⌘K</span><input
        bind:this={input}
        bind:value={query}
        onkeydown={key}
        placeholder={t('search.worldPlaceholder')}
      />
    </div>
    <div class="results">
      {#each results as node, i}<button
          class:active={index === i}
          onmouseenter={() => (index = i)}
          onclick={() => open(node.id)}
          ><span style:background={types.find((type) => type.key === node.type)?.colorDark}
          ></span><b>{node.title}</b><small
            >{types.find((type) => type.key === node.type)
              ? nodeTypeLabel(
                  types.find((type) => type.key === node.type)!,
                  'singular'
                )
              : ''}</small
          ></button
        >{/each}{#if query && !results.length}<div>
          {t('explorer.nothingFound')}
        </div>{/if}{#if !query}<div>
          {t('search.prompt')}
        </div>{/if}
    </div>
  </section>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 15vh 16px;
    background: rgba(6, 8, 11, 0.58);
    backdrop-filter: blur(3px);
  }
  section {
    width: min(570px, 100%);
    border: 1px solid var(--line-2);
    border-radius: 13px;
    background: var(--bg-2);
    box-shadow: 0 28px 80px rgba(0, 0, 0, 0.6);
    overflow: hidden;
    animation: lift-in 0.16s var(--ease-atlore);
  }
  .search {
    height: 56px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    border-bottom: 1px solid var(--line);
  }
  .search > span {
    padding: 3px 6px;
    border: 1px solid var(--line);
    border-radius: 5px;
    font: 9px var(--font-mono);
    color: var(--text-3);
  }
  input {
    flex: 1;
    border: 0;
    outline: 0;
    background: transparent;
    font-size: 16px;
  }
  .results {
    max-height: 350px;
    overflow: auto;
    padding: 5px;
  }
  .results button {
    width: 100%;
    min-height: 40px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text-2);
    text-align: left;
  }
  .results button.active {
    background: var(--bg-3);
    color: var(--text);
  }
  .results button > span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .results b {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
  }
  .results small {
    font: 9px var(--font-mono);
    color: var(--text-3);
  }
  .results > div {
    padding: 14px;
    color: var(--text-3);
    font-size: 12.5px;
  }
</style>
